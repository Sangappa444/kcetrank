const mongoose = require('mongoose');
const kcetConnection = require('../config/KCETdb');

const collegeSchema = new mongoose.Schema({
    college_code: { type: String, required: true, unique: true, index: true },
    college_name: { type: String, required: true }
});

const College = kcetConnection.model('College', collegeSchema, 'Colleges');

module.exports = College;
