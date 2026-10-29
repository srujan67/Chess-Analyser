import express from 'express';
import healthRouter from './routes/health.routes.js';

const app = express();

// Parse incoming JSON request bodies
app.use(express.json());

// API Routes
app.use('/api/health', healthRouter);

// 404 Handler for unknown routes
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// Global error handling middleware (4 arguments required by Express)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  console.error(`[Error] ${req.method} ${req.originalUrl}:`, err);

  res.status(statusCode).json({
    error: statusCode === 500 ? 'Internal Server Error' : 'Error',
    message,
  });
});

export default app;
