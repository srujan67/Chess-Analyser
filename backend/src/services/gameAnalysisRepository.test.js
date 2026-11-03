import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getLatestGameAnalysis,
  saveGameAnalysis,
} from './gameAnalysisRepository.js';

function fakeConnection({ failMoveInsert = false } = {}) {
  const calls = [];
  return {
    calls,
    async beginTransaction() { calls.push('begin'); },
    async execute(sql, values) {
      calls.push({ sql, values });
      return [{ insertId: 41 }];
    },
    async query(sql, values) {
      calls.push({ sql, values });
      if (failMoveInsert) throw new Error('forced move insert failure');
      return [{ affectedRows: 1 }];
    },
    async commit() { calls.push('commit'); },
    async rollback() { calls.push('rollback'); },
    release() { calls.push('release'); },
  };
}

const move = {
  moveId: 9,
  bestMove: 'e2e4',
  bestMoveSan: 'e4',
  evaluationBefore: {
    score: { type: 'centipawns', value: 10 },
    depth: 12,
    seldepth: 15,
    nodes: 100,
    nps: 200,
    time: 3,
    principalVariation: ['e2e4', 'e7e5'],
  },
  evaluationAfter: {
    score: { type: 'mate', value: -2 },
    depth: 12,
    seldepth: 16,
    nodes: 120,
    nps: 210,
    time: 4,
  },
  centipawnLoss: null,
  classification: 'blunder',
};

describe('gameAnalysisRepository', () => {
  it('commits analysis metadata and all move results in one transaction', async () => {
    const connection = fakeConnection();
    const database = { getConnection: async () => connection };
    const analysisId = await saveGameAnalysis({
      gameId: '8',
      engineVersion: 'Stockfish 19',
      depth: 12,
      moveAnalyses: [move],
    }, database);

    assert.equal(analysisId, 41);
    assert.deepEqual(connection.calls.map((call) => (
      typeof call === 'string' ? call : call.sql.includes('INSERT INTO move_analyses')
        ? 'insert-moves'
        : 'insert-analysis'
    )), ['begin', 'insert-analysis', 'insert-moves', 'commit', 'release']);
    const bulkInsert = connection.calls.find(
      (call) => typeof call === 'object' && call.sql.includes('INSERT INTO move_analyses'),
    );
    assert.equal(bulkInsert.values[0][0][0], 41);
    assert.equal(bulkInsert.values[0][0][8], null);
    assert.deepEqual(JSON.parse(bulkInsert.values[0][0][10]), ['e2e4', 'e7e5']);
  });

  it('rolls back and releases the connection when move persistence fails', async () => {
    const connection = fakeConnection({ failMoveInsert: true });
    const database = { getConnection: async () => connection };
    await assert.rejects(
      saveGameAnalysis({
        gameId: '8',
        engineVersion: 'Stockfish 19',
        depth: 12,
        moveAnalyses: [move],
      }, database),
      /forced move insert failure/,
    );
    assert.ok(connection.calls.includes('rollback'));
    assert.ok(connection.calls.includes('release'));
    assert.ok(!connection.calls.includes('commit'));
  });

  it('retrieves latest analysis and ordered per-move results with bound IDs', async () => {
    const calls = [];
    const database = {
      async query(sql, values) {
        calls.push({ sql, values });
        return calls.length === 1
          ? [[{ analysisId: 41, gameId: '8', engineVersion: 'Stockfish 19' }]]
          : [[{ moveId: 9, plyNumber: 1, classification: 'blunder' }]];
      },
    };
    const result = await getLatestGameAnalysis('8', database);
    assert.equal(result.analysisId, 41);
    assert.equal(result.moves[0].plyNumber, 1);
    assert.deepEqual(calls.map(({ values }) => values), [['8'], [41]]);
    assert.match(calls[0].sql, /ORDER BY completed_at DESC, id DESC/);
    assert.match(calls[1].sql, /ORDER BY m\.ply_number ASC/);
  });
});
