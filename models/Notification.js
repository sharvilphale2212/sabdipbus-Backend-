const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  message: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['info', 'warning', 'delay', 'arrival'],
    default: 'info',
  },
  targetRole: {
    type: String,
    enum: ['all', 'student', 'driver', 'admin'],
    default: 'all',
  },
  targetIds: [{
    type: String,
  }],
  read: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      ret.id = ret._id.toString();
      ret.createdAt = ret.createdAt.toISOString();
      delete ret.__v;
      return ret;
    }
  },
});

// Auto-delete notifications older than 7 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 604800 });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
