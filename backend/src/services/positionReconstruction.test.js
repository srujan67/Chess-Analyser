import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { describe, it } from 'node:test';
import {
  GameHistoryMismatchError,
  reconstructGamePositions,
} from './positionReconstruction.js';

function savedGame(pgn) {
  const chess = new Chess();
  chess.loadPgn(pgn, { strict: false });
  return {
    pgn,
    moves: chess.history({ verbose: true }).map((move, index) => ({
      id: index + 10,
      plyNumber: index + 1,
      san: move.san,
      fenAfter: move.after,
    })),
  };
}

describe('reconstructGamePositions', () => {
  it('reconstructs initial and subsequent positions and UCI moves', () => {
    const game = savedGame('1. e4 e5 2. Nf3 *');
    const reconstructed = reconstructGamePositions(game);

    assert.equal(reconstructed.moves.length, 3);
    assert.equal(reconstructed.initialFen, reconstructed.moves[0].fenBefore);
    assert.deepEqual(
      reconstructed.moves.map(({ san, uci, sideToMove, moveId }) => ({
        san,
        uci,
        sideToMove,
        moveId,
      })),
      [
        { san: 'e4', uci: 'e2e4', sideToMove: 'w', moveId: 10 },
        { san: 'e5', uci: 'e7e5', sideToMove: 'b', moveId: 11 },
        { san: 'Nf3', uci: 'g1f3', sideToMove: 'w', moveId: 12 },
      ],
    );
  });

  it('uses the PGN FEN header as the initial custom position', () => {
    const pgn = [
      '[Event "Custom start"]',
      '[SetUp "1"]',
      '[FEN "4k3/8/8/8/8/8/4K3/6R1 w - - 0 1"]',
      '',
      '1. Rh1 Kf7 *',
    ].join('\n');
    const reconstructed = reconstructGamePositions(savedGame(pgn));
    assert.equal(
      reconstructed.initialFen,
      '4k3/8/8/8/8/8/4K3/6R1 w - - 0 1',
    );
    assert.deepEqual(
      reconstructed.moves.map(({ san, uci }) => [san, uci]),
      [['Rh1', 'g1h1'], ['Kf7', 'e8f7']],
    );
  });

  it('rejects PGN and stored move history that disagree', () => {
    const game = savedGame('1. e4 e5 *');
    game.moves[1].fenAfter = game.moves[0].fenAfter;
    assert.throws(
      () => reconstructGamePositions(game),
      GameHistoryMismatchError,
    );
  });
});
