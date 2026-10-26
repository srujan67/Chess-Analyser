import { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import Chessboard from './components/Chessboard';
import PgnUploader from './components/PgnUploader';
import MoveHistory from './components/MoveHistory';
import AnalysisPanel from './components/AnalysisPanel';
import {
  DEFAULT_STARTING_FEN,
  getNavigationIndex,
} from './services/chessService';
import './App.css';

export default function App() {
  const [gameData, setGameData] = useState({
    moves: [],
    positions: [DEFAULT_STARTING_FEN],
    headers: {},
    totalMoves: 0,
  });
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [gameSource, setGameSource] = useState('');

  const handleGameLoaded = (parsedResult, sourceName) => {
    setGameData({
      moves: parsedResult.moves || [],
      positions: parsedResult.positions || [DEFAULT_STARTING_FEN],
      headers: parsedResult.headers || {},
      totalMoves: parsedResult.totalMoves || 0,
    });
    // Start at move 1 so the user immediately sees the first move on the board
    setCurrentMoveIndex(parsedResult.totalMoves > 0 ? 1 : 0);
    setGameSource(sourceName);
  };

  const handleGameCleared = () => {
    setGameData({
      moves: [],
      positions: [DEFAULT_STARTING_FEN],
      headers: {},
      totalMoves: 0,
    });
    setCurrentMoveIndex(0);
    setGameSource('');
  };

  const handleNavigate = useCallback(
    (action) => {
      setCurrentMoveIndex((prev) =>
        getNavigationIndex(action, prev, gameData.totalMoves)
      );
    },
    [gameData.totalMoves]
  );

  const handleSelectMove = (index) => {
    if (index >= 0 && index <= gameData.totalMoves) {
      setCurrentMoveIndex(index);
    }
  };

  // Keyboard navigation for desktop: Left (prev), Right (next), Home (start), End (last)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Avoid intercepting keystrokes when typing in textarea or input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleNavigate('prev');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNavigate('next');
      } else if (e.key === 'Home') {
        e.preventDefault();
        handleNavigate('start');
      } else if (e.key === 'End') {
        e.preventDefault();
        handleNavigate('end');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNavigate]);

  const currentFen =
    gameData.positions[currentMoveIndex] || DEFAULT_STARTING_FEN;
  const currentMove =
    currentMoveIndex > 0 ? gameData.moves[currentMoveIndex - 1] : null;

  return (
    <div className="app-container">
      <Header />

      <main className="dashboard-layout">
        {/* Left column: Primary Chessboard view */}
        <section className="board-column" aria-label="Game Board Section">
          <Chessboard
            currentFen={currentFen}
            currentMove={currentMove}
            currentMoveIndex={currentMoveIndex}
            totalMoves={gameData.totalMoves}
            onNavigate={handleNavigate}
          />
        </section>

        {/* Right column: Controls, Move History, and Analysis */}
        <section className="sidebar-column" aria-label="Game Controls and Analysis">
          <PgnUploader
            onGameLoaded={handleGameLoaded}
            onGameCleared={handleGameCleared}
          />

          <div className="sidebar-panels-grid">
            <MoveHistory
              moves={gameData.moves}
              currentMoveIndex={currentMoveIndex}
              headers={gameData.headers}
              onSelectMove={handleSelectMove}
            />
            <AnalysisPanel />
          </div>
        </section>
      </main>

      <footer className="footer">
        <p>
          Chess Analyser &bull; Milestone 2: Functional PGN Import &amp; Replay &bull;{' '}
          {gameSource ? `Loaded: ${gameSource}` : 'No game loaded'}
        </p>
      </footer>
    </div>
  );
}
