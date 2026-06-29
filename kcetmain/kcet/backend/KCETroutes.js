/**
 * KCET Backend Routes
 * Handles KCET cutoff predictions, college information, and payment processing
 * Mounted at /kcet in the main server.js
 */
require('dns').setServers(['1.1.1.1', '8.8.8.8']);

const express = require('express');
const router = express.Router();

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');

// Import models
const College = require('./models/KCETCollege');
const { CATEGORIES, getModelForStream, streamModels } = require('./models/KCETCutoff');
const Transaction = require('./models/KCETTransaction');
const User = require('./models/KCETUser');
const KCETCounselorRequest = require('./models/KCETCounselorRequest');
const auth = require('./middleware/KCETauth');
const { sendPDFEmail } = require('./utils/emailService');

// ===== RAZORPAY CONFIGURATION =====
// Serve static assets directly from this router to ensure paths resolve correctly regardless of server.js config
router.use(express.static(path.join(__dirname, 'public')));

// ===== RAZORPAY CONFIGURATION =====
const razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_DUMMYKEY123',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_secret_123'
});

// ===== API ROUTES =====

/**
 * GET /kcet/
 * Renders the main KCET predictor page
 */
router.get('/', (req, res) => {
    try {
        // View file is at kcet/backend/views/KCETindex.ejs
        res.render('KCETindex', {
            razorpayKey: process.env.RAZORPAY_KEY_ID || 'rzp_test_DUMMYKEY123'
        });
    } catch (err) {
        console.error('[KCET] Error rendering main page:', err.message);
        res.status(500).json({ error: 'Failed to load KCET predictor' });
    }
});

/**
 * GET /kcet/login
 * Renders the login/registration page
 */
router.get('/login', (req, res) => {
    try {
        res.render('KCETlogin');
    } catch (err) {
        console.error('[KCET] Error rendering login page:', err.message);
        res.status(500).json({ error: 'Failed to load login page' });
    }
});

/**
 * GET /kcet/Oauth/login
 * Handles Google OAuth redirection, code exchange, and session injection
 */
router.get('/Oauth/login', async (req, res) => {
    try {
        const host = req.get('host');
        const protocol = host.includes('localhost') ? 'http' : 'https';
        const redirectUri = `${protocol}://${host}/kcet/Oauth/login`;
        
        const oauth2Client = new OAuth2Client(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            redirectUri
        );

        const { code } = req.query;

        if (!code) {
            // Generate consent page URL and redirect
            const authUrl = oauth2Client.generateAuthUrl({
                access_type: 'offline',
                scope: ['profile', 'email'],
                prompt: 'consent'
            });
            return res.redirect(authUrl);
        }

        // Exchange code for tokens
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // Verify ID Token
        const ticket = await oauth2Client.verifyIdToken({
            idToken: tokens.id_token,
            audience: process.env.GOOGLE_CLIENT_ID
        });
        const payload = ticket.getPayload();
        const googleId = payload.sub;
        const email = payload.email;
        const name = payload.name;

        // Find or create user in MongoDB
        let user = await User.findOne({ email });

        if (user) {
            if (!user.googleId) {
                user.googleId = googleId;
                await user.save();
            }
        } else {
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

        // Generate JWT token
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET || 'supersecret_key_123_abc',
            { expiresIn: '7d' }
        );

        // Render injection script to store token in localStorage and redirect to dashboard
        const sanitizedUser = {
            id: user._id,
            name: user.name,
            email: user.email,
            subscriptionType: user.subscriptionType,
            subscriptionStatus: user.subscriptionStatus,
            subscriptionExpiresAt: user.subscriptionExpiresAt,
            pdfDownloadsLeft: user.pdfDownloadsLeft,
            pdfDownloadsUsed: user.pdfDownloadsUsed
        };

        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Verifying Login...</title>
                <script>
                    localStorage.setItem('kcet_jwt_token', '${token}');
                    localStorage.setItem('kcet_user', JSON.stringify(${JSON.stringify(sanitizedUser)}));
                    window.location.href = '/kcet';
                </script>
            </head>
            <body>
                <p style="font-family: sans-serif; text-align: center; margin-top: 50px;">
                    Authentication successful! Redirecting you to the KCET Predictor...
                </p>
            </body>
            </html>
        `);

    } catch (err) {
        console.error('[Google OAuth Error]:', err.message);
        res.status(500).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Login Failed</title>
            </head>
            <body style="font-family: sans-serif; text-align: center; margin-top: 50px;">
                <h3 style="color: #ef4444;">Google Sign-In Failed</h3>
                <p>\${err.message}</p>
                <a href="/kcet/login">Back to Sign In</a>
            </body>
            </html>
        `);
    }
});

/**
 * GET /kcet/api/categories
 * Returns all available course categories
 */
router.get('/api/categories', (req, res) => {
    try {
        res.json(CATEGORIES);
    } catch (err) {
        console.error('[KCET] Error fetching categories:', err.message);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

/**
 * GET /kcet/api/colleges
 * Returns all colleges from the database
 */
router.get('/api/colleges', async (req, res) => {
    try {
        const colleges = await College.find({}, { _id: 0, college_code: 1, college_name: 1 }).sort({ college_name: 1 });
        res.json(colleges);
    } catch (err) {
        console.error('[KCET] Database error fetching colleges:', err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /kcet/api/courses
 * Returns courses filtered by category
 * Query params: category (optional)
 */
router.get('/api/courses', async (req, res) => {
    const { category } = req.query;

    try {
        if (!category) {
            // Fetch courses from ALL streams
            const promises = CATEGORIES.map(stream => streamModels[stream] ? streamModels[stream].distinct('course_name') : Promise.resolve([]));
            const allResults = await Promise.all(promises);
            const allCoursesSet = new Set(allResults.flat());
            let courses = Array.from(allCoursesSet).sort();
            res.json(courses);
        } else {
            const streamModel = getModelForStream(category);
            const coursesData = await streamModel.distinct('course_name');

            let courses = coursesData.sort();
            res.json(courses);
        }
    } catch (err) {
        console.error('[KCET] Database error fetching courses:', err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /kcet/api/cutoffs
 * Returns cutoff data with optional filtering
 * Query params: year, round, college_code, category (comma-separated), course_name (comma-separated), course_category (optional)
 */
router.get('/api/cutoffs', async (req, res) => {
    const { year, round, college_code, category, course_name, course_category } = req.query;

    let filter = {};
    if (year) filter.year = year;
    if (round) filter.round = round;
    if (college_code) {
        const codesList = Array.isArray(college_code) ? college_code : college_code.split(',').filter(Boolean);
        if (codesList.length > 0) {
            filter.college_code = { $in: codesList };
        }
    }

    // Handle category as comma-separated string or array
    if (category) {
        const categoriesList = Array.isArray(category) ? category : category.split(',').filter(Boolean);
        if (categoriesList.length > 0) {
            filter.category = { $in: categoriesList };
        }
    }

    // Handle course_name as comma-separated string or array
    if (course_name) {
        const coursesList = Array.isArray(course_name) ? course_name : course_name.split(',').filter(Boolean);
        if (coursesList.length > 0) {
            filter.course_name = { $in: coursesList };
        }
    }

    try {
        let results = [];
        if (course_category) {
            const CutoffModel = getModelForStream(course_category);
            results = await CutoffModel.find(filter).sort({ college_name: 1, course_name: 1, year: 1, round: 1 }).lean();
        } else {
            // Search all streams
            const promises = CATEGORIES.map(stream => {
                const CutoffModel = getModelForStream(stream);
                return CutoffModel.find(filter).lean();
            });
            const allResults = await Promise.all(promises);
            results = allResults.flat();

            // Sort in JS since we combined results from multiple collections
            results.sort((a, b) => {
                if (a.college_name !== b.college_name) return a.college_name.localeCompare(b.college_name);
                if (a.course_name !== b.course_name) return a.course_name.localeCompare(b.course_name);
                if (a.year !== b.year) return a.year.localeCompare(b.year);
                return a.round.localeCompare(b.round);
            });
        }

        res.json(results);
    } catch (err) {
        console.error('[KCET] Database error fetching cutoffs:', err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /kcet/api/predict
 * Predicts college admission chances based on rank and categories
 * Query params: rank (required), category (required, comma-separated), course_name (optional, comma-separated), course_category (optional)
 */
router.get('/api/predict', async (req, res) => {
    const { rank, category, course_name, course_category } = req.query;

    if (!rank || !category) {
        return res.status(400).json({ error: 'Rank and category are required' });
    }

    const userRank = parseInt(rank, 10);

    if (isNaN(userRank) || userRank < 1) {
        return res.status(400).json({ error: 'Invalid rank value' });
    }

    // Parse categories as comma-separated string or array
    const categoriesList = Array.isArray(category) ? category : category.split(',').filter(Boolean);
    if (categoriesList.length === 0) {
        return res.status(400).json({ error: 'At least one category is required' });
    }

    let filter = { category: { $in: categoriesList } };

    // Parse course_name as comma-separated string or array
    if (course_name) {
        const coursesList = Array.isArray(course_name) ? course_name : course_name.split(',').filter(Boolean);
        // Optimize: If the user selected a massive amount of courses (e.g. "Select All"), 
        // we can safely drop the course_name filter and just scan the whole stream DB, which is much faster than massive $in
        if (coursesList.length > 0 && coursesList.length < 50) {
            filter.course_name = { $in: coursesList };
        }
    }

    // Apply College Search Filter
    if (req.query.college_codes) {
        const collegeCodesList = req.query.college_codes.split(',').filter(Boolean);
        if (collegeCodesList.length > 0) {
            filter.college_code = { $in: collegeCodesList };
        }
    }

    try {
        const CutoffModel = getModelForStream(course_category);

        // Fetch only up to 250000 records, sorted optimally by DB
        const rows = await CutoffModel.find(filter)
            .sort({ cutoff_rank_num: 1 })
            .limit(250000)
            .lean();

        let predictions = rows.map(row => {
            const cutoff = parseInt(row.cutoff_rank_num || row.cutoff_rank, 10);
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

        // Sorting the results logically
        predictions.sort((a, b) => {
            if (a.cutoff_rank_num !== b.cutoff_rank_num) {
                return a.cutoff_rank_num - b.cutoff_rank_num;
            }
            if (a.year !== b.year) {
                return b.year - a.year; // Latest year first
            }
            if (a.round !== b.round) {
                return a.round - b.round;
            }
            const collegeCompare = a.college_name.localeCompare(b.college_name);
            return collegeCompare !== 0 ? collegeCompare : a.course_name.localeCompare(b.course_name);
        });

        res.json(predictions);
    } catch (err) {
        console.error('[KCET] Database error predicting colleges:', err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /kcet/api/payment/order
 * Creates a Razorpay order for payment processing with dynamic pricing
 * Body: { categories: [], courses: [] }
 * Pricing: ₹99 base + ₹30 per extra category + ₹10 per extra course
 */
router.post('/api/payment/order', async (req, res) => {
    try {
        const { categories, courses, couponCode } = req.body;
        const categoriesList = Array.isArray(categories) ? categories : [];
        const coursesList = Array.isArray(courses) ? courses : [];

        // Check for 100% discount coupon admin45
        if (couponCode && couponCode.trim().toLowerCase() === 'admin45') {
            console.log('[KCET] Free payment order requested via admin45 coupon');
            return res.json({
                id: 'free_order_admin45',
                currency: 'INR',
                amount: 0,
                isFree: true
            });
        }

        // Calculate dynamic pricing
        let amount = 99; // Base amount in INR
        if (categoriesList.length > 1) {
            amount += (categoriesList.length - 1) * 30;
        }
        if (coursesList.length > 1) {
            amount += (coursesList.length - 1) * 10;
        }

        const amountInPaise = amount * 100; // Convert to paise for Razorpay

        const options = {
            amount: amountInPaise,
            currency: 'INR',
            receipt: 'receipt_order_kcet_' + Math.random().toString(36).substring(7)
        };

        const order = await razorpayInstance.orders.create(options);

        if (!order) {
            return res.status(500).json({ error: 'Failed to create payment order' });
        }

        console.log('[KCET] Payment order created:', order.id, 'Amount:', amount);
        res.json({
            id: order.id,
            currency: order.currency,
            amount: order.amount
        });

    } catch (error) {
        console.error('[KCET] Razorpay Error:', error.message);
        res.status(500).json({ error: 'Payment initialization failed', details: error.message });
    }
});

/**
 * POST /kcet/api/payment/validate-coupon
 * Validates a coupon code on the backend
 */
router.post('/api/payment/validate-coupon', (req, res) => {
    try {
        const { couponCode } = req.body;
        if (couponCode && couponCode.trim().toLowerCase() === 'admin45') {
            return res.json({
                success: true,
                discountPercent: 100,
                couponCode: 'admin45',
                message: 'Coupon applied successfully! 100% discount.'
            });
        }
        return res.status(400).json({
            success: false,
            message: 'Invalid coupon code.'
        });
    } catch (error) {
        console.error('[KCET] Coupon Validation Error:', error.message);
        res.status(500).json({ success: false, error: 'Coupon validation failed', details: error.message });
    }
});

/**
 * POST /kcet/api/payment/verify-payment
 * Verifies Razorpay payment signature and saves transaction to MongoDB
 */
router.post('/api/payment/verify-payment', async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, couponCode } = req.body;

        // Bypassing Razorpay signature verification for the admin45 coupon
        if (couponCode === 'admin45' || razorpay_order_id === 'free_order_admin45') {
            try {
                // Generate a unique transaction ID to satisfy MongoDB's unique index constraint
                const uniqueTxId = 'free_pay_' + crypto.randomBytes(8).toString('hex');
                const transaction = new Transaction({
                    transactionId: uniqueTxId,
                    orderId: razorpay_order_id || 'free_order_admin45',
                    price: 0,
                    timestamp: new Date()
                });

                await transaction.save();
                console.log('[KCET] Coupon-based free purchase verified and saved with ID:', uniqueTxId);

                return res.json({
                    success: true,
                    message: 'Payment verified successfully (Coupon Applied)'
                });
            } catch (dbError) {
                console.error('[KCET] Database Error saving transaction:', dbError.message);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to save transaction',
                    details: dbError.message
                });
            }
        }

        const sign = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSign = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || 'dummy_secret_123')
            .update(sign.toString())
            .digest("hex");

        if (razorpay_signature === expectedSign) {
            // Save transaction to MongoDB
            try {
                const { categories, courses } = req.body;
                const categoriesList = Array.isArray(categories) ? categories : [];
                const coursesList = Array.isArray(courses) ? courses : [];

                let price = 99; // Base amount in INR
                if (categoriesList.length > 1) {
                    price += (categoriesList.length - 1) * 30;
                }
                if (coursesList.length > 1) {
                    price += (coursesList.length - 1) * 10;
                }

                const transaction = new Transaction({
                    transactionId: razorpay_payment_id,
                    orderId: razorpay_order_id,
                    price: price,
                    timestamp: new Date()
                });

                await transaction.save();

                console.log('[KCET] Payment verified and saved:', razorpay_payment_id);

                return res.json({
                    success: true,
                    message: 'Payment verified successfully'
                });
            } catch (dbError) {
                console.error('[KCET] Database Error saving transaction:', dbError.message);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to save transaction',
                    details: dbError.message
                });
            }
        } else {
            return res.status(400).json({ success: false, message: 'Invalid payment signature' });
        }
    } catch (error) {
        console.error('[KCET] Verification Error:', error.message);
        res.status(500).json({ success: false, error: 'Verification failed', details: error.message });
    }
});

/**
 * POST /kcet/api/create-order
 * Creates a Razorpay order for payment processing
 * Body: { amount (paise), currency, receipt }
 */
router.post('/api/create-order', async (req, res) => {
    try {
        const { amount, currency, receipt } = req.body;

        // Validation: Minimum 100 paise (1 INR)
        if (!amount || amount < 100) {
            return res.status(400).json({ error: 'Amount must be at least 100 paise' });
        }

        const options = {
            amount: parseInt(amount, 10),
            currency: currency || 'INR',
            receipt: receipt || 'receipt_order_kcet_' + Math.random().toString(36).substring(7)
        };

        const order = await razorpayInstance.orders.create(options);

        if (!order) {
            return res.status(500).json({ error: 'Failed to create payment order' });
        }

        console.log('[KCET] Payment order created via /api/create-order:', order.id, 'Amount:', order.amount);
        res.json({
            order_id: order.id,
            amount: order.amount,
            currency: order.currency
        });

    } catch (error) {
        console.error('[KCET] Create Order Error:', error.message);
        res.status(500).json({ error: 'Payment initialization failed', details: error.message });
    }
});

/**
 * POST /kcet/api/verify-payment
 * Verifies Razorpay signature and saves transaction to MongoDB
 */
router.post('/api/verify-payment', async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, couponCode, amount } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ success: false, error: 'Missing required payment fields' });
        }

        // Bypassing Razorpay signature verification for the admin45 coupon
        if (couponCode === 'admin45' || razorpay_order_id === 'free_order_admin45') {
            try {
                const uniqueTxId = 'free_pay_' + crypto.randomBytes(8).toString('hex');
                const transaction = new Transaction({
                    transactionId: uniqueTxId,
                    orderId: razorpay_order_id || 'free_order_admin45',
                    price: 0,
                    timestamp: new Date()
                });

                await transaction.save();
                console.log('[KCET] Coupon-based free purchase verified and saved with ID:', uniqueTxId);

                return res.json({
                    success: true,
                    message: 'Payment verified successfully (Coupon Applied)'
                });
            } catch (dbError) {
                console.error('[KCET] Database Error saving transaction:', dbError.message);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to save transaction',
                    details: dbError.message
                });
            }
        }

        const sign = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSign = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || 'dummy_secret_123')
            .update(sign.toString())
            .digest("hex");

        if (razorpay_signature === expectedSign) {
            try {
                // If amount is passed in paise, convert to INR for DB storage, else use default pricing
                const price = amount ? amount / 100 : 99;

                const transaction = new Transaction({
                    transactionId: razorpay_payment_id,
                    orderId: razorpay_order_id,
                    price: price,
                    timestamp: new Date()
                });

                await transaction.save();

                console.log('[KCET] Payment verified and saved via /api/verify-payment:', razorpay_payment_id);

                return res.json({
                    success: true,
                    message: 'Payment verified successfully'
                });
            } catch (dbError) {
                console.error('[KCET] Database Error saving transaction:', dbError.message);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to save transaction',
                    details: dbError.message
                });
            }
        } else {
            return res.status(400).json({ success: false, message: 'Invalid payment signature' });
        }
    } catch (error) {
        console.error('[KCET] Verification Error:', error.message);
        res.status(500).json({ success: false, error: 'Verification failed', details: error.message });
    }
});

// ===== SUBSCRIPTION API ENDPOINTS =====

/**
 * POST /kcet/api/payment/subscription/order
 * Creates a Razorpay order for subscription plans
 * Body: { planType } (Pro or Ultra Pro)
 */
router.post('/api/payment/subscription/order', async (req, res) => {
    try {
        const { planType } = req.body;
        
        if (planType !== 'Pro' && planType !== 'Ultra Pro') {
            return res.status(400).json({ error: 'Invalid plan type' });
        }

        const price = planType === 'Pro' ? 599 : 5999;
        const amountInPaise = price * 100;

        const options = {
            amount: amountInPaise,
            currency: 'INR',
            receipt: `receipt_sub_${planType.toLowerCase().replace(' ', '')}_` + Math.random().toString(36).substring(7)
        };

        const order = await razorpayInstance.orders.create(options);

        if (!order) {
            return res.status(500).json({ error: 'Failed to create subscription order' });
        }

        console.log(`[KCET Sub] Order created: ${order.id} for Plan: ${planType}`);
        res.json({
            id: order.id,
            currency: order.currency,
            amount: order.amount,
            planType
        });
    } catch (error) {
        console.error('[KCET Sub] Razorpay Error:', error.message);
        res.status(500).json({ error: 'Subscription initialization failed', details: error.message });
    }
});

/**
 * POST /kcet/api/payment/subscription/verify
 * Verifies Razorpay signature and upgrades user's subscription plan in MongoDB
 */
router.post('/api/payment/subscription/verify', auth, async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planType, phoneNumber } = req.body;

        if (planType !== 'Pro' && planType !== 'Ultra Pro') {
            return res.status(400).json({ error: 'Invalid plan type' });
        }

        const sign = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSign = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || 'dummy_secret_123')
            .update(sign.toString())
            .digest("hex");

        if (razorpay_signature === expectedSign) {
            try {
                // Find and update active user
                const user = await User.findById(req.user._id);
                if (!user) {
                    return res.status(404).json({ error: 'User not found' });
                }

                const price = planType === 'Pro' ? 599 : 5999;
                
                // Upgrade subscription type and status
                user.subscriptionType = planType;
                user.subscriptionStatus = 'Active';
                if (phoneNumber) {
                    user.phoneNumber = phoneNumber;
                }
                
                // Expiry is 1 year from now
                const expiryDate = new Date();
                expiryDate.setFullYear(expiryDate.getFullYear() + 1);
                user.subscriptionExpiresAt = expiryDate;

                // Grant download credits
                if (planType === 'Pro') {
                    user.pdfDownloadsLeft = (user.pdfDownloadsLeft || 0) + 5;
                } else {
                    user.pdfDownloadsLeft = 9999; // Unlimited for Ultra Pro
                }

                await user.save();

                // Save transaction
                const transaction = new Transaction({
                    transactionId: razorpay_payment_id,
                    orderId: razorpay_order_id,
                    price: price,
                    timestamp: new Date()
                });
                await transaction.save();

                console.log(`[KCET Sub] User upgraded: ${user.email} -> ${planType}`);
                
                return res.json({
                    success: true,
                    message: `Upgraded to ${planType} successfully`,
                    user: {
                        id: user._id,
                        name: user.name,
                        email: user.email,
                        subscriptionType: user.subscriptionType,
                        subscriptionStatus: user.subscriptionStatus,
                        subscriptionExpiresAt: user.subscriptionExpiresAt,
                        pdfDownloadsLeft: user.pdfDownloadsLeft,
                        pdfDownloadsUsed: user.pdfDownloadsUsed,
                        phoneNumber: user.phoneNumber
                    }
                });
            } catch (dbError) {
                console.error('[KCET Sub] Database Error saving user:', dbError.message);
                return res.status(500).json({ success: false, error: 'Database upgrade failed', details: dbError.message });
            }
        } else {
            return res.status(400).json({ success: false, message: 'Invalid subscription signature' });
        }
    } catch (error) {
        console.error('[KCET Sub] Verification Error:', error.message);
        res.status(500).json({ success: false, error: 'Verification failed', details: error.message });
    }
});

/**
 * POST /kcet/api/payment/subscription-download
 * Authenticates subscription download, decrements credits and updates statistics
 */
router.post('/api/payment/subscription-download', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.subscriptionType !== 'Pro' && user.subscriptionType !== 'Ultra Pro') {
            return res.status(403).json({ error: 'Upgrade required' });
        }

        if (user.pdfDownloadsLeft <= 0) {
            return res.status(403).json({ error: 'No download credits remaining' });
        }

        // Decrement download credits
        if (user.pdfDownloadsLeft < 999) {
            user.pdfDownloadsLeft -= 1;
        }
        user.pdfDownloadsUsed += 1;
        await user.save();

        // Create transaction log
        const transaction = new Transaction({
            transactionId: 'sub_use_' + crypto.randomBytes(8).toString('hex'),
            orderId: 'sub_order_' + crypto.randomBytes(8).toString('hex'),
            price: 0,
            timestamp: new Date()
        });
        await transaction.save();

        console.log(`[KCET Sub] Download credit used: ${user.email}. Remaining: ${user.pdfDownloadsLeft}`);
        res.json({
            success: true,
            pdfDownloadsLeft: user.pdfDownloadsLeft,
            pdfDownloadsUsed: user.pdfDownloadsUsed
        });

    } catch (err) {
        console.error('[KCET Sub] Credit consumption error:', err.message);
        res.status(500).json({ error: 'Failed to process subscription download' });
    }
});

/**
 * POST /kcet/api/send-pdf
 * Sends the generated PDF report to the user's email
 */
router.post('/api/send-pdf', async (req, res) => {
    try {
        const { email, pdfBase64 } = req.body;
        if (!email || !pdfBase64) {
            return res.status(400).json({ error: 'Email and PDF data are required' });
        }
        
        // Convert base64 to buffer
        const base64Data = pdfBase64.replace(/^data:application\/pdf;base64,/, "");
        const pdfBuffer = Buffer.from(base64Data, 'base64');
        
        const result = await sendPDFEmail(email, pdfBuffer);
        if (result.success) {
            res.json({ success: true, message: 'PDF sent successfully' });
        } else {
            res.status(500).json({ error: 'Failed to send email' });
        }
    } catch (err) {
        console.error('[KCET Email] Error processing PDF email:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /kcet/api/subscription/resources
 * Fetches subscription resources according to user level
 */
router.get('/api/subscription/resources', auth, (req, res) => {
    try {
        const resources = {};

        if (req.user.subscriptionType === 'Pro' || req.user.subscriptionType === 'Ultra Pro') {
            resources.whatsappLink = 'https://chat.whatsapp.com/EWKgjqKvVM19mDABQm8c7P';
            resources.supportPhone = '+91 8880870645';
            resources.supportEmail = 'kea.vidyari@gmail.com';
            resources.updates = [
                { title: 'KEA Option Entry Guide 2026', date: '2026-06-18', url: '#' },
                { title: 'Top 50 Engineering Cutoff Trends', date: '2026-06-15', url: '#' }
            ];
        }

        if (req.user.subscriptionType === 'Ultra Pro') {
            resources.counselingLink = 'https://calendly.com/vidyari-counseling/personal-counseling-30min';
            resources.cutoffAnalyses = [
                { title: 'KEA Option Matrix Master list', date: '2026-06-19', url: '#' }
            ];
        }

        res.json(resources);
    } catch (err) {
        console.error('[KCET Sub] Resource fetching error:', err.message);
        res.status(500).json({ error: 'Failed to load subscription resources' });
    }
});

/**
 * GET /kcet/dashboard
 * Renders the dedicated dashboard page
 */
router.get('/dashboard', (req, res) => {
    try {
        res.render('KCETdashboard');
    } catch (err) {
        console.error('[KCET] Error rendering dashboard page:', err.message);
        res.status(500).json({ error: 'Failed to load dashboard' });
    }
});

/**
 * GET /kcet/api/user/profile
 * Retrieves active user profile information
 */
router.get('/api/user/profile', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (err) {
        console.error('[KCET] Profile fetch error:', err.message);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

/**
 * POST /kcet/api/user/profile
 * Updates user settings details (name, rank, category, phone)
 */
router.post('/api/user/profile', auth, async (req, res) => {
    try {
        const { name, rank, category, phoneNumber } = req.body;
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (name) user.name = name;
        if (rank !== undefined) user.rank = rank;
        if (category !== undefined) user.category = category;
        if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;

        await user.save();
        
        const sanitizedUser = {
            id: user._id,
            name: user.name,
            email: user.email,
            subscriptionType: user.subscriptionType,
            subscriptionStatus: user.subscriptionStatus,
            subscriptionExpiresAt: user.subscriptionExpiresAt,
            pdfDownloadsLeft: user.pdfDownloadsLeft,
            pdfDownloadsUsed: user.pdfDownloadsUsed,
            phoneNumber: user.phoneNumber,
            rank: user.rank,
            category: user.category
        };

        res.json({ success: true, user: sanitizedUser });
    } catch (err) {
        console.error('[KCET] Profile update error:', err.message);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

/**
 * GET /kcet/api/user/saved-options
 * Fetches the user's saved prioritized option list
 */
router.get('/api/user/saved-options', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user.savedOptions || []);
    } catch (err) {
        console.error('[KCET] Saved options fetch error:', err.message);
        res.status(500).json({ error: 'Failed to fetch saved options' });
    }
});

/**
 * POST /kcet/api/user/saved-options
 * Saves the user's prioritized option list
 */
router.post('/api/user/saved-options', auth, async (req, res) => {
    try {
        const { savedOptions } = req.body;
        if (!Array.isArray(savedOptions)) {
            return res.status(400).json({ error: 'savedOptions must be an array' });
        }

        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        user.savedOptions = savedOptions.map((opt, idx) => ({
            college_code: opt.college_code,
            college_name: opt.college_name,
            course_name: opt.course_name,
            priority: opt.priority !== undefined ? opt.priority : idx + 1
        }));

        await user.save();
        res.json({ success: true, savedOptions: user.savedOptions });
    } catch (err) {
        console.error('[KCET] Saved options update error:', err.message);
        res.status(500).json({ error: 'Failed to update saved options' });
    }
});

// ===== ADMIN & COUNSELOR REQUEST ENDPOINTS =====

const adminAuth = (req, res, next) => {
    if (req.user && (req.user.role === 'admin' || req.user.email === 'kea.vidyari@gmail.com')) {
        next();
    } else {
        res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
    }
};

/**
 * POST /kcet/api/user/counselor-request
 * Saves manual option entry request details for Ultra Pro users
 */
router.post('/api/user/counselor-request', auth, async (req, res) => {
    try {
        const { stream, comments } = req.body;
        if (!stream || !comments) {
            return res.status(400).json({ error: 'Preferred stream and comments are required' });
        }
        
        if (req.user.subscriptionType !== 'Ultra Pro') {
            return res.status(403).json({ error: 'Counselor request is only available for Ultra Pro subscribers' });
        }
        
        const counselorRequest = new KCETCounselorRequest({
            userId: req.user._id,
            userName: req.user.name,
            userEmail: req.user.email,
            userPhone: req.user.phoneNumber || 'Not provided',
            stream,
            comments,
            status: 'Pending'
        });
        
        await counselorRequest.save();
        res.status(201).json({ success: true, message: 'Request submitted successfully' });
    } catch (err) {
        console.error('[KCET] Counselor request error:', err.message);
        res.status(500).json({ error: 'Failed to submit counselor request' });
    }
});

/**
 * GET /kcet/api/user/counselor-requests
 * Retrieves all manual option entry requests submitted by the logged-in user
 */
router.get('/api/user/counselor-requests', auth, async (req, res) => {
    try {
        const requests = await KCETCounselorRequest.find({ userId: req.user._id }).sort({ createdAt: -1 });
        res.json({ success: true, requests });
    } catch (err) {
        console.error('[KCET] Error fetching counselor requests:', err.message);
        res.status(500).json({ error: 'Failed to fetch counselor requests' });
    }
});

/**
 * GET /kcet/admin
 * Renders the dedicated admin dashboard page
 */
router.get('/admin', (req, res) => {
    try {
        res.render('KCETadmin');
    } catch (err) {
        console.error('[KCET] Error rendering admin page:', err.message);
        res.status(500).json({ error: 'Failed to load admin dashboard' });
    }
});

/**
 * GET /kcet/api/admin/dashboard
 * Retrieves dashboard overview metrics, subscribers directory, and counseling queue
 */
router.get('/api/admin/dashboard', auth, adminAuth, async (req, res) => {
    try {
        const totalUsers = await User.countDocuments({});
        const proCount = await User.countDocuments({ subscriptionType: 'Pro' });
        const ultraProCount = await User.countDocuments({ subscriptionType: 'Ultra Pro' });
        
        // Calculate estimated revenue from Transactions
        const transactions = await Transaction.find({});
        const totalRevenue = transactions.reduce((sum, tx) => sum + (tx.price || 0), 0);
        
        const pendingRequests = await KCETCounselorRequest.countDocuments({ status: { $in: ['Pending', 'In Progress'] } });
        const resolvedRequests = await KCETCounselorRequest.countDocuments({ status: 'Resolved' });
        
        // Find subscribers (Pro or Ultra Pro)
        const subscribers = await User.find({ subscriptionType: { $in: ['Pro', 'Ultra Pro'] } })
            .select('-password')
            .sort({ createdAt: -1 });
            
        // Find counseling requests
        const counselingRequests = await KCETCounselorRequest.find({})
            .sort({ createdAt: -1 });
            
        res.json({
            metrics: {
                totalUsers,
                proCount,
                ultraProCount,
                totalRevenue,
                pendingRequests,
                resolvedRequests
            },
            subscribers,
            counselingRequests
        });
    } catch (err) {
        console.error('[KCET Admin] Dashboard data fetch error:', err.message);
        res.status(500).json({ error: 'Failed to fetch admin dashboard metrics' });
    }
});

/**
 * POST /kcet/api/admin/request/status
 * Updates status of a counselor request
 */
router.post('/api/admin/request/status', auth, adminAuth, async (req, res) => {
    try {
        const { requestId, status } = req.body;
        if (!requestId || !status) {
            return res.status(400).json({ error: 'requestId and status are required' });
        }
        
        if (!['Pending', 'In Progress', 'Resolved'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        
        const request = await KCETCounselorRequest.findById(requestId);
        if (!request) {
            return res.status(404).json({ error: 'Counseling request not found' });
        }
        
        request.status = status;
        await request.save();
        
        res.json({ success: true, message: `Request status updated to ${status}` });
    } catch (err) {
        console.error('[KCET Admin] Status update error:', err.message);
        res.status(500).json({ error: 'Failed to update request status' });
    }
});

// ===== ERROR HANDLING =====
/**
 * Handle 404 for unmatched KCET routes
 * Static files should be served before reaching this router
 */
router.use((req, res) => {
    res.status(404).json({ error: 'KCET endpoint not found' });
});

// ===== EXPORTS =====
module.exports = router;
