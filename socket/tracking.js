const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/keys');
const User = require('../models/User');
const Bus = require('../models/Bus');
const Notification = require('../models/Notification');

// In-memory live locations (not persisted — only while trip is active)
const liveLocations = {};

function setupSocketHandlers(io) {
  // Socket authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const decoded = jwt.verify(token, jwtSecret);
      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    console.log(`🔌 Connected: ${socket.user.name} (${socket.user.role})`);

    // Join user-specific room for targeted notifications
    socket.join(`user:${socket.user.id}`);
    socket.join(`role:${socket.user.role}`);

    // ── Student events ──
    if (socket.user.role === 'student') {
      try {
        const student = await User.findById(socket.user.id).lean();
        if (student && student.assignedBus) {
          const busId = student.assignedBus.toString();
          socket.join(`bus:${busId}`);
          console.log(`  📍 Student ${student.name} subscribed to bus ${busId}`);

          // Send current location if available
          if (liveLocations[busId]) {
            socket.emit('bus:location-update', {
              busId,
              ...liveLocations[busId]
            });
          }
        }
      } catch (err) {
        console.error('Error loading student data:', err.message);
      }
    }

    // ── Driver events ──
    if (socket.user.role === 'driver') {
      let driver = null;
      let driverBus = null;

      try {
        driver = await User.findById(socket.user.id);
        if (driver && driver.assignedBus) {
          driverBus = await Bus.findById(driver.assignedBus);
          socket.join(`bus:${driver.assignedBus.toString()}`);
        }
      } catch (err) {
        console.error('Error loading driver data:', err.message);
      }

      // Start trip
      socket.on('driver:start-trip', async () => {
        try {
          if (!driver || !driverBus) return;

          driverBus.tripActive = true;
          driverBus.status = 'on-route';
          await driverBus.save();

          driver.isActive = true;
          await driver.save();

          const busId = driverBus._id.toString();
          console.log(`  🚌 Driver ${driver.name} started trip on bus ${driverBus.number}`);

          // Create notification in DB
          const notif = await Notification.create({
            message: `Bus ${driverBus.number} has started its trip on route ${driverBus.route}!`,
            type: 'info',
            targetRole: 'student',
            targetIds: driverBus.assignedStudents.map(s => s.toString()),
          });

          const notifData = {
            id: notif._id.toString(),
            message: notif.message,
            type: notif.type,
            createdAt: notif.createdAt.toISOString(),
            read: false,
          };

          io.to(`bus:${busId}`).emit('notification', notifData);
          io.to(`bus:${busId}`).emit('bus:trip-started', { busId, busNumber: driverBus.number });
          io.to('role:admin').emit('bus:status-change', { busId, status: 'on-route' });
        } catch (err) {
          console.error('Error starting trip:', err.message);
        }
      });

      // Update location — throttled to prevent spam
      let lastLocationUpdate = 0;
      socket.on('driver:update-location', async (data) => {
        try {
          if (!driver || !driverBus || !driverBus.tripActive) return;

          // Throttle: at most once per 2 seconds
          const now = Date.now();
          if (now - lastLocationUpdate < 2000) return;
          lastLocationUpdate = now;

          const busId = driverBus._id.toString();

          const locationData = {
            lat: data.lat,
            lng: data.lng,
            heading: data.heading || 0,
            speed: data.speed || 0,
            timestamp: now,
          };

          // Update in-memory cache
          liveLocations[busId] = locationData;

          // Update bus location in DB (non-blocking)
          Bus.findByIdAndUpdate(driverBus._id, {
            currentLocation: { lat: data.lat, lng: data.lng }
          }).catch(() => {});

          // Calculate ETA for each stop
          const etas = driverBus.stops.map(stop => {
            const dist = haversineDistance(data.lat, data.lng, stop.lat, stop.lng);
            const speed = Math.max(data.speed || 20, 5); // km/h, min 5
            const etaMinutes = Math.round((dist / speed) * 60);
            return { stopName: stop.name, eta: etaMinutes, distance: dist.toFixed(2) };
          });

          // Broadcast to all clients watching this bus
          io.to(`bus:${busId}`).emit('bus:location-update', {
            busId,
            busNumber: driverBus.number,
            ...locationData,
            etas,
          });

          // Send to admin
          io.to('role:admin').emit('bus:location-update', {
            busId,
            busNumber: driverBus.number,
            ...locationData,
            etas,
          });

          // Check if bus is near any stop (within ~5 min) — send arrival notification
          etas.forEach(eta => {
            if (eta.eta <= 5 && eta.eta > 0) {
              io.to(`bus:${busId}`).emit('notification', {
                id: `eta-${busId}-${eta.stopName}-${now}`,
                message: `Bus ${driverBus.number} arriving at ${eta.stopName} in ~${eta.eta} minutes!`,
                type: 'arrival',
                createdAt: new Date().toISOString(),
                read: false,
              });
            }
          });
        } catch (err) {
          console.error('Error updating location:', err.message);
        }
      });

      // Stop trip
      socket.on('driver:stop-trip', async () => {
        try {
          if (!driver || !driverBus) return;

          const busId = driverBus._id.toString();

          driverBus.tripActive = false;
          driverBus.status = 'idle';
          driverBus.currentLocation = undefined;
          await driverBus.save();

          driver.isActive = false;
          await driver.save();

          delete liveLocations[busId];

          console.log(`  🛑 Driver ${driver.name} stopped trip on bus ${driverBus.number}`);

          const notif = await Notification.create({
            message: `Bus ${driverBus.number} has completed its trip.`,
            type: 'info',
            targetRole: 'student',
            targetIds: driverBus.assignedStudents.map(s => s.toString()),
          });

          const notifData = {
            id: notif._id.toString(),
            message: notif.message,
            type: notif.type,
            createdAt: notif.createdAt.toISOString(),
            read: false,
          };

          io.to(`bus:${busId}`).emit('notification', notifData);
          io.to(`bus:${busId}`).emit('bus:trip-ended', { busId });
          io.to('role:admin').emit('bus:status-change', { busId, status: 'idle' });
        } catch (err) {
          console.error('Error stopping trip:', err.message);
        }
      });
    }

    // ── Admin events ──
    if (socket.user.role === 'admin') {
      socket.on('admin:subscribe-all', async () => {
        try {
          const buses = await Bus.find().select('_id').lean();
          buses.forEach(bus => {
            socket.join(`bus:${bus._id.toString()}`);
          });
          // Send all current live locations
          socket.emit('admin:all-locations', liveLocations);
        } catch (err) {
          console.error('Error subscribing admin:', err.message);
        }
      });
    }

    socket.on('disconnect', () => {
      console.log(`🔌 Disconnected: ${socket.user.name}`);
    });
  });
}

// ── Haversine distance (km) ──
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg) { return deg * Math.PI / 180; }

module.exports = { setupSocketHandlers, liveLocations };
