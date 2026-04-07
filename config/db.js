const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.error('  ❌ MONGO_URI is not defined in environment variables.');
    console.error('  💡 Create a .env file with MONGO_URI=mongodb+srv://...');
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(uri, {
      // Mongoose 8 uses these by default, but we set them explicitly for clarity
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });

    console.log(`  ✅ MongoDB Connected: ${conn.connection.host}`);

    // Connection event listeners
    mongoose.connection.on('error', (err) => {
      console.error('  ❌ MongoDB connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('  ⚠️  MongoDB disconnected. Attempting reconnection...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('  ✅ MongoDB reconnected successfully.');
    });

    return conn;
  } catch (err) {
    console.error('  ❌ MongoDB connection failed:', err.message);
    console.error('  💡 Check your MONGO_URI and network connectivity.');
    process.exit(1);
  }
};

module.exports = connectDB;
