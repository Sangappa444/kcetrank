require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.urlencoded({ extended: true }));

// Serve static assets for /kcet
app.use('/kcet', express.static(path.join(__dirname, 'public')));

// EJS View Engine Configuration
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Mount the Auth router
const authRouter = require('./routes/KCETauth');
app.use('/kcet/api/auth', authRouter);

// Mount the KCET router
const kcetRouter = require('./KCETroutes');
app.use('/kcet', kcetRouter);

// Root path redirect
app.get('/', (req, res) => {
    res.redirect('/kcet');
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('[Server Error]:', err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
});

// Start listening only if not in Vercel serverless environment
if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
        console.log(`Open http://localhost:${PORT}/kcet to access the KCET Predictor`);
    });
}

module.exports = app;
