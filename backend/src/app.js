const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const env = require('./config/env');
const routes = require('./routes');
const errorMiddleware = require('./middleware/errorMiddleware');
const ApiError = require('./utils/ApiError');

const app = express();

// Global Middlewares
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// 1. Base API Routes
app.use('/api', routes);

// 2. Serve Static Frontend Production Assets (Unified Port)
const distPathCandidates = [
  path.resolve(__dirname, '../../frontend/dist'),
  path.resolve(__dirname, '../../../frontend/dist'),
  path.resolve(process.cwd(), 'frontend/dist'),
  path.resolve(process.cwd(), '../frontend/dist')
];

const distPath = distPathCandidates.find(p => fs.existsSync(p));

if (distPath) {
  app.use(express.static(distPath));

  // Single Page Application (SPA) HTML5 Fallback
  app.get('*', (req, res, next) => {
    if (req.originalUrl.startsWith('/api')) {
      return next(ApiError.notFound(`API endpoint not found: ${req.originalUrl}`));
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// 3. 404 Route Handler for unmatched API routes
app.use('*', (req, res, next) => {
  next(ApiError.notFound(`Route not found: ${req.originalUrl}`));
});

// 4. Centralized Error Handling Middleware
app.use(errorMiddleware);

module.exports = app;
