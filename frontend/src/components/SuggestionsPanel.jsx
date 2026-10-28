export default function SuggestionsPanel() {
  return (
    <section className="panel suggestions-panel" aria-labelledby="suggestions-panel-title">
      <div className="panel-header">
        <div className="panel-header-title-group">
          <svg
            className="panel-icon"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9 18h6" />
            <path d="M10 22h4" />
            <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
          </svg>
          <h2 id="suggestions-panel-title" className="panel-title">Suggestions</h2>
        </div>
      </div>

      <div className="panel-body">
        <div className="empty-state suggestions-empty-state">
          <div className="empty-state-bulb-icon" aria-hidden="true">
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 18h6" />
              <path d="M10 22h4" />
              <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
            </svg>
          </div>
          <p className="empty-state-title">Suggestions will appear here</p>
          <p className="empty-state-desc">
            Tactical insights and alternative move suggestions will be provided here once the engine analysis service is connected in a future milestone.
          </p>
        </div>
      </div>
    </section>
  );
}
