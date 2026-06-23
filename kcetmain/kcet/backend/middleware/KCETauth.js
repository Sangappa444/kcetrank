const jwt = require('jsonwebtoken');
const User = require('../models/KCETUser');

module.exports = async function (req, res, next) {
    // Get token from header
    const authHeader = req.header('Authorization');
    
    if (!authHeader) {
        return res.status(401).json({ error: 'No token, authorization denied' });
    }

    // Check if token starts with Bearer
    if (!authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token format is invalid. Should be Bearer <token>' });
    }

    const token = authHeader.split(' ')[1];

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecret_key_123_abc');
        
        // Find user in db and attach to request
        const user = await User.findById(decoded.userId).select('-password');
        if (!user) {
            return res.status(401).json({ error: 'User not found, authorization denied' });
        }

        req.user = user;
        next();
    } catch (err) {
        console.error('[Auth Middleware] Token verification failed:', err.message);
        res.status(401).json({ error: 'Token is not valid' });
    }
};
