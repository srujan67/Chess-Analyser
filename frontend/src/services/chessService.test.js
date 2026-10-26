import { describe, it, expect } from 'vitest';
import {
  parsePgn,
  getNavigationIndex,
  DEFAULT_STARTING_FEN,
  SAMPLE_PGN,
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

  it('should reject invalid or illegal moves in PGN', () => {
    const invalidPgn = '1. e5 e4'; // e5 is illegal for white on move 1
    const result = parsePgn(invalidPgn);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Invalid PGN/i);
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
