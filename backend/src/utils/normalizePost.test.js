import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeLimit, sanitizeSort } from './normalizePost.js';

describe('sanitizeLimit', () => {
  it('returns the default (25) for non-numeric input', () => {
    assert.equal(sanitizeLimit(undefined), 25);
    assert.equal(sanitizeLimit('abc'), 25);
  });

  it('clamps values above 100 down to 100', () => {
    assert.equal(sanitizeLimit(500), 100);
    assert.equal(sanitizeLimit('250'), 100);
  });

  it('clamps non-positive values up to 1', () => {
    assert.equal(sanitizeLimit(0), 1);
    assert.equal(sanitizeLimit(-10), 1);
  });

  it('passes through valid limits, parsing numeric strings', () => {
    assert.equal(sanitizeLimit(42), 42);
    assert.equal(sanitizeLimit('7'), 7);
  });
});

describe('sanitizeSort', () => {
  it('returns "hot" for unknown or missing sort values', () => {
    assert.equal(sanitizeSort('foo'), 'hot');
    assert.equal(sanitizeSort(undefined), 'hot');
    assert.equal(sanitizeSort(null), 'hot');
  });

  it('passes through allowed sorts (hot, new, top)', () => {
    assert.equal(sanitizeSort('hot'), 'hot');
    assert.equal(sanitizeSort('new'), 'new');
    assert.equal(sanitizeSort('top'), 'top');
  });
});
