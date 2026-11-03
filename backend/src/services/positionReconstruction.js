import { Chess } from 'chess.js';
import { cleanPgn } from './chessParser.js';

export class GameHistoryMismatchError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GameHistoryMismatchError';
  }
}

function canonicalFen(fen) {
  try {
    return new Chess(fen).fen();
  } catch {
    throw new GameHistoryMismatchError('A stored move contains an invalid FEN.');
  }
}

export function reconstructGamePositions(game) {
  if (!game || typeof game.pgn !== 'string' || !Array.isArray(game.moves)) {
    throw new GameHistoryMismatchError('Saved game data is incomplete.');
  }

  const chess = new Chess();
  try {
    chess.loadPgn(cleanPgn(game.pgn), { strict: false });
  } catch {
    throw new GameHistoryMismatchError('The saved PGN could not be reconstructed.');
  }

  const history = chess.history({ verbose: true });
  if (history.length !== game.moves.length) {
    throw new GameHistoryMismatchError(
      'The saved PGN and stored move history have different lengths.',
    );
  }

  const moves = history.map((move, index) => {
    const storedMove = game.moves[index];
    const plyNumber = index + 1;
    if (
      Number(storedMove.plyNumber) !== plyNumber ||
      storedMove.san !== move.san ||
      canonicalFen(storedMove.fenAfter) !== move.after
    ) {
      throw new GameHistoryMismatchError(
        `The saved PGN does not match stored move ${plyNumber}.`,
      );
    }

    return {
      moveId: storedMove.id,
      plyNumber,
      fenBefore: move.before,
      fenAfter: move.after,
      san: move.san,
      uci: `${move.from}${move.to}${move.promotion || ''}`,
      sideToMove: move.color,
    };
  });

  return {
    initialFen: moves[0]?.fenBefore ?? chess.fen(),
    moves,
  };
}
