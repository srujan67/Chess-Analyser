import { useCallback, useEffect, useState } from 'react';
import { getSavedGame, getSavedGames } from '../services/gameApi';
import { parsePgn } from '../services/chessService';

function formatImportDate(dateValue) {
  const date = new Date(dateValue);
  return Number.isNaN(date.getTime())
    ? 'Import date unavailable'
    : date.toLocaleString();
}

export default function SavedGamesModal({ isOpen, onClose, onGameLoaded }) {
  const [games, setGames] = useState([]);
  const [loadState, setLoadState] = useState('loading');
  const [error, setError] = useState('');
  const [loadingGameId, setLoadingGameId] = useState(null);
  const [openError, setOpenError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!isOpen) return undefined;

    let active = true;
    getSavedGames()
      .then((savedGames) => {
        if (!active) return;
        setGames(savedGames);
        setError('');
        setLoadState('loaded');
      })
      .catch((loadError) => {
        if (!active) return;
        setError(loadError.message);
        setLoadState('error');
      });

    return () => {
      active = false;
    };
  }, [isOpen, reloadKey]);

  const handleClose = useCallback(() => {
    setGames([]);
    setError('');
    setOpenError('');
    setLoadState('loading');
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && loadingGameId === null) {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClose, isOpen, loadingGameId]);

  if (!isOpen) return null;

  const handleOpenGame = async (id) => {
    if (loadingGameId !== null) return;

    setLoadingGameId(id);
    setOpenError('');

    try {
      const game = await getSavedGame(id);
      const parsed = parsePgn(game.pgn);

      if (!parsed.success) {
        throw new Error(`Saved PGN could not be replayed: ${parsed.error}`);
      }

      const storedMovesMatch =
        game.moves.length === parsed.moves.length &&
        game.moves.every((move, index) => {
          const plyNumber = move.plyNumber ?? move.ply_number;
          return (
            Number(plyNumber) === index + 1 &&
            move.san === parsed.moves[index].san
          );
        });

      if (!storedMovesMatch) {
        throw new Error('The saved move records do not match the stored PGN.');
      }

      onGameLoaded(parsed, game);
      handleClose();
    } catch (loadError) {
      setOpenError(loadError.message);
    } finally {
      setLoadingGameId(null);
    }
  };

  const handleRetry = () => {
    setLoadState('loading');
    setError('');
    setReloadKey((key) => key + 1);
  };

  return (
    <div
      className="modal-backdrop saved-games-backdrop"
      onClick={loadingGameId === null ? handleClose : undefined}
      role="presentation"
    >
      <section
        className="modal-dialog saved-games-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="saved-games-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-header-title">
            <svg
              className="panel-icon"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 5h16v15H4z" />
              <path d="M8 3v4M16 3v4M4 10h16" />
              <path d="M8 14h3M8 17h6" />
            </svg>
            <h2 id="saved-games-title" className="modal-title-text">Saved Games</h2>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={handleClose}
            disabled={loadingGameId !== null}
            aria-label="Close saved games"
          >
            ✕
          </button>
        </div>

        <div className="modal-body saved-games-body">
          {loadState === 'loading' && (
            <p className="saved-games-state" role="status" aria-live="polite">
              Loading saved games...
            </p>
          )}

          {loadState === 'error' && (
            <div className="saved-games-state">
              <p className="feedback-banner feedback-error" role="alert">{error}</p>
              <button type="button" className="btn btn-primary" onClick={handleRetry}>
                Retry
              </button>
            </div>
          )}

          {loadState === 'loaded' && games.length === 0 && (
            <div className="empty-state saved-games-empty">
              <span className="empty-state-icon" aria-hidden="true">♟</span>
              <p className="empty-state-title">No saved games yet</p>
              <p className="empty-state-desc">
                Import a PGN and save it to see it listed here.
              </p>
            </div>
          )}

          {loadState === 'loaded' && games.length > 0 && (
            <>
              <p className="saved-games-loaded" role="status" aria-live="polite">
                {games.length} saved {games.length === 1 ? 'game' : 'games'} loaded
              </p>
              {openError && (
                <p className="feedback-banner feedback-error" role="alert">
                  {openError}
                </p>
              )}
              <ul className="saved-games-list" aria-label="Saved games">
                {games.map((game) => (
                  <li key={game.id}>
                    <button
                      type="button"
                      className="saved-game-item"
                      onClick={() => handleOpenGame(game.id)}
                      disabled={loadingGameId !== null}
                      aria-label={`Open game ${game.id}: ${game.whitePlayer || 'Unknown'} versus ${game.blackPlayer || 'Unknown'}`}
                    >
                      <span className="saved-game-players">
                        <span>{game.whitePlayer || 'Unknown White'}</span>
                        <span aria-hidden="true"> vs </span>
                        <span>{game.blackPlayer || 'Unknown Black'}</span>
                      </span>
                      <span className="saved-game-details">
                        <span>Game #{game.id}</span>
                        <span>{game.result || '*'}</span>
                        <span>{game.movesCount} moves</span>
                        <time dateTime={game.createdAt}>
                          {formatImportDate(game.createdAt)}
                        </time>
                      </span>
                      {loadingGameId === game.id && (
                        <span className="saved-game-loading" role="status">
                          Loading game...
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="modal-footer">
          <span className="saved-games-footer-note">
            Select a game to load it onto the board.
          </span>
          <button type="button" className="btn btn-outline" onClick={handleClose}>
            Close
          </button>
        </div>
      </section>
    </div>
  );
}
