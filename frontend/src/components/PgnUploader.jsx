import { useState } from 'react';

const SAMPLE_PGN = `[Event "Live Chess"]
[Site "Chess.com"]
[Date "2026.10.15"]
[White "Player1"]
[Black "Player2"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 Nbd7 1-0`;

export default function PgnUploader({ onPgnLoaded }) {
  const [pgnText, setPgnText] = useState('');
  const [activeTab, setActiveTab] = useState('paste'); // 'paste' | 'file'
  const [loadedFileName, setLoadedFileName] = useState('');
  const [feedback, setFeedback] = useState(null);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.pgn') && !file.name.endsWith('.txt')) {
      setFeedback({ type: 'error', message: 'Please select a valid .pgn file' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        setPgnText(content);
        setLoadedFileName(file.name);
        setFeedback({ type: 'success', message: `Loaded "${file.name}"` });
        if (onPgnLoaded) {
          onPgnLoaded(content, file.name);
        }
      }
    };
    reader.readAsText(file);
  };

  const handleLoadText = () => {
    if (!pgnText.trim()) {
      setFeedback({ type: 'error', message: 'Please paste or enter PGN text before loading.' });
      return;
    }
    setLoadedFileName('Manual Input');
    setFeedback({ type: 'success', message: 'PGN content loaded successfully.' });
    if (onPgnLoaded) {
      onPgnLoaded(pgnText, 'Manual Input');
    }
  };

  const handleLoadSample = () => {
    setPgnText(SAMPLE_PGN);
    setLoadedFileName('Ruy Lopez Sample');
    setFeedback({ type: 'success', message: 'Sample game loaded (Ruy Lopez).' });
    if (onPgnLoaded) {
      onPgnLoaded(SAMPLE_PGN, 'Ruy Lopez Sample');
    }
  };

  const handleClear = () => {
    setPgnText('');
    setLoadedFileName('');
    setFeedback(null);
    if (onPgnLoaded) {
      onPgnLoaded('', '');
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
              placeholder="Paste your Chess.com PGN here (e.g. 1. e4 e5 2. Nf3 Nc6...)"
              value={pgnText}
              onChange={(e) => setPgnText(e.target.value)}
              rows={4}
              aria-label="PGN text"
            />
          </div>
        ) : (
          <div className="pgn-dropzone">
            <input
              type="file"
              id="pgn-file-input"
              className="file-input-hidden"
              accept=".pgn,.txt"
              onChange={handleFileUpload}
            />
            <label htmlFor="pgn-file-input" className="file-dropzone-label">
              <span className="upload-icon" aria-hidden="true">📁</span>
              <span className="upload-prompt">
                {loadedFileName ? `Current file: ${loadedFileName}` : 'Choose a .pgn file or drop it here'}
              </span>
              <span className="upload-hint">Downloaded from Chess.com or Lichess</span>
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
