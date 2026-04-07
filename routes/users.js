const express = require('express');
const { verifyToken, requireRole } = require('../middleware/auth');
const User = require('../models/User');
const Bus = require('../models/Bus');

const router = express.Router();

// GET /api/users/me — get current user profile + assigned bus info
router.get('/me', verifyToken, async (req, res) => {
  try {
    const { id, role } = req.user;
    const user = await User.findById(id).populate('assignedBus');

    if (!user) return res.status(404).json({ message: 'User not found.' });

    if (role === 'student') {
      const busData = user.assignedBus ? {
        id: user.assignedBus._id.toString(),
        number: user.assignedBus.number,
        route: user.assignedBus.route,
        status: user.assignedBus.status,
        tripActive: user.assignedBus.tripActive,
        stops: user.assignedBus.stops,
        assignedStudents: user.assignedBus.assignedStudents.map(s => s.toString()),
      } : null;

      return res.json({
        id: user._id.toString(),
        name: user.name,
        role: 'student',
        erpId: user.erpId,
        assignedBus: busData,
        pickupStop: user.pickupStop,
        dropStop: user.dropStop || 'College Campus (Main)',
        pickupLocation: user.pickupLocation || user.pickupStop,
        dropLocation: user.dropLocation || 'College Campus (Main)',
      });
    }

    if (role === 'driver') {
      const busData = user.assignedBus ? {
        id: user.assignedBus._id.toString(),
        number: user.assignedBus.number,
        route: user.assignedBus.route,
        status: user.assignedBus.status,
        tripActive: user.assignedBus.tripActive,
        stops: user.assignedBus.stops,
        assignedStudents: user.assignedBus.assignedStudents.map(s => s.toString()),
      } : null;

      return res.json({
        id: user._id.toString(),
        name: user.name,
        role: 'driver',
        driverId: user.driverId,
        phone: user.phone,
        assignedBus: busData,
        isActive: user.isActive,
      });
    }

    if (role === 'admin') {
      return res.json({
        id: user._id.toString(),
        name: user.name,
        role: 'admin',
      });
    }

    res.status(400).json({ message: 'Unknown role.' });
  } catch (err) {
    console.error('Error fetching profile:', err);
    res.status(500).json({ message: 'Failed to fetch profile.' });
  }
});

// GET /api/users/students — list all students (admin only)
router.get('/students', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const students = await User.find({ role: 'student' })
      .select('name erpId assignedBus pickupStop dropStop pickupLocation dropLocation')
      .lean();

    const list = students.map(s => ({
      id: s._id.toString(),
      name: s.name,
      erpId: s.erpId,
      assignedBus: s.assignedBus?.toString() || null,
      pickupStop: s.pickupStop,
      dropStop: s.dropStop || 'College Campus (Main)',
      pickupLocation: s.pickupLocation || s.pickupStop,
      dropLocation: s.dropLocation || 'College Campus (Main)',
    }));

    res.json(list);
  } catch (err) {
    console.error('Error fetching students:', err);
    res.status(500).json({ message: 'Failed to fetch students.' });
  }
});

// POST /api/users/students — add student (admin only)
router.post('/students', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { name, erpId, password, pickupLocation, dropLocation, assignedBus } = req.body;

    if (!name || !password) {
      return res.status(400).json({ message: 'Name and password are required.' });
    }

    // Auto-generate ERP ID if not provided
    const finalErpId = erpId || await generateStudentId();

    // Check duplicate
    const existing = await User.findOne({ loginId: finalErpId });
    if (existing) {
      return res.status(400).json({ message: 'ERP ID already exists.' });
    }

    const newStudent = await User.create({
      loginId: finalErpId,
      name,
      password,
      role: 'student',
      erpId: finalErpId,
      assignedBus: assignedBus || null,
      pickupStop: pickupLocation || '',
      dropStop: dropLocation || 'College Campus (Main)',
      pickupLocation: pickupLocation || '',
      dropLocation: dropLocation || 'College Campus (Main)',
    });

    // Add to bus if assigned
    if (assignedBus) {
      await Bus.findByIdAndUpdate(assignedBus, {
        $addToSet: { assignedStudents: newStudent._id }
      });
    }

    res.status(201).json({
      message: 'Student added successfully.',
      student: {
        id: newStudent._id.toString(),
        name: newStudent.name,
        erpId: newStudent.erpId,
        assignedBus: newStudent.assignedBus?.toString() || null,
        pickupStop: newStudent.pickupStop,
        dropStop: newStudent.dropStop,
        pickupLocation: newStudent.pickupLocation,
        dropLocation: newStudent.dropLocation,
      }
    });
  } catch (err) {
    console.error('Error adding student:', err);
    res.status(500).json({ message: 'Failed to add student.' });
  }
});

// PUT /api/users/students/:id — update student (admin only)
router.put('/students/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const student = await User.findById(req.params.id);
    if (!student || student.role !== 'student') {
      return res.status(404).json({ message: 'Student not found.' });
    }

    const { name, pickupLocation, dropLocation, assignedBus, password } = req.body;

    if (name) student.name = name;
    if (pickupLocation !== undefined) {
      student.pickupLocation = pickupLocation;
      student.pickupStop = pickupLocation;
    }
    if (dropLocation !== undefined) {
      student.dropLocation = dropLocation;
      student.dropStop = dropLocation;
    }
    if (password) student.password = password; // pre-save hook will hash

    // Handle bus reassignment
    if (assignedBus !== undefined && assignedBus !== student.assignedBus?.toString()) {
      // Remove from old bus
      if (student.assignedBus) {
        await Bus.findByIdAndUpdate(student.assignedBus, {
          $pull: { assignedStudents: student._id }
        });
      }

      student.assignedBus = assignedBus || null;

      // Add to new bus
      if (assignedBus) {
        await Bus.findByIdAndUpdate(assignedBus, {
          $addToSet: { assignedStudents: student._id }
        });
      }
    }

    await student.save();

    res.json({
      message: 'Student updated.',
      student: {
        id: student._id.toString(),
        name: student.name,
        erpId: student.erpId,
        assignedBus: student.assignedBus?.toString() || null,
        pickupStop: student.pickupStop,
        dropStop: student.dropStop,
        pickupLocation: student.pickupLocation,
        dropLocation: student.dropLocation,
      }
    });
  } catch (err) {
    console.error('Error updating student:', err);
    res.status(500).json({ message: 'Failed to update student.' });
  }
});

// DELETE /api/users/students/:id — delete student (admin only)
router.delete('/students/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const student = await User.findById(req.params.id);
    if (!student || student.role !== 'student') {
      return res.status(404).json({ message: 'Student not found.' });
    }

    // Remove from bus
    if (student.assignedBus) {
      await Bus.findByIdAndUpdate(student.assignedBus, {
        $pull: { assignedStudents: student._id }
      });
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'Student deleted.' });
  } catch (err) {
    console.error('Error deleting student:', err);
    res.status(500).json({ message: 'Failed to delete student.' });
  }
});

// GET /api/users/drivers — list all drivers (admin only)
router.get('/drivers', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const drivers = await User.find({ role: 'driver' })
      .select('name driverId phone assignedBus isActive')
      .lean();

    const list = drivers.map(d => ({
      id: d._id.toString(),
      name: d.name,
      driverId: d.driverId,
      phone: d.phone,
      assignedBus: d.assignedBus?.toString() || null,
      isActive: d.isActive,
    }));

    res.json(list);
  } catch (err) {
    console.error('Error fetching drivers:', err);
    res.status(500).json({ message: 'Failed to fetch drivers.' });
  }
});

// POST /api/users/drivers — add driver (admin only)
router.post('/drivers', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { name, phone, assignedBus, password } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Driver name is required.' });
    }

    const driverId = await generateDriverId();

    const newDriver = await User.create({
      loginId: driverId,
      name,
      password: password || 'password123',
      role: 'driver',
      driverId,
      phone: phone || '',
      assignedBus: assignedBus || null,
    });

    // Assign to bus if specified
    if (assignedBus) {
      const bus = await Bus.findById(assignedBus);
      if (bus) {
        // Unassign previous driver from this bus
        if (bus.assignedDriver) {
          await User.findByIdAndUpdate(bus.assignedDriver, { assignedBus: null });
        }
        bus.assignedDriver = newDriver._id;
        await bus.save();
      }
    }

    res.status(201).json({
      message: 'Driver added successfully.',
      driver: {
        id: newDriver._id.toString(),
        name: newDriver.name,
        driverId: newDriver.driverId,
        phone: newDriver.phone,
        assignedBus: newDriver.assignedBus?.toString() || null,
        isActive: false,
      }
    });
  } catch (err) {
    console.error('Error adding driver:', err);
    res.status(500).json({ message: 'Failed to add driver.' });
  }
});

// PUT /api/users/drivers/:id — update driver (admin only)
router.put('/drivers/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const driver = await User.findById(req.params.id);
    if (!driver || driver.role !== 'driver') {
      return res.status(404).json({ message: 'Driver not found.' });
    }

    const { name, phone, assignedBus, password } = req.body;

    if (name) driver.name = name;
    if (phone !== undefined) driver.phone = phone;
    if (password) driver.password = password; // pre-save hook will hash

    // Handle bus reassignment
    if (assignedBus !== undefined && assignedBus !== driver.assignedBus?.toString()) {
      // Unassign from old bus
      if (driver.assignedBus) {
        const oldBus = await Bus.findById(driver.assignedBus);
        if (oldBus && oldBus.assignedDriver?.toString() === driver._id.toString()) {
          oldBus.assignedDriver = null;
          await oldBus.save();
        }
      }

      driver.assignedBus = assignedBus || null;

      if (assignedBus) {
        const newBus = await Bus.findById(assignedBus);
        if (newBus) {
          // Unassign previous driver from this bus
          if (newBus.assignedDriver) {
            await User.findByIdAndUpdate(newBus.assignedDriver, { assignedBus: null });
          }
          newBus.assignedDriver = driver._id;
          await newBus.save();
        }
      }
    }

    await driver.save();

    res.json({
      message: 'Driver updated.',
      driver: {
        id: driver._id.toString(),
        name: driver.name,
        driverId: driver.driverId,
        phone: driver.phone,
        assignedBus: driver.assignedBus?.toString() || null,
        isActive: driver.isActive,
      }
    });
  } catch (err) {
    console.error('Error updating driver:', err);
    res.status(500).json({ message: 'Failed to update driver.' });
  }
});

// DELETE /api/users/drivers/:id — delete driver (admin only)
router.delete('/drivers/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const driver = await User.findById(req.params.id);
    if (!driver || driver.role !== 'driver') {
      return res.status(404).json({ message: 'Driver not found.' });
    }

    // Unassign from bus
    if (driver.assignedBus) {
      const bus = await Bus.findById(driver.assignedBus);
      if (bus && bus.assignedDriver?.toString() === driver._id.toString()) {
        bus.assignedDriver = null;
        await bus.save();
      }
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'Driver deleted.' });
  } catch (err) {
    console.error('Error deleting driver:', err);
    res.status(500).json({ message: 'Failed to delete driver.' });
  }
});

// GET /api/users/stops — get all unique stop names
router.get('/stops', verifyToken, async (req, res) => {
  try {
    const buses = await Bus.find().select('stops').lean();
    const allStops = [...new Set(
      buses.flatMap(b => b.stops.map(s => s.name))
        .filter(n => n !== 'College Campus (Main)')
    )];
    res.json(allStops);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch stops.' });
  }
});

// PUT /api/users/allot-bus — bus allotment: assign driver to bus (admin only)
router.put('/allot-bus', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { busId, driverId } = req.body;

    const bus = await Bus.findById(busId);
    if (!bus) return res.status(404).json({ message: 'Bus not found.' });

    const driver = await User.findById(driverId);
    if (!driver || driver.role !== 'driver') {
      return res.status(404).json({ message: 'Driver not found.' });
    }

    // Unassign driver from previous bus
    if (driver.assignedBus && driver.assignedBus.toString() !== busId) {
      await Bus.findByIdAndUpdate(driver.assignedBus, { assignedDriver: null });
    }

    // Unassign previous driver from this bus
    if (bus.assignedDriver && bus.assignedDriver.toString() !== driverId) {
      await User.findByIdAndUpdate(bus.assignedDriver, { assignedBus: null });
    }

    bus.assignedDriver = driver._id;
    await bus.save();

    driver.assignedBus = bus._id;
    await driver.save();

    res.json({
      message: `Driver ${driver.name} assigned to bus ${bus.number}.`,
      bus: { id: bus._id.toString(), number: bus.number, assignedDriver: bus.assignedDriver.toString() },
      driver: { id: driver._id.toString(), name: driver.name, assignedBus: driver.assignedBus.toString() },
    });
  } catch (err) {
    console.error('Error allotting bus:', err);
    res.status(500).json({ message: 'Failed to assign driver.' });
  }
});

// ── Helper functions ──
async function generateDriverId() {
  const count = await User.countDocuments({ role: 'driver' });
  return `DRV${String(count + 1).padStart(3, '0')}`;
}

async function generateStudentId() {
  const count = await User.countDocuments({ role: 'student' });
  return `STU${String(count + 1).padStart(3, '0')}`;
}

module.exports = router;
