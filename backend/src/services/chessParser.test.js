import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseAndValidatePgn } from './chessParser.js';
import { saveGameToDatabase } from './gameService.js';

const CHESS_COM_PGN = `[Site "Chess.com"]
[Date "2026-10-25"]
[White "SrujanMS"]
[Black "FAHMI161"]
[Result "1-0"]
[WhiteElo "702"]
[BlackElo "689"]
[TimeControl "600"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 h6 4. c3 Nf6 5. Qe2 d5 6. exd5 Nxd5 7. Nxe5 Nxe5 8. Qxe5+ Be6 9. O-O Bd6 10. Qxg7 Kd7 11. d4 Qg8 12. Bxh6 Nxc3 13. Bxe6+ Kxe6 14. Re1+ Kd7 15. Nxc3 Qxg7 16. Bxg7 Rxh2 17. Bf6 Rh6 18. Bg5 Rh5 19. f4 f6 20. g4 Rhh8 21. Bxf6 Bxf4 22. Bxh8 Rxh8 23. Rf1 Bh2+ 24. Kg2 Kd6 25. Ne4+ 1-0`;

describe('chessParser - parseAndValidatePgn', () => {
  test('should parse a valid PGN with headers and moves', () => {
    const pgn = `[Event "World Championship"]
[White "Carlsen, Magnus"]
[Black "Nepomniachtchi, Ian"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 1-0`;

    const result = parseAndValidatePgn(pgn);
    assert.equal(result.success, true);
    assert.equal(result.data.whitePlayer, 'Carlsen, Magnus');
    assert.equal(result.data.blackPlayer, 'Nepomniachtchi, Ian');
    assert.equal(result.data.result, '1-0');
    assert.equal(result.data.moves.length, 8);
    assert.equal(result.data.moves[0].plyNumber, 1);
    assert.equal(result.data.moves[0].san, 'e4');
    assert.ok(result.data.moves[0].fenAfter.includes('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR'));
    assert.equal(result.data.moves[7].plyNumber, 8);
    assert.equal(result.data.moves[7].san, 'Nf6');
  });

  test('should parse the exact Chess.com exported game', () => {
    const result = parseAndValidatePgn(CHESS_COM_PGN);
    assert.equal(result.success, true);
    assert.equal(result.data.whitePlayer, 'SrujanMS');
    assert.equal(result.data.blackPlayer, 'FAHMI161');
    assert.equal(result.data.result, '1-0');
    assert.equal(result.data.moves.length, 49);
    assert.equal(result.data.moves[0].san, 'e4');
    assert.equal(result.data.moves[48].san, 'Ne4+');
  });

  test('should parse Chess.com game containing WhatsApp non-breaking spaces and zero-width spaces', () => {
    const whatsappPgn = CHESS_COM_PGN
      .replace('1. e4', '1.\u00A0e4')
      .replace('2. Nf3', '2. \u200BNf3')
      .replace('1-0', '1\u20130');

    const result = parseAndValidatePgn(whatsappPgn);
    assert.equal(result.success, true);
    assert.equal(result.data.moves.length, 49);
    assert.equal(result.data.result, '1-0');
  });

  test('should parse a valid PGN without headers', () => {
    const pgn = '1. d4 d5 2. c4 e6';
    const result = parseAndValidatePgn(pgn);

    assert.equal(result.success, true);
    assert.equal(result.data.whitePlayer, null);
    assert.equal(result.data.blackPlayer, null);
    assert.equal(result.data.result, '*');
    assert.equal(result.data.moves.length, 4);
    assert.equal(result.data.moves[0].san, 'd4');
  });

  test('should reject missing or empty PGN input', () => {
    const emptyResult = parseAndValidatePgn('');
    assert.equal(emptyResult.success, false);
    assert.match(emptyResult.error, /PGN is required/i);

    const whitespaceResult = parseAndValidatePgn('   \n  \t ');
    assert.equal(whitespaceResult.success, false);
    assert.match(whitespaceResult.error, /PGN is required/i);

    const nullResult = parseAndValidatePgn(null);
    assert.equal(nullResult.success, false);
    assert.match(nullResult.error, /PGN is required/i);
  });

  test('should reject invalid chess moves in PGN with clear offending move details', () => {
    const invalidResult = parseAndValidatePgn('1. e5 e4'); // e5 is illegal on move 1 for White
    assert.equal(invalidResult.success, false);
    assert.match(invalidResult.error, /Invalid PGN/i);
    assert.match(invalidResult.error, /e5/);
  });

  test('should reject PGN with headers but no moves', () => {
    const headerOnly = `[Event "Casual"]
[White "Alice"]
[Black "Bob"]
[Result "*"]`;

    const noMovesResult = parseAndValidatePgn(headerOnly);
    assert.equal(noMovesResult.success, false);
    assert.match(noMovesResult.error, /No valid moves found/i);
  });

  test('should reject malformed game data before attempting a database write', async () => {
    await assert.rejects(
      () => saveGameToDatabase({}),
      /valid PGN string|Game data is required|At least one valid move/i,
    );

    await assert.rejects(
      () => saveGameToDatabase({ pgn: '1. e4 e5', moves: [] }),
      /At least one valid move/i,
    );
  });
});
