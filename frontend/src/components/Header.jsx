export default function Header() {
  return (
    <header className="header">
      <div className="header-brand">
        <div className="header-logo" aria-hidden="true">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
            <path d="M9 15h6" />
            <path d="M12 12v6" />
          </svg>
        </div>
        <div>
          <h1 className="header-title">Chess Analyser</h1>
          <p className="header-tagline">
            Import PGNs, replay games, and analyse mistakes
          </p>
        </div>
      </div>
      <div className="header-meta">
        <span className="badge badge-milestone">Milestone 2: PGN Import &amp; Replay</span>
      </div>
    </header>
  );
}
