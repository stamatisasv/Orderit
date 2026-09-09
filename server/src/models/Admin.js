import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const Admin = sequelize.define(
  'Admin',
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },

    username: {
  type: DataTypes.STRING(50),
  allowNull: false,
  unique: true,
  validate: {
    len: {
      args: [5, 20],
      msg: 'Username must be at least 5 characters long.'
    }
  }
},

    passwordHash: {
      type: DataTypes.STRING(255),
      allowNull: false
    }
  },
  {
    tableName: 'admins',
    timestamps: true
  }
);