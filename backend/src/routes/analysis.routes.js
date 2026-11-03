import { Router } from 'express';
import { Chess } from 'chess.js';
import {
  StockfishProcessError,
  StockfishTimeoutError,
  getStockfishService,
} from '../services/stockfishService.js';

const DEFAULT_DEPTH = 12;
const MIN_DEPTH = 1;
const MAX_DEPTH = 20;

export function createAnalysisRouter(getEngine = getStockfishService) {
  const router = Router();

  router.post('/', async (req, res) => {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Request body must be a JSON object containing a FEN.',
      });
    }

    const { fen, depth = DEFAULT_DEPTH } = body;
    if (typeof fen !== 'string' || fen.trim() === '') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'A non-empty FEN string is required.',
      });
    }

    if (!Number.isInteger(depth) || depth < MIN_DEPTH || depth > MAX_DEPTH) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Depth must be an integer from ${MIN_DEPTH} to ${MAX_DEPTH}.`,
      });
    }

    let validatedFen;
    try {
      validatedFen = new Chess(fen).fen();
    } catch {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'The supplied FEN is invalid.',
      });
    }

    try {
      const result = await getEngine().analyzePosition({ fen: validatedFen, depth });
      if (!result?.evaluation?.score) {
        throw new StockfishProcessError('Engine returned no evaluation score.');
      }

      const { evaluation } = result;
      return res.status(200).json({
        status: 'ok',
        bestMove: result.bestMove,
        evaluation: {
          type: evaluation.score.type,
          value: evaluation.score.value,
        },
        depth: evaluation.depth,
        selectiveDepth: evaluation.seldepth ?? null,
        nodes: evaluation.nodes ?? null,
        nodesPerSecond: evaluation.nps ?? null,
        principalVariation: evaluation.principalVariation ?? [],
        ...(result.ponder ? { ponder: result.ponder } : {}),
      });
    } catch (error) {
      if (error instanceof StockfishTimeoutError) {
        return res.status(504).json({
          error: 'Gateway Timeout',
          message: 'Chess analysis timed out. Please try again.',
        });
      }

      if (error instanceof StockfishProcessError) {
        console.error('[Analysis Route Error] Stockfish process failed:', error.message);
        return res.status(503).json({
          error: 'Service Unavailable',
          message: 'The chess analysis engine is unavailable.',
        });
      }

      console.error('[Analysis Route Error] Failed to analyze position:', error.message);
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'The chess analysis engine could not complete the request.',
      });
    }
  });

  return router;
}

export default createAnalysisRouter();
