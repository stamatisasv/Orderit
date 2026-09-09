import express from 'express';

import { Category } from '../models/Category.js';
import { Product } from '../models/Product.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

import multer from 'multer';
import sharp from 'sharp';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const productImagesDirectory = path.join(
  __dirname,
  '../../uploads/products'
);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (req, file, callback) => {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp'
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return callback(
        new Error('INVALID_IMAGE_TYPE')
      );
    }

    callback(null, true);
  }
});

const deleteProductImage = async (imageUrl) => {
  if (
    !imageUrl ||
    !imageUrl.startsWith('/uploads/products/')
  ) {
    return;
  }

  const filename = path.basename(imageUrl);
  const filePath = path.join(
    productImagesDirectory,
    filename
  );

  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
};

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


router.post(
  '/:menuId/categories/:categoryId/products/:productId/image',
  upload.single('image'),
  async (req, res) => {
    try {
      const menuId = Number(req.params.menuId);
      const categoryId = Number(req.params.categoryId);
      const productId = Number(req.params.productId);

      if (!req.file) {
        return res.status(400).json({
          message: 'Product image is required.'
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

      const metadata = await sharp(
        req.file.buffer
      ).metadata();

      if (!metadata.width || !metadata.height) {
        return res.status(400).json({
          message: 'Unable to read image dimensions.'
        });
      }

      if (
        metadata.width < 800 ||
        metadata.height < 800
      ) {
        return res.status(400).json({
          message:
            'Product image must be at least 800 × 800 pixels.'
        });
      }

      if (metadata.width !== metadata.height) {
        return res.status(400).json({
          message:
            'Product image must have a 1:1 aspect ratio.'
        });
      }

      await fs.mkdir(productImagesDirectory, {
        recursive: true
      });

      const filename =
        `${crypto.randomUUID()}.webp`;

      const outputPath = path.join(
        productImagesDirectory,
        filename
      );

      await sharp(req.file.buffer)
        .rotate()
        .resize({
          width: 1200,
          height: 1200,
          fit: 'cover',
          withoutEnlargement: true
        })
        .webp({
          quality: 85
        })
        .toFile(outputPath);

      await deleteProductImage(product.imageUrl);

      product.imageUrl =
        `/uploads/products/${filename}`;

      await product.save();

      return res.status(200).json({
        message: 'Product image uploaded successfully.',
        product
      });
    } catch (error) {
      console.error(
        'Product image upload error:',
        error
      );

      return res.status(500).json({
        message: 'Internal server error.'
      });
    }
  }
);

router.delete(
  '/:menuId/categories/:categoryId/products/:productId/image',
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

      await deleteProductImage(product.imageUrl);

      product.imageUrl = null;

      await product.save();

      return res.status(200).json({
        message: 'Product image removed successfully.',
        product
      });
    } catch (error) {
      console.error(
        'Remove product image error:',
        error
      );

      return res.status(500).json({
        message: 'Internal server error.'
      });
    }
  }
);

export default router;