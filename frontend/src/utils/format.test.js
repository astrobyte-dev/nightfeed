import { describe, it, expect } from 'vitest';
import { formatDuration } from '@/utils/format';

describe('formatDuration', () => {
  it('formats whole minutes with zero-padded seconds', () => {
    expect(formatDuration(75)).toBe('1:15');
  });

  it('zero-pads single-digit seconds', () => {
    expect(formatDuration(5)).toBe('0:05');
  });

  it('floors fractional seconds', () => {
    expect(formatDuration(125.9)).toBe('2:05');
  });

  it('returns null for non-positive or non-finite input', () => {
    expect(formatDuration(0)).toBeNull();
    expect(formatDuration(-3)).toBeNull();
    expect(formatDuration(Infinity)).toBeNull();
  });
});
