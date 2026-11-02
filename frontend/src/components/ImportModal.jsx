import { useState, useEffect, useRef } from 'react';
import { parsePgn, SAMPLE_PGN } from '../services/chessService';
import { saveGame } from '../services/gameApi';

export default function ImportModal({
  isOpen,
  onClose,
  onGameLoaded,
  onGameSaved,
  onGameSaveFailed,
}) {
  const [pgnText, setPgnText] = useState('');
  const [activeTab, setActiveTab] = useState('paste'); // 'paste' | 'file'
  const [loadedFileName, setLoadedFileName] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isSubmitting = useRef(false);

  // Close modal when pressing Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isSaving) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSaving, onClose]);

  if (!isOpen) return null;

  const processPgnContent = async (content, sourceName) => {
    if (isSubmitting.current) return;

    const result = parsePgn(content);
    if (!result.success) {
      setFeedback({ type: 'error', message: result.error });
      // Do not clear the existing game on error
      return;
    }

    if (onGameLoaded) {
      onGameLoaded(result, sourceName);
    }

    isSubmitting.current = true;
    setIsSaving(true);
    setFeedback({
      type: 'pending',
      message: `Loaded locally. Saving ${result.totalMoves} moves to the database...`,
    });

    try {
      const savedGame = await saveGame(content);
      onGameSaved?.(savedGame.gameId);
      setFeedback({
        type: 'success',
        message: `Saved game ${savedGame.gameId} with ${result.totalMoves} moves (${sourceName}).`,
      });
      onClose();
    } catch (error) {
      onGameSaveFailed?.();
      setFeedback({
        type: 'error',
        message: `The game is loaded locally but was not saved: ${error.message}`,
      });
    } finally {
      isSubmitting.current = false;
      setIsSaving(false);
    }
  };

  const handleFileUpload = (file) => {
    if (!file || isSubmitting.current) return;

    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.pgn') && !fileName.endsWith('.txt')) {
      setFeedback({
        type: 'error',
        message: 'Unsupported file type. Please upload a valid .pgn or .txt file.',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        setPgnText(content);
        setLoadedFileName(file.name);
        processPgnContent(content, file.name);
      }
    };
    reader.onerror = () => {
      setFeedback({
        type: 'error',
        message: 'Failed to read the file. Please check file permissions and try again.',
      });
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isSaving) setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (isSaving) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleLoadText = () => {
    if (isSaving) return;

    if (!pgnText.trim()) {
      setFeedback({
        type: 'error',
        message: 'PGN content is empty. Please enter or paste valid PGN text.',
      });
      return;
    }
    setLoadedFileName('Manual Input');
    processPgnContent(pgnText, 'Manual Input');
  };

  const handleLoadSample = () => {
    if (isSaving) return;

    setPgnText(SAMPLE_PGN);
    setLoadedFileName('Opera Game (Paul Morphy, 1858)');
    processPgnContent(SAMPLE_PGN, 'Opera Game (Paul Morphy, 1858)');
  };

  return (
    <div
      className="modal-backdrop"
      onClick={isSaving ? undefined : onClose}
      role="presentation"
    >
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(e) => e.stopPropagation()} // Prevent clicks inside modal from closing it
      >
        <div className="modal-header">
          <div className="modal-header-title">
            <svg
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
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="12" y2="12" />
              <line x1="15" y1="15" x2="12" y2="12" />
            </svg>
            <h2 id="modal-title" className="modal-title-text">Import Chess Game (PGN)</h2>
          </div>

          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close dialog"
            title="Close dialog (Esc)"
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="tab-group" role="tablist" aria-label="PGN Input Method">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'paste'}
              className={`tab-btn ${activeTab === 'paste' ? 'active' : ''}`}
              onClick={() => setActiveTab('paste')}
              disabled={isSaving}
            >
              Paste PGN Text
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'file'}
              className={`tab-btn ${activeTab === 'file' ? 'active' : ''}`}
              onClick={() => setActiveTab('file')}
              disabled={isSaving}
            >
              Upload PGN File
            </button>
          </div>

          {activeTab === 'paste' ? (
            <div className="pgn-paste-area">
              <textarea
                className="pgn-textarea"
                placeholder="Paste game PGN here (e.g. 1. e4 e5 2. Nf3 Nc6...)"
                value={pgnText}
                onChange={(e) => setPgnText(e.target.value)}
                disabled={isSaving}
                rows={7}
                aria-label="PGN text input"
                autoFocus
              />
            </div>
          ) : (
            <div
              className={`pgn-dropzone ${isDragging ? 'dragging' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                type="file"
                id="modal-pgn-file-input"
                className="file-input-hidden"
                accept=".pgn,.txt"
                onChange={(e) => handleFileUpload(e.target.files?.[0])}
                disabled={isSaving}
              />
              <label htmlFor="modal-pgn-file-input" className="file-dropzone-label">
                <span className="upload-icon" aria-hidden="true">📁</span>
                <span className="upload-prompt">
                  {loadedFileName ? `Selected: ${loadedFileName}` : 'Choose a .pgn file or drop it here'}
                </span>
                <span className="upload-hint">Supports .pgn and .txt files from Chess.com or Lichess</span>
              </label>
            </div>
          )}

          {feedback && (
            <div
              className={`feedback-banner feedback-${feedback.type}`}
              role={feedback.type === 'error' ? 'alert' : 'status'}
              aria-live="polite"
            >
              {feedback.message}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleLoadSample}
            disabled={isSaving}
            title="Load the classic 1858 Opera Game by Paul Morphy"
          >
            Load Sample PGN
          </button>
          <div className="modal-footer-right">
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleLoadText}
              disabled={!pgnText.trim() || isSaving}
            >
              {isSaving ? 'Saving...' : 'Load Game'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
