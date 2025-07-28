const mongoose = require('mongoose');
const Admin = require('../models/admin');
require('dotenv').config();

async function createInitialAdmin() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/capturecore');
    console.log('Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email: 'admin@capturecore.com' });
    
    if (existingAdmin) {
      console.log('Admin user already exists');
      process.exit(0);
    }

    // Create super admin
    const superAdmin = new Admin({
      name: 'Super Admin',
      email: 'admin@capturecore.com',
      password: 'Admin@123', // This will be hashed automatically
      role: 'super_admin',
      isActive: true,
      permissions: [
        'manage_users',
        'manage_products', 
        'manage_categories',
        'view_analytics',
        'manage_orders'
      ]
    });

    await superAdmin.save();
    console.log('Super Admin created successfully!');
    console.log('Email: admin@capturecore.com');
    console.log('Password: Admin@123');
    console.log('Please change the password after first login.');

    // Create additional admin roles (optional)
    const moderator = new Admin({
      name: 'Moderator',
      email: 'moderator@capturecore.com',
      password: 'Moderator@123',
      role: 'moderator',
      isActive: true,
      permissions: [
        'manage_users',
        'view_analytics'
      ]
    });

    await moderator.save();
    console.log('Moderator created successfully!');
    console.log('Email: moderator@capturecore.com');
    console.log('Password: Moderator@123');

  } catch (error) {
    console.error('Error creating admin:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the script
createInitialAdmin(); 