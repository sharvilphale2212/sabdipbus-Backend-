require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');
const Bus = require('./models/Bus');
const Notification = require('./models/Notification');

// ── Route definitions (Nashik-area college bus routes) ───────────────────────
const routes = [
  {
    name: 'Panchavati - College',
    stops: [
      { name: 'Panchavati', lat: 20.0063, lng: 73.7910 },
      { name: 'Shalimar', lat: 20.0030, lng: 73.7850 },
      { name: 'Raviwar Karanja', lat: 19.9990, lng: 73.7890 },
      { name: 'CBS', lat: 19.9975, lng: 73.7920 },
      { name: 'College Road', lat: 19.9890, lng: 73.7960 },
      { name: 'College Campus (Main)', lat: 19.9810, lng: 73.8000 },
    ]
  },
  {
    name: 'Nashik Road - College',
    stops: [
      { name: 'Nashik Road Station', lat: 19.9630, lng: 73.8130 },
      { name: 'Dwarka', lat: 19.9670, lng: 73.8070 },
      { name: 'Bytco Point', lat: 19.9740, lng: 73.8000 },
      { name: 'Ashok Stambh', lat: 19.9830, lng: 73.7930 },
      { name: 'Tilak Wadi', lat: 19.9860, lng: 73.7960 },
      { name: 'College Campus (Main)', lat: 19.9810, lng: 73.8000 },
    ]
  },
  {
    name: 'Gangapur Road - College',
    stops: [
      { name: 'Gangapur Road', lat: 20.0190, lng: 73.7650 },
      { name: 'Rane Nagar', lat: 20.0140, lng: 73.7700 },
      { name: 'Tidke Colony', lat: 20.0080, lng: 73.7760 },
      { name: 'Ashok Stambh', lat: 19.9830, lng: 73.7930 },
      { name: 'Rajiv Nagar', lat: 19.9850, lng: 73.7960 },
      { name: 'College Campus (Main)', lat: 19.9810, lng: 73.8000 },
    ]
  },
  {
    name: 'Satpur - College',
    stops: [
      { name: 'Satpur MIDC', lat: 20.0250, lng: 73.7550 },
      { name: 'Satpur Colony', lat: 20.0210, lng: 73.7590 },
      { name: 'Ambad Link Road', lat: 20.0150, lng: 73.7640 },
      { name: 'Mumbai Naka', lat: 20.0050, lng: 73.7730 },
      { name: 'Indira Nagar', lat: 19.9970, lng: 73.7830 },
      { name: 'College Campus (Main)', lat: 19.9810, lng: 73.8000 },
    ]
  },
  {
    name: 'Indira Nagar - College',
    stops: [
      { name: 'Indira Nagar', lat: 19.9970, lng: 73.7830 },
      { name: 'Patel Chowk', lat: 19.9940, lng: 73.7860 },
      { name: 'Sharanpur Road', lat: 19.9910, lng: 73.7890 },
      { name: 'Mahatma Nagar', lat: 19.9870, lng: 73.7920 },
      { name: 'Canada Corner', lat: 19.9845, lng: 73.7950 },
      { name: 'College Campus (Main)', lat: 19.9810, lng: 73.8000 },
    ]
  },
  {
    name: 'CIDCO - College',
    stops: [
      { name: 'CIDCO', lat: 20.0320, lng: 73.7480 },
      { name: 'Pathardi Phata', lat: 20.0260, lng: 73.7530 },
      { name: 'Nashik Phata', lat: 20.0180, lng: 73.7610 },
      { name: 'Mumbai Naka', lat: 20.0050, lng: 73.7730 },
      { name: 'CBS', lat: 19.9975, lng: 73.7920 },
      { name: 'College Campus (Main)', lat: 19.9810, lng: 73.8000 },
    ]
  },
  {
    name: 'Deolali - College',
    stops: [
      { name: 'Deolali Camp', lat: 19.9460, lng: 73.8350 },
      { name: 'Deolali Gaon', lat: 19.9520, lng: 73.8280 },
      { name: 'Vihas Nagar', lat: 19.9580, lng: 73.8210 },
      { name: 'Nashik Road Station', lat: 19.9630, lng: 73.8130 },
      { name: 'Bytco Point', lat: 19.9740, lng: 73.8000 },
      { name: 'College Campus (Main)', lat: 19.9810, lng: 73.8000 },
    ]
  },
  {
    name: 'Makhmalabad - College',
    stops: [
      { name: 'Makhmalabad', lat: 20.0400, lng: 73.7700 },
      { name: 'Gadge Nagar', lat: 20.0340, lng: 73.7720 },
      { name: 'Satpur Colony', lat: 20.0210, lng: 73.7590 },
      { name: 'Rane Nagar', lat: 20.0140, lng: 73.7700 },
      { name: 'Panchavati', lat: 20.0063, lng: 73.7910 },
      { name: 'College Campus (Main)', lat: 19.9810, lng: 73.8000 },
    ]
  },
  {
    name: 'Adgaon - College',
    stops: [
      { name: 'Adgaon Naka', lat: 20.0450, lng: 73.7400 },
      { name: 'Pipeline Road', lat: 20.0370, lng: 73.7480 },
      { name: 'Pathardi Phata', lat: 20.0260, lng: 73.7530 },
      { name: 'CIDCO', lat: 20.0320, lng: 73.7480 },
      { name: 'Mumbai Naka', lat: 20.0050, lng: 73.7730 },
      { name: 'College Campus (Main)', lat: 19.9810, lng: 73.8000 },
    ]
  },
  {
    name: 'Trimbak Road - College',
    stops: [
      { name: 'Trimbak Naka', lat: 20.0260, lng: 73.7830 },
      { name: 'Dasak Phata', lat: 20.0200, lng: 73.7850 },
      { name: 'Panchavati', lat: 20.0063, lng: 73.7910 },
      { name: 'Shalimar', lat: 20.0030, lng: 73.7850 },
      { name: 'CBS', lat: 19.9975, lng: 73.7920 },
      { name: 'College Campus (Main)', lat: 19.9810, lng: 73.8000 },
    ]
  },
  {
    name: 'Sinnar - College',
    stops: [
      { name: 'Sinnar Phata', lat: 19.9300, lng: 73.8400 },
      { name: 'Ozar Phata', lat: 19.9400, lng: 73.8370 },
      { name: 'Deolali Camp', lat: 19.9460, lng: 73.8350 },
      { name: 'Nashik Road Station', lat: 19.9630, lng: 73.8130 },
      { name: 'Dwarka', lat: 19.9670, lng: 73.8070 },
      { name: 'College Campus (Main)', lat: 19.9810, lng: 73.8000 },
    ]
  },
  {
    name: 'Peth Road - College',
    stops: [
      { name: 'Peth Naka', lat: 20.0100, lng: 73.8050 },
      { name: 'Hirawadi', lat: 20.0060, lng: 73.8010 },
      { name: 'Govind Nagar', lat: 20.0010, lng: 73.7970 },
      { name: 'Raviwar Karanja', lat: 19.9990, lng: 73.7890 },
      { name: 'Ashok Stambh', lat: 19.9830, lng: 73.7930 },
      { name: 'College Campus (Main)', lat: 19.9810, lng: 73.8000 },
    ]
  },
  {
    name: 'Upnagar - College',
    stops: [
      { name: 'Upnagar Naka', lat: 19.9900, lng: 73.8100 },
      { name: 'Jail Road', lat: 19.9870, lng: 73.8060 },
      { name: 'Ashok Stambh', lat: 19.9830, lng: 73.7930 },
      { name: 'Tilak Wadi', lat: 19.9860, lng: 73.7960 },
      { name: 'College Road', lat: 19.9890, lng: 73.7960 },
      { name: 'College Campus (Main)', lat: 19.9810, lng: 73.8000 },
    ]
  },
];

const firstNames = ['Aarav', 'Vivaan', 'Aditya', 'Sai', 'Arjun', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan', 'Shaurya',
  'Ananya', 'Diya', 'Myra', 'Sara', 'Aadhya', 'Isha', 'Kiara', 'Riya', 'Priya', 'Kavya',
  'Rohan', 'Harsh', 'Dev', 'Yash', 'Ritik', 'Sneha'];
const lastNames = ['Sharma', 'Patel', 'Kulkarni', 'Deshmukh', 'Joshi', 'Patil', 'Shah', 'Mehta', 'Gupta', 'Singh',
  'Reddy', 'Iyer', 'Nair', 'Kumar', 'Verma', 'Chauhan', 'Yadav', 'Tiwari', 'Pandey', 'Mishra'];
const driverNames = ['Rajesh', 'Suresh', 'Manoj', 'Ramesh', 'Vijay', 'Prakash', 'Ganesh', 'Sunil', 'Anil', 'Sanjay',
  'Deepak', 'Amit', 'Ravi', 'Ashok', 'Mohan', 'Vinod', 'Kiran', 'Nitin', 'Sachin', 'Ajay',
  'Rahul', 'Pradeep', 'Santosh', 'Dinesh', 'Mahesh', 'Yogesh'];

const runSeed = async () => {
  try {
    await connectDB();
    console.log('Clearing database...');
    await User.deleteMany({});
    await Bus.deleteMany({});
    await Notification.deleteMany({});

    console.log('Seeding data...');

    // 1. Admin
    await User.create({
      loginId: 'admin',
      name: 'Admin User',
      password: 'admin123',
      role: 'admin',
    });

    // 2. Buses
    const mappedBuses = [];
    for (let i = 1; i <= 26; i++) {
        const routeIdx = (i - 1) % routes.length;
        const route = routes[routeIdx];
        const stops = route.stops.map((s, idx) => ({ ...s, order: idx + 1 }));
        
        mappedBuses.push({
            number: `SB-${String(i).padStart(2, '0')}`,
            route: route.name,
            stops: stops,
            capacity: 50,
        });
    }

    const insertedBuses = await Bus.insertMany(mappedBuses);

    // 3. Drivers
    for (let i = 1; i <= 26; i++) {
        const bus = insertedBuses[i - 1];
        const driverId = `DRV${String(i).padStart(3, '0')}`;
        const newDriver = await User.create({
            loginId: driverId,
            name: `${driverNames[i - 1] || 'Driver'} Patil`,
            password: 'password123',
            role: 'driver',
            driverId: driverId,
            phone: `98${String(70000000 + i).padStart(8, '0')}`,
            assignedBus: bus._id
        });
        
        bus.assignedDriver = newDriver._id;
        await bus.save();
    }

    // 4. Students
    for (let i = 1; i <= 104; i++) {
        const busIdx = (i - 1) % 26;
        const bus = insertedBuses[busIdx];
        
        const fn = firstNames[(i - 1) % firstNames.length];
        const ln = lastNames[(i - 1) % lastNames.length];
        const studentErpId = `STU${String(i).padStart(3, '0')}`;

        const busStops = bus.stops.filter((s) => s.name !== 'College Campus (Main)');
        const pickupStop = busStops[Math.floor(Math.random() * busStops.length)]?.name || busStops[0]?.name;

        const newStudent = await User.create({
            loginId: studentErpId,
            name: `${fn} ${ln}`,
            password: 'password123',
            role: 'student',
            erpId: studentErpId,
            assignedBus: bus._id,
            pickupStop: pickupStop,
            pickupLocation: pickupStop,
            dropStop: 'College Campus (Main)',
            dropLocation: 'College Campus (Main)'
        });

        bus.assignedStudents.push(newStudent._id);
        if (i % 26 === 0 || i === 104) {
             await bus.save(); 
        }
    }

    // Explicitly emit a save for buses that haven't been saved yet just in case.
    for(const bus of insertedBuses) {
       if(bus.isModified()) {
           await bus.save();
       }
    }


    // 5. Initial Notifications
    await Notification.insertMany([
        { message: 'Welcome to Sandip Bus Tracker! Track your bus in real-time.', type: 'info', targetRole: 'student' },
        { message: 'Please ensure GPS is enabled before starting your trip. Using simulated location if actual geolocation fails.', type: 'info', targetRole: 'driver' },
    ]);

    console.log('✅ Seeding completed successfully!');
    process.exit(0);

  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
};

runSeed();
