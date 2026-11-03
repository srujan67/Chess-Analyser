import { Router } from 'express';
import { parseAndValidatePgn } from '../services/chessParser.js';
import {
  getGameById,
  getSavedGames,
  saveGameToDatabase,
} from '../services/gameService.js';

const router = Router();
const MAX_UNSIGNED_BIGINT = 18446744073709551615n;

export function isValidGameId(id) {
  if (typeof id !== 'string' || !/^[1-9]\d{0,19}$/.test(id)) {
    return false;
  }

  return BigInt(id) <= MAX_UNSIGNED_BIGINT;
}

/**
 * GET /api/games
 * Returns a bounded list of saved game summaries.
 */
router.get('/', async (req, res) => {
  try {
    const games = await getSavedGames();
    return res.status(200).json({ status: 'ok', games });
  } catch (error) {
    console.error('[Game Route Error] Failed to retrieve games:', error.message);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve games from the database.',
    });
  }
});

/**
 * GET /api/games/:id
 * Returns one saved game and its moves.
 */
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (!isValidGameId(id)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Game ID must be a positive integer.',
    });
  }

  try {
    const game = await getGameById(id);
    if (!game) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Game not found.',
      });
    }

    return res.status(200).json({ status: 'ok', game });
  } catch (error) {
    console.error('[Game Route Error] Failed to retrieve game:', error.message);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve the game from the database.',
    });
  }
});

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
