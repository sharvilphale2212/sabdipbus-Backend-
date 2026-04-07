const mongoose = require('mongoose');

const stopSchema = new mongoose.Schema({
  name: { type: String, required: true },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  order: { type: Number, required: true },
}, { _id: false });

const busSchema = new mongoose.Schema({
  number: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  route: {
    type: String,
    required: true,
    trim: true,
  },
  stops: [stopSchema],
  assignedDriver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  assignedStudents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  status: {
    type: String,
    enum: ['idle', 'on-route', 'delayed'],
    default: 'idle',
  },
  tripActive: {
    type: Boolean,
    default: false,
  },
  capacity: {
    type: Number,
    default: 50,
  },
  currentLocation: {
    lat: Number,
    lng: Number,
  },
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      ret.id = ret._id.toString();
      delete ret.__v;
      return ret;
    }
  },
  toObject: { virtuals: true },
});

// Virtual for student count
busSchema.virtual('studentCount').get(function () {
  return this.assignedStudents ? this.assignedStudents.length : 0;
});

const Bus = mongoose.model('Bus', busSchema);

module.exports = Bus;
