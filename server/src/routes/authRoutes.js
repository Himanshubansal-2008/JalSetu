const express = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const {
  registerGp,
  demoLogin,
  login,
  getMe,
} = require('../controllers/authController');

const router = express.Router();

// Registration routes (Public)
router.post('/signup', registerGp);
router.post('/register', registerGp);

// Demo 1-tap login (Public)
router.post('/demo-login', demoLogin);

// Standard credentials login (Public)
router.post('/login', login);

// Authenticated user profile (Protected)
router.get('/me', authenticate, getMe);

module.exports = router;
