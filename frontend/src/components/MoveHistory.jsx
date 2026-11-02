import { useEffect, useRef } from 'react';

export default function MoveHistory({
  moves = [],
  currentMoveIndex = 0,
  headers = null,
  onSelectMove,
}) {
  const activeBtnRef = useRef(null);
  const tableWrapperRef = useRef(null);

  // Auto-scroll ONLY the internal move list container to keep the active move visible.
  // This explicitly avoids calling window.scroll or element.scrollIntoView(),
  // ensuring the outer document/window remains completely stationary during move navigation.
  useEffect(() => {
    const container = tableWrapperRef.current;
    const activeBtn = activeBtnRef.current;

    if (!container || !activeBtn) return;

    // When navigating to the starting position (move 0), scroll smoothly to the top
    if (currentMoveIndex === 0) {
      if (typeof container.scrollTo === 'function') {
        container.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        container.scrollTop = 0;
      }
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const activeRect = activeBtn.getBoundingClientRect();

    const isAbove = activeRect.top < containerRect.top;
    const isBelow = activeRect.bottom > containerRect.bottom;

    if (isAbove) {
      const diff = activeRect.top - containerRect.top - 8;
      if (typeof container.scrollBy === 'function') {
        container.scrollBy({ top: diff, behavior: 'smooth' });
      } else {
        container.scrollTop += diff;
      }
    } else if (isBelow) {
      const diff = activeRect.bottom - containerRect.bottom + 8;
      if (typeof container.scrollBy === 'function') {
        container.scrollBy({ top: diff, behavior: 'smooth' });
      } else {
        container.scrollTop += diff;
      }
    }
  }, [currentMoveIndex]);

  // Format moves into turn pairs: { moveNumber, white, black, whiteIndex, blackIndex }
  const movePairs = [];
  for (let i = 0; i < moves.length; i += 2) {
    movePairs.push({
      moveNumber: Math.floor(i / 2) + 1,
      whiteIndex: i + 1,
      white: moves[i],
      blackIndex: i + 1 < moves.length ? i + 2 : null,
      black: moves[i + 1] || null,
    });
  }

  const whitePlayer = headers?.White || 'White';
  const blackPlayer = headers?.Black || 'Black';
  const gameResult = headers?.Result || '';

  return (
    <section className="panel move-history-panel" aria-labelledby="moves-panel-title">
      <div className="panel-header">
        <div className="panel-header-title-group">
          <svg
            className="panel-icon"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
          <h2 id="moves-panel-title" className="panel-title">Moves</h2>
        </div>
        <span className="badge badge-subtle">{moves.length} moves</span>
      </div>

      <div className="panel-body">
        {headers && (headers.White || headers.Black) && (
          <div className="game-players-bar">
            <span className="player-name">⚪ {whitePlayer}</span>
            <span className="game-vs">vs</span>
            <span className="player-name">⚫ {blackPlayer}</span>
            {gameResult && <span className="game-result-badge">{gameResult}</span>}
          </div>
        )}

        {moves.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon" aria-hidden="true">♟</span>
            <p className="empty-state-title">No moves loaded</p>
            <p className="empty-state-desc">
              Click &quot;Import PGN&quot; in the header to load a game.
            </p>
          </div>
        ) : (
          <div className="move-list-table-wrapper" ref={tableWrapperRef}>
            <div className="start-pos-row">
              <button
                type="button"
                className={`move-btn start-pos-btn ${currentMoveIndex === 0 ? 'active' : ''}`}
                onClick={() => onSelectMove && onSelectMove(0)}
                ref={currentMoveIndex === 0 ? activeBtnRef : null}
              >
                ⇤ Starting Position
              </button>
            </div>
            <table className="move-list-table">
              <thead>
                <tr>
                  <th scope="col" className="col-num">#</th>
                  <th scope="col" className="col-move">White</th>
                  <th scope="col" className="col-move">Black</th>
                </tr>
              </thead>
              <tbody>
                {movePairs.map((pair) => {
                  const isWhiteActive = currentMoveIndex === pair.whiteIndex;
                  const isBlackActive = currentMoveIndex === pair.blackIndex;
                  const whiteSan = pair.white?.san || pair.white;
                  const blackSan = pair.black ? (pair.black?.san || pair.black) : null;

                  return (
                    <tr key={pair.moveNumber}>
                      <td className="col-num">{pair.moveNumber}.</td>
                      <td className="col-move">
                        <button
                          type="button"
                          className={`move-btn ${isWhiteActive ? 'active' : ''}`}
                          onClick={() => onSelectMove && onSelectMove(pair.whiteIndex)}
                          ref={isWhiteActive ? activeBtnRef : null}
                          aria-label={`Move ${pair.moveNumber} White: ${whiteSan}`}
                        >
                          {whiteSan}
                        </button>
                      </td>
                      <td className="col-move">
                        {blackSan ? (
                          <button
                            type="button"
                            className={`move-btn ${isBlackActive ? 'active' : ''}`}
                            onClick={() => onSelectMove && onSelectMove(pair.blackIndex)}
                            ref={isBlackActive ? activeBtnRef : null}
                            aria-label={`Move ${pair.moveNumber} Black: ${blackSan}`}
                          >
                            {blackSan}
                          </button>
                        ) : (
                          <span className="move-placeholder">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
