require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const { Server } = require('socket.io');
const { port, clientUrl } = require('./config/keys');
const connectDB = require('./config/db');

// Routes
const authRoutes = require('./routes/auth');
const busRoutes = require('./routes/buses');
const userRoutes = require('./routes/users');
const notificationRoutes = require('./routes/notifications');
const { setupSocketHandlers } = require('./socket/tracking');

const app = express();
const server = http.createServer(app);

// Connect to MongoDB
connectDB();

// CORS configuration based on environment
const cors = require("cors");

const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map(o => o.trim())
  : [];

app.use(cors({
  origin: function (origin, callback) {
    console.log("🌐 Origin:", origin);

    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("CORS blocked: " + origin));
  },
  credentials: true
}));

// VERY IMPORTANT (preflight fix)
app.options('*', cors());

// Socket.io
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  }
});

// Make io accessible to routes
app.set('io', io);

// Middleware
app.use(helmet());

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`⚠️ CORS Blocked preflight/request from Origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
};

app.use(cors(corsOptions));
// Handle preflight requests for all routes
app.options('*', cors(corsOptions));

app.use(express.json());

// Request logger
app.use((req, res, next) => {
  console.log(`${new Date().toLocaleTimeString()} │ Origin: ${req.headers.origin || 'N/A'} │ ${req.method} ${req.path}`);
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/buses', busRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve Frontend in Production
const path = require('path');
if (process.env.NODE_ENV === 'production') {
  const clientBuildPath = path.join(__dirname, '../client/dist');
  app.use(express.static(clientBuildPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

// Setup Socket.io handlers
setupSocketHandlers(io);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ message: 'Internal Server Error' });
});

// Start server
server.listen(port, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════╗');
  console.log('  ║      🚌  Sandip Bus Tracker — Server        ║');
  console.log(`  ║      Running on port ${port}                   ║`);
  console.log('  ║      WebSocket: Ready                       ║');
  console.log('  ╚══════════════════════════════════════════════╝');
  console.log('');
  console.log('  Demo Logins:');
  console.log('  ─────────────────────────────────────────────');
  console.log('  Student:  STU001 / password123');
  console.log('  Driver:   DRV001 / password123');
  console.log('  Admin:    admin  / admin123');
  console.log('');
});

module.exports = { app, server, io };
