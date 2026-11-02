import { Router } from 'express';
import { parseAndValidatePgn } from '../services/chessParser.js';
import { saveGameToDatabase } from '../services/gameService.js';

const router = Router();

/**
 * POST /api/games
 * Accepts a PGN string in JSON request body, validates the chess game,
 * and saves the game and its individual moves into MySQL in an atomic transaction.
 */
router.post('/', async (req, res) => {
  try {
    const { pgn } = req.body || {};

    // 1. Validate and parse PGN
    const parseResult = parseAndValidatePgn(pgn);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Bad Request',
        message: parseResult.error,
      });
    }

    // 2. Persist game and moves to MySQL
    const savedGame = await saveGameToDatabase(parseResult.data);

    // 3. Return 201 Created with saved game metadata
    return res.status(201).json({
      status: 'ok',
      gameId: savedGame.gameId,
      whitePlayer: savedGame.whitePlayer,
      blackPlayer: savedGame.blackPlayer,
      result: savedGame.result,
      movesCount: savedGame.movesCount,
    });
  } catch (error) {
    // Log server-side diagnostic error without leaking internal credentials or SQL details
    console.error('[Game Route Error] Failed to save game:', error.message);

    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to save the game to the database.',
    });
  }
});

export default router;

