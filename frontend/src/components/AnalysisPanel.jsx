export default function AnalysisPanel() {
  return (
    <section className="panel analysis-panel" aria-labelledby="analysis-panel-title">
      <div className="panel-header">
        <h2 id="analysis-panel-title" className="panel-title">Engine Analysis</h2>
        <span className="badge badge-warning">Awaiting Stockfish</span>
      </div>

      <div className="panel-body">
        <div className="analysis-empty-state">
          <div className="analysis-status-card">
            <div className="status-indicator-box">
              <span className="status-beacon beacon-offline"></span>
              <div>
                <h3 className="status-title">Engine Not Connected</h3>
                <p className="status-subtitle">
                  Stockfish engine integration is planned for an upcoming milestone.
                </p>
              </div>
            </div>
          </div>

          <div className="planned-features-list">
            <h4 className="planned-heading">Planned Engine Features</h4>
            <div className="feature-grid">
              <div className="feature-item">
                <span className="feature-badge">Position Evaluation</span>
                <p className="feature-desc">Real-time centipawn advantage evaluation bar</p>
              </div>
              <div className="feature-item">
                <span className="feature-badge">Move Classification</span>
                <p className="feature-desc">Automatic detection of inaccuracies, mistakes, and blunders</p>
              </div>
              <div className="feature-item">
                <span className="feature-badge">Alternative Lines</span>
                <p className="feature-desc">Deep-search recommendations and tactical refutations</p>
              </div>
            </div>
          </div>

          <div className="architecture-note">
            <p>
              <strong>Architecture Note:</strong> In accordance with milestone requirements, analysis results will only be rendered once the Node.js backend and Stockfish process are connected via HTTP APIs.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
