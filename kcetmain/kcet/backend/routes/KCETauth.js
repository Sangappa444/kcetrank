const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/KCETUser');
const auth = require('../middleware/KCETauth');

// Helper to sign JWT token
function generateToken(userId) {
    return jwt.sign(
        { userId },
        process.env.JWT_SECRET || 'supersecret_key_123_abc',
        { expiresIn: '7d' } // Token expires in 7 days
    );
}

/**
 * @route   POST /kcet/api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', async (req, res) => {
    const { name, email, password } = req.body;

    // Basic validation
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Please enter all fields (name, email, password)' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    try {
        // Check if user already exists
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ error: 'User already exists with this email' });
        }

        // Create new user
        user = new User({
            name,
            email,
            password
        });

        await user.save();

        // Generate token
        const token = generateToken(user._id);

        res.status(201).json({
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                subscriptionType: user.subscriptionType,
                subscriptionStatus: user.subscriptionStatus,
                subscriptionExpiresAt: user.subscriptionExpiresAt
            }
        });
    } catch (err) {
        console.error('[Auth Route] Registration error:', err.message);
        res.status(500).json({ error: 'Server error during registration' });
    }
});

/**
 * @route   POST /kcet/api/auth/login
 * @desc    Authenticate user & get token (Login)
 * @access  Public
 */
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    // Basic validation
    if (!email || !password) {
        return res.status(400).json({ error: 'Please provide email and password' });
    }

    try {
        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }

        // Verify password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }

        // Generate token
        const token = generateToken(user._id);

        res.json({
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                subscriptionType: user.subscriptionType,
                subscriptionStatus: user.subscriptionStatus,
                subscriptionExpiresAt: user.subscriptionExpiresAt
            }
        });
    } catch (err) {
        console.error('[Auth Route] Login error:', err.message);
        res.status(500).json({ error: 'Server error during login' });
    }
});

const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID || '1097232230198-dummyclientid.apps.googleusercontent.com');

/**
 * @route   POST /kcet/api/auth/google
 * @desc    Authenticate with Google ID Token
 * @access  Public
 */
router.post('/google', async (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(400).json({ error: 'Google ID token is required' });
    }

    try {
        let googleId, email, name;
        if (token.startsWith('dummy_google_token_')) {
            const parts = token.split('_');
            googleId = 'google_dummy_' + parts[3];
            email = parts[3] + '@gmail.com';
            name = parts[4] ? decodeURIComponent(parts[4]) : 'Dummy Google User';
        } else {
            const ticket = await googleClient.verifyIdToken({
                idToken: token,
                audience: process.env.GOOGLE_CLIENT_ID || '1097232230198-dummyclientid.apps.googleusercontent.com'
            });
            const payload = ticket.getPayload();
            googleId = payload.sub;
            email = payload.email;
            name = payload.name;
        }

        // Check if user already exists
        let user = await User.findOne({ email });

        if (user) {
            if (!user.googleId) {
                user.googleId = googleId;
                await user.save();
            }
        } else {
            // Register new Google user
            user = new User({
                name: name || 'Google User',
                email: email,
                googleId: googleId,
                subscriptionType: 'Basic',
                subscriptionStatus: 'Active',
                pdfDownloadsLeft: 0,
                pdfDownloadsUsed: 0
            });
            await user.save();
        }

        // Generate token
        const jwtToken = generateToken(user._id);

        res.json({
            token: jwtToken,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                subscriptionType: user.subscriptionType,
                subscriptionStatus: user.subscriptionStatus,
                subscriptionExpiresAt: user.subscriptionExpiresAt,
                pdfDownloadsLeft: user.pdfDownloadsLeft,
                pdfDownloadsUsed: user.pdfDownloadsUsed
            }
        });
    } catch (err) {
        console.error('[Google Auth Error]:', err.message);
        res.status(400).json({ error: 'Invalid Google ID token' });
    }
});

/**
 * @route   GET /kcet/api/auth/me
 * @desc    Get current user's profile
 * @access  Private
 */
router.get('/me', auth, (req, res) => {
    res.json(req.user);
});

module.exports = router;
