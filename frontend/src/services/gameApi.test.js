import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  analyzeGame,
  getGameAnalysis,
  getSavedGame,
  getSavedGames,
  saveGame,
} from './gameApi';

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

  describe('gameApi - saved-game retrieval', () => {
    it('retrieves and returns saved-game summaries', async () => {
      const games = [{ id: 8, whitePlayer: 'Alice', movesCount: 75 }];
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'ok', games }),
      });
      vi.stubGlobal('fetch', fetchMock);

      await expect(getSavedGames()).resolves.toEqual(games);
      expect(fetchMock).toHaveBeenCalledWith('/api/games');
    });

    it('retrieves a saved game by ID including its PGN and move records', async () => {
      const game = {
        id: 8,
        pgn: '1. e4 e5',
        moves: [
          { plyNumber: 1, san: 'e4', fenAfter: 'fen-1' },
          { plyNumber: 2, san: 'e5', fenAfter: 'fen-2' },
        ],
      };
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'ok', game }),
      });
      vi.stubGlobal('fetch', fetchMock);

      await expect(getSavedGame(8)).resolves.toEqual(game);
      expect(fetchMock).toHaveBeenCalledWith('/api/games/8');
    });

    it('reports list and detail retrieval failures without leaking server internals', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          json: async () => ({ message: 'SQL secret details' }),
        }),
      );

      await expect(getSavedGames()).rejects.toThrow(
        'The server could not load saved games.',
      );
      await expect(getSavedGame(8)).rejects.toThrow(
        'The server could not load the saved game.',
      );
    });

    it('rejects malformed retrieval response shapes', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ status: 'ok', games: null, game: { pgn: '1. e4' } }),
        }),
      );

      await expect(getSavedGames()).rejects.toThrow(
        'unexpected saved-games response',
      );
      await expect(getSavedGame(8)).rejects.toThrow(
        'unexpected game response',
      );
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

describe('gameApi - game analysis', () => {
  it('returns null when the saved game has no completed analysis', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ message: 'No completed analysis exists.' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(getGameAnalysis(42)).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledWith('/api/games/42/analysis');
  });

  it('loads the latest completed analysis and per-move engine facts', async () => {
    const analysis = {
      analysisId: 7,
      engineVersion: 'Stockfish 19',
      depth: 12,
      moves: [{ plyNumber: 1, classification: 'best_or_acceptable' }],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'ok', analysis }),
    }));

    await expect(getGameAnalysis(42)).resolves.toEqual(analysis);
  });

  it('analyzes only on explicit request and loads the newly saved result', async () => {
    const analysis = {
      analysisId: 7,
      depth: 12,
      moves: [{ plyNumber: 1, classification: 'blunder' }],
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          status: 'ok',
          analysisId: 7,
          summary: { white: {}, black: {} },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'ok', analysis }),
      });
    vi.stubGlobal('fetch', fetchMock);

    await expect(analyzeGame(42)).resolves.toEqual(analysis);
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/games/42/analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ depth: 12 }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/games/42/analysis');
  });

  it('reports safe errors when analysis cannot be loaded or started', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    await expect(getGameAnalysis(42)).rejects.toThrow(
      'Could not connect to the backend. Game analysis could not be loaded.',
    );
    await expect(analyzeGame(42)).rejects.toThrow(
      'Could not connect to the backend. Game analysis was not completed.',
    );
  });
});
