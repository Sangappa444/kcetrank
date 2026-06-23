const mongoose = require('mongoose');
const kcetConnection = require('../config/KCETdb');

const cutoffSchema = new mongoose.Schema({
    college_code: { type: String, required: true, index: true },
    college_name: { type: String, required: true },
    course_name: { type: String, required: true, index: true },
    stream: { type: String, index: true },
    cutoff_rank_num: { type: Number, index: true }, // Added for ultra-fast sorting
    year: { type: String, index: true },
    round: { type: String, index: true },
    category: { type: String, required: true, index: true }
});

// Create compound indexes to optimize specific API queries
cutoffSchema.index({ college_name: 1, course_name: 1, year: 1, round: 1 });
cutoffSchema.index({ category: 1, course_name: 1 });
cutoffSchema.index({ cutoff_rank_num: 1 });

const CATEGORIES = [
    'Engineering', 'Agriculture', 'Veterinary', 'B.Pharm', 'D.Pharm',
    'B.Sc Nursing', 'BNYS', 'Allied Health Sciences', 'BPT', 'BPO', 'Architecture'
];

const streamModels = {};
CATEGORIES.forEach(streamName => {
    const safeName = streamName.replace(/[^a-zA-Z0-9]/g, '');
    const collectionName = 'Cutoff_' + safeName;
    streamModels[streamName] = kcetConnection.model(collectionName, cutoffSchema, collectionName);
    streamModels[streamName].syncIndexes().catch(err => console.error('[KCET] Index error:', err));
});

function getModelForStream(streamName) {
    if (!streamName || !streamModels[streamName]) return streamModels['Engineering'];
    return streamModels[streamName];
}

module.exports = {
    cutoffSchema,
    CATEGORIES,
    streamModels,
    getModelForStream
};
