import { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import Chessboard from './components/Chessboard';
import SuggestionsPanel from './components/SuggestionsPanel';
import MoveHistory from './components/MoveHistory';
import ImportModal from './components/ImportModal';
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
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

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

  // Keyboard shortcuts for desktop: Left (prev), Right (next), Home (start), End (last)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Avoid intercepting keystrokes when typing in textarea or input, or if modal is open
      if (
        isImportModalOpen ||
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
  }, [handleNavigate, isImportModalOpen]);

  const currentFen =
    gameData.positions[currentMoveIndex] || DEFAULT_STARTING_FEN;
  const currentMove =
    currentMoveIndex > 0 ? gameData.moves[currentMoveIndex - 1] : null;

  return (
    <div className="app-container">
      <Header onOpenImport={() => setIsImportModalOpen(true)} />

      <main className="dashboard-layout-3col">
        {/* Left column: Chessboard and controls (largest area) */}
        <section className="dashboard-col board-column" aria-label="Chessboard Section">
          <Chessboard
            currentFen={currentFen}
            currentMove={currentMove}
            currentMoveIndex={currentMoveIndex}
            totalMoves={gameData.totalMoves}
            onNavigate={handleNavigate}
          />
        </section>

        {/* Middle column: Suggestions (placeholder) */}
        <section className="dashboard-col suggestions-column" aria-label="Suggestions Section">
          <SuggestionsPanel />
        </section>

        {/* Right column: Move History */}
        <section className="dashboard-col moves-column" aria-label="Move History Section">
          <MoveHistory
            moves={gameData.moves}
            currentMoveIndex={currentMoveIndex}
            headers={gameData.headers}
            onSelectMove={handleSelectMove}
          />
        </section>
      </main>

      <footer className="footer">
        <p>
          Chess Analyser &bull; Review your games and improve your play &bull;{' '}
          {gameSource ? `Loaded: ${gameSource}` : 'No game loaded (Click "Import PGN" to start)'}
        </p>
      </footer>

      {/* PGN Import Modal Dialog */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onGameLoaded={handleGameLoaded}
      />
    </div>
  );
}
