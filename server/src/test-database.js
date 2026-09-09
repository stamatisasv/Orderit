import { sequelize } from './config/database.js';

try {
  await sequelize.authenticate();
  console.log('Database connection successful!');
} catch (error) {
  console.error('Database connection failed:');
  console.error(error.message);
} finally {
  await sequelize.close();
}