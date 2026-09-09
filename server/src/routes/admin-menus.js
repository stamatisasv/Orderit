import express from 'express';

import { Menu } from '../models/Menu.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

const router = express.Router();

router.use(requireAdmin);

router.get('/', async (req, res) => {
  try {
    const menus = await Menu.findAll({
      order: [['createdAt', 'DESC']]
    });

    return res.status(200).json({
      menus
    });
  } catch (error) {
    console.error('Get menus error:', error);

    return res.status(500).json({
      message: 'Internal server error.'
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body;

    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        message: 'Menu name is required.'
      });
    }

    const menu = await Menu.create({
      name: name.trim(),
      description:
        typeof description === 'string' && description.trim()
          ? description.trim()
          : null
    });

    return res.status(201).json({
      message: 'Menu created successfully.',
      menu
    });
  } catch (error) {
    console.error('Create menu error:', error);

    return res.status(500).json({
      message: 'Internal server error.'
    });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const menu = await Menu.findByPk(id);

    if (!menu) {
      return res.status(404).json({
        message: 'Menu not found.'
      });
    }

    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        message: 'Menu name is required.'
      });
    }

    menu.name = name.trim();
    menu.description =
      typeof description === 'string' && description.trim()
        ? description.trim()
        : null;

    await menu.save();

    return res.status(200).json({
      message: 'Menu updated successfully.',
      menu
    });
  } catch (error) {
    console.error('Update menu error:', error);

    return res.status(500).json({
      message: 'Internal server error.'
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const menu = await Menu.findByPk(id);

    if (!menu) {
      return res.status(404).json({
        message: 'Menu not found.'
      });
    }

    await menu.destroy();

    return res.status(200).json({
      message: 'Menu deleted successfully.'
    });
  } catch (error) {
    console.error('Delete menu error:', error);

    return res.status(500).json({
      message: 'Internal server error.'
    });
  }
});

router.patch('/:id/activate', async (req, res) => {
  try {
    const { id } = req.params;

    const menu = await Menu.findByPk(id);

    if (!menu) {
      return res.status(404).json({
        message: 'Menu not found.'
      });
    }

    await Menu.update(
      {
        isActive: false
      },
      {
        where: {}
      }
    );

    menu.isActive = true;
    await menu.save();

    return res.status(200).json({
      message: 'Menu activated successfully.',
      menu
    });
  } catch (error) {
    console.error('Activate menu error:', error);

    return res.status(500).json({
      message: 'Internal server error.'
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const menu = await Menu.findByPk(req.params.id);

    if (!menu) {
      return res.status(404).json({
        message: 'Menu not found.'
      });
    }

    return res.status(200).json({
      menu
    });
  } catch (error) {
    console.error('Get menu error:', error);

    return res.status(500).json({
      message: 'Internal server error.'
    });
  }
});

export default router;  