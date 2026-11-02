import { afterEach, describe, expect, it, vi } from 'vitest';
import { saveGame } from './gameApi';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('gameApi - saveGame', () => {
  it('posts the original PGN as JSON and returns the saved game ID', async () => {
    const pgn = '[Event "Example"]\n\n1. e4 e5';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ status: 'ok', gameId: 42 }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(saveGame(pgn)).resolves.toEqual({ gameId: 42 });
    expect(fetchMock).toHaveBeenCalledWith('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pgn }),
    });
  });

  it('shows backend validation messages for client errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ message: 'Invalid PGN: Illegal move "e5".' }),
      }),
    );

    await expect(saveGame('1. e5')).rejects.toThrow('Invalid PGN: Illegal move "e5".');
  });

  it('does not expose server error details', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Database password and SQL details' }),
      }),
    );

    await expect(saveGame('1. e4 e5')).rejects.toThrow(
      'The server could not save the game. The game was not saved.',
    );
    await expect(saveGame('1. e4 e5')).rejects.not.toThrow(
      'Database password and SQL details',
    );
  });

  it('reports backend unavailability without losing local game data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

    await expect(saveGame('1. e4 e5')).rejects.toThrow(
      'Could not connect to the backend. The game was not saved.',
    );
  });

  it('reports a proxy or gateway error as backend unavailability', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => ({ message: 'Proxy error internals' }),
      }),
    );

    await expect(saveGame('1. e4 e5')).rejects.toThrow(
      'Could not reach the backend. The game was not saved.',
    );
  });

  it('rejects a successful HTTP response that does not contain a valid game ID', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ status: 'ok', gameId: 'not-an-id' }),
      }),
    );

    await expect(saveGame('1. e4 e5')).rejects.toThrow(
      'The backend returned an unexpected response.',
    );
  });
});
