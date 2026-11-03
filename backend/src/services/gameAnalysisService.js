import { Chess } from 'chess.js';
import pool from '../config/db.js';
import { getStockfishService } from './stockfishService.js';
import { getGameById } from './gameService.js';
import { saveGameAnalysis, getLatestGameAnalysis } from './gameAnalysisRepository.js';
import { reconstructGamePositions } from './positionReconstruction.js';
import {
  evaluatePlayedMove,
  MOVE_CLASSIFICATION_THRESHOLDS,
} from './moveClassification.js';

export const DEFAULT_ANALYSIS_DEPTH = 12;
export const MIN_ANALYSIS_DEPTH = 1;
export const MAX_ANALYSIS_DEPTH = 20;
export const MAX_ANALYZABLE_PLIES = 200;

export class GameAnalysisLimitError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GameAnalysisLimitError';
  }
}

function sanForUci(fen, uci) {
  const match = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(uci);
  if (!match) return null;

  try {
    const chess = new Chess(fen);
    return chess.move({
      from: match[1],
      to: match[2],
      ...(match[3] ? { promotion: match[3] } : {}),
    })?.san ?? null;
  } catch {
    return null;
  }
}

function terminalEvaluation(fen, depth) {
  const chess = new Chess(fen);
  if (chess.isCheckmate()) {
    return {
      depth,
      score: { type: 'mate', value: 0 },
      principalVariation: [],
    };
  }
  if (chess.isDraw()) {
    return {
      depth,
      score: { type: 'centipawns', value: 0 },
      principalVariation: [],
    };
  }
  return null;
}

function summarizeMoveClassifications(moveAnalyses) {
  const summary = {
    white: { bestOrAcceptable: 0, inaccuracy: 0, mistake: 0, blunder: 0 },
    black: { bestOrAcceptable: 0, inaccuracy: 0, mistake: 0, blunder: 0 },
  };

  for (const move of moveAnalyses) {
    const playerSummary = summary[move.sideToMove === 'w' ? 'white' : 'black'];
    const countKey = move.classification.replace(
      /_([a-z])/g,
      (_, letter) => letter.toUpperCase(),
    );
    playerSummary[countKey] += 1;
  }
  return summary;
}

export function createGameAnalysisService({
  database = pool,
  engineProvider = getStockfishService,
  gameLoader = getGameById,
  saveAnalysis = saveGameAnalysis,
  latestAnalysisLoader = getLatestGameAnalysis,
  classificationThresholds = MOVE_CLASSIFICATION_THRESHOLDS,
} = {}) {
  async function analyzeGame(gameId, depth = DEFAULT_ANALYSIS_DEPTH) {
    if (
      !Number.isInteger(depth) ||
      depth < MIN_ANALYSIS_DEPTH ||
      depth > MAX_ANALYSIS_DEPTH
    ) {
      throw new RangeError(
        `Analysis depth must be an integer from ${MIN_ANALYSIS_DEPTH} to ${MAX_ANALYSIS_DEPTH}.`,
      );
    }

    const game = await gameLoader(gameId, database);
    if (!game) return null;

    const { initialFen, moves } = reconstructGamePositions(game);
    if (moves.length === 0) {
      throw new Error('Saved game does not contain any played moves.');
    }
    if (moves.length > MAX_ANALYZABLE_PLIES) {
      throw new GameAnalysisLimitError(
        `Games longer than ${MAX_ANALYZABLE_PLIES} plies cannot be analysed.`,
      );
    }

    const positions = [initialFen, ...moves.map((move) => move.fenAfter)];
    const engine = engineProvider();
    const evaluations = [];
    for (const fen of positions) {
      const result = await engine.analyzePosition({ fen, depth });
      const evaluation = result.evaluation ?? terminalEvaluation(fen, depth);
      if (!evaluation?.score) {
        throw new Error('Stockfish returned no usable evaluation for a game position.');
      }
      evaluations.push({
        ...evaluation,
        bestMove: result.bestMove,
        ponder: result.ponder ?? null,
      });
    }

    const engineVersion = engine.getEngineVersion?.();
    if (!engineVersion) {
      throw new Error('Stockfish did not report its engine version.');
    }

    const moveAnalyses = moves.map((move, index) => {
      const evaluationBefore = evaluations[index];
      const evaluationAfter = evaluations[index + 1];
      const classification = evaluatePlayedMove({
        evaluationBefore,
        evaluationAfter,
        moverColor: move.sideToMove,
        thresholds: classificationThresholds,
      });

      return {
        ...classification,
        moveId: move.moveId,
        plyNumber: move.plyNumber,
        sideToMove: move.sideToMove,
        playedSan: move.san,
        playedUci: move.uci,
        bestMove: evaluationBefore.bestMove,
        bestMoveSan: sanForUci(move.fenBefore, evaluationBefore.bestMove),
        evaluationBefore,
        evaluationAfter,
      };
    });

    const persistedMoveAnalyses = moveAnalyses.map((move) => ({
      ...move,
      evaluationBefore: {
        ...move.evaluationBefore,
        score: move.evaluationBeforeWhite.score,
      },
      evaluationAfter: {
        ...move.evaluationAfter,
        score: move.evaluationAfterWhite.score,
      },
    }));
    const analysisId = await saveAnalysis(
      {
        gameId,
        engineVersion,
        depth,
        moveAnalyses: persistedMoveAnalyses,
      },
      database,
    );

    return {
      analysisId,
      gameId,
      engineVersion,
      depth,
      movesAnalyzed: moveAnalyses.length,
      summary: summarizeMoveClassifications(moveAnalyses),
    };
  }

  async function getLatestAnalysis(gameId) {
    return latestAnalysisLoader(gameId, database);
  }

  return { analyzeGame, getLatestAnalysis };
}

const gameAnalysisService = createGameAnalysisService();
export const analyzeGame = gameAnalysisService.analyzeGame;
export const getLatestAnalysis = gameAnalysisService.getLatestAnalysis;
