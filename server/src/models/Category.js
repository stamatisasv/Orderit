import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';
import { Menu } from './Menu.js';

export const Category = sequelize.define(
  'Category',
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },

    menuId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },

    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        len: {
          args: [2, 100],
          msg: 'Category name must be between 2 and 100 characters.'
        }
      }
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },

    sortOrder: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0
    }
  },
  {
    tableName: 'categories',
    timestamps: true
  }
);

Menu.hasMany(Category, {
  foreignKey: 'menuId',
  onDelete: 'CASCADE'
});

Category.belongsTo(Menu, {
  foreignKey: 'menuId'
});