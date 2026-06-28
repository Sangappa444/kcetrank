/**
 * Vercel Serverless Function Entry Point
 * Wraps the Express backend app for Vercel serverless deployment.
 * Locally, the backend runs via KCETserver.js directly.
 */
const path = require('path');

// Load environment variables from backend .env (for local/fallback)
// On Vercel production, env vars are set in the Vercel Dashboard
require('dotenv').config({
  path: path.join(__dirname, '..', 'kcetmain', 'kcet', 'backend', '.env')
});

// Import the fully configured Express app
const app = require('../kcetmain/kcet/backend/KCETserver');

// Export for Vercel serverless
module.exports = app;
