import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isValidGameId } from './game.routes.js';

describe('game routes - game ID validation', () => {
  it('accepts positive decimal IDs up to the MySQL unsigned BIGINT maximum', () => {
    assert.equal(isValidGameId('1'), true);
    assert.equal(isValidGameId('18446744073709551615'), true);
  });

  it('rejects invalid, non-positive, and out-of-range IDs', () => {
    for (const id of ['', '0', '-1', '1.5', 'abc', '18446744073709551616']) {
      assert.equal(isValidGameId(id), false, `Expected ${id} to be invalid`);
    }
  });
});
