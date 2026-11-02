import { describe, it, expect } from 'vitest';
import {
  parsePgn,
  getNavigationIndex,
  DEFAULT_STARTING_FEN,
  SAMPLE_PGN,
  CHESS_COM_SAMPLE_PGN,
} from './chessService';

describe('chessService - parsePgn', () => {
  it('should parse a valid genuine sample game with full history and positions', () => {
    const result = parsePgn(SAMPLE_PGN);

    expect(result.success).toBe(true);
    expect(result.moves).toBeDefined();
    expect(result.moves.length).toBe(33); // 33 half-moves in the Opera game
    expect(result.totalMoves).toBe(33);

    // Initial position + 33 moves = 34 positions
    expect(result.positions).toHaveLength(34);
    expect(result.positions[0]).toBe(DEFAULT_STARTING_FEN);

    // Check first move
    expect(result.moves[0].san).toBe('e4');
    expect(result.moves[0].from).toBe('e2');
    expect(result.moves[0].to).toBe('e4');
    expect(result.moves[0].color).toBe('w');

    // Check final move (Rd8#)
    const finalMove = result.moves[32];
    expect(finalMove.san).toBe('Rd8#');
    expect(finalMove.from).toBe('d1');
    expect(finalMove.to).toBe('d8');

    // Check headers
    expect(result.headers?.White).toBe('Paul Morphy');
    expect(result.headers?.Black).toBe('Duke Karl / Count Isouard');
    expect(result.headers?.Result).toBe('1-0');
  });

  it('should parse the exact Chess.com exported game', () => {
    const result = parsePgn(CHESS_COM_SAMPLE_PGN);

    expect(result.success).toBe(true);
    expect(result.totalMoves).toBe(49);
    expect(result.moves).toHaveLength(49);
    expect(result.positions).toHaveLength(50);

    // Verify headers
    expect(result.headers?.White).toBe('SrujanMS');
    expect(result.headers?.Black).toBe('FAHMI161');
    expect(result.headers?.Result).toBe('1-0');
    expect(result.headers?.WhiteElo).toBe('702');
    expect(result.headers?.BlackElo).toBe('689');

    // Verify first and last move
    expect(result.moves[0].san).toBe('e4');
    expect(result.moves[48].san).toBe('Ne4+');
  });

  it('should parse Chess.com game containing WhatsApp non-breaking spaces (\u00A0)', () => {
    // WhatsApp commonly converts spaces after move numbers into non-breaking spaces
    const pgnWithNbsp = CHESS_COM_SAMPLE_PGN.replace(/1\. e4/g, '1.\u00A0e4')
      .replace(/2\. Nf3/g, '2.\u00A0Nf3');

    const result = parsePgn(pgnWithNbsp);
    expect(result.success).toBe(true);
    expect(result.totalMoves).toBe(49);
    expect(result.moves[0].san).toBe('e4');
  });

  it('should parse Chess.com game containing zero-width spaces (\u200B) and directional marks (\u200E)', () => {
    const pgnWithZws = CHESS_COM_SAMPLE_PGN.replace('1. e4', '1. \u200Be4')
      .replace('2. Nf3', '\u200E2. Nf3\u200B');

    const result = parsePgn(pgnWithZws);
    expect(result.success).toBe(true);
    expect(result.totalMoves).toBe(49);
  });

  it('should parse games with smart quotes and en-dashes', () => {
    const smartPgn = `[Site “Chess.com”]
[Result “1–0”]

1. e4 e5 1–0`;

    const result = parsePgn(smartPgn);
    expect(result.success).toBe(true);
    expect(result.totalMoves).toBe(2);
    expect(result.headers?.Result).toBe('1-0');
  });

  it('should parse games with Windows CRLF and missing blank lines between tags and moves', () => {
    const crlfPgn = '[Event "Test"]\r\n[Site "Chess.com"]\r\n[Result "1-0"]\r\n1. e4 e5 1-0';
    const result = parsePgn(crlfPgn);
    expect(result.success).toBe(true);
    expect(result.totalMoves).toBe(2);
  });

  it('should parse a simple Scholar\'s Mate PGN', () => {
    const pgn = '1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0';
    const result = parsePgn(pgn);

    expect(result.success).toBe(true);
    expect(result.moves).toHaveLength(7);
    expect(result.moves[6].san).toBe('Qxf7#');
    expect(result.positions).toHaveLength(8);
  });

  it('should reject empty or whitespace-only PGN', () => {
    expect(parsePgn('').success).toBe(false);
    expect(parsePgn('   \n  \t ').success).toBe(false);
    expect(parsePgn(null).success).toBe(false);
    expect(parsePgn('').error).toContain('empty');
  });

  it('should reject invalid or illegal moves in PGN with clear offending move info', () => {
    const invalidPgn = '1. e5 e4'; // e5 is illegal for white on move 1
    const result = parsePgn(invalidPgn);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Invalid PGN/i);
    expect(result.error).toContain('e5');
  });

  it('should report the offending illegal move in a long game', () => {
    // Introduce an illegal move into the Chess.com game at move 25
    const corruptedPgn = CHESS_COM_SAMPLE_PGN.replace('25. Ne4+', '25. Ne5+');
    const result = parsePgn(corruptedPgn);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Ne5+');
  });

  it('should reject garbage text that contains no legal chess game', () => {
    const garbage = 'this is completely random text not a chess game';
    const result = parsePgn(garbage);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should return an error when PGN has headers but no moves', () => {
    const headerOnly = '[Event "Casual"]\n[White "Alice"]\n[Black "Bob"]\n';
    const result = parsePgn(headerOnly);

    expect(result.success).toBe(false);
    expect(result.error).toContain('No valid moves found');
  });
});

describe('chessService - getNavigationIndex', () => {
  const totalMoves = 10;

  it('should navigate to the start (move 0)', () => {
    expect(getNavigationIndex('start', 5, totalMoves)).toBe(0);
    expect(getNavigationIndex('first', 5, totalMoves)).toBe(0);
  });

  it('should navigate to the previous move and clamp at 0', () => {
    expect(getNavigationIndex('prev', 5, totalMoves)).toBe(4);
    expect(getNavigationIndex('prev', 1, totalMoves)).toBe(0);
    expect(getNavigationIndex('prev', 0, totalMoves)).toBe(0);
  });

  it('should navigate to the next move and clamp at totalMoves', () => {
    expect(getNavigationIndex('next', 5, totalMoves)).toBe(6);
    expect(getNavigationIndex('next', 9, totalMoves)).toBe(10);
    expect(getNavigationIndex('next', 10, totalMoves)).toBe(10);
  });

  it('should navigate to the end (totalMoves)', () => {
    expect(getNavigationIndex('end', 3, totalMoves)).toBe(10);
    expect(getNavigationIndex('last', 3, totalMoves)).toBe(10);
  });

  it('should safely return 0 when game has 0 moves', () => {
    expect(getNavigationIndex('next', 0, 0)).toBe(0);
    expect(getNavigationIndex('prev', 0, 0)).toBe(0);
    expect(getNavigationIndex('end', 0, 0)).toBe(0);
  });
});
