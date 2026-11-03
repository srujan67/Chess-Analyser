import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  StockfishProcessError,
  StockfishTimeoutError,
} from '../services/stockfishService.js';
import { createAnalysisRouter } from './analysis.routes.js';

const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
let handler;

function configureRoute(engine) {
  const router = createAnalysisRouter(() => engine);
  handler = router.stack[0].route.stack[0].handle;
}

async function postAnalysis(body) {
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
  await handler({ body }, response);
  return { status: response.statusCode, json: async () => response.body };
}

describe('POST /api/analysis', () => {
  it('returns structured engine analysis for a valid FEN', async () => {
    const calls = [];
    const engine = {
      async analyzePosition(options) {
        calls.push(options);
        return {
          bestMove: 'e2e4',
          ponder: 'e7e5',
          evaluation: {
            depth: 12,
            seldepth: 18,
            score: { type: 'centipawns', value: 31 },
            nodes: 10000,
            nps: 25000,
            principalVariation: ['e2e4', 'e7e5'],
          },
        };
      },
    };
    configureRoute(engine);

    const response = await postAnalysis({ fen: startFen });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: 'ok',
      bestMove: 'e2e4',
      evaluation: { type: 'centipawns', value: 31 },
      depth: 12,
      selectiveDepth: 18,
      nodes: 10000,
      nodesPerSecond: 25000,
      principalVariation: ['e2e4', 'e7e5'],
      ponder: 'e7e5',
    });
    assert.deepEqual(calls, [{ fen: startFen, depth: 12 }]);
  });

  it('rejects missing and malformed FEN values without calling the engine', async () => {
    let calls = 0;
    configureRoute({
      async analyzePosition() {
        calls += 1;
      },
    });

    const missingResponse = await postAnalysis({});
    assert.equal(missingResponse.status, 400);
    assert.match((await missingResponse.json()).message, /FEN/);

    const invalidResponse = await postAnalysis({ fen: 'not a fen' });
    assert.equal(invalidResponse.status, 400);
    assert.match((await invalidResponse.json()).message, /invalid/i);
    assert.equal(calls, 0);
  });

  it('rejects invalid depth values', async () => {
    configureRoute({ async analyzePosition() { assert.fail('engine should not run'); } });
    for (const depth of [0, 21, 1.5, '12']) {
      const response = await postAnalysis({ fen: startFen, depth });
      assert.equal(response.status, 400);
    }
  });

  it('returns safe timeout and engine-unavailable responses', async () => {
    configureRoute({
      async analyzePosition() {
        throw new StockfishTimeoutError('private timeout detail');
      },
    });
    const timeoutResponse = await postAnalysis({ fen: startFen });
    assert.equal(timeoutResponse.status, 504);
    assert.doesNotMatch(JSON.stringify(await timeoutResponse.json()), /private timeout detail/);

    configureRoute({
      async analyzePosition() {
        throw new StockfishProcessError('private process detail');
      },
    });
    const processResponse = await postAnalysis({ fen: startFen });
    assert.equal(processResponse.status, 503);
    assert.doesNotMatch(JSON.stringify(await processResponse.json()), /private process detail/);
  });
});
