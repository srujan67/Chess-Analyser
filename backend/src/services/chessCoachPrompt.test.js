import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildCoachInput,
  COACH_FIELD_LIMITS,
  COACH_PERSONALITY_INSTRUCTIONS,
  COACH_RESPONSE_SCHEMA,
  validateCoachResponse,
} from './chessCoachPrompt.js';

const validResponse = () => Object.fromEntries(
  Object.keys(COACH_FIELD_LIMITS).map((field) => [field, `A short ${field}.`]),
);

describe('chess coach prompt and response validation', () => {
  it('builds a compact, allowlisted prompt and limits the principal variation', () => {
    const input = buildCoachInput({
      playerColor: 'White',
      moveNumber: 3,
      playedSan: 'Nf3',
      positionBeforeFen: 'fen-before',
      bestMoveUci: 'd2d4',
      bestMoveSan: 'd4',
      evaluationBefore: { value: 30, type: 'centipawns' },
      evaluationAfter: { value: -45, type: 'centipawns' },
      centipawnLoss: 75,
      classification: 'mistake',
      principalVariation: Array.from({ length: 10 }, (_, index) => `uci${index}`),
      pgn: 'must not be included',
      fullGame: ['must not be included'],
    });
    const parsedEvidence = JSON.parse(input.split('\n\n').at(-1));

    assert.match(COACH_PERSONALITY_INSTRUCTIONS, /Stockfish facts.*authoritative/i);
    assert.equal(COACH_RESPONSE_SCHEMA.type, 'object');
    assert.equal(parsedEvidence.principalVariation.length, 8);
    assert.equal('pgn' in parsedEvidence, false);
    assert.equal('fullGame' in parsedEvidence, false);
  });

  it('accepts the complete response shape and trims whitespace', () => {
    const response = validateCoachResponse({
      ...validResponse(),
      headline: '  A better square  ',
    });
    assert.equal(response.headline, 'A better square');
    assert.equal(Object.keys(response).length, 6);
  });

  it('rejects missing, non-string, empty, and over-limit fields', () => {
    assert.throws(() => validateCoachResponse(null), TypeError);
    assert.throws(() => validateCoachResponse({}), TypeError);
    assert.throws(() => validateCoachResponse({
      ...validResponse(),
      roast: '',
    }), /roast/);
    assert.throws(() => validateCoachResponse({
      ...validResponse(),
      headline: 'x'.repeat(COACH_FIELD_LIMITS.headline + 1),
    }), /headline/);
  });
});
