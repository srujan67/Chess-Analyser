import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createChessCoachRouter } from './chessCoach.routes.js';
import {
  CoachProviderError,
  CoachResponseError,
  UnsupportedMoveClassificationError,
} from '../services/chessCoachService.js';
import { GeminiConfigurationError } from '../services/geminiConfig.js';

function handlerFor(service) {
  return createChessCoachRouter(service).stack[0].route.stack[0].handle;
}

async function invoke(handler, params) {
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
  await handler({ params }, response);
  return response;
}

describe('POST move explanation route', () => {
  it('rejects missing, malformed, zero, and out-of-range IDs', async () => {
    let calls = 0;
    const handler = handlerFor({
      async explainMove() { calls += 1; },
    });
    for (const params of [
      { gameId: '8', analysisId: '21', moveId: '0' },
      { gameId: 'x', analysisId: '21', moveId: '1' },
      { gameId: '8', analysisId: 'nope', moveId: '1' },
      { gameId: '8', analysisId: '21', moveId: '18446744073709551616' },
    ]) {
      assert.equal((await invoke(handler, params)).statusCode, 400);
    }
    assert.equal(calls, 0);
  });

  it('returns the explanation and authoritative engine facts from the service', async () => {
    const handler = handlerFor({
      async explainMove() {
        return {
          bestMove: 'd2d4',
          classification: 'mistake',
          explanation: { headline: 'A better square.' },
        };
      },
    });
    const response = await invoke(handler, {
      gameId: '8',
      analysisId: '21',
      moveId: '42',
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.bestMove, 'd2d4');
    assert.equal(response.body.classification, 'mistake');
  });

  it('returns safe status codes for unsupported classes, missing moves and provider errors', async () => {
    const params = { gameId: '8', analysisId: '21', moveId: '42' };
    for (const [error, status] of [
      [new UnsupportedMoveClassificationError(), 422],
      [new CoachResponseError(), 502],
      [new GeminiConfigurationError('secret configuration detail'), 503],
      [new CoachProviderError('quota'), 503],
      [new CoachProviderError('timeout'), 504],
    ]) {
      const handler = handlerFor({
        async explainMove() { throw error; },
      });
      const response = await invoke(handler, params);
      assert.equal(response.statusCode, status);
      assert.doesNotMatch(JSON.stringify(response.body), /secret configuration detail/);
    }
    const missingHandler = handlerFor({ async explainMove() { return null; } });
    assert.equal((await invoke(missingHandler, params)).statusCode, 404);
  });
});
