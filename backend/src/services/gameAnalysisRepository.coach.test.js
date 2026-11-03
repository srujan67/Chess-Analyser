import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getMoveAnalysisContext } from './gameAnalysisRepository.js';

describe('getMoveAnalysisContext', () => {
  it('requires all three ownership IDs in the joined, parameterized lookup', async () => {
    let captured;
    const context = {
      analysisId: '21',
      gameId: '8',
      moveId: '42',
      principalVariation: '["e2e4","e7e5"]',
      engineMetadata: '{"before":{"depth":12}}',
    };
    const database = {
      async query(sql, values) {
        captured = { sql, values };
        return [[context]];
      },
    };

    const result = await getMoveAnalysisContext({
      gameId: '8',
      analysisId: '21',
      moveId: '42',
    }, database);
    assert.deepEqual(captured.values, ['8', '21', '42']);
    assert.match(captured.sql, /ga\.game_id = \? AND ga\.id = \? AND ma\.move_id = \?/);
    assert.match(captured.sql, /m\.id = ma\.move_id AND m\.game_id = ga\.game_id/);
    assert.deepEqual(result.principalVariation, ['e2e4', 'e7e5']);
    assert.deepEqual(result.engineMetadata, { before: { depth: 12 } });
  });

  it('returns null when the IDs do not identify an owned analysed move', async () => {
    const database = { async query() { return [[]]; } };
    assert.equal(await getMoveAnalysisContext({
      gameId: '8',
      analysisId: '22',
      moveId: '42',
    }, database), null);
  });
});
