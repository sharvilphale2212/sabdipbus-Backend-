const express = require('express');
const { verifyToken, requireRole } = require('../middleware/auth');
const Bus = require('../models/Bus');
const User = require('../models/User');

const router = express.Router();

// GET /api/buses — list all buses
router.get('/', verifyToken, async (req, res) => {
  try {
    const buses = await Bus.find()
      .populate('assignedDriver', 'name driverId phone isActive')
      .lean();

    const busList = buses.map(b => ({
      id: b._id.toString(),
      number: b.number,
      route: b.route,
      status: b.status,
      assignedDriver: b.assignedDriver ? b.assignedDriver._id.toString() : null,
      driverName: b.assignedDriver ? b.assignedDriver.name : null,
      studentCount: b.assignedStudents ? b.assignedStudents.length : 0,
      capacity: b.capacity,
      tripActive: b.tripActive,
      stops: b.stops,
    }));

    res.json(busList);
  } catch (err) {
    console.error('Error fetching buses:', err);
    res.status(500).json({ message: 'Failed to fetch buses.' });
  }
});

// GET /api/buses/:id — single bus details
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id)
      .populate('assignedDriver', 'name driverId phone isActive')
      .populate('assignedStudents', 'name erpId pickupStop');

    if (!bus) return res.status(404).json({ message: 'Bus not found.' });

    res.json({
      id: bus._id.toString(),
      number: bus.number,
      route: bus.route,
      stops: bus.stops,
      status: bus.status,
      tripActive: bus.tripActive,
      capacity: bus.capacity,
      assignedDriver: bus.assignedDriver ? bus.assignedDriver._id.toString() : null,
      driverName: bus.assignedDriver ? bus.assignedDriver.name : 'Unassigned',
      driverPhone: bus.assignedDriver ? bus.assignedDriver.phone : null,
      studentList: bus.assignedStudents.map(s => ({
        id: s._id.toString(),
        name: s.name,
        pickupStop: s.pickupStop,
      })),
      studentCount: bus.assignedStudents.length,
    });
  } catch (err) {
    console.error('Error fetching bus:', err);
    res.status(500).json({ message: 'Failed to fetch bus.' });
  }
});

// POST /api/buses — add a new bus (admin only)
router.post('/', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { number, route, stops, capacity } = req.body;

    if (!number || !route) {
      return res.status(400).json({ message: 'Bus number and route are required.' });
    }

    // Check duplicate bus number
    const existing = await Bus.findOne({ number });
    if (existing) {
      return res.status(400).json({ message: 'Bus number already exists.' });
    }

    const newBus = await Bus.create({
      number,
      route,
      stops: stops || [],
      capacity: capacity || 50,
    });

    res.status(201).json({
      message: 'Bus added successfully.',
      bus: {
        id: newBus._id.toString(),
        number: newBus.number,
        route: newBus.route,
        stops: newBus.stops,
        status: newBus.status,
        tripActive: newBus.tripActive,
        capacity: newBus.capacity,
        assignedDriver: null,
        studentCount: 0,
      }
    });
  } catch (err) {
    console.error('Error adding bus:', err);
    res.status(500).json({ message: 'Failed to add bus.' });
  }
});

// PUT /api/buses/:id — update bus (admin only)
router.put('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id);
    if (!bus) return res.status(404).json({ message: 'Bus not found.' });

    const { number, route, stops, capacity, status } = req.body;
    if (number) bus.number = number;
    if (route) bus.route = route;
    if (stops) bus.stops = stops;
    if (capacity) bus.capacity = capacity;
    if (status) bus.status = status;

    await bus.save();

    res.json({
      message: 'Bus updated successfully.',
      bus: {
        id: bus._id.toString(),
        number: bus.number,
        route: bus.route,
        stops: bus.stops,
        status: bus.status,
        tripActive: bus.tripActive,
        capacity: bus.capacity,
        assignedDriver: bus.assignedDriver?.toString() || null,
        studentCount: bus.assignedStudents.length,
      }
    });
  } catch (err) {
    console.error('Error updating bus:', err);
    res.status(500).json({ message: 'Failed to update bus.' });
  }
});

// DELETE /api/buses/:id — delete bus (admin only)
router.delete('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id);
    if (!bus) return res.status(404).json({ message: 'Bus not found.' });

    // Unassign driver and students
    await User.updateMany(
      { assignedBus: bus._id },
      { $set: { assignedBus: null } }
    );

    await Bus.findByIdAndDelete(req.params.id);
    res.json({ message: 'Bus deleted successfully.' });
  } catch (err) {
    console.error('Error deleting bus:', err);
    res.status(500).json({ message: 'Failed to delete bus.' });
  }
});

// PUT /api/buses/:id/assign-driver — assign driver to bus (admin)
router.put('/:id/assign-driver', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id);
    if (!bus) return res.status(404).json({ message: 'Bus not found.' });

    const { driverId } = req.body;
    const driver = await User.findById(driverId);
    if (!driver || driver.role !== 'driver') {
      return res.status(404).json({ message: 'Driver not found.' });
    }

    // Remove driver from previous bus
    await Bus.updateMany(
      { assignedDriver: driver._id },
      { $set: { assignedDriver: null } }
    );

    bus.assignedDriver = driver._id;
    await bus.save();

    driver.assignedBus = bus._id;
    await driver.save();

    res.json({
      message: `Driver ${driver.name} assigned to bus ${bus.number}.`,
      bus: {
        id: bus._id.toString(),
        number: bus.number,
        assignedDriver: bus.assignedDriver.toString(),
      }
    });
  } catch (err) {
    console.error('Error assigning driver:', err);
    res.status(500).json({ message: 'Failed to assign driver.' });
  }
});

// PUT /api/buses/:id/assign-students — assign students to bus (admin)
router.put('/:id/assign-students', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id);
    if (!bus) return res.status(404).json({ message: 'Bus not found.' });

    const { studentIds } = req.body;
    if (!Array.isArray(studentIds)) {
      return res.status(400).json({ message: 'studentIds must be an array.' });
    }

    for (const sid of studentIds) {
      const student = await User.findById(sid);
      if (student && student.role === 'student') {
        // Remove from previous bus
        await Bus.updateMany(
          { assignedStudents: student._id },
          { $pull: { assignedStudents: student._id } }
        );

        student.assignedBus = bus._id;
        await student.save();

        if (!bus.assignedStudents.includes(student._id)) {
          bus.assignedStudents.push(student._id);
        }
      }
    }

    await bus.save();
    res.json({
      message: `${studentIds.length} students assigned to bus ${bus.number}.`,
      bus: {
        id: bus._id.toString(),
        number: bus.number,
        studentCount: bus.assignedStudents.length,
      }
    });
  } catch (err) {
    console.error('Error assigning students:', err);
    res.status(500).json({ message: 'Failed to assign students.' });
  }
});

module.exports = router;
