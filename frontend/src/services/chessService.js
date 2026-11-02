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

export const CHESS_COM_SAMPLE_PGN = `[Site "Chess.com"]
[Date "2026-10-25"]
[White "SrujanMS"]
[Black "FAHMI161"]
[Result "1-0"]
[WhiteElo "702"]
[BlackElo "689"]
[TimeControl "600"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 h6 4. c3 Nf6 5. Qe2 d5 6. exd5 Nxd5 7. Nxe5 Nxe5 8. Qxe5+ Be6 9. O-O Bd6 10. Qxg7 Kd7 11. d4 Qg8 12. Bxh6 Nxc3 13. Bxe6+ Kxe6 14. Re1+ Kd7 15. Nxc3 Qxg7 16. Bxg7 Rxh2 17. Bf6 Rh6 18. Bg5 Rh5 19. f4 f6 20. g4 Rhh8 21. Bxf6 Bxf4 22. Bxh8 Rxh8 23. Rf1 Bh2+ 24. Kg2 Kd6 25. Ne4+ 1-0`;

/**
 * Normalizes and sanitizes PGN text across different operating systems,
 * messaging apps (such as WhatsApp), and clipboard paste sources:
 * - Strips Byte Order Mark (BOM) and invisible zero-width/directional characters.
 * - Converts non-breaking spaces (\u00A0) and other Unicode whitespace to standard ASCII space.
 * - Converts Windows CRLF and legacy CR line endings to standard \n.
 * - Converts smart double quotes to standard ASCII double quotes (").
 * - Converts smart single quotes/apostrophes to standard ASCII single quotes (').
 * - Converts smart dashes (en-dash, em-dash, minus) to standard ASCII hyphens (-).
 * - Ensures separation between header tag pairs and movetext.
 *
 * @param {string} pgnString
 * @returns {string}
 */
export function cleanPgn(pgnString) {
  if (!pgnString || typeof pgnString !== 'string') return '';

  return (
    pgnString
      // Strip BOM and other invisible formatting characters that often appear in copied PGNs
      .replace(/[\u00AD\u061C\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, '')
      // Convert all Unicode whitespace (NBSP, narrow NBSP, em/en spaces, etc.) to standard spaces
      .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
      // Normalize line breaks to \n
      .replace(/\r\n|\r|\u2028|\u2029/g, '\n')
      // Normalize smart/curly double quotes
      .replace(/[\u201C\u201D\u00AB\u00BB\u201E\u201F]/g, '"')
      // Normalize smart/curly single quotes
      .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
      // Normalize Unicode dashes and hyphen-like punctuation to a standard ASCII hyphen
      .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, '-')
      // Ensure separation between header tags and movetext if not present
      .replace(/(\]\s*)\n(?=[0-9]+\.)/g, '$1\n\n')
      .trim()
  );
}

/**
 * Formats chess parser errors into human-readable, actionable messages
 * that indicate the specific offending move or token.
 *
 * @param {Error} err
 * @param {string} sourceText
 * @returns {string}
 */
function formatPgnError(err, sourceText) {
  if (!err) return 'Invalid PGN: Unable to parse game.';
  const msg = err.message || '';

  // 1. Illegal or unrecognised move caught by chess.js move validator
  if (msg.startsWith('Invalid move in PGN:')) {
    const offendingMove = msg.replace('Invalid move in PGN:', '').trim();
    return `Invalid PGN: Illegal or unrecognised move "${offendingMove}".`;
  }

  // 2. Syntax errors from Peggy grammar parser with line and offset coordinates
  if (err.location && err.location.start) {
    const { line, column, offset } = err.location.start;
    if (typeof offset === 'number' && typeof sourceText === 'string') {
      const slice = sourceText.slice(offset, offset + 25);
      const match = slice.match(/^([^\s\][(){}]+)/);
      if (match && match[1]) {
        return `Invalid PGN: Syntax error near "${match[1]}" (line ${line}, column ${column}).`;
      }
    }
    return `Invalid PGN: Syntax error at line ${line}, column ${column}.`;
  }

  return `Invalid PGN: ${msg}`;
}

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

  const cleaned = cleanPgn(pgnString);
  if (!cleaned) {
    return {
      success: false,
      error: 'PGN content is empty after stripping invisible formatting characters.',
    };
  }

  const chess = new Chess();

  try {
    chess.loadPgn(cleaned, { strict: false });
  } catch (err) {
    return {
      success: false,
      error: formatPgnError(err, cleaned),
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
