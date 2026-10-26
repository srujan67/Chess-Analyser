import { useEffect, useRef } from 'react';

export default function MoveHistory({
  moves = [],
  currentMoveIndex = 0,
  headers = null,
  onSelectMove,
}) {
  const activeBtnRef = useRef(null);

  // Auto-scroll the move list to keep active move visible
  useEffect(() => {
    if (activeBtnRef.current) {
      activeBtnRef.current.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
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
    <section className="panel move-history-panel" aria-labelledby="move-history-title">
      <div className="panel-header">
        <h2 id="move-history-title" className="panel-title">Move History</h2>
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
              Upload a PGN file or click &quot;Load Sample PGN&quot; to inspect moves.
            </p>
          </div>
        ) : (
          <div className="move-list-table-wrapper">
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
