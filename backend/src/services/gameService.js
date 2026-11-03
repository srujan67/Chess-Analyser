import pool from '../config/db.js';

const GAME_LIST_LIMIT = 100;

/**
 * Saves a validated chess game and its individual moves into MySQL
 * using an atomic database transaction.
 *
 * @param {object} gameData
 * @param {string|null} gameData.whitePlayer
 * @param {string|null} gameData.blackPlayer
 * @param {string} gameData.result
 * @param {string} gameData.pgn
 * @param {Array<{plyNumber: number, san: string, fenAfter: string}>} gameData.moves
 * @returns {Promise<{
 *   gameId: number,
 *   whitePlayer: string|null,
 *   blackPlayer: string|null,
 *   result: string,
 *   movesCount: number
 * }>}
 */
export async function saveGameToDatabase(gameData) {
  if (!gameData || typeof gameData !== 'object') {
    throw new Error('Game data is required to save a game.');
  }

  const { whitePlayer, blackPlayer, result, pgn, moves } = gameData;

  if (typeof pgn !== 'string' || !pgn.trim()) {
    throw new Error('A valid PGN string is required before saving a game.');
  }

  if (!Array.isArray(moves) || moves.length === 0) {
    throw new Error('At least one valid move is required before saving a game.');
  }

  const connection = await pool.getConnection();

  try {
    // 1. Begin atomic transaction
    await connection.beginTransaction();

    // 2. Insert into games table
    const insertGameSql = `
      INSERT INTO games (white_player, black_player, result, pgn)
      VALUES (?, ?, ?, ?)
    `;
    const [gameResult] = await connection.execute(insertGameSql, [
      whitePlayer,
      blackPlayer,
      result,
      pgn,
    ]);

    const gameId = gameResult.insertId;

    // 3. Bulk insert individual moves into moves table
    if (moves && moves.length > 0) {
      const insertMovesSql = `
        INSERT INTO moves (game_id, ply_number, san, fen_after)
        VALUES ?
      `;
      const moveValues = moves.map((m) => [
        gameId,
        m.plyNumber,
        m.san,
        m.fenAfter,
      ]);

      await connection.query(insertMovesSql, [moveValues]);
    }

    // 4. Commit all database changes
    await connection.commit();

    return {
      gameId,
      whitePlayer,
      blackPlayer,
      result,
      movesCount: moves.length,
    };
  } catch (error) {
    // 5. Rollback everything if any insert fails
    await connection.rollback();
    throw error;
  } finally {
    // 6. Always release the connection back to the pool
    connection.release();
  }
}

/**
 * Retrieves a bounded list of saved games without their PGN contents.
 *
 * @param {import('mysql2/promise').Pool} database
 * @returns {Promise<Array<{
 *   id: number|string,
 *   whitePlayer: string|null,
 *   blackPlayer: string|null,
 *   result: string,
 *   createdAt: Date|string,
 *   movesCount: number
 * }>>}
 */
export async function getSavedGames(database = pool) {
  const sql = `
    SELECT
      g.id,
      g.white_player AS whitePlayer,
      g.black_player AS blackPlayer,
      g.result,
      g.created_at AS createdAt,
      COUNT(m.id) AS movesCount
    FROM games AS g
    LEFT JOIN moves AS m ON m.game_id = g.id
    GROUP BY
      g.id,
      g.white_player,
      g.black_player,
      g.result,
      g.created_at
    ORDER BY g.created_at DESC, g.id DESC
    LIMIT ?
  `;
  const [rows] = await database.query(sql, [GAME_LIST_LIMIT]);
  return rows;
}

/**
 * Retrieves one game and its moves in ply order.
 *
 * @param {string} gameId
 * @param {import('mysql2/promise').Pool} database
 * @returns {Promise<{
 *   id: number|string,
 *   whitePlayer: string|null,
 *   blackPlayer: string|null,
 *   result: string,
 *   pgn: string,
 *   createdAt: Date|string,
 *   moves: Array<{plyNumber: number, san: string, fenAfter: string}>
 * }|null>}
 */
export async function getGameById(gameId, database = pool) {
  const gameSql = `
    SELECT
      id,
      white_player AS whitePlayer,
      black_player AS blackPlayer,
      result,
      pgn,
      created_at AS createdAt
    FROM games
    WHERE id = ?
    LIMIT 1
  `;
  const [gameRows] = await database.query(gameSql, [gameId]);

  if (gameRows.length === 0) {
    return null;
  }

  const movesSql = `
    SELECT
      ply_number AS plyNumber,
      san,
      fen_after AS fenAfter
    FROM moves
    WHERE game_id = ?
    ORDER BY ply_number ASC
  `;
  const [moves] = await database.query(movesSql, [gameId]);

  return {
    ...gameRows[0],
    moves,
  };
}
