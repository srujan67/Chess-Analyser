import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { describe, it } from 'node:test';
import {
  createGameAnalysisService,
  GameAnalysisLimitError,
} from './gameAnalysisService.js';
import { StockfishTimeoutError } from './stockfishService.js';

function gameWithMoves(pgn, gameId = '8') {
  const chess = new Chess();
  chess.loadPgn(pgn, { strict: false });
  return {
    id: gameId,
    pgn,
    moves: chess.history({ verbose: true }).map((move, index) => ({
      id: index + 1,
      plyNumber: index + 1,
      san: move.san,
      fenAfter: move.after,
    })),
  };
}

function fakeEngine() {
  const calls = [];
  return {
    calls,
    getEngineVersion: () => 'Stockfish 19 test',
    async analyzePosition({ fen, depth }) {
      calls.push({ fen, depth });
      return {
        bestMove: calls.length === 1 ? 'e2e4' : 'e7e5',
        evaluation: {
          depth,
          seldepth: depth + 2,
          nodes: 1000,
          nps: 2000,
          time: 2,
          score: {
            type: 'centipawns',
            value: calls.length === 1 ? 30 : -10,
          },
          principalVariation: ['e2e4', 'e7e5'],
        },
      };
    },
  };
}

describe('gameAnalysisService', () => {
  it('analyses each position once in sequence and persists the move result', async () => {
    const game = gameWithMoves('1. e4 e5 *');
    const engine = fakeEngine();
    const saves = [];
    const service = createGameAnalysisService({
      engineProvider: () => engine,
      gameLoader: async () => game,
      saveAnalysis: async (payload) => {
        saves.push(payload);
        return 55;
      },
    });

    const result = await service.analyzeGame('8', 12);
    assert.equal(engine.calls.length, game.moves.length + 1);
    assert.deepEqual(engine.calls.map(({ depth }) => depth), [12, 12, 12]);
    assert.equal(result.analysisId, 55);
    assert.equal(result.movesAnalyzed, 2);
    assert.equal(saves[0].moveAnalyses[0].playedUci, 'e2e4');
    assert.equal(saves[0].moveAnalyses[0].bestMoveSan, 'e4');
    assert.equal(saves[0].moveAnalyses[0].centipawnLoss, 20);
    assert.equal(saves[0].moveAnalyses[0].evaluationBefore.score.value, 30);
  });

  it('returns null for a nonexistent game and validates depth', async () => {
    const service = createGameAnalysisService({
      gameLoader: async () => null,
    });
    assert.equal(await service.analyzeGame('999', 12), null);
    await assert.rejects(service.analyzeGame('8', 21), RangeError);
  });

  it('enforces the full-game ply limit before starting engine analysis', async () => {
    const chess = new Chess();
    for (let index = 0; index < 201; index += 1) {
      const legalMoves = chess.moves({ verbose: true });
      assert.ok(legalMoves.length > 0, 'Generated game should remain playable.');
      const move = legalMoves[0];
      chess.move({
        from: move.from,
        to: move.to,
        ...(move.promotion ? { promotion: move.promotion } : {}),
      });
    }
    const pgn = chess.pgn();
    const game = gameWithMoves(pgn);
    let engineStarted = false;
    const service = createGameAnalysisService({
      engineProvider: () => {
        engineStarted = true;
        return fakeEngine();
      },
      gameLoader: async () => game,
    });

    await assert.rejects(service.analyzeGame('8', 12), GameAnalysisLimitError);
    assert.equal(engineStarted, false);
  });

  it('does not persist partial results when an engine position times out', async () => {
    const game = gameWithMoves('1. e4 e5 *');
    let calls = 0;
    let persisted = false;
    const service = createGameAnalysisService({
      engineProvider: () => ({
        async analyzePosition() {
          calls += 1;
          if (calls === 2) throw new StockfishTimeoutError('search timed out');
          return {
            bestMove: 'e2e4',
            evaluation: {
              depth: 12,
              score: { type: 'centipawns', value: 10 },
              principalVariation: ['e2e4'],
            },
          };
        },
        getEngineVersion: () => 'Stockfish 19 test',
      }),
      gameLoader: async () => game,
      saveAnalysis: async () => {
        persisted = true;
      },
    });

    await assert.rejects(
      service.analyzeGame('8', 12),
      StockfishTimeoutError,
    );
    assert.equal(persisted, false);
  });
});
