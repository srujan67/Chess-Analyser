import { useState } from 'react';
import Header from './components/Header';
import Chessboard from './components/Chessboard';
import PgnUploader from './components/PgnUploader';
import MoveHistory from './components/MoveHistory';
import AnalysisPanel from './components/AnalysisPanel';
import './App.css';

/**
 * Extracts chess moves (SAN notation) from raw PGN text.
 * Strips headers, comments, and results.
 */
function extractMovesFromPgn(pgn) {
  if (!pgn || typeof pgn !== 'string') return [];
  const withoutHeaders = pgn.replace(/\[.*?\]/g, ' ');
  const withoutComments = withoutHeaders.replace(/\{.*?\}/g, ' ');
  const withoutVariations = withoutComments.replace(/\(.*?\)/g, ' ');
  const tokens = withoutVariations
    .replace(/[0-9]+\.+/g, ' ')
    .replace(/(1-0|0-1|1\/2-1\/2|\*)/g, ' ')
    .trim()
    .split(/\s+/);
  return tokens.filter((t) => t.length > 0 && !t.startsWith('$'));
}

export default function App() {
  const [moves, setMoves] = useState([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [gameSource, setGameSource] = useState('');

  const handlePgnLoaded = (pgnContent, sourceName) => {
    if (!pgnContent) {
      setMoves([]);
      setCurrentMoveIndex(0);
      setGameSource('');
      return;
    }
    const parsedMoves = extractMovesFromPgn(pgnContent);
    setMoves(parsedMoves);
    setCurrentMoveIndex(parsedMoves.length > 0 ? 1 : 0);
    setGameSource(sourceName);
  };

  const handleNavigate = (direction) => {
    if (moves.length === 0) return;
    if (direction === 'start') {
      setCurrentMoveIndex(0);
    } else if (direction === 'prev') {
      setCurrentMoveIndex((prev) => Math.max(0, prev - 1));
    } else if (direction === 'next') {
      setCurrentMoveIndex((prev) => Math.min(moves.length, prev + 1));
    } else if (direction === 'end') {
      setCurrentMoveIndex(moves.length);
    }
  };

  const handleSelectMove = (index) => {
    setCurrentMoveIndex(index);
  };

  return (
    <div className="app-container">
      <Header />

      <main className="dashboard-layout">
        {/* Left column: Primary Chessboard view */}
        <section className="board-column" aria-label="Game Board Section">
          <Chessboard
            currentMoveIndex={currentMoveIndex}
            totalMoves={moves.length}
            onNavigate={handleNavigate}
          />
        </section>

        {/* Right column: Controls, Move History, and Analysis */}
        <section className="sidebar-column" aria-label="Game Controls and Analysis">
          <PgnUploader onPgnLoaded={handlePgnLoaded} />
          
          <div className="sidebar-panels-grid">
            <MoveHistory
              moves={moves}
              currentMoveIndex={currentMoveIndex}
              onSelectMove={handleSelectMove}
            />
            <AnalysisPanel />
          </div>
        </section>
      </main>

      <footer className="footer">
        <p>
          Chess Analyser &bull; Milestone 1: Frontend Foundation &bull;{' '}
          {gameSource ? `Active Game: ${gameSource}` : 'No game loaded'}
        </p>
      </footer>
    </div>
  );
}
