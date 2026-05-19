require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const Razorpay = require('razorpay');

const app = express();
const PORT = process.env.PORT || 3001;
const DB_PATH = path.join(__dirname, '..', 'data', 'cutoffs.db');

app.use(cors());
app.use(express.json());

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'dummy_id',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_secret',
});

const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error('Error connecting to the database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
    }
});

// GET /api/colleges
app.get('/api/colleges', (req, res) => {
    const query = 'SELECT DISTINCT college_code, college_name FROM cutoffs ORDER BY college_name';
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// GET /api/courses
app.get('/api/courses', (req, res) => {
    const query = 'SELECT DISTINCT course_name FROM cutoffs ORDER BY course_name';
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(row => row.course_name));
    });
});

// GET /api/cutoffs
app.get('/api/cutoffs', (req, res) => {
    const { year, round, college_code, category } = req.query;
    
    let query = 'SELECT * FROM cutoffs WHERE 1=1';
    let params = [];
    
    if (year) { query += ' AND year = ?'; params.push(year); }
    if (round) { query += ' AND round = ?'; params.push(round); }
    if (college_code) { query += ' AND college_code = ?'; params.push(college_code); }
    if (category) { query += ' AND category = ?'; params.push(category); }
    
    query += ' ORDER BY college_name, course_name, round, year';
    
    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// GET /api/predict
app.get('/api/predict', (req, res) => {
    const { rank, category, course_name } = req.query;
    
    if (!rank || !category) {
        return res.status(400).json({ error: 'Rank and category are required' });
    }
    
    const userRank = parseInt(rank, 10);
    
    let query = `
        SELECT college_code, college_name, course_name, cutoff_rank, year, round 
        FROM cutoffs 
        WHERE category = ?
    `;
    let params = [category];
    
    if (course_name) {
        query += ' AND course_name = ?';
        params.push(course_name);
    }
    
    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const predictions = rows.map(row => {
            const cutoff = parseInt(row.cutoff_rank, 10);
            if (isNaN(cutoff)) return null;
            
            let chances = 'Tough';
            if (userRank <= cutoff * 0.8) chances = 'Safe';
            else if (userRank <= cutoff) chances = 'Moderate';
            
            return {
                ...row,
                cutoff_rank_num: cutoff,
                chances
            };
        }).filter(r => r !== null);
        
        predictions.sort((a, b) => a.cutoff_rank_num - b.cutoff_rank_num);
        res.json(predictions);
    });
});

// POST /api/create-order
app.post('/api/create-order', async (req, res) => {
    try {
        const options = {
            amount: 10 * 100, // ₹10
            currency: "INR",
            receipt: `receipt_${Date.now()}`
        };
        const order = await razorpay.orders.create(options);
        res.json(order);
    } catch (error) {
        console.error("Razorpay Order Error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
