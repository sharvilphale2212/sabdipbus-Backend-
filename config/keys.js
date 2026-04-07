require('dotenv').config();

module.exports = {
  jwtSecret: process.env.JWT_SECRET || 'sandip-bus-tracker-secret-key-2024',
  jwtExpiry: '24h',
  port: process.env.PORT || 5001,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',

  // Map tile config
  mapTile: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }
};
