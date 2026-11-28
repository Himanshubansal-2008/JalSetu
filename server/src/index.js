// Load environment variables at the very top
require('dotenv').config();

// Fail-Fast Startup Environment Check (Issue #9)
const requiredEnv = ['DATABASE_URL', 'JWT_SECRET'];
const missingEnv = requiredEnv.filter((key) => !process.env[key] || !process.env[key].trim());
if (missingEnv.length > 0) {
  console.error(`\n❌ [Fatal Startup Error]: Missing required environment variable(s): ${missingEnv.join(', ')}`);
  console.error('Please configure DATABASE_URL and JWT_SECRET in server/.env before starting the server.\n');
  process.exit(1);
}

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { apiLimiter } = require('./middleware/rateLimiter');

const app = express();

// Security HTTP headers
app.use(helmet());

// CORS configuration with allowlist driven by ALLOWED_ORIGINS
const isDev = process.env.NODE_ENV !== 'production';
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Mobile / native apps, server-to-server, curl, Postman have no Origin header
    if (!origin) return callback(null, true);

    const normalizedOrigin = origin.replace(/\/$/, '');

    // Allow explicitly configured origins
    if (allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    // In local development / non-production, allow local dev & emulator origins
    if (isDev) {
      if (
        /^https?:\/\/localhost(:\d+)?$/.test(origin) ||
        /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin) ||
        /^https?:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/.test(origin) ||
        /^https?:\/\/192\.168\.\d+\.\d+(:\d+)?$/.test(origin) ||
        /^exp:\/\//.test(origin)
      ) {
        return callback(null, true);
      }
    }

    return callback(new Error(`CORS origin not allowed: ${origin}`));
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '5mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// General API rate limiter
app.use('/api', apiLimiter);

// Auth routes
app.use('/api/auth', require('./routes/authRoutes'));

// Asset routes
app.use('/api/assets', require('./routes/assetRoute'));

// Inventory routes
app.use('/api/inventory', require('./routes/inventoryRoute'));

// Finance routes
app.use('/api/finance', require('./routes/financeRoute'));

// Consumer routes
app.use('/api/consumers', require('./routes/consumerRoute'));

// Bill routes
app.use('/api/bills', require('./routes/billRoute'));

// Dashboard routes
app.use('/api/dashboard', require('./routes/dashboardRoute'));

// Worker routes
app.use('/api/workers', require('./routes/workerRoute'));

// Gram Panchayat approval routes
app.use('/api/gps', require('./routes/gpRoute'));

// Platform Administration routes (Main Admin only)
app.use('/api/admin', require('./routes/adminRoute'));

// Gram Panchayat self-management routes (GP Admin only)
app.use('/api/gp', require('./routes/gpSelfRoute'));

// 404 handler for unmatched routes
app.use((req, res, next) => {
  res.status(404).json({ error: 'Route not found' });
});

// Central error handler
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Image or request is too large' });
  }
  console.error('Server error:', err);
  res.status(500).json({ error: 'Something went wrong' });
});

const { ensureMainAdminExists } = require('./utils/mainAdmin');

// Listen on configured port or default to 4000
const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => {
  console.log(`JalSetu server running on port ${PORT}`);
  ensureMainAdminExists();
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is already in use by another process!`);
    console.error(`To free port ${PORT}, run:\n  lsof -ti :${PORT} | xargs kill -9\n`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});
