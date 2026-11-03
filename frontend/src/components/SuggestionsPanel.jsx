import { useMemo } from 'react';
import { buildGameCoaching } from '../services/coachingService';

const CLASSIFICATION_STYLES = {
  blunder: 'coach-event-blunder',
  mistake: 'coach-event-mistake',
  inaccuracy: 'coach-event-inaccuracy',
  best_or_acceptable: 'coach-event-good',
};

function getNavigationTargets(events, currentMoveIndex) {
  const selectedIndex = events.findIndex(
    (event) => event.plyNumber === currentMoveIndex,
  );
  if (selectedIndex >= 0) {
    return {
      selectedIndex,
      previousIndex: selectedIndex > 0 ? selectedIndex - 1 : -1,
      nextIndex: selectedIndex < events.length - 1 ? selectedIndex + 1 : -1,
    };
  }

  let previousIndex = -1;
  for (let index = 0; index < events.length; index += 1) {
    if (events[index].plyNumber < currentMoveIndex) previousIndex = index;
  }

  return {
    selectedIndex: -1,
    previousIndex,
    nextIndex: events.findIndex((event) => event.plyNumber > currentMoveIndex),
  };
}

function PlayerCounts({ color, name, counts }) {
  const countLabel = (count, singular, plural) => (
    <span><b>{count}</b> {count === 1 ? singular : plural}</span>
  );
  return (
    <div className={`coach-player-summary coach-player-${color}`}>
      <div className="coach-player-heading">
        <span className="coach-player-dot" aria-hidden="true" />
        <strong>{name}</strong>
      </div>
      <div className="coach-counts" aria-label={`${name} move classifications`}>
        {countLabel(counts.inaccuracy, 'inaccuracy', 'inaccuracies')}
        {countLabel(counts.mistake, 'mistake', 'mistakes')}
        {countLabel(counts.blunder, 'blunder', 'blunders')}
      </div>
    </div>
  );
}

function EmptyState({ status, error, onAnalyze, onRetry }) {
  if (status === 'saving') {
    return (
      <p className="coach-state-message" role="status">
        Saving the game to your library before opening its engine coaching…
      </p>
    );
  }
  if (status === 'loading') {
    return <p className="coach-state-message" role="status">Checking the engine’s notes…</p>;
  }
  if (status === 'analyzing') {
    return (
      <div className="coach-state-message" role="status">
        <span className="coach-loading-dot" aria-hidden="true" />
        Stockfish is reviewing the moves. Its tiny calculator brain is on the case…
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="coach-state-message coach-state-error" role="alert">
        <p>{error || 'Could not load this game’s analysis.'}</p>
        <button type="button" className="btn btn-secondary coach-action" onClick={onRetry}>
          Retry loading
        </button>
      </div>
    );
  }
  if (status === 'not-analyzed') {
    return (
      <div className="coach-state-message">
        <span className="coach-state-icon" aria-hidden="true">♟</span>
        <h3>No engine notes yet</h3>
        <p>Ask Stockfish to review this saved game. We’ll use that completed analysis for the coaching cards.</p>
        <button type="button" className="btn btn-primary coach-action" onClick={onAnalyze}>
          Analyze game
        </button>
      </div>
    );
  }
  if (status === 'local') {
    return (
      <div className="coach-state-message">
        <span className="coach-state-icon" aria-hidden="true">♟</span>
        <h3>Game is loaded locally</h3>
        <p>Save the game to your library first, then Stockfish can build coaching notes from its stored analysis.</p>
      </div>
    );
  }
  return (
    <div className="coach-state-message">
      <span className="coach-state-icon" aria-hidden="true">♟</span>
      <h3>Your coach is ready</h3>
      <p>Load a saved game to review the strong moves, the wobbly ones, and everything Stockfish can actually prove.</p>
    </div>
  );
}

export default function SuggestionsPanel({
  analysis = null,
  analysisStatus = 'empty',
  analysisError = '',
  currentMoveIndex = 0,
  moves = [],
  headers = {},
  onSelectMove,
  onAnalyze,
  onRetry,
}) {
  const coaching = useMemo(
    () => buildGameCoaching(analysis, moves),
    [analysis, moves],
  );
  const events = coaching.events;
  const summary = coaching.summary;
  const { selectedIndex, previousIndex, nextIndex } = getNavigationTargets(
    events,
    currentMoveIndex,
  );

  if (analysisStatus !== 'ready' || !analysis) {
    return (
      <section className="panel suggestions-panel" aria-labelledby="suggestions-panel-title">
        <div className="panel-header">
          <div className="panel-header-title-group">
            <span className="panel-icon coach-header-icon" aria-hidden="true">♟</span>
            <h2 id="suggestions-panel-title" className="panel-title">Chess Coach</h2>
          </div>
          <span className="badge badge-subtle">Stockfish</span>
        </div>
        <div className="panel-body suggestions-body">
          <EmptyState
            status={analysisStatus}
            error={analysisError}
            onAnalyze={onAnalyze}
            onRetry={onRetry}
          />
        </div>
      </section>
    );
  }

  if (!summary || summary.totalMovesAnalyzed === 0) {
    return (
      <section className="panel suggestions-panel" aria-labelledby="suggestions-panel-title">
        <div className="panel-header">
          <div className="panel-header-title-group">
            <span className="panel-icon coach-header-icon" aria-hidden="true">♟</span>
            <h2 id="suggestions-panel-title" className="panel-title">Chess Coach</h2>
          </div>
          <span className="badge badge-subtle">Depth {analysis.depth ?? '—'}</span>
        </div>
        <div className="panel-body suggestions-body">
          <div className="coach-state-message">
            <h3>No move results were returned</h3>
            <p>This completed analysis does not contain usable per-move classifications.</p>
          </div>
        </div>
      </section>
    );
  }

  const colorWithFewerSeriousMistakes = summary.fewerSeriousMistakes;
  const sideName = colorWithFewerSeriousMistakes === 'tie'
    ? 'Both sides'
    : colorWithFewerSeriousMistakes === 'white'
      ? headers.White || 'White'
      : headers.Black || 'Black';
  const currentMove = selectedIndex >= 0
    ? events[selectedIndex]
    : null;
  const selectedBoardMove = currentMoveIndex > 0
    ? moves[currentMoveIndex - 1]
    : null;
  const boardSelectionLabel = currentMoveIndex === 0
    ? 'Board: starting position'
    : `Board: ${Math.ceil(currentMoveIndex / 2)}.${selectedBoardMove?.color === 'b' ? '..' : ''} ${selectedBoardMove?.san || 'selected move'}`;

  return (
    <section className="panel suggestions-panel" aria-labelledby="suggestions-panel-title">
      <div className="panel-header">
        <div className="panel-header-title-group">
          <span className="panel-icon coach-header-icon" aria-hidden="true">♟</span>
          <h2 id="suggestions-panel-title" className="panel-title">Chess Coach</h2>
        </div>
        <span className="badge badge-subtle">
          {analysis.engineVersion || 'Stockfish'} · depth {analysis.depth ?? '—'}
        </span>
      </div>

      <div className="panel-body suggestions-body">
        <div className="coach-results">
          <div className="coach-overview">
            <p className="coach-opening-line">{summary.openingLine}</p>
            <p className="coach-compare-line">
              {sideName} made fewer serious mistakes
              {colorWithFewerSeriousMistakes === 'tie' ? '—a rare moment of mutual restraint.' : '.'}
              <span> Serious mistakes count mistakes + blunders; this is not a prediction of who won.</span>
            </p>
            <div className="coach-player-summaries">
              <PlayerCounts
                color="white"
                name={headers.White || 'White'}
                counts={summary.counts.white}
              />
              <PlayerCounts
                color="black"
                name={headers.Black || 'Black'}
                counts={summary.counts.black}
              />
            </div>
            {summary.lessons.length > 0 && (
              <div className="coach-lessons">
                <h3>Take this to your next game</h3>
                <ul>
                  {summary.lessons.map((lesson) => <li key={lesson}>{lesson}</li>)}
                </ul>
              </div>
            )}
          </div>

          <div className="coach-events-heading">
            <div>
              <h3>Move-by-move notes</h3>
              <p>{events.length} selected coaching {events.length === 1 ? 'moment' : 'moments'}</p>
              <p className="coach-board-selection" aria-live="polite">
                {boardSelectionLabel}{currentMove ? ' · coaching note selected' : ''}
              </p>
            </div>
            <div className="coach-event-navigation" aria-label="Coaching event navigation">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => onSelectMove?.(events[previousIndex]?.plyNumber)}
                disabled={previousIndex < 0}
                aria-label="Previous coaching event"
                title="Previous coaching event"
              >
                ←
              </button>
              <span aria-live="polite">
                {currentMove ? `${selectedIndex + 1}/${events.length}` : '—'}
              </span>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => onSelectMove?.(events[nextIndex]?.plyNumber)}
                disabled={nextIndex < 0}
                aria-label="Next coaching event"
                title="Next coaching event"
              >
                →
              </button>
            </div>
          </div>

          {events.length === 0 ? (
            <div className="coach-all-good">
              <span aria-hidden="true">✨</span>
              <div>
                <strong>No mistakes flagged</strong>
                <p>Every analyzed move landed in Stockfish’s best-or-acceptable category. The engine is checking its work.</p>
              </div>
            </div>
          ) : (
            <div className="coach-event-list" aria-label="Coaching events">
              {events.map((event) => {
                const active = event.plyNumber === currentMoveIndex;
                const color = event.color === 'w' ? 'White' : event.color === 'b' ? 'Black' : 'Player';
                const moveName = event.playedSan || 'Move';
                const recommendedMove = event.bestMoveSan || event.bestMove;

                return (
                  <button
                    type="button"
                    key={`${event.moveId ?? event.plyNumber}-${event.classification}`}
                    className={`coach-event-card ${CLASSIFICATION_STYLES[event.classification] || ''} ${active ? 'active' : ''}`}
                    onClick={() => onSelectMove?.(event.plyNumber)}
                    aria-pressed={active}
                    aria-label={`${color}, move ${Math.ceil(event.plyNumber / 2)}, ${event.label}: ${moveName}${active ? ', currently selected' : ', select to show on board'}`}
                  >
                    <span className="coach-event-topline">
                      <span className={`coach-event-side coach-side-${event.color || 'unknown'}`}>
                        <span className="coach-player-dot" aria-hidden="true" />
                        {color}
                      </span>
                      <span className="coach-event-move-number">
                        {Math.ceil(event.plyNumber / 2)}.{event.color === 'b' ? '..' : ''}
                      </span>
                      <span className="coach-classification">{event.label}</span>
                    </span>
                    <span className="coach-event-title">
                      <span className="coach-move-san">{moveName}</span>
                      {active && <span className="coach-current-tag">On board</span>}
                    </span>
                    <span className="coach-evaluation">{event.explanation.whatHappened}</span>
                    {recommendedMove && (
                      <span className="coach-recommendation">
                        Stockfish preferred <strong>{recommendedMove}</strong>
                      </span>
                    )}
                    <span className="coach-why">{event.explanation.whyItWasProblematic || event.explanation.betterIdea}</span>
                    {event.classification !== 'best_or_acceptable' && (
                      <span className="coach-better-idea">{event.explanation.betterIdea}</span>
                    )}
                    <span className="coach-tip"><strong>Coach’s tip:</strong> {event.explanation.coachingTip}</span>
                    <span className="coach-roast">{event.explanation.roast}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
