import { useState } from 'react';

// Starting position piece map (row 0 is rank 8, row 7 is rank 1)
const INITIAL_BOARD = [
  ['♜', '♞', '♝', '♛', '♚', '♝', '♞', '♜'], // Rank 8 (Black back rank)
  ['♟', '♟', '♟', '♟', '♟', '♟', '♟', '♟'], // Rank 7 (Black pawns)
  ['', '', '', '', '', '', '', ''],         // Rank 6
  ['', '', '', '', '', '', '', ''],         // Rank 5
  ['', '', '', '', '', '', '', ''],         // Rank 4
  ['', '', '', '', '', '', '', ''],         // Rank 3
  ['♙', '♙', '♙', '♙', '♙', '♙', '♙', '♙'], // Rank 2 (White pawns)
  ['♖', '♘', '♗', '♕', '♔', '♗', '♘', '♖'], // Rank 1 (White back rank)
];

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

export default function Chessboard({ currentMoveIndex = 0, totalMoves = 0, onNavigate }) {
  const [isFlipped, setIsFlipped] = useState(false);

  const displayRanks = isFlipped ? [...RANKS].reverse() : RANKS;
  const displayFiles = isFlipped ? [...FILES].reverse() : FILES;

  return (
    <div className="chessboard-container">
      <div className="board-wrapper">
        <div className="chessboard" role="region" aria-label="Chessboard">
          {displayRanks.map((rank, rowIndex) => (
            <div key={rank} className="board-row">
              {displayFiles.map((file, colIndex) => {
                const actualRow = isFlipped ? 7 - rowIndex : rowIndex;
                const actualCol = isFlipped ? 7 - colIndex : colIndex;
                const isLight = (actualRow + actualCol) % 2 === 0;
                const piece = INITIAL_BOARD[actualRow][actualCol];
                const isBlackPiece = ['♜', '♞', '♝', '♛', '♚', '♟'].includes(piece);

                return (
                  <div
                    key={`${file}${rank}`}
                    className={`board-square ${isLight ? 'square-light' : 'square-dark'}`}
                    data-square={`${file}${rank}`}
                  >
                    {/* Rank coordinate on the first column of the row */}
                    {colIndex === 0 && (
                      <span className="coord coord-rank">{rank}</span>
                    )}

                    {/* File coordinate on the bottom row */}
                    {rowIndex === 7 && (
                      <span className="coord coord-file">{file}</span>
                    )}

                    {piece && (
                      <span
                        className={`chess-piece ${isBlackPiece ? 'piece-black' : 'piece-white'}`}
                        aria-label={`${piece} on ${file}${rank}`}
                      >
                        {piece}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="board-controls">
        <div className="board-status">
          <span className="status-dot"></span>
          <span className="status-text">Starting Position (Move {currentMoveIndex}/{totalMoves})</span>
        </div>

        <div className="controls-buttons">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onNavigate && onNavigate('start')}
            disabled={totalMoves === 0}
            title="Go to start"
            aria-label="Go to start"
          >
            ⇤
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onNavigate && onNavigate('prev')}
            disabled={totalMoves === 0}
            title="Previous move"
            aria-label="Previous move"
          >
            ←
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onNavigate && onNavigate('next')}
            disabled={totalMoves === 0}
            title="Next move"
            aria-label="Next move"
          >
            →
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onNavigate && onNavigate('end')}
            disabled={totalMoves === 0}
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
            ⇄ Flip
          </button>
        </div>
      </div>
    </div>
  );
}
