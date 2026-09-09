import express from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { rateLimit } from 'express-rate-limit';
import { requireAdmin } from '../middleware/requireAdmin.js';

import { Admin } from '../models/Admin.js';
import { Session } from '../models/Session.js';

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false
});

const hashToken = (token) => {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
};

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    
    if (
      typeof username !== 'string' ||
      typeof password !== 'string' ||
      !username.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: 'Username and password are required.'
      });
    }

    const normalizedUsername = username.trim().toLowerCase();

    const admin = await Admin.findOne({
      where: {
        username: normalizedUsername
      }
    });

    if (!admin) {
      return res.status(401).json({
        message: 'Invalid username or password.'
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      admin.passwordHash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        message: 'Invalid username or password.'
      });
    }

    const sessionToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(sessionToken);

    const sessionDays = Number(process.env.SESSION_DAYS || 7);

    const expiresAt = new Date(
      Date.now() + sessionDays * 24 * 60 * 60 * 1000
    );

    await Session.create({
      tokenHash,
      adminId: admin.id,
      expiresAt
    });

    res.cookie('orderit_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: sessionDays * 24 * 60 * 60 * 1000,
      path: '/'
    });

    return res.status(200).json({
      message: 'Login successful.',
      admin: {
        id: admin.id,
        username: admin.username
      }
    });
  } catch (error) {
    console.error('Login error:', error);

    return res.status(500).json({
      message: 'Internal server error.'
    });
  }
});

router.get('/me', requireAdmin, (req, res) => {
  return res.status(200).json({
    admin: {
      id: req.admin.id,
      username: req.admin.username
    }
  });
});

router.post('/logout', async (req, res) => {
  try {
    const sessionToken = req.cookies.orderit_session;

    if (sessionToken) {
      const tokenHash = hashToken(sessionToken);

      await Session.destroy({
        where: {
          tokenHash
        }
      });
    }

    res.clearCookie('orderit_session', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });

    return res.status(200).json({
      message: 'Logout successful.'
    });
  } catch (error) {
    console.error('Logout error:', error);

    return res.status(500).json({
      message: 'Internal server error.'
    });
  }
});

export default router;