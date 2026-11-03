/**
 * Initial heuristic thresholds only; these are not official Chess.com labels.
 * Centipawn loss is clamped at zero, so improvements classify as acceptable.
 */
export const MOVE_CLASSIFICATION_THRESHOLDS = Object.freeze({
  bestOrAcceptableMaxCp: 30,
  inaccuracyMaxCp: 100,
  mistakeMaxCp: 200,
});

function scoreFromWhitePerspective(evaluation, sideToMove) {
  if (!evaluation?.score || !['w', 'b'].includes(sideToMove)) {
    throw new TypeError('An evaluation and valid side-to-move are required.');
  }

  return {
    ...evaluation,
    score: {
      ...evaluation.score,
      value: sideToMove === 'w'
        ? evaluation.score.value
        : -evaluation.score.value,
    },
  };
}

export function normalizeEvaluationToWhite(evaluation, sideToMove) {
  return scoreFromWhitePerspective(evaluation, sideToMove);
}

function scoreFromMoverPerspective(evaluation, sideToMove, moverColor) {
  const whitePerspective = scoreFromWhitePerspective(evaluation, sideToMove);
  return {
    ...whitePerspective,
    score: {
      ...whitePerspective.score,
      value: moverColor === 'w'
        ? whitePerspective.score.value
        : -whitePerspective.score.value,
    },
  };
}

export function calculateCentipawnLoss(evaluationBefore, evaluationAfter, moverColor) {
  if (
    evaluationBefore?.score?.type !== 'centipawns' ||
    evaluationAfter?.score?.type !== 'centipawns'
  ) {
    return null;
  }

  const opponentColor = moverColor === 'w' ? 'b' : 'w';
  const beforeForMover = scoreFromMoverPerspective(
    evaluationBefore,
    moverColor,
    moverColor,
  ).score.value;
  const afterForMover = scoreFromMoverPerspective(
    evaluationAfter,
    opponentColor,
    moverColor,
  ).score.value;
  return Math.max(0, beforeForMover - afterForMover);
}

function hasMatingOutcomeForMover(evaluation, sideToMove, moverColor) {
  if (evaluation?.score?.type !== 'mate') return null;
  const value = scoreFromMoverPerspective(
    evaluation,
    sideToMove,
    moverColor,
  ).score.value;
  if (value === 0) return sideToMove === moverColor ? 'mated' : 'winning';
  return value > 0 ? 'winning' : 'losing';
}

export function classifyMove({
  evaluationBefore,
  evaluationAfter,
  moverColor,
  thresholds = MOVE_CLASSIFICATION_THRESHOLDS,
  centipawnLoss = calculateCentipawnLoss(
    evaluationBefore,
    evaluationAfter,
    moverColor,
  ),
}) {
  if (centipawnLoss !== null) {
    if (centipawnLoss <= thresholds.bestOrAcceptableMaxCp) {
      return 'best_or_acceptable';
    }
    if (centipawnLoss <= thresholds.inaccuracyMaxCp) {
      return 'inaccuracy';
    }
    if (centipawnLoss <= thresholds.mistakeMaxCp) {
      return 'mistake';
    }
    return 'blunder';
  }

  const opponentColor = moverColor === 'w' ? 'b' : 'w';
  const beforeMate = hasMatingOutcomeForMover(
    evaluationBefore,
    moverColor,
    moverColor,
  );
  const afterMate = hasMatingOutcomeForMover(
    evaluationAfter,
    opponentColor,
    moverColor,
  );
  if (
    afterMate === 'losing' &&
    beforeMate !== 'losing'
  ) {
    return 'blunder';
  }
  if (beforeMate === 'winning' && afterMate !== 'winning') {
    return 'blunder';
  }
  return 'best_or_acceptable';
}

export function evaluatePlayedMove({
  evaluationBefore,
  evaluationAfter,
  moverColor,
  thresholds = MOVE_CLASSIFICATION_THRESHOLDS,
}) {
  const centipawnLoss = calculateCentipawnLoss(
    evaluationBefore,
    evaluationAfter,
    moverColor,
  );
  return {
    evaluationBeforeWhite: normalizeEvaluationToWhite(evaluationBefore, moverColor),
    evaluationAfterWhite: normalizeEvaluationToWhite(
      evaluationAfter,
      moverColor === 'w' ? 'b' : 'w',
    ),
    centipawnLoss,
    classification: classifyMove({
      evaluationBefore,
      evaluationAfter,
      moverColor,
      thresholds,
      centipawnLoss,
    }),
  };
}
