const API_URL = '/api/games';

async function getJson(url, unavailableMessage, serverErrorMessage) {
  let response;

  try {
    response = await fetch(url);
  } catch {
    throw new Error(unavailableMessage);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    if ([502, 503, 504].includes(response.status)) {
      throw new Error(unavailableMessage);
    }

    if (response.status >= 500) {
      throw new Error(serverErrorMessage);
    }

    throw new Error(
      typeof payload?.message === 'string'
        ? payload.message
        : 'The backend could not complete the request.',
    );
  }

  if (response.status !== 200 || payload?.status !== 'ok') {
    throw new Error('The backend returned an unexpected response.');
  }

  return payload;
}

/**
 * Saves a PGN through the backend, which validates it again before persistence.
 *
 * @param {string} pgn
 * @returns {Promise<{gameId: number}>}
 */
export async function saveGame(pgn) {
  let response;

  try {
    response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pgn }),
    });
  } catch {
    throw new Error('Could not connect to the backend. The game was not saved.');
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    if ([502, 503, 504].includes(response.status)) {
      throw new Error('Could not reach the backend. The game was not saved.');
    }

    if (response.status >= 500) {
      throw new Error('The server could not save the game. The game was not saved.');
    }

    const message =
      typeof payload?.message === 'string'
        ? payload.message
        : 'The backend rejected the game. The game was not saved.';
    throw new Error(message);
  }

  if (
    response.status !== 201 ||
    payload?.status !== 'ok' ||
    !Number.isSafeInteger(payload.gameId) ||
    payload.gameId < 1
  ) {
    throw new Error('The backend returned an unexpected response. The game was not saved.');
  }

  return { gameId: payload.gameId };
}

/**
 * Retrieves the saved-game summaries from the backend.
 *
 * @returns {Promise<Array<{
 *   id: number|string,
 *   whitePlayer: string|null,
 *   blackPlayer: string|null,
 *   result: string,
 *   createdAt: string,
 *   movesCount: number|string
 * }>>}
 */
export async function getSavedGames() {
  const payload = await getJson(
    API_URL,
    'Could not connect to the backend. Saved games could not be loaded.',
    'The server could not load saved games.',
  );

  if (!Array.isArray(payload.games)) {
    throw new Error('The backend returned an unexpected saved-games response.');
  }

  return payload.games;
}

/**
 * Retrieves one saved game, including its PGN and stored move records.
 *
 * @param {number|string} id
 * @returns {Promise<{
 *   id: number|string,
 *   whitePlayer: string|null,
 *   blackPlayer: string|null,
 *   result: string,
 *   pgn: string,
 *   createdAt: string,
 *   moves: Array<{plyNumber: number, san: string, fenAfter: string}>
 * }>}
 */
export async function getSavedGame(id) {
  const payload = await getJson(
    `${API_URL}/${encodeURIComponent(id)}`,
    'Could not connect to the backend. The saved game could not be loaded.',
    'The server could not load the saved game.',
  );

  if (
    !payload.game ||
    typeof payload.game.pgn !== 'string' ||
    !Array.isArray(payload.game.moves)
  ) {
    throw new Error('The backend returned an unexpected game response.');
  }

  return payload.game;
}

/**
 * Retrieves the latest completed Stockfish analysis for a saved game.
 *
 * @param {number|string} id
 * @returns {Promise<object|null>}
 */
export async function getGameAnalysis(id) {
  let response;
  try {
    response = await fetch(`${API_URL}/${encodeURIComponent(id)}/analysis`);
  } catch {
    throw new Error('Could not connect to the backend. Game analysis could not be loaded.');
  }

  if (response.status === 404) return null;

  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    if ([502, 503, 504].includes(response.status)) {
      throw new Error('Could not reach the backend. Game analysis could not be loaded.');
    }
    if (response.status >= 500) {
      throw new Error('The server could not load game analysis.');
    }
    throw new Error(
      typeof payload?.message === 'string'
        ? payload.message
        : 'The backend could not load game analysis.',
    );
  }

  if (
    response.status !== 200 ||
    payload?.status !== 'ok' ||
    !payload.analysis ||
    !Array.isArray(payload.analysis.moves)
  ) {
    throw new Error('The backend returned an unexpected game analysis response.');
  }

  return payload.analysis;
}

/**
 * Requests Stockfish analysis only when the caller has confirmed none exists.
 *
 * @param {number|string} id
 * @param {number} [depth=12]
 * @returns {Promise<object>} The latest saved analysis, including move results.
 */
export async function analyzeGame(id, depth = 12) {
  let response;
  try {
    response = await fetch(`${API_URL}/${encodeURIComponent(id)}/analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ depth }),
    });
  } catch {
    throw new Error('Could not connect to the backend. Game analysis was not completed.');
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    if ([502, 503, 504].includes(response.status)) {
      throw new Error('The chess engine is currently unavailable. Try again shortly.');
    }
    if (response.status >= 500) {
      throw new Error('The server could not analyze this game.');
    }
    throw new Error(
      typeof payload?.message === 'string'
        ? payload.message
        : 'The backend could not analyze this game.',
    );
  }

  if (
    response.status !== 201 ||
    payload?.status !== 'ok' ||
    !(
      (Number.isSafeInteger(payload.analysisId) && payload.analysisId > 0) ||
      (typeof payload.analysisId === 'string' && /^[1-9]\d*$/.test(payload.analysisId))
    ) ||
    !payload.summary
  ) {
    throw new Error('The backend returned an unexpected analysis response.');
  }

  const analysis = await getGameAnalysis(id);
  if (!analysis || String(analysis.analysisId) !== String(payload.analysisId)) {
    throw new Error('The completed analysis could not be retrieved.');
  }
  return analysis;
}
