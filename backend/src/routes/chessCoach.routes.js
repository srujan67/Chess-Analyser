import { Router } from 'express';
import { isValidGameId } from './game.routes.js';
import {
  CoachProviderError,
  CoachResponseError,
  explainMove,
  UnsupportedMoveClassificationError,
} from '../services/chessCoachService.js';
import { GeminiConfigurationError } from '../services/geminiConfig.js';
import { GameHistoryMismatchError } from '../services/positionReconstruction.js';

export function createChessCoachRouter(service = { explainMove }) {
  const router = Router({ mergeParams: true });

  router.post('/', async (req, res) => {
    const { gameId, analysisId, moveId } = req.params;
    if (
      !isValidGameId(gameId) ||
      !isValidGameId(analysisId) ||
      !isValidGameId(moveId)
    ) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Game, analysis, and move IDs must be positive integers.',
      });
    }

    try {
      const result = await service.explainMove({ gameId, analysisId, moveId });
      if (!result) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'The requested analysed move was not found.',
        });
      }
      return res.status(200).json({ status: 'ok', ...result });
    } catch (error) {
      if (error instanceof UnsupportedMoveClassificationError) {
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
      if (error instanceof GeminiConfigurationError) {
        return res.status(503).json({
          error: 'Service Unavailable',
          message: 'The chess coach is not configured.',
        });
      }
      if (error instanceof CoachProviderError) {
        if (error.kind === 'timeout') {
          return res.status(504).json({
            error: 'Gateway Timeout',
            message: 'The chess coach request timed out. Please try again.',
          });
        }
        if (error.kind === 'quota') {
          return res.status(503).json({
            error: 'Service Unavailable',
            message: 'The chess coach is temporarily unavailable.',
          });
        }
        return res.status(502).json({
          error: 'Bad Gateway',
          message: 'The chess coach could not complete this explanation.',
        });
      }
      if (error instanceof CoachResponseError) {
        return res.status(502).json({
          error: 'Bad Gateway',
          message: 'The chess coach returned an invalid explanation.',
        });
      }

      console.error('[Chess Coach Route Error] Failed to explain move.');
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to generate the chess coaching explanation.',
      });
    }
  });

  return router;
}

export default createChessCoachRouter();
