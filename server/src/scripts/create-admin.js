import bcrypt from 'bcrypt';
import { sequelize } from '../config/database.js';
import { Admin } from '../models/Admin.js';

const username = process.argv[2]?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;

if (!username || !password) {
  console.log('Username and password are required.');
  process.exit(1);
}

if (username.length < 5 || username.length > 50) {
  console.log('Username must be between 5 and 50 characters.');
  process.exit(1);
}

if (password.length < 4) {
  console.log('Password must be at least 4 characters.');
  process.exit(1);
}
try {
  await sequelize.authenticate();ADMIN_PASSWORD="$ADMIN_PASSWORD"

  const existingAdmin = await Admin.findOne({
    where: { username }
  });

  if (existingAdmin) {
    console.log('An admin with this username already exists.');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await Admin.create({
    username,
    passwordHash
  });

  console.log('Admin created successfully.');
} catch (error) {
  console.error('Unable to create admin:');
  console.error(error.message);
} finally {
  await sequelize.close();
}