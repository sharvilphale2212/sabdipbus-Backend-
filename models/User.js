const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  loginId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['student', 'driver', 'admin'],
    required: true,
    index: true,
  },
  phone: {
    type: String,
    default: '',
  },

  // ── Student-specific fields ──
  erpId: {
    type: String,
    sparse: true,
    index: true,
  },
  pickupStop: {
    type: String,
    default: '',
  },
  dropStop: {
    type: String,
    default: 'College Campus (Main)',
  },
  pickupLocation: {
    type: String,
    default: '',
  },
  dropLocation: {
    type: String,
    default: 'College Campus (Main)',
  },

  // ── Driver-specific fields ──
  driverId: {
    type: String,
    sparse: true,
  },
  isActive: {
    type: Boolean,
    default: false,
  },

  // ── Shared fields ──
  assignedBus: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bus',
    default: null,
  },
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      ret.id = ret._id.toString();
      delete ret.__v;
      delete ret.password;
      return ret;
    }
  },
  toObject: { virtuals: true },
});

// Pre-save hook to hash password
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Static method to find user by credentials
userSchema.statics.findByCredentials = async function (loginId, password) {
  const user = await this.findOne({ loginId });
  if (!user) return null;

  const isMatch = await user.comparePassword(password);
  if (!isMatch) return null;

  return {
    id: user._id.toString(),
    name: user.name,
    role: user.role,
  };
};

const User = mongoose.model('User', userSchema);

module.exports = User;
