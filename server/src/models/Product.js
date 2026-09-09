import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';
import { Category } from './Category.js';

export const Product = sequelize.define(
  'Product',
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },

    categoryId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },

    name: {
      type: DataTypes.STRING(120),
      allowNull: false,
      validate: {
        len: {
          args: [2, 120],
          msg: 'Product name must be between 2 and 120 characters.'
        }
      }
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },

    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0
      }
    },

    imageUrl: {
      type: DataTypes.STRING(500),
      allowNull: true
    },

    isAvailable: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },

    sortOrder: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0
    }
  },
  {
    tableName: 'products',
    timestamps: true
  }
);

Category.hasMany(Product, {
  foreignKey: 'categoryId',
  onDelete: 'CASCADE'
});

Product.belongsTo(Category, {
  foreignKey: 'categoryId'
});