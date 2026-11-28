const express = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const { authLimiter } = require('../middleware/rateLimiter');
const {
  registerGp,
  demoLogin,
  login,
  getMe,
  changePassword,
  refreshToken,
} = require('../controllers/authController');

const router = express.Router();

// Registration routes (Public, rate-limited)
router.post('/signup', authLimiter, registerGp);
router.post('/register', authLimiter, registerGp);

// Demo 1-tap login (Public, rate-limited)
router.post('/demo-login', authLimiter, demoLogin);

// Standard credentials login (Public, rate-limited)
router.post('/login', authLimiter, login);

// Refresh access token (Public/Bearer, rate-limited)
router.post('/refresh', authLimiter, refreshToken);

// Authenticated user profile (Protected)
router.get('/me', authenticate, getMe);

// Change own password (Protected)
router.post('/change-password', authenticate, changePassword);

module.exports = router;
