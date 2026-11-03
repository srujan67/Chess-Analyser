import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getGameById, getSavedGames } from './gameService.js';

describe('gameService - retrieval', () => {
  it('lists game summaries with a bounded aggregate query that omits PGN', async () => {
    const games = [
      {
        id: 8,
        whitePlayer: 'Alice',
        blackPlayer: 'Bob',
        result: '1-0',
        createdAt: '2026-11-02T10:00:00.000Z',
        movesCount: 12,
      },
    ];
    let capturedQuery = '';
    let capturedValues;
    const database = {
      async query(sql, values) {
        capturedQuery = sql;
        capturedValues = values;
        return [games];
      },
    };

    assert.deepEqual(await getSavedGames(database), games);
    assert.match(capturedQuery, /LEFT JOIN moves AS m ON m\.game_id = g\.id/i);
    assert.match(capturedQuery, /COUNT\(m\.id\) AS movesCount/i);
    assert.match(capturedQuery, /GROUP BY/i);
    assert.match(capturedQuery, /ORDER BY g\.created_at DESC, g\.id DESC/i);
    assert.match(capturedQuery, /LIMIT \?/i);
    assert.doesNotMatch(capturedQuery, /g\.pgn/i);
    assert.deepEqual(capturedValues, [100]);
  });

  it('returns an empty array when the database has no games', async () => {
    const database = {
      async query() {
        return [[]];
      },
    };

    assert.deepEqual(await getSavedGames(database), []);
  });

  it('returns a game with moves ordered by ply number and uses parameterized IDs', async () => {
    const game = {
      id: 8,
      whitePlayer: 'Alice',
      blackPlayer: 'Bob',
      result: '1-0',
      pgn: '1. e4 e5',
      createdAt: '2026-11-02T10:00:00.000Z',
    };
    const moves = [
      { plyNumber: 1, san: 'e4', fenAfter: 'fen-1' },
      { plyNumber: 2, san: 'e5', fenAfter: 'fen-2' },
    ];
    const calls = [];
    const database = {
      async query(sql, values) {
        calls.push({ sql, values });
        return calls.length === 1 ? [[game]] : [moves];
      },
    };

    assert.deepEqual(await getGameById('8', database), { ...game, moves });
    assert.deepEqual(calls.map(({ values }) => values), [['8'], ['8']]);
    assert.match(calls[0].sql, /WHERE id = \?/i);
    assert.match(calls[1].sql, /WHERE game_id = \?/i);
    assert.match(calls[1].sql, /ORDER BY ply_number ASC/i);
  });

  it('returns null and skips the move query when the game does not exist', async () => {
    let queryCount = 0;
    const database = {
      async query() {
        queryCount += 1;
        return [[]];
      },
    };

    assert.equal(await getGameById('999', database), null);
    assert.equal(queryCount, 1);
  });
});
