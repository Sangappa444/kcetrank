const mongoose = require('mongoose');
const kcetConnection = require('../config/KCETdb');

const transactionSchema = new mongoose.Schema({
    transactionId: { type: String, required: true, unique: true, index: true },
    orderId: { type: String, required: true, index: true },
    price: { type: Number, required: true },
    timestamp: { type: Date, required: true, index: true, default: Date.now }
});

const Transaction = kcetConnection.model('TransactionKcet', transactionSchema);

// Force build indexes in the background
Transaction.syncIndexes().then(() => {
    console.log('[KCET DB] Transaction Indexes synchronized successfully.');
}).catch(err => {
    console.error('[KCET DB] Failed to sync Transaction indexes:', err);
});

module.exports = Transaction;
