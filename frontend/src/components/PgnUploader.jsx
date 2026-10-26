import { useState } from 'react';
import { parsePgn, SAMPLE_PGN } from '../services/chessService';

export default function PgnUploader({ onGameLoaded, onGameCleared }) {
  const [pgnText, setPgnText] = useState('');
  const [activeTab, setActiveTab] = useState('paste'); // 'paste' | 'file'
  const [loadedFileName, setLoadedFileName] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const processPgnContent = (content, sourceName) => {
    const result = parsePgn(content);
    if (!result.success) {
      setFeedback({ type: 'error', message: result.error });
      if (onGameCleared) onGameCleared();
      return;
    }

    setFeedback({
      type: 'success',
      message: `Loaded ${result.totalMoves} moves (${sourceName}).`,
    });
    if (onGameLoaded) {
      onGameLoaded(result, sourceName);
    }
  };

  const handleFileUpload = (file) => {
    if (!file) return;

    if (!file.name.endsWith('.pgn') && !file.name.endsWith('.txt')) {
      setFeedback({
        type: 'error',
        message: 'Unsupported file type. Please upload a .pgn or .txt file.',
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
        message: 'Failed to read the selected file. Please try again.',
      });
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
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
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleLoadText = () => {
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
    setPgnText(SAMPLE_PGN);
    setLoadedFileName('Opera Game (Paul Morphy, 1858)');
    processPgnContent(SAMPLE_PGN, 'Opera Game (Paul Morphy, 1858)');
  };

  const handleClear = () => {
    setPgnText('');
    setLoadedFileName('');
    setFeedback(null);
    if (onGameCleared) {
      onGameCleared();
    }
  };

  return (
    <section className="panel pgn-uploader-panel" aria-labelledby="pgn-panel-title">
      <div className="panel-header">
        <h2 id="pgn-panel-title" className="panel-title">Game Import (PGN)</h2>
        <div className="tab-group" role="tablist" aria-label="PGN Input Method">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'paste'}
            className={`tab-btn ${activeTab === 'paste' ? 'active' : ''}`}
            onClick={() => setActiveTab('paste')}
          >
            Paste PGN
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'file'}
            className={`tab-btn ${activeTab === 'file' ? 'active' : ''}`}
            onClick={() => setActiveTab('file')}
          >
            Upload File
          </button>
        </div>
      </div>

      <div className="panel-body">
        {activeTab === 'paste' ? (
          <div className="pgn-paste-area">
            <textarea
              className="pgn-textarea"
              placeholder="Paste your PGN here (e.g. 1. e4 e5 2. Nf3 Nc6...)"
              value={pgnText}
              onChange={(e) => setPgnText(e.target.value)}
              rows={4}
              aria-label="PGN text"
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
              id="pgn-file-input"
              className="file-input-hidden"
              accept=".pgn,.txt"
              onChange={(e) => handleFileUpload(e.target.files?.[0])}
            />
            <label htmlFor="pgn-file-input" className="file-dropzone-label">
              <span className="upload-icon" aria-hidden="true">📁</span>
              <span className="upload-prompt">
                {loadedFileName ? `Loaded: ${loadedFileName}` : 'Choose a .pgn file or drop it here'}
              </span>
              <span className="upload-hint">Supported formats: .pgn, .txt</span>
            </label>
          </div>
        )}

        {feedback && (
          <div className={`feedback-banner feedback-${feedback.type}`} role="status">
            {feedback.message}
          </div>
        )}

        <div className="pgn-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleLoadText}
            disabled={!pgnText.trim()}
          >
            Load Game
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleLoadSample}
          >
            Load Sample PGN
          </button>
          {pgnText && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleClear}
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
