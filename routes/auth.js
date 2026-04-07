const express = require('express');
const jwt = require('jsonwebtoken');
const { jwtSecret, jwtExpiry } = require('../config/keys');
const User = require('../models/User');

const router = express.Router();

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
