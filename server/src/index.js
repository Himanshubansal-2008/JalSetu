// Load environment variables at the very top
require('dotenv').config();

const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

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

// Listen on configured port or default to 4000
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API running on ${PORT}`);
});
