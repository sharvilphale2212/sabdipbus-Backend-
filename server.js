require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const { Server } = require('socket.io');
const { port } = require('./config/keys');
const connectDB = require('./config/db');

// Routes
const authRoutes = require('./routes/auth');
const busRoutes = require('./routes/buses');
const userRoutes = require('./routes/users');
const notificationRoutes = require('./routes/notifications');
const { setupSocketHandlers } = require('./socket/tracking');

const app = express();
const server = http.createServer(app);

// Connect DB
connectDB();


// ✅ CORS FIX (SINGLE SOURCE OF TRUTH)
const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map(o => o.trim())
  : [];

console.log("✅ Allowed Origins:", allowedOrigins);

const corsOptions = {
  origin: function (origin, callback) {
    console.log("🌐 Incoming Origin:", origin);

    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("❌ CORS BLOCKED: " + origin));
  },
  credentials: true
};

// ✅ APPLY CORS ONCE
app.use(cors(corsOptions));

// ✅ HANDLE PREFLIGHT
app.options('*', cors(corsOptions));


// Socket.io
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  }
});

app.set('io', io);


// Middleware
app.use(helmet());
app.use(express.json());

// Logger
app.use((req, res, next) => {
  console.log(`${new Date().toLocaleTimeString()} │ ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/buses', busRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);

// Health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Socket handlers
setupSocketHandlers(io);

// Error handler
app.use((err, req, res, next) => {
  console.error("🔥 Server Error:", err.message);
  res.status(500).json({ message: err.message });
});

// Start server
server.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});

module.exports = { app, server, io };
