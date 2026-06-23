const mongoose = require('mongoose');
const kcetConnection = require('../config/KCETdb');

const kcetCounselorRequestSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    userName: {
        type: String,
        required: true
    },
    userEmail: {
        type: String,
        required: true
    },
    userPhone: {
        type: String,
        required: true
    },
    stream: {
        type: String,
        required: true
    },
    comments: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'In Progress', 'Resolved'],
        default: 'Pending',
        index: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const KCETCounselorRequest = kcetConnection.model('KCETCounselorRequest', kcetCounselorRequestSchema, 'KCETCounselorRequests');

module.exports = KCETCounselorRequest;
