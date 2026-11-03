import { Router } from 'express';
import { isValidGameId } from './game.routes.js';
import {
  analyzeGame,
  getLatestAnalysis,
  GameAnalysisLimitError,
  DEFAULT_ANALYSIS_DEPTH,
  MIN_ANALYSIS_DEPTH,
  MAX_ANALYSIS_DEPTH,
} from '../services/gameAnalysisService.js';
import { GameHistoryMismatchError } from '../services/positionReconstruction.js';
import {
  StockfishProcessError,
  StockfishTimeoutError,
} from '../services/stockfishService.js';

export function createGameAnalysisRouter({
  analyze = analyzeGame,
  getLatest = getLatestAnalysis,
} = {}) {
  const router = Router({ mergeParams: true });

  router.post('/', async (req, res) => {
    const { gameId } = req.params;
    if (!isValidGameId(gameId)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Game ID must be a positive integer.',
      });
    }

    const body = req.body ?? {};
    if (
      typeof body !== 'object' ||
      Array.isArray(body) ||
      (body.depth !== undefined &&
        (!Number.isInteger(body.depth) ||
          body.depth < MIN_ANALYSIS_DEPTH ||
          body.depth > MAX_ANALYSIS_DEPTH))
    ) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Depth must be an integer from ${MIN_ANALYSIS_DEPTH} to ${MAX_ANALYSIS_DEPTH}.`,
      });
    }

    try {
      const result = await analyze(gameId, body.depth ?? DEFAULT_ANALYSIS_DEPTH);
      if (!result) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Game not found.',
        });
      }
      return res.status(201).json({ status: 'ok', ...result });
    } catch (error) {
      if (error instanceof GameAnalysisLimitError) {
        return res.status(422).json({
          error: 'Unprocessable Entity',
          message: error.message,
        });
      }
      if (error instanceof GameHistoryMismatchError) {
        return res.status(409).json({
          error: 'Conflict',
          message: 'Saved game moves do not match the stored PGN.',
        });
      }
      if (error instanceof StockfishTimeoutError) {
        return res.status(504).json({
          error: 'Gateway Timeout',
          message: 'Game analysis timed out. No analysis was saved.',
        });
      }
      if (error instanceof StockfishProcessError) {
        console.error('[Game Analysis Route Error] Stockfish failed:', error.message);
        return res.status(503).json({
          error: 'Service Unavailable',
          message: 'The chess analysis engine is unavailable.',
        });
      }

      console.error('[Game Analysis Route Error] Failed to analyze game:', error.message);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to analyze and save this game.',
      });
    }
  });

  router.get('/', async (req, res) => {
    const { gameId } = req.params;
    if (!isValidGameId(gameId)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Game ID must be a positive integer.',
      });
    }

    try {
      const analysis = await getLatest(gameId);
      if (!analysis) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'No completed analysis exists for this game.',
        });
      }
      return res.status(200).json({ status: 'ok', analysis });
    } catch (error) {
      console.error('[Game Analysis Route Error] Failed to retrieve analysis:', error.message);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to retrieve the game analysis.',
      });
    }
  });

  return router;
}

export default createGameAnalysisRouter();
