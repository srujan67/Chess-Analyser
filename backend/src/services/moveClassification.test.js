import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  calculateCentipawnLoss,
  classifyMove,
  evaluatePlayedMove,
  MOVE_CLASSIFICATION_THRESHOLDS,
  normalizeEvaluationToWhite,
} from './moveClassification.js';

const score = (type, value) => ({ score: { type, value } });

describe('move classification and evaluation perspective', () => {
  it('normalizes positive and negative evaluations for White and Black', () => {
    assert.equal(
      normalizeEvaluationToWhite(score('centipawns', 45), 'w').score.value,
      45,
    );
    assert.equal(
      normalizeEvaluationToWhite(score('centipawns', 45), 'b').score.value,
      -45,
    );
    assert.equal(
      normalizeEvaluationToWhite(score('centipawns', -60), 'b').score.value,
      60,
    );
  });

  it('calculates loss from White mover perspective across a side-to-move change', () => {
    assert.equal(
      calculateCentipawnLoss(
        score('centipawns', 120),
        score('centipawns', -45),
        'w',
      ),
      75,
    );
  });

  it('calculates loss from Black mover perspective across a side-to-move change', () => {
    assert.equal(
      calculateCentipawnLoss(
        score('centipawns', 90),
        score('centipawns', -25),
        'b',
      ),
      65,
    );
  });

  it('keeps negative improvement from becoming negative centipawn loss', () => {
    assert.equal(
      calculateCentipawnLoss(
        score('centipawns', -40),
        score('centipawns', 25),
        'w',
      ),
      0,
    );
  });

  it('does not convert mate scores to centipawns and classifies forced-mate changes', () => {
    const before = score('mate', 3);
    const after = score('mate', 2);
    assert.equal(calculateCentipawnLoss(before, after, 'w'), null);
    assert.equal(classifyMove({
      evaluationBefore: before,
      evaluationAfter: after,
      moverColor: 'w',
    }), 'blunder');
  });

  it('classifies centipawn loss against documented heuristic thresholds', () => {
    assert.deepEqual(MOVE_CLASSIFICATION_THRESHOLDS, {
      bestOrAcceptableMaxCp: 30,
      inaccuracyMaxCp: 100,
      mistakeMaxCp: 200,
    });
    const before = score('centipawns', 0);
    const classifyLoss = (centipawnLoss) => classifyMove({
      evaluationBefore: before,
      evaluationAfter: before,
      moverColor: 'w',
      centipawnLoss,
    });
    assert.equal(classifyLoss(30), 'best_or_acceptable');
    assert.equal(classifyLoss(31), 'inaccuracy');
    assert.equal(classifyLoss(100), 'inaccuracy');
    assert.equal(classifyLoss(101), 'mistake');
    assert.equal(classifyLoss(200), 'mistake');
    assert.equal(classifyLoss(201), 'blunder');
  });

  it('returns normalized evaluations and loss together for a played move', () => {
    const result = evaluatePlayedMove({
      evaluationBefore: score('centipawns', 80),
      evaluationAfter: score('centipawns', -20),
      moverColor: 'w',
    });
    assert.equal(result.evaluationBeforeWhite.score.value, 80);
    assert.equal(result.evaluationAfterWhite.score.value, 20);
    assert.equal(result.centipawnLoss, 60);
    assert.equal(result.classification, 'inaccuracy');
  });
});
