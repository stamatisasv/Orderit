import express from 'express';

import { Menu } from '../models/Menu.js';
import { Category } from '../models/Category.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

const router = express.Router();

router.use(requireAdmin);

router.get('/:menuId/categories', async (req, res) => {
  try {
    const menuId = Number(req.params.menuId);

    const menu = await Menu.findByPk(menuId);

    if (!menu) {
      return res.status(404).json({
        message: 'Menu not found.'
      });
    }

    const categories = await Category.findAll({
      where: { menuId },
      order: [
        ['sortOrder', 'ASC'],
        ['createdAt', 'ASC']
      ]
    });

    return res.status(200).json({
      categories
    });
  } catch (error) {
    console.error('Get categories error:', error);

    return res.status(500).json({
      message: 'Internal server error.'
    });
  }
});

router.post('/:menuId/categories', async (req, res) => {
  try {
    const menuId = Number(req.params.menuId);
    const { name, description } = req.body;

    const menu = await Menu.findByPk(menuId);

    if (!menu) {
      return res.status(404).json({
        message: 'Menu not found.'
      });
    }

    if (
      typeof name !== 'string' ||
      name.trim().length < 2 ||
      name.trim().length > 100
    ) {
      return res.status(400).json({
        message: 'Category name must be between 2 and 100 characters.'
      });
    }

    const maxSortOrder = await Category.max('sortOrder', {
      where: { menuId }
    });

    const category = await Category.create({
      menuId,
      name: name.trim(),
      description:
        typeof description === 'string' && description.trim()
          ? description.trim()
          : null,
      sortOrder: (maxSortOrder ?? 0) + 1
    });

    return res.status(201).json({
      message: 'Category created successfully.',
      category
    });
  } catch (error) {
    console.error('Create category error:', error);

    return res.status(500).json({
      message: 'Internal server error.'
    });
  }
});

router.put('/:menuId/categories/:categoryId', async (req, res) => {
  try {
    const menuId = Number(req.params.menuId);
    const categoryId = Number(req.params.categoryId);
    const { name, description } = req.body;

    const category = await Category.findOne({
      where: {
        id: categoryId,
        menuId
      }
    });

    if (!category) {
      return res.status(404).json({
        message: 'Category not found.'
      });
    }

    if (
      typeof name !== 'string' ||
      name.trim().length < 2 ||
      name.trim().length > 100
    ) {
      return res.status(400).json({
        message: 'Category name must be between 2 and 100 characters.'
      });
    }

    category.name = name.trim();
    category.description =
      typeof description === 'string' && description.trim()
        ? description.trim()
        : null;

    await category.save();

    return res.status(200).json({
      message: 'Category updated successfully.',
      category
    });
  } catch (error) {
    console.error('Update category error:', error);

    return res.status(500).json({
      message: 'Internal server error.'
    });
  }
});

router.delete('/:menuId/categories/:categoryId', async (req, res) => {
  try {
    const menuId = Number(req.params.menuId);
    const categoryId = Number(req.params.categoryId);

    const category = await Category.findOne({
      where: {
        id: categoryId,
        menuId
      }
    });

    if (!category) {
      return res.status(404).json({
        message: 'Category not found.'
      });
    }

    await category.destroy();

    return res.status(200).json({
      message: 'Category deleted successfully.'
    });
  } catch (error) {
    console.error('Delete category error:', error);

    return res.status(500).json({
      message: 'Internal server error.'
    });
  }
});

export default router;