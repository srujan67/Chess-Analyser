import { useState, useEffect, useCallback, useRef } from 'react';
import Header from './components/Header';
import Chessboard from './components/Chessboard';
import SuggestionsPanel from './components/SuggestionsPanel';
import MoveHistory from './components/MoveHistory';
import ImportModal from './components/ImportModal';
import SavedGamesModal from './components/SavedGamesModal';
import {
  DEFAULT_STARTING_FEN,
  getNavigationIndex,
} from './services/chessService';
import { analyzeGame, getGameAnalysis } from './services/gameApi';
import './App.css';

export default function App() {
  const [gameData, setGameData] = useState({
    moves: [],
    positions: [DEFAULT_STARTING_FEN],
    headers: {},
    totalMoves: 0,
    gameId: null,
    saveStatus: 'none',
  });
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [gameSource, setGameSource] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSavedGamesOpen, setIsSavedGamesOpen] = useState(false);
  const [gameAnalysis, setGameAnalysis] = useState(null);
  const [analysisStatus, setAnalysisStatus] = useState('empty');
  const [analysisError, setAnalysisError] = useState('');
  const analysisRequestInProgress = useRef(false);
  const activeGameId = useRef(null);
  const [analysisReloadKey, setAnalysisReloadKey] = useState(0);

  const handleGameLoaded = (parsedResult, sourceName) => {
    activeGameId.current = null;
    setGameData({
      moves: parsedResult.moves || [],
      positions: parsedResult.positions || [DEFAULT_STARTING_FEN],
      headers: parsedResult.headers || {},
      totalMoves: parsedResult.totalMoves || 0,
      gameId: null,
      saveStatus: 'saving',
    });
    // Start at move 1 so the user immediately sees the first move on the board
    setCurrentMoveIndex(parsedResult.totalMoves > 0 ? 1 : 0);
    setGameSource(sourceName);
    setGameAnalysis(null);
    setAnalysisStatus('saving');
    setAnalysisError('');
  };

  const handleGameSaved = (gameId) => {
    activeGameId.current = gameId;
    setGameData((currentGame) => ({
      ...currentGame,
      gameId,
      saveStatus: 'saved',
    }));
    setAnalysisStatus('loading');
    setAnalysisReloadKey((key) => key + 1);
  };

  const handleGameSaveFailed = () => {
    setAnalysisStatus('local');
    setGameData((currentGame) => ({
      ...currentGame,
      saveStatus: 'local',
    }));
  };

  const handleSavedGameLoaded = (parsedResult, savedGame) => {
    activeGameId.current = savedGame.id;
    setGameData({
      moves: parsedResult.moves,
      positions: parsedResult.positions,
      headers: parsedResult.headers || {},
      totalMoves: parsedResult.totalMoves,
      gameId: savedGame.id,
      saveStatus: 'saved',
    });
    setCurrentMoveIndex(parsedResult.totalMoves > 0 ? 1 : 0);
    setGameSource(`Saved game #${savedGame.id}`);
    setGameAnalysis(null);
    setAnalysisStatus('loading');
    setAnalysisError('');
    setAnalysisReloadKey((key) => key + 1);
  };

  const handleOpenSavedGames = () => {
    setIsSavedGamesOpen(true);
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

  useEffect(() => {
    let cancelled = false;
    if (!gameData.gameId) return undefined;
    getGameAnalysis(gameData.gameId)
      .then((analysis) => {
        if (cancelled) return;
        setGameAnalysis(analysis);
        setAnalysisStatus(analysis ? 'ready' : 'not-analyzed');
      })
      .catch((error) => {
        if (cancelled) return;
        setAnalysisError(error.message);
        setAnalysisStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [gameData.gameId, analysisReloadKey]);

  const handleAnalyzeGame = async () => {
    if (
      !gameData.gameId ||
      gameAnalysis ||
      analysisRequestInProgress.current
    ) {
      return;
    }

    const requestedGameId = gameData.gameId;
    analysisRequestInProgress.current = true;
    setAnalysisStatus('analyzing');
    setAnalysisError('');
    try {
      const analysis = await analyzeGame(requestedGameId);
      if (String(activeGameId.current) === String(requestedGameId)) {
        setGameAnalysis(analysis);
        setAnalysisStatus('ready');
      }
    } catch (error) {
      if (String(activeGameId.current) === String(requestedGameId)) {
        setAnalysisError(error.message);
        setAnalysisStatus('error');
      }
    } finally {
      analysisRequestInProgress.current = false;
    }
  };

  const handleRetryAnalysisLoad = async () => {
    if (!gameData.gameId) return;
    const requestedGameId = gameData.gameId;
    setAnalysisStatus('loading');
    setAnalysisError('');
    try {
      const analysis = await getGameAnalysis(requestedGameId);
      if (String(activeGameId.current) === String(requestedGameId)) {
        setGameAnalysis(analysis);
        setAnalysisStatus(analysis ? 'ready' : 'not-analyzed');
      }
    } catch (error) {
      if (String(activeGameId.current) === String(requestedGameId)) {
        setAnalysisError(error.message);
        setAnalysisStatus('error');
      }
    }
  };

  // Keyboard shortcuts for desktop: Left (prev), Right (next), Home (start), End (last)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Avoid intercepting keystrokes when typing in textarea or input, or if modal is open
      if (
        isImportModalOpen ||
        isSavedGamesOpen ||
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
  }, [handleNavigate, isImportModalOpen, isSavedGamesOpen]);

  const currentFen =
    gameData.positions[currentMoveIndex] || DEFAULT_STARTING_FEN;
  const currentMove =
    currentMoveIndex > 0 ? gameData.moves[currentMoveIndex - 1] : null;

  return (
    <div className="app-container">
      <Header
        onOpenImport={() => setIsImportModalOpen(true)}
        onOpenSavedGames={handleOpenSavedGames}
      />

      <main className="dashboard-layout-3col">
        {/* Left column: Chessboard and controls (largest area) */}
        <section className="dashboard-col board-column" aria-label="Chessboard Section">
          <Chessboard
            currentFen={currentFen}
            currentMove={currentMove}
            currentMoveIndex={currentMoveIndex}
            totalMoves={gameData.totalMoves}
            headers={gameData.headers}
            onNavigate={handleNavigate}
          />
        </section>

        {/* Middle column: Stockfish-powered chess coaching */}
        <section className="dashboard-col suggestions-column" aria-label="Suggestions Section">
          <SuggestionsPanel
            analysis={gameAnalysis}
            analysisStatus={analysisStatus}
            analysisError={analysisError}
            currentMoveIndex={currentMoveIndex}
            moves={gameData.moves}
            headers={gameData.headers}
            onSelectMove={handleSelectMove}
            onAnalyze={handleAnalyzeGame}
            onRetry={handleRetryAnalysisLoad}
          />
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
          {gameSource ? (
            <>
              Loaded: {gameSource}
              {gameData.saveStatus === 'saving' && ' · Saving to database...'}
              {gameData.saveStatus === 'saved' && ` · Saved (ID: ${gameData.gameId})`}
              {gameData.saveStatus === 'local' && ' · Loaded locally (not saved)'}
            </>
          ) : (
            'No game loaded (Click "Import PGN" to start)'
          )}
        </p>
      </footer>

      {/* PGN Import Modal Dialog */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onGameLoaded={handleGameLoaded}
        onGameSaved={handleGameSaved}
        onGameSaveFailed={handleGameSaveFailed}
      />
      <SavedGamesModal
        isOpen={isSavedGamesOpen}
        onClose={() => setIsSavedGamesOpen(false)}
        onGameLoaded={handleSavedGameLoaded}
      />
    </div>
  );
}
