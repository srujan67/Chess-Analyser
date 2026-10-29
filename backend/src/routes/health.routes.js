import { Router } from 'express';
import pool from '../config/db.js';

const router = Router();

/**
 * GET /api/health
 * Simple health check endpoint to confirm the service is online.
 */
router.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'chess-analyser-api',
  });
});

/**
 * GET /api/health/db
 * Database health check endpoint verifying MySQL connectivity via connection pool.
 * Executes a lightweight `SELECT 1` query to verify active connectivity.
 */
router.get('/db', async (req, res) => {
  try {
    await pool.query('SELECT 1 AS healthy');

    return res.status(200).json({
      status: 'ok',
      service: 'chess-analyser-api',
      database: 'connected',
    });
  } catch (error) {
    // Log detailed error internally on server without exposing credentials to clients
    console.error('[Database Error] Health check query failed:', error.message);

    return res.status(503).json({
      status: 'error',
      service: 'chess-analyser-api',
      database: 'disconnected',
      message: 'Unable to connect to the database',
    });
  }
});

export default router;
