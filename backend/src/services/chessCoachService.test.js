import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { describe, it } from 'node:test';
import {
  CoachProviderError,
  CoachResponseError,
  createChessCoachService,
  UnsupportedMoveClassificationError,
} from './chessCoachService.js';
import { COACH_FIELD_LIMITS } from './chessCoachPrompt.js';

function createSavedGame(pgn = '1. e4 e5 *') {
  const chess = new Chess();
  chess.loadPgn(pgn, { strict: false });
  return {
    id: '8',
    pgn,
    moves: chess.history({ verbose: true }).map((move, index) => ({
      id: String(index + 1),
      plyNumber: index + 1,
      san: move.san,
      fenAfter: move.after,
    })),
  };
}

function validExplanation() {
  return Object.fromEntries(
    Object.keys(COACH_FIELD_LIMITS).map((field) => [field, `A concise ${field}.`]),
  );
}

function analysisContext(overrides = {}) {
  return {
    gameId: '8',
    analysisId: '21',
    engineVersion: 'Stockfish 19',
    searchDepth: 12,
    moveId: '1',
    plyNumber: 1,
    playedSan: 'e4',
    bestMove: 'd2d4',
    bestMoveSan: 'd4',
    evaluationBefore: 20,
    evaluationBeforeType: 'centipawns',
    evaluationAfter: -75,
    evaluationAfterType: 'centipawns',
    centipawnLoss: 55,
    classification: 'inaccuracy',
    principalVariation: ['d2d4', 'd7d5', 'c2c4'],
    engineMetadata: {
      before: { depth: 12 },
      after: { depth: 12 },
    },
    ...overrides,
  };
}

function createService({
  context = analysisContext(),
  game = createSavedGame(),
  interaction,
  providerError,
  onCreate,
} = {}) {
  return createChessCoachService({
    moveContextLoader: async () => context,
    gameLoader: async () => game,
    geminiClientProvider: () => ({
      interactions: {
        async create(params) {
          onCreate?.(params);
          if (providerError) throw providerError;
          return interaction ?? {
            status: 'completed',
            output_text: JSON.stringify(validExplanation()),
          };
        },
      },
    }),
    modelProvider: () => 'gemini-3.8-flash',
  });
}

describe('chessCoachService', () => {
  it('sends trusted selected-move facts and returns stored engine findings separately', async () => {
    let captured;
    const service = createService({
      onCreate(params) {
        captured = params;
      },
    });
    const result = await service.explainMove({
      gameId: '8',
      analysisId: '21',
      moveId: '1',
    });

    assert.equal(captured.model, 'gemini-3.8-flash');
    assert.equal(captured.response_format.mime_type, 'application/json');
    assert.equal(captured.generation_config.max_output_tokens, 700);
    assert.match(captured.input, /"bestMoveUci":"d2d4"/);
    assert.doesNotMatch(captured.input, /"pgn"/);
    assert.equal(result.bestMove, 'd2d4');
    assert.equal(result.classification, 'inaccuracy');
    assert.equal(result.centipawnLoss, 55);
    assert.equal(result.playerColor, 'White');
    assert.equal(result.moveNumber, 1);
    assert.equal(result.explanation.headline, 'A concise headline.');
  });

  it('refuses to explain unsupported classifications before calling Gemini', async () => {
    let called = false;
    const service = createService({
      context: analysisContext({ classification: 'best_or_acceptable' }),
      onCreate() { called = true; },
    });
    await assert.rejects(
      service.explainMove({ gameId: '8', analysisId: '21', moveId: '1' }),
      UnsupportedMoveClassificationError,
    );
    assert.equal(called, false);
  });

  it('returns no context for a move not owned by the requested game and analysis', async () => {
    const service = createChessCoachService({
      moveContextLoader: async ({ gameId, analysisId, moveId }) => {
        assert.deepEqual({ gameId, analysisId, moveId }, {
          gameId: '8',
          analysisId: '21',
          moveId: '99',
        });
        return null;
      },
    });
    assert.equal(
      await service.explainMove({ gameId: '8', analysisId: '21', moveId: '99' }),
      null,
    );
  });

  it('maps quota/provider errors without retaining provider messages', async () => {
    const service = createService({
      providerError: Object.assign(new Error('secret provider response'), { status: 429 }),
    });
    await assert.rejects(
      service.explainMove({ gameId: '8', analysisId: '21', moveId: '1' }),
      (error) => error instanceof CoachProviderError &&
        error.kind === 'quota' &&
        !error.message.includes('secret'),
    );
  });

  it('rejects malformed or schema-invalid model responses', async () => {
    for (const interaction of [
      { status: 'failed', output_text: '' },
      { status: 'completed', output_text: '{bad json' },
      {
        status: 'completed',
        output_text: JSON.stringify({ ...validExplanation(), roast: 'x'.repeat(181) }),
      },
    ]) {
      const service = createService({ interaction });
      await assert.rejects(
        service.explainMove({ gameId: '8', analysisId: '21', moveId: '1' }),
        CoachResponseError,
      );
    }
  });
});
