import { Chess } from 'chess.js';

export const DEFAULT_STARTING_FEN =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const SAMPLE_PGN = `[Event "Paris"]
[Site "Paris FRA"]
[Date "1858.??.??"]
[Round "?"]
[White "Paul Morphy"]
[Black "Duke Karl / Count Isouard"]
[Result "1-0"]
[ECO "C41"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0`;

/**
 * Validates and parses a raw PGN string into structured moves, FEN positions, and headers.
 * 
 * @param {string} pgnString - Raw PGN text to parse
 * @returns {{
 *   success: boolean,
 *   error?: string,
 *   moves?: Array<{
 *     index: number,
 *     san: string,
 *     from: string,
 *     to: string,
 *     color: string,
 *     piece: string,
 *     captured: string | null,
 *     beforeFen: string,
 *     afterFen: string
 *   }>,
 *   positions?: string[],
 *   headers?: Record<string, string>,
 *   totalMoves?: number
 * }}
 */
export function parsePgn(pgnString) {
  if (!pgnString || typeof pgnString !== 'string' || !pgnString.trim()) {
    return {
      success: false,
      error: 'PGN content is empty. Please enter or upload valid PGN text.',
    };
  }

  const chess = new Chess();

  try {
    chess.loadPgn(pgnString, { strict: false });
  } catch (err) {
    return {
      success: false,
      error: `Invalid PGN: ${err.message || 'Unable to parse chess notation or illegal move encountered.'}`,
    };
  }

  const historyVerbose = chess.history({ verbose: true });

  if (historyVerbose.length === 0) {
    return {
      success: false,
      error: 'No valid moves found in the provided PGN.',
    };
  }

  const headers = chess.header();

  // positions[0] = initial board position, positions[i] = board after move i
  const positions = [DEFAULT_STARTING_FEN];
  const moves = historyVerbose.map((move, index) => {
    positions.push(move.after);
    return {
      index: index + 1,
      san: move.san,
      from: move.from,
      to: move.to,
      color: move.color,
      piece: move.piece,
      captured: move.captured || null,
      beforeFen: move.before,
      afterFen: move.after,
    };
  });

  return {
    success: true,
    moves,
    positions,
    headers,
    totalMoves: moves.length,
  };
}

/**
 * Calculates the target move index for board navigation actions.
 * 
 * @param {'start' | 'prev' | 'next' | 'end'} action
 * @param {number} currentIndex
 * @param {number} totalMoves
 * @returns {number}
 */
export function getNavigationIndex(action, currentIndex, totalMoves) {
  if (!totalMoves || totalMoves <= 0) return 0;

  switch (action) {
    case 'start':
    case 'first':
      return 0;
    case 'prev':
      return Math.max(0, currentIndex - 1);
    case 'next':
      return Math.min(totalMoves, currentIndex + 1);
    case 'end':
    case 'last':
      return totalMoves;
    default:
      return Math.max(0, Math.min(totalMoves, currentIndex));
  }
}
