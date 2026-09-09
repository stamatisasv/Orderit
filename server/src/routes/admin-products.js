import express from 'express';

import { Category } from '../models/Category.js';
import { Product } from '../models/Product.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

const router = express.Router();

router.use(requireAdmin);

router.get('/:menuId/categories/:categoryId/products', async (req, res) => {
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

    const products = await Product.findAll({
      where: {
        categoryId
      },
      order: [
        ['sortOrder', 'ASC'],
        ['createdAt', 'ASC']
      ]
    });

    return res.status(200).json({
      products
    });
  } catch (error) {
    console.error('Get products error:', error);

    return res.status(500).json({
      message: 'Internal server error.'
    });
  }
});

router.post('/:menuId/categories/:categoryId/products', async (req, res) => {
  try {
    const menuId = Number(req.params.menuId);
    const categoryId = Number(req.params.categoryId);

    const {
      name,
      description,
      price,
      isAvailable
    } = req.body;

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
      name.trim().length > 120
    ) {
      return res.status(400).json({
        message: 'Product name must be between 2 and 120 characters.'
      });
    }

    const numericPrice = Number(price);

    if (
      !Number.isFinite(numericPrice) ||
      numericPrice < 0
    ) {
      return res.status(400).json({
        message: 'A valid product price is required.'
      });
    }

    const maxSortOrder = await Product.max('sortOrder', {
      where: {
        categoryId
      }
    });

    const product = await Product.create({
      categoryId,
      name: name.trim(),
      description:
        typeof description === 'string' && description.trim()
          ? description.trim()
          : null,
      price: numericPrice.toFixed(2),
      isAvailable:
        typeof isAvailable === 'boolean'
          ? isAvailable
          : true,
      sortOrder: (maxSortOrder ?? 0) + 1
    });

    return res.status(201).json({
      message: 'Product created successfully.',
      product
    });
  } catch (error) {
    console.error('Create product error:', error);

    return res.status(500).json({
      message: 'Internal server error.'
    });
  }
});

router.put(
  '/:menuId/categories/:categoryId/products/:productId',
  async (req, res) => {
    try {
      const menuId = Number(req.params.menuId);
      const categoryId = Number(req.params.categoryId);
      const productId = Number(req.params.productId);

      const {
        name,
        description,
        price,
        isAvailable
      } = req.body;

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

      const product = await Product.findOne({
        where: {
          id: productId,
          categoryId
        }
      });

      if (!product) {
        return res.status(404).json({
          message: 'Product not found.'
        });
      }

      if (
        typeof name !== 'string' ||
        name.trim().length < 2 ||
        name.trim().length > 120
      ) {
        return res.status(400).json({
          message: 'Product name must be between 2 and 120 characters.'
        });
      }

      const numericPrice = Number(price);

      if (
        !Number.isFinite(numericPrice) ||
        numericPrice < 0
      ) {
        return res.status(400).json({
          message: 'A valid product price is required.'
        });
      }

      product.name = name.trim();

      product.description =
        typeof description === 'string' && description.trim()
          ? description.trim()
          : null;

      product.price = numericPrice.toFixed(2);

      if (typeof isAvailable === 'boolean') {
        product.isAvailable = isAvailable;
      }

      await product.save();

      return res.status(200).json({
        message: 'Product updated successfully.',
        product
      });
    } catch (error) {
      console.error('Update product error:', error);

      return res.status(500).json({
        message: 'Internal server error.'
      });
    }
  }
);

router.patch(
  '/:menuId/categories/:categoryId/products/:productId/availability',
  async (req, res) => {
    try {
      const menuId = Number(req.params.menuId);
      const categoryId = Number(req.params.categoryId);
      const productId = Number(req.params.productId);

      const { isAvailable } = req.body;

      if (typeof isAvailable !== 'boolean') {
        return res.status(400).json({
          message: 'Availability must be true or false.'
        });
      }

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

      const product = await Product.findOne({
        where: {
          id: productId,
          categoryId
        }
      });

      if (!product) {
        return res.status(404).json({
          message: 'Product not found.'
        });
      }

      product.isAvailable = isAvailable;

      await product.save();

      return res.status(200).json({
        message: 'Product availability updated successfully.',
        product
      });
    } catch (error) {
      console.error('Update availability error:', error);

      return res.status(500).json({
        message: 'Internal server error.'
      });
    }
  }
);

router.delete(
  '/:menuId/categories/:categoryId/products/:productId',
  async (req, res) => {
    try {
      const menuId = Number(req.params.menuId);
      const categoryId = Number(req.params.categoryId);
      const productId = Number(req.params.productId);

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

      const product = await Product.findOne({
        where: {
          id: productId,
          categoryId
        }
      });

      if (!product) {
        return res.status(404).json({
          message: 'Product not found.'
        });
      }

      await product.destroy();

      return res.status(200).json({
        message: 'Product deleted successfully.'
      });
    } catch (error) {
      console.error('Delete product error:', error);

      return res.status(500).json({
        message: 'Internal server error.'
      });
    }
  }
);

export default router;