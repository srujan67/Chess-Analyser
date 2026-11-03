import { describe, expect, it } from 'vitest';
import {
  buildGameCoaching,
  formatEvaluationChange,
  getEvaluationDisplay,
} from './coachingService';

function analysisMove({
  plyNumber,
  classification,
  playedSan,
  bestMove = 'g1f3',
  bestMoveSan = 'Nf3',
  evaluationBefore = 30,
  evaluationAfter = -50,
  evaluationBeforeType = 'centipawns',
  evaluationAfterType = 'centipawns',
  centipawnLoss = 80,
} = {}) {
  return {
    moveId: plyNumber,
    plyNumber,
    classification,
    playedSan,
    bestMove,
    bestMoveSan,
    evaluationBefore,
    evaluationAfter,
    evaluationBeforeType,
    evaluationAfterType,
    centipawnLoss,
    principalVariation: [],
  };
}

describe('buildGameCoaching', () => {
  it('summarizes each side and creates grounded cards for errors and positive moves', () => {
    const analysis = {
      moves: [
        analysisMove({
          plyNumber: 1,
          classification: 'blunder',
          playedSan: 'e4',
          bestMoveSan: 'd4',
          centipawnLoss: 250,
        }),
        analysisMove({
          plyNumber: 2,
          classification: 'mistake',
          playedSan: 'e5',
          bestMoveSan: 'c5',
          centipawnLoss: 150,
        }),
        analysisMove({
          plyNumber: 3,
          classification: 'inaccuracy',
          playedSan: 'Qh5',
          centipawnLoss: 50,
        }),
        analysisMove({
          plyNumber: 4,
          classification: 'best_or_acceptable',
          playedSan: 'Nc6',
          centipawnLoss: 0,
        }),
      ],
    };
    const moves = [
      { color: 'w', san: 'e4' },
      { color: 'b', san: 'e5' },
      { color: 'w', san: 'Qh5' },
      { color: 'b', san: 'Nc6' },
    ];

    const result = buildGameCoaching(analysis, moves);

    expect(result.summary.counts.white).toMatchObject({
      blunder: 1,
      mistake: 0,
      inaccuracy: 1,
      seriousMistakes: 1,
    });
    expect(result.summary.counts.black).toMatchObject({
      mistake: 1,
      blunder: 0,
      inaccuracy: 0,
      seriousMistakes: 1,
    });
    expect(result.summary.fewerSeriousMistakes).toBe('tie');
    expect(result.events.map((event) => event.plyNumber)).toEqual([1, 2, 3, 4]);
    expect(result.events[0].explanation.whatHappened).toContain('e4');
    expect(result.events[0].explanation.betterIdea).toContain('d4');
    expect(result.events[0].explanation.whatHappened).toContain('2.50 pawns');
    expect(result.events[3].label).toBe('Solid move');
    expect(result.events[0].explanation.betterIdea).not.toMatch(/hung|checkmate|fork|pin/i);
    expect(result.summary.lessons.length).toBeLessThanOrEqual(2);
  });

  it('selects representative good moves for a game with mostly acceptable play', () => {
    const moves = Array.from({ length: 10 }, (_, index) => ({
      color: index % 2 === 0 ? 'w' : 'b',
      san: index % 2 === 0 ? 'Nf3' : 'Nf6',
    }));
    const analysis = {
      moves: moves.map((move, index) => analysisMove({
        plyNumber: index + 1,
        classification: 'best_or_acceptable',
        playedSan: move.san,
        centipawnLoss: 0,
      })),
    };

    const result = buildGameCoaching(analysis, moves);

    expect(result.summary.counts.white).toMatchObject({
      inaccuracy: 0,
      mistake: 0,
      blunder: 0,
    });
    expect(result.summary.counts.black).toMatchObject({
      inaccuracy: 0,
      mistake: 0,
      blunder: 0,
    });
    expect(result.events.length).toBe(3);
    expect(new Set(result.events.map((event) => event.color))).toEqual(new Set(['w', 'b']));
    expect(result.summary.fewerSeriousMistakes).toBe('tie');
  });

  it('does not make tactical claims when best moves or evaluations are absent', () => {
    const result = buildGameCoaching(
      {
        moves: [
          analysisMove({
            plyNumber: 1,
            classification: 'blunder',
            playedSan: 'Ra3',
            bestMoveSan: null,
            bestMove: null,
            evaluationBefore: null,
            evaluationAfter: null,
            centipawnLoss: null,
          }),
        ],
      },
      [{ color: 'w', san: 'Ra3' }],
    );

    expect(result.events[0].explanation.whatHappened).toContain(
      'Evaluation details are unavailable',
    );
    expect(result.events[0].explanation.betterIdea).toContain(
      'No best move was recorded',
    );
    expect(result.summary.lessons[0]).toContain('did not provide a usable centipawn loss');
  });

  it('keeps mate scores distinct from centipawn evaluations', () => {
    const move = analysisMove({
      plyNumber: 2,
      classification: 'mistake',
      evaluationBefore: 3,
      evaluationAfter: -2,
      evaluationBeforeType: 'mate',
      evaluationAfterType: 'mate',
      centipawnLoss: null,
    });

    expect(formatEvaluationChange(move)).toContain('Mate evaluation: M+3 → M−2');
    expect(getEvaluationDisplay(-2, 'mate')).toBe('M−2');
    expect(getEvaluationDisplay(85, 'centipawns')).toBe('+0.85 pawns');
  });

  it('handles an analysis with no usable per-move data', () => {
    expect(buildGameCoaching({ moves: [] }, [])).toEqual({
      events: [],
      summary: {
        counts: {
          white: { inaccuracy: 0, mistake: 0, blunder: 0, seriousMistakes: 0 },
          black: { inaccuracy: 0, mistake: 0, blunder: 0, seriousMistakes: 0 },
        },
        fewerSeriousMistakes: 'tie',
        openingLine: expect.any(String),
        lessons: [],
        totalMovesAnalyzed: 0,
      },
    });
  });
});
