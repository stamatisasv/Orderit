import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const Menu = sequelize.define(
  'Menu',
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },

    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        len: {
          args: [2, 100],
          msg: 'Menu name must be between 2 and 100 characters.'
        }
      }
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },

    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  },
  {
    tableName: 'menus',
    timestamps: true
  }
);