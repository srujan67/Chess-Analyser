const CLASSIFICATIONS = ['best_or_acceptable', 'inaccuracy', 'mistake', 'blunder'];
const ERROR_CLASSIFICATIONS = ['inaccuracy', 'mistake', 'blunder'];
const ERROR_LABELS = {
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  blunder: 'Blunder',
  best_or_acceptable: 'Solid move',
};

const COACH_OPENERS = [
  'Stockfish has reviewed the game. It brought notes.',
  'The engine has opinions. Happily, they are about the moves.',
  'Chess lesson incoming; no pieces were harmed in the review.',
];

const MOVE_HEADLINES = {
  blunder: [
    'The engine spotted a big swing',
    'A costly turn on the board',
    'That move gave the evaluation a jolt',
  ],
  mistake: [
    'Stockfish found a better route',
    'A reasonable idea, but not the strongest',
    'There was a sturdier choice',
  ],
  inaccuracy: [
    'A small opportunity left behind',
    'Close, but the engine preferred another move',
    'A little room for improvement',
  ],
  best_or_acceptable: [
    'A solid choice',
    'Nice, the engine agrees',
    'Clean work on this turn',
  ],
};

const MOVE_ROASTS = {
  blunder: [
    'The evaluation took a sudden detour. It forgot to send a postcard.',
    'That choice gave the engine something to talk about. It talks in numbers.',
    'The position changed its mood faster than a king can castle—if only it could.',
  ],
  mistake: [
    'A decent plan, just not the engine’s favourite plot twist.',
    'Stockfish has filed a polite objection.',
    'The engine found a better square for this idea. Naturally, it brought receipts.',
  ],
  inaccuracy: [
    'Not a disaster; more like leaving the good seat for the aisle.',
    'A small missed upgrade. The position noticed.',
    'The engine found a slightly shinier route. No drama required.',
  ],
  best_or_acceptable: [
    'A move the engine can live with. High praise from a calculator.',
    'Solid chess. The engine is trying not to look impressed.',
    'That held up well. The evaluation stayed on its best behaviour.',
  ],
};

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asMoveNumber(value) {
  const ply = Number(value);
  return Number.isInteger(ply) && ply > 0 ? Math.ceil(ply / 2) : null;
}

function labelForClassification(classification) {
  return ERROR_LABELS[classification] ?? 'Engine review';
}

function shortMoveName(move) {
  return move?.playedSan || 'the played move';
}

function preferredMoveName(move) {
  return move?.bestMoveSan || move?.bestMove || null;
}

function evaluationScore(value, type) {
  const number = finiteNumber(value);
  if (number === null) return null;

  if (type === 'mate') {
    if (number === 0) return 'M0';
    return `M${number > 0 ? '+' : '−'}${Math.abs(number)}`;
  }
  if (type !== 'centipawns') return null;
  const pawns = number / 100;
  const formatted = Math.abs(pawns).toFixed(2);
  return `${pawns > 0 ? '+' : pawns < 0 ? '−' : ''}${formatted}`;
}

export function formatEvaluationChange(move) {
  const before = evaluationScore(move?.evaluationBefore, move?.evaluationBeforeType);
  const after = evaluationScore(move?.evaluationAfter, move?.evaluationAfterType);
  const beforeType = move?.evaluationBeforeType;
  const afterType = move?.evaluationAfterType;

  if (
    before === null ||
    after === null ||
    beforeType !== afterType
  ) {
    return 'Evaluation details are unavailable for this move.';
  }

  if (beforeType === 'mate') {
    return `Mate evaluation: ${before} → ${after} (White’s perspective).`;
  }

  const loss = finiteNumber(move?.centipawnLoss);
  if (loss !== null) {
    if (loss === 0) {
      return `White evaluation: ${before} → ${after}; the move stayed in the engine’s acceptable band.`;
    }
    return `White evaluation: ${before} → ${after}; engine-estimated loss for the mover: ${(loss / 100).toFixed(2)} pawns.`;
  }
  return `White evaluation: ${before} → ${after}.`;
}

function explanationFor(move, eventIndex) {
  const played = shortMoveName(move);
  const preferred = preferredMoveName(move);
  const moveNo = asMoveNumber(move.plyNumber);
  const moveLabel = moveNo ? `move ${moveNo}` : 'this move';

  if (move.classification === 'best_or_acceptable') {
    return {
      headline: MOVE_HEADLINES.best_or_acceptable[eventIndex % 3],
      whatHappened: `${played} held up within Stockfish’s acceptable range on ${moveLabel}. ${formatEvaluationChange(move)}`,
      betterIdea: preferred
        ? `Stockfish’s recorded choice was ${preferred}; your move also stayed close enough to its preferred score.`
        : 'No alternative best move was recorded, but the engine classified this played move as acceptable.',
      coachingTip: 'Keep comparing candidate moves before committing; this one stayed within the engine’s acceptable band.',
      roast: MOVE_ROASTS.best_or_acceptable[eventIndex % 3],
    };
  }

  const alternative = preferred
    ? `Stockfish preferred ${preferred}. The supplied evaluation supports that alternative, but does not establish a specific tactic.`
    : 'No best move was recorded, so the engine data cannot support a concrete alternative here.';

  let why = 'The engine’s evaluation changed after the move, indicating a stronger continuation was available.';
  if (move.classification === 'blunder') {
    why = 'Stockfish classified this as a blunder, its most severe move category. The label reflects the recorded evaluation loss, not proof of a particular tactic.';
  } else if (move.classification === 'mistake') {
    why = 'Stockfish classified this as a mistake, meaning it gave up more evaluation than an inaccuracy under these heuristics.';
  } else {
    why = 'Stockfish found a better continuation, though the recorded loss is smaller than for a mistake or blunder under these heuristics.';
  }

  return {
    headline: MOVE_HEADLINES[move.classification][eventIndex % 3],
    whatHappened: `You played ${played} on ${moveLabel}. ${formatEvaluationChange(move)}`,
    whyItWasProblematic: why,
    betterIdea: alternative,
    coachingTip: 'Before moving, compare your candidate with the engine’s suggestion and check whether the resulting evaluation stays steady.',
    roast: MOVE_ROASTS[move.classification][eventIndex % 3],
  };
}

function choosePositiveMoves(bestMoves) {
  if (bestMoves.length <= 3) return bestMoves;

  const selected = [];
  const addFirstForColor = (color) => {
    const candidate = bestMoves.find((move) => move.color === color);
    if (candidate && !selected.includes(candidate)) selected.push(candidate);
  };
  addFirstForColor('w');
  addFirstForColor('b');

  const last = bestMoves.at(-1);
  if (selected.length < 3 && last && !selected.includes(last)) selected.push(last);
  if (selected.length < 3) {
    for (const move of bestMoves) {
      if (!selected.includes(move)) selected.push(move);
      if (selected.length === 3) break;
    }
  }
  return selected;
}

function buildSummaryLessons(errors, positiveMoves) {
  const lessons = [];
  const mostCostly = errors
    .filter((move) => finiteNumber(move.centipawnLoss) !== null)
    .sort((left, right) => finiteNumber(right.centipawnLoss) - finiteNumber(left.centipawnLoss))[0];

  if (mostCostly) {
    const preferred = preferredMoveName(mostCostly);
    lessons.push(
      preferred
        ? `At move ${asMoveNumber(mostCostly.plyNumber)}, compare ${shortMoveName(mostCostly)} with ${preferred}; Stockfish’s recorded evaluation favoured the alternative.`
        : `At move ${asMoveNumber(mostCostly.plyNumber)}, pause to compare candidate moves: the engine recorded the largest centipawn loss here.`,
    );
  } else if (errors.length > 0) {
    const example = errors[0];
    const hasMateScore = errors.some(
      (move) => move.evaluationBeforeType === 'mate' || move.evaluationAfterType === 'mate',
    );
    lessons.push(hasMateScore
      ? `At move ${asMoveNumber(example.plyNumber)}, Stockfish used a mate-based evaluation; mate scores are shown separately rather than treated as centipawns.`
      : `At move ${asMoveNumber(example.plyNumber)}, the engine flagged a weaker result but did not provide a usable centipawn loss; avoid guessing at a specific tactic.`,
    );
  }

  if (positiveMoves.length > 0) {
    lessons.push(
      `Keep the habit behind ${shortMoveName(positiveMoves[0])}: it was classified as best or acceptable by the engine.`,
    );
  }
  return lessons.slice(0, 2);
}

export function buildGameCoaching(analysis, playedMoves = []) {
  if (!analysis || !Array.isArray(analysis.moves)) {
    return { events: [], summary: null };
  }

  const counts = {
    white: { inaccuracy: 0, mistake: 0, blunder: 0, seriousMistakes: 0 },
    black: { inaccuracy: 0, mistake: 0, blunder: 0, seriousMistakes: 0 },
  };
  const validMoves = analysis.moves
    .filter((move) => CLASSIFICATIONS.includes(move?.classification))
    .map((move) => {
      const plyNumber = Number(move.plyNumber);
      const playedMove = Number.isInteger(plyNumber) && plyNumber > 0
        ? playedMoves[plyNumber - 1]
        : null;
      const color = playedMove?.color;
      return {
        ...move,
        plyNumber,
        color: color === 'w' || color === 'b' ? color : null,
        playedSan: move.playedSan || playedMove?.san || null,
      };
    })
    .filter((move) => Number.isInteger(move.plyNumber) && move.plyNumber > 0);

  for (const move of validMoves) {
    if (!move.color || move.classification === 'best_or_acceptable') continue;
    const playerCounts = counts[move.color === 'w' ? 'white' : 'black'];
    playerCounts[move.classification] += 1;
    if (move.classification === 'mistake' || move.classification === 'blunder') {
      playerCounts.seriousMistakes += 1;
    }
  }

  const errors = validMoves.filter((move) => ERROR_CLASSIFICATIONS.includes(move.classification));
  const positiveMoves = choosePositiveMoves(
    validMoves.filter((move) => move.classification === 'best_or_acceptable' && move.color),
  );
  const selectedMoves = [...errors, ...positiveMoves]
    .sort((left, right) => left.plyNumber - right.plyNumber);
  const events = selectedMoves.map((move, index) => ({
    ...move,
    label: labelForClassification(move.classification),
    explanation: explanationFor(move, index),
  }));
  const whiteSerious = counts.white.seriousMistakes;
  const blackSerious = counts.black.seriousMistakes;

  let fewerSeriousMistakes;
  if (whiteSerious === blackSerious) {
    fewerSeriousMistakes = 'tie';
  } else {
    fewerSeriousMistakes = whiteSerious < blackSerious ? 'white' : 'black';
  }

  return {
    events,
    summary: {
      counts,
      fewerSeriousMistakes,
      openingLine: COACH_OPENERS[(errors.length + positiveMoves.length) % COACH_OPENERS.length],
      lessons: buildSummaryLessons(errors, positiveMoves),
      totalMovesAnalyzed: validMoves.length,
    },
  };
}

export function getEvaluationDisplay(value, type) {
  const score = evaluationScore(value, type);
  if (score === null) return '—';
  return type === 'mate' ? score : `${score} pawns`;
}
