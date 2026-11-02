const API_URL = '/api/games';

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
