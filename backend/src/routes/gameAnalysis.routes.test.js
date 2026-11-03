import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createGameAnalysisRouter } from './gameAnalysis.routes.js';
import {
  StockfishProcessError,
  StockfishTimeoutError,
} from '../services/stockfishService.js';

function createRouteHandlers(options) {
  const router = createGameAnalysisRouter(options);
  return {
    post: router.stack[0].route.stack[0].handle,
    get: router.stack[1].route.stack[0].handle,
  };
}

async function invoke(handler, { gameId, body = {} }) {
  const response = {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
  };
  await handler({ params: { gameId }, body }, response);
  return response;
}

describe('/api/games/:id/analysis', () => {
  it('validates game ID and depth before invoking analysis', async () => {
    let calls = 0;
    const handlers = createRouteHandlers({
      analyze: async () => { calls += 1; },
      getLatest: async () => null,
    });

    assert.equal((await invoke(handlers.post, {
      gameId: '0',
      body: { depth: 12 },
    })).statusCode, 400);
    assert.equal((await invoke(handlers.post, {
      gameId: 'bad',
      body: { depth: 12 },
    })).statusCode, 400);
    assert.equal((await invoke(handlers.post, {
      gameId: '8',
      body: { depth: 21 },
    })).statusCode, 400);
    assert.equal(calls, 0);
  });

  it('returns 404 for a nonexistent game and returns analysis results on success', async () => {
    let handlers = createRouteHandlers({
      analyze: async (gameId, depth) => {
        assert.equal(gameId, '8');
        assert.equal(depth, 12);
        return null;
      },
      getLatest: async () => null,
    });
    assert.equal((await invoke(handlers.post, { gameId: '8' })).statusCode, 404);

    handlers = createRouteHandlers({
      analyze: async (gameId, depth) => ({
        analysisId: 55,
        gameId,
        depth,
        movesAnalyzed: 2,
        summary: { white: {}, black: {} },
      }),
      getLatest: async () => ({
        analysisId: 55,
        moves: [{ plyNumber: 1, classification: 'best_or_acceptable' }],
      }),
    });

    const saved = await invoke(handlers.post, { gameId: '8' });
    assert.equal(saved.statusCode, 201);
    assert.equal(saved.body.analysisId, 55);
    const latest = await invoke(handlers.get, { gameId: '8' });
    assert.equal(latest.statusCode, 200);
    assert.equal(latest.body.analysis.moves[0].plyNumber, 1);
  });

  it('returns 404 when no completed analysis is available', async () => {
    const handlers = createRouteHandlers({
      analyze: async () => null,
      getLatest: async () => null,
    });
    const result = await invoke(handlers.get, { gameId: '8' });
    assert.equal(result.statusCode, 404);
  });

  it('maps engine timeouts and process failures to safe HTTP errors', async () => {
    let handlers = createRouteHandlers({
      analyze: async () => {
        throw new StockfishTimeoutError('private timeout detail');
      },
      getLatest: async () => null,
    });
    const timeout = await invoke(handlers.post, { gameId: '8' });
    assert.equal(timeout.statusCode, 504);
    assert.doesNotMatch(JSON.stringify(timeout.body), /private timeout detail/);

    handlers = createRouteHandlers({
      analyze: async () => {
        throw new StockfishProcessError('private process detail');
      },
      getLatest: async () => null,
    });
    const unavailable = await invoke(handlers.post, { gameId: '8' });
    assert.equal(unavailable.statusCode, 503);
    assert.doesNotMatch(JSON.stringify(unavailable.body), /private process detail/);
  });
});
