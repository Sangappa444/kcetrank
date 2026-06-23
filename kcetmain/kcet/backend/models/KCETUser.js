const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const kcetConnection = require('../config/KCETdb');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        index: true
    },
    password: {
        type: String,
        required: false,
        minlength: 6
    },
    googleId: {
        type: String,
        index: true
    },
    subscriptionType: {
        type: String,
        enum: ['Basic', 'Pro', 'Ultra Pro'],
        default: 'Basic'
    },
    subscriptionStatus: {
        type: String,
        enum: ['Active', 'Expired', 'None'],
        default: 'Active'
    },
    subscriptionExpiresAt: {
        type: Date,
        default: null
    },
    pdfDownloadsLeft: {
        type: Number,
        default: 0
    },
    pdfDownloadsUsed: {
        type: Number,
        default: 0
    },
    phoneNumber: {
        type: String,
        trim: true,
        default: null
    },
    rank: {
        type: Number,
        default: null
    },
    category: {
        type: String,
        default: null
    },
    savedOptions: [{
        college_code: { type: String, required: true },
        college_name: { type: String, required: true },
        course_name: { type: String, required: true },
        priority: { type: Number, required: true }
    }],
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user',
        index: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Pre-save hook to hash password before saving to the database
userSchema.pre('save', async function (next) {
    const user = this;
    if (!user.password || !user.isModified('password')) return next();

    try {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
        next();
    } catch (err) {
        next(err);
    }
});

// Method to compare candidate password with the hashed password
userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

// Create compilation on our kcetConnection
const User = kcetConnection.model('User', userSchema, 'Users');

module.exports = User;
