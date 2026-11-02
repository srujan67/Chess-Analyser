import { Chess } from 'chess.js';

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
 * Validates and parses raw PGN text into structured game data and individual moves.
 *
 * @param {string} pgnString - The raw PGN string to validate and parse
 * @returns {{
 *   success: boolean,
 *   error?: string,
 *   data?: {
 *     whitePlayer: string | null,
 *     blackPlayer: string | null,
 *     result: string,
 *     pgn: string,
 *     moves: Array<{
 *       plyNumber: number,
 *       san: string,
 *       fenAfter: string
 *     }>
 *   }
 * }}
 */
export function parseAndValidatePgn(pgnString) {
  if (!pgnString || typeof pgnString !== 'string' || !pgnString.trim()) {
    return {
      success: false,
      error: 'PGN is required and must be a non-empty string.',
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

  const whitePlayer =
    headers.White && headers.White !== '?'
      ? headers.White.slice(0, 100)
      : null;

  const blackPlayer =
    headers.Black && headers.Black !== '?'
      ? headers.Black.slice(0, 100)
      : null;

  const result =
    headers.Result && headers.Result !== '*'
      ? headers.Result.slice(0, 7)
      : '*';

  const moves = historyVerbose.map((move, index) => ({
    plyNumber: index + 1,
    san: move.san.slice(0, 20),
    fenAfter: move.after.slice(0, 150),
  }));

  return {
    success: true,
    data: {
      whitePlayer,
      blackPlayer,
      result,
      pgn: cleaned,
      moves,
    },
  };
}
