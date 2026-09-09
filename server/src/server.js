import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import 'dotenv/config';
import './models/Admin.js';
import './models/Session.js';
import authRoutes from './routes/auth.js';
import './models/Menu.js';
import './models/Category.js';
import adminMenuRoutes from './routes/admin-menus.js';
import adminCategoryRoutes from './routes/admin-categories.js';
import './models/Product.js'
import adminProductRoutes from './routes/admin-products.js';


import { sequelize } from './config/database.js';

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN,
    credentials: true
  })
);

app.use(express.json());
app.use(cookieParser());
app.use('/api/admin/menus', adminMenuRoutes);
app.use('/api/admin/menus', adminCategoryRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin/menus', adminMenuRoutes);
app.use('/api/admin/menus', adminProductRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok'
  });
});

const startServer = async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync();

    console.log('Database connection successful.');

    app.listen(process.env.PORT, () => {
      console.log(`Orderit API running on port ${process.env.PORT}`);
    });
  } catch (error) {
    console.error('Unable to start server:');
    console.error(error.message);
  }
};

startServer();