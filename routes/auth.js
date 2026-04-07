const express = require('express');
const jwt = require('jsonwebtoken');
const { jwtSecret, jwtExpiry } = require('../config/keys');
const User = require('../models/User');

const router = express.Router();

// POST /api/auth/admin/signup
router.post('/admin/signup', async (req, res) => {
  try {
    const { name, email, loginId, password } = req.body;

    if (!name || !email || !loginId || !password) {
      return res.status(400).json({ message: 'All fields are required (name, email, loginId, password).' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format.' });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    // Prevent duplicate emails or loginIds
    const existingUser = await User.findOne({ $or: [{ email }, { loginId }] });
    if (existingUser) {
      return res.status(400).json({ message: 'An account with this email or Login ID already exists.' });
    }

    // Create the new admin
    const newAdmin = await User.create({
      loginId,
      name,
      email,
      password, // Pre-save hook hashes it automatically
      role: 'admin'
    });

    res.status(201).json({
      message: 'Admin registered successfully.',
      admin: {
        id: newAdmin._id.toString(),
        name: newAdmin.name,
        email: newAdmin.email,
        role: newAdmin.role
      }
    });
  } catch (err) {
    console.error('Admin signup error:', err);
    res.status(500).json({ message: 'Server error during admin signup.' });
  }
});


// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { loginId, password } = req.body;

    if (!loginId || !password) {
      return res.status(400).json({ message: 'Login ID and password are required.' });
    }

    const user = await User.findByCredentials(loginId, password);

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials. Please check your ID and password.' });
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, role: user.role },
      jwtSecret,
      { expiresIn: jwtExpiry }
    );

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, name: user.name, role: user.role }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error during login.' });
  }
});

// GET /api/auth/verify — verify token validity
router.get('/verify', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ valid: false });
  }
  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], jwtSecret);
    res.json({ valid: true, user: { id: decoded.id, name: decoded.name, role: decoded.role } });
  } catch {
    res.status(401).json({ valid: false });
  }
});

module.exports = router;
