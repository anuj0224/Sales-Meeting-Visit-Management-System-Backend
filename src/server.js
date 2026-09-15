const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// Load environment variables
dotenv.config();

const app = express();

// Enable CORS for Vercel deployment & local frontend
const allowedOrigin = process.env.CLIENT_URL || '*';
app.use(
  cors({
    origin: (origin, callback) => {
      // allow requests with no origin (like mobile apps, curl, or tests)
      if (!origin || allowedOrigin === '*' || origin === allowedOrigin || origin.endsWith('.vercel.app')) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check Endpoint (Required for Render)
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'Optronix Sales Meeting & Visit Management API',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/customers', require('./routes/customerRoutes'));
app.use('/api/meetings', require('./routes/meetingRoutes'));
app.use('/api/followups', require('./routes/followUpRoutes'));
app.use('/api/analytics', require('./routes/analyticsRoutes'));

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { message: `Route not found - ${req.originalUrl}`, code: 'NOT_FOUND' }
  });
});

// Centralized Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'test') {
  connectDB().then(() => {
    app.listen(PORT, () => {
      console.log(`[Server] Sales Management Backend running on port ${PORT}`);
    });
  });
}

module.exports = app;
