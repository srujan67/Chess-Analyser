export default function MoveHistory({ moves = [], currentMoveIndex = 0, onSelectMove }) {
  // Format moves into pairs (turn: { num, white, black })
  const movePairs = [];
  for (let i = 0; i < moves.length; i += 2) {
    movePairs.push({
      moveNumber: Math.floor(i / 2) + 1,
      whiteIndex: i + 1,
      white: moves[i],
      blackIndex: i + 2 <= moves.length ? i + 2 : null,
      black: moves[i + 1] || null,
    });
  }

  return (
    <section className="panel move-history-panel" aria-labelledby="move-history-title">
      <div className="panel-header">
        <h2 id="move-history-title" className="panel-title">Move History</h2>
        <span className="badge badge-subtle">{moves.length} half-moves</span>
      </div>

      <div className="panel-body">
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

                  return (
                    <tr key={pair.moveNumber}>
                      <td className="col-num">{pair.moveNumber}.</td>
                      <td className="col-move">
                        <button
                          type="button"
                          className={`move-btn ${isWhiteActive ? 'active' : ''}`}
                          onClick={() => onSelectMove && onSelectMove(pair.whiteIndex)}
                        >
                          {pair.white}
                        </button>
                      </td>
                      <td className="col-move">
                        {pair.black ? (
                          <button
                            type="button"
                            className={`move-btn ${isBlackActive ? 'active' : ''}`}
                            onClick={() => onSelectMove && onSelectMove(pair.blackIndex)}
                          >
                            {pair.black}
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
