import assert from 'node:assert/strict';
import pool from '../src/config/db.js';
import { getSavedGames } from '../src/services/gameService.js';
import {
  analyzeGame,
  getLatestAnalysis,
} from '../src/services/gameAnalysisService.js';
import { closeStockfishService } from '../src/services/stockfishService.js';

const depth = Number(process.env.ANALYSIS_TEST_DEPTH || 2);

try {
  const games = await getSavedGames(pool);
  assert.ok(games.length > 0, 'At least one saved game is required for integration testing.');

  const game = games[0];
  const result = await analyzeGame(String(game.id), depth);
  assert.ok(result?.analysisId, 'The analysis should be persisted.');
  assert.equal(result.movesAnalyzed, Number(game.movesCount));

  const persisted = await getLatestAnalysis(String(game.id));
  assert.equal(String(persisted.analysisId), String(result.analysisId));
  assert.equal(persisted.moves.length, Number(game.movesCount));
  assert.equal(persisted.moves[0].plyNumber, 1);

  console.log(JSON.stringify({
    status: 'passed',
    gameId: String(game.id),
    analysisId: String(result.analysisId),
    depth: result.depth,
    engineVersion: result.engineVersion,
    movesAnalyzed: result.movesAnalyzed,
    persistedMoves: persisted.moves.length,
    summary: result.summary,
  }, null, 2));
} finally {
  await closeStockfishService();
  await pool.end();
}
