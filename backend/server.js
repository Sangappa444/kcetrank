require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3001;
const DB_PATH = path.join(__dirname, '..', 'data', 'cutoffs.db');

app.use(cors());
app.use(express.json());

const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error('Error connecting to the database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
    }
});

function getCategoryForCourse(courseName) {
    const name = courseName.toUpperCase();
    if (name.includes('ARCHITECTURE')) return 'Architecture';
    if (name.includes('B-PHARMA')) return 'B.Pharm';
    if (name.includes('PHARMA-D') || name.includes('PHARM-D')) return 'D.Pharm';
    if (name.includes('VETERINARY') || name.includes('VETER SCI') || name.includes('B.V.SC')) return 'Veterinary';
    if (name.includes('NURSING')) return 'B.Sc Nursing';
    if (name.includes('BNYS') || name.includes('NATUROPATHY') || name.includes('YOGA')) return 'BNYS';
    if (name.includes('PHYSIOTHERAPY') || name.includes('BPT')) return 'BPT';
    if (name.includes('PROSTHETICS ORTHOTICS') || name.includes('BPO')) return 'BPO';
    if (name.includes('OPTOMETRY')) return 'BPO';
    
    // Agriculture and Farm Sciences
    if (name.includes('AGRICULTURE') || name.includes('AGRI') || name.includes('FORESTRY') || 
        name.includes('HORTICULTURE') || name.includes('SERICULTURE') || name.includes('FISHERIES') || 
        name.includes('FOOD SCI') || name.includes('DAIRY') || name.includes('NUTRITION') || 
        name.includes('DIETETICS') || name.includes('COMMUNITY SCIENCE') || name.includes('FOOD TECHNOLOGY') || 
        name.includes('FOOD TECH')) {
        return 'Agriculture';
    }
    
    // Allied Health Sciences
    if (name.includes('AHS') || name.includes('OPERATION THEATER') || name.includes('OCCUPATIONAL') || 
        name.includes('AUDIOLOGY') || name.includes('ANAEST') || name.includes('CARDIAC') || 
        name.includes('TRAUMA') || name.includes('IMAGING') || name.includes('LAB') || 
        name.includes('NEURO') || name.includes('PERFUSION') || name.includes('RADIOTHERAPY') || 
        name.includes('RENAL') || name.includes('RESP') || name.includes('HOSP. ADMIN') || 
        name.includes('RECORD TECH') || name.includes('PUBLIC HEALTH')) {
        return 'Allied Health Sciences';
    }
    
    return 'Engineering';
}

// GET /api/categories
app.get('/api/categories', (req, res) => {
    const categories = [
        'Engineering',
        'Agriculture',
        'Veterinary',
        'B.Pharm',
        'D.Pharm',
        'B.Sc Nursing',
        'BNYS',
        'Allied Health Sciences',
        'BPT',
        'BPO',
        'Architecture'
    ];
    res.json(categories);
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
    const { category } = req.query;
    const query = 'SELECT DISTINCT course_name FROM cutoffs ORDER BY course_name';
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        let courses = rows.map(row => row.course_name);
        if (category) {
            courses = courses.filter(course => getCategoryForCourse(course) === category);
        }
        res.json(courses);
    });
});

// GET /api/cutoffs
app.get('/api/cutoffs', (req, res) => {
    const { year, round, college_code, category, course_name, course_category } = req.query;
    
    let query = 'SELECT * FROM cutoffs WHERE 1=1';
    let params = [];
    
    if (year) { query += ' AND year = ?'; params.push(year); }
    if (round) { query += ' AND round = ?'; params.push(round); }
    if (college_code) { query += ' AND college_code = ?'; params.push(college_code); }
    if (category) { query += ' AND category = ?'; params.push(category); }
    if (course_name) { query += ' AND course_name = ?'; params.push(course_name); }
    
    query += ' ORDER BY college_name, course_name, year, round';
    
    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        let results = rows;
        if (course_category) {
            results = results.filter(row => getCategoryForCourse(row.course_name) === course_category);
        }
        res.json(results);
    });
});

// GET /api/predict
app.get('/api/predict', (req, res) => {
    const { rank, category, course_name, course_category } = req.query;
    
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
        
        let predictions = rows.map(row => {
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
        
        if (course_category) {
            predictions = predictions.filter(r => getCategoryForCourse(r.course_name) === course_category);
        }
        
        predictions.sort((a, b) => {
            if (a.cutoff_rank_num !== b.cutoff_rank_num) {
                return a.cutoff_rank_num - b.cutoff_rank_num;
            }
            if (a.year !== b.year) {
                return a.year - b.year;
            }
            if (a.round !== b.round) {
                return a.round - b.round;
            }
            const collegeCompare = a.college_name.localeCompare(b.college_name);
            return collegeCompare !== 0 ? collegeCompare : a.course_name.localeCompare(b.course_name);
        });
        res.json(predictions);
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
