import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';
import { Admin } from './Admin.js';

export const Session = sequelize.define(
  'Session',
  {
    tokenHash: {
      type: DataTypes.STRING(64),
      primaryKey: true
    },

    adminId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },

    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false
    }
  },
  {
    tableName: 'admin_sessions',
    timestamps: true
  }
);

Admin.hasMany(Session, {
  foreignKey: 'adminId',
  onDelete: 'CASCADE'
});

Session.belongsTo(Admin, {
  foreignKey: 'adminId'
});