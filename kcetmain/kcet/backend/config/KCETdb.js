const mongoose = require('mongoose');

// MongoDB connection URI
const kcetDbUri = process.env.MONGODB_URI || 'mongodb+srv://freefireb2k444_db_user:6L8JB9yOXIfBTwmg@cluster0.h7nxozh.mongodb.net/kcet_db?appName=Cluster0';

// Create connection
const kcetConnection = mongoose.createConnection(kcetDbUri);

kcetConnection.on('error', (err) => {
    console.error('[KCET DB] Error connecting to MongoDB:', err.message);
});

kcetConnection.once('open', () => {
    console.log('[KCET DB] Connected to KCET MongoDB successfully');
});

module.exports = kcetConnection;
