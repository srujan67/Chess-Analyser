import pool from '../config/db.js';

export async function saveGameAnalysis(
  { gameId, engineVersion, depth, moveAnalyses },
  database = pool,
) {
  const connection = await database.getConnection();
  let transactionStarted = false;

  try {
    await connection.beginTransaction();
    transactionStarted = true;

    const [analysisResult] = await connection.execute(
      `INSERT INTO game_analyses (game_id, engine_version, search_depth)
       VALUES (?, ?, ?)`,
      [gameId, engineVersion, depth],
    );
    const analysisId = analysisResult.insertId;

    if (moveAnalyses.length > 0) {
      const values = moveAnalyses.map((move) => [
        analysisId,
        move.moveId,
        move.bestMove,
        move.bestMoveSan,
        move.evaluationBefore.score.value,
        move.evaluationBefore.score.type,
        move.evaluationAfter.score.value,
        move.evaluationAfter.score.type,
        move.centipawnLoss,
        move.classification,
        JSON.stringify(move.evaluationBefore.principalVariation ?? []),
        JSON.stringify({
          before: engineMetadata(move.evaluationBefore),
          after: engineMetadata(move.evaluationAfter),
        }),
      ]);

      await connection.query(
        `INSERT INTO move_analyses (
           analysis_id, move_id, best_move, best_move_san,
           evaluation_before, evaluation_before_type,
           evaluation_after, evaluation_after_type, centipawn_loss,
           classification, principal_variation, engine_metadata
         ) VALUES ?`,
        [values],
      );
    }

    await connection.commit();
    return analysisId;
  } catch (error) {
    if (transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        error.rollbackError = rollbackError;
      }
    }
    throw error;
  } finally {
    connection.release();
  }
}

function engineMetadata(evaluation) {
  return {
    depth: evaluation.depth ?? null,
    selectiveDepth: evaluation.seldepth ?? null,
    nodes: evaluation.nodes ?? null,
    nodesPerSecond: evaluation.nps ?? null,
    timeMs: evaluation.time ?? null,
  };
}

export async function getLatestGameAnalysis(gameId, database = pool) {
  const [analyses] = await database.query(
    `SELECT
       id AS analysisId,
       game_id AS gameId,
       engine_version AS engineVersion,
       search_depth AS depth,
       completed_at AS completedAt
     FROM game_analyses
     WHERE game_id = ?
     ORDER BY completed_at DESC, id DESC
     LIMIT 1`,
    [gameId],
  );
  if (analyses.length === 0) return null;

  const analysis = analyses[0];
  const [moves] = await database.query(
    `SELECT
       ma.move_id AS moveId,
       m.ply_number AS plyNumber,
       m.san AS playedSan,
       ma.best_move AS bestMove,
       ma.best_move_san AS bestMoveSan,
       ma.evaluation_before AS evaluationBefore,
       ma.evaluation_before_type AS evaluationBeforeType,
       ma.evaluation_after AS evaluationAfter,
       ma.evaluation_after_type AS evaluationAfterType,
       'white' AS evaluationPerspective,
       ma.centipawn_loss AS centipawnLoss,
       ma.classification,
       ma.principal_variation AS principalVariation,
       ma.engine_metadata AS engineMetadata
     FROM move_analyses AS ma
     INNER JOIN moves AS m ON m.id = ma.move_id
     WHERE ma.analysis_id = ?
     ORDER BY m.ply_number ASC`,
    [analysis.analysisId],
  );

  return { ...analysis, moves };
}

function parseJsonColumn(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export async function getMoveAnalysisContext(
  { gameId, analysisId, moveId },
  database = pool,
) {
  const [rows] = await database.query(
    `SELECT
       ga.id AS analysisId,
       ga.game_id AS gameId,
       ga.engine_version AS engineVersion,
       ga.search_depth AS searchDepth,
       ma.move_id AS moveId,
       m.ply_number AS plyNumber,
       m.san AS playedSan,
       ma.best_move AS bestMove,
       ma.best_move_san AS bestMoveSan,
       ma.evaluation_before AS evaluationBefore,
       ma.evaluation_before_type AS evaluationBeforeType,
       ma.evaluation_after AS evaluationAfter,
       ma.evaluation_after_type AS evaluationAfterType,
       ma.centipawn_loss AS centipawnLoss,
       ma.classification,
       ma.principal_variation AS principalVariation,
       ma.engine_metadata AS engineMetadata
     FROM game_analyses AS ga
     INNER JOIN move_analyses AS ma ON ma.analysis_id = ga.id
     INNER JOIN moves AS m
       ON m.id = ma.move_id AND m.game_id = ga.game_id
     WHERE ga.game_id = ? AND ga.id = ? AND ma.move_id = ?
     LIMIT 1`,
    [gameId, analysisId, moveId],
  );
  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    ...row,
    principalVariation: parseJsonColumn(row.principalVariation, []),
    engineMetadata: parseJsonColumn(row.engineMetadata, {}),
  };
}
