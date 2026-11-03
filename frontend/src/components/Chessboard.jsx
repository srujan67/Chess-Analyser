import { useState } from 'react';
import { Chessboard as ReactChessboard } from 'react-chessboard';
import { DEFAULT_STARTING_FEN } from '../services/chessService';

export default function Chessboard({
  currentFen = DEFAULT_STARTING_FEN,
  currentMove = null,
  currentMoveIndex = 0,
  totalMoves = 0,
  headers = {},
  onNavigate,
}) {
  const [isFlipped, setIsFlipped] = useState(false);

  // Compute square highlights for the active move
  const customSquareStyles = {};
  if (currentMove?.from && currentMove?.to) {
    customSquareStyles[currentMove.from] = {
      backgroundColor: 'rgba(255, 255, 0, 0.35)',
    };
    customSquareStyles[currentMove.to] = {
      backgroundColor: 'rgba(255, 255, 0, 0.55)',
    };
  }

  // Determine current move description for the status badge
  let statusText = 'Starting Position';
  if (currentMoveIndex > 0 && currentMove) {
    const moveNum = Math.floor((currentMoveIndex - 1) / 2) + 1;
    const isWhite = currentMove.color === 'w';
    statusText = `${moveNum}.${isWhite ? '' : '..'} ${currentMove.san}`;
  }

  const whitePlayer = headers.White || 'White';
  const blackPlayer = headers.Black || 'Black';
  const topPlayer = isFlipped
    ? { color: 'white', label: 'White', name: whitePlayer, position: 'top' }
    : { color: 'black', label: 'Black', name: blackPlayer, position: 'top' };
  const bottomPlayer = isFlipped
    ? { color: 'black', label: 'Black', name: blackPlayer, position: 'bottom' }
    : { color: 'white', label: 'White', name: whitePlayer, position: 'bottom' };

  const renderPlayerLabel = (player) => (
    <div className={`board-player board-player-${player.color} board-player-${player.position}`}>
      <span className="board-player-indicator" aria-hidden="true" />
      <span className="board-player-label">{player.label}</span>
      <span className="board-player-name" title={player.name}>{player.name}</span>
    </div>
  );

  return (
    <div className="chessboard-container">
      {renderPlayerLabel(topPlayer)}
      <div className="board-wrapper">
        <ReactChessboard
          options={{
            position: currentFen || DEFAULT_STARTING_FEN,
            boardOrientation: isFlipped ? 'black' : 'white',
            allowDragging: false,
            showNotation: true,
            darkSquareStyle: { backgroundColor: '#b58863' },
            lightSquareStyle: { backgroundColor: '#f0d9b5' },
            squareStyles: customSquareStyles,
            boardStyle: {
              borderRadius: '6px',
              overflow: 'hidden',
            },
          }}
        />
      </div>
      {renderPlayerLabel(bottomPlayer)}

      <div className="board-controls">
        <div className="board-status">
          <span className="status-dot"></span>
          <span className="status-text">
            {statusText} ({currentMoveIndex}/{totalMoves})
          </span>
        </div>

        <div className="controls-buttons">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onNavigate && onNavigate('start')}
            disabled={totalMoves === 0 || currentMoveIndex === 0}
            title="Go to start (Move 0)"
            aria-label="Go to start"
          >
            ⇤
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onNavigate && onNavigate('prev')}
            disabled={totalMoves === 0 || currentMoveIndex === 0}
            title="Previous move"
            aria-label="Previous move"
          >
            ←
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onNavigate && onNavigate('next')}
            disabled={totalMoves === 0 || currentMoveIndex === totalMoves}
            title="Next move"
            aria-label="Next move"
          >
            →
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onNavigate && onNavigate('end')}
            disabled={totalMoves === 0 || currentMoveIndex === totalMoves}
            title="Go to end"
            aria-label="Go to end"
          >
            ⇥
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setIsFlipped(!isFlipped)}
            title="Flip board orientation"
          >
            ⇄ Flip ({isFlipped ? 'Black' : 'White'})
          </button>
        </div>
      </div>
    </div>
  );
}
