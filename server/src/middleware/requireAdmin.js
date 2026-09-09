import crypto from 'crypto';

import { Session } from '../models/Session.js';
import { Admin } from '../models/Admin.js';

const hashToken = (token) => {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
};

export const requireAdmin = async (req, res, next) => {
  try {
    const sessionToken = req.cookies.orderit_session;

    if (!sessionToken) {
      return res.status(401).json({
        message: 'Authentication required.'
      });
    }

    const tokenHash = hashToken(sessionToken);

    const session = await Session.findOne({
      where: {
        tokenHash
      },
      include: {
        model: Admin,
        attributes: ['id', 'username']
      }
    });

    if (!session) {
      return res.status(401).json({
        message: 'Invalid session.'
      });
    }

    if (new Date(session.expiresAt) < new Date()) {
      await session.destroy();

      res.clearCookie('orderit_session', {
        path: '/'
      });

      return res.status(401).json({
        message: 'Session expired.'
      });
    }

    req.admin = session.Admin;

    next();
  } catch (error) {
    console.error('Authentication error:', error);

    return res.status(500).json({
      message: 'Internal server error.'
    });
  }
};