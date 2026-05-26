import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useMode } from '@/hooks/useMode';

const MODE_KEY = 'nightfeed:mode';

function reset() {
  localStorage.clear();
  window.history.replaceState(null, '', '/');
}

describe('useMode', () => {
  beforeEach(reset);

  it('initial state from URL: ?mode=feed lands in feed mode', () => {
    window.history.replaceState(null, '', '/?mode=feed');
    const { result } = renderHook(() => useMode());
    expect(result.current.mode).toBe('feed');
  });

  it('initial state from localStorage when URL is silent', () => {
    localStorage.setItem(MODE_KEY, 'feed');
    const { result } = renderHook(() => useMode());
    expect(result.current.mode).toBe('feed');
  });

  it('defaults to grid when neither URL nor localStorage is set', () => {
    const { result } = renderHook(() => useMode());
    expect(result.current.mode).toBe('grid');
  });

  it('URL takes precedence over localStorage on init', () => {
    localStorage.setItem(MODE_KEY, 'feed');
    window.history.replaceState(null, '', '/?mode=grid');
    const { result } = renderHook(() => useMode());
    expect(result.current.mode).toBe('grid');
  });

  it('setMode persists to both URL and localStorage', () => {
    const { result } = renderHook(() => useMode());

    act(() => result.current.setMode('feed'));
    expect(result.current.mode).toBe('feed');
    expect(new URLSearchParams(window.location.search).get('mode')).toBe(
      'feed'
    );
    expect(localStorage.getItem(MODE_KEY)).toBe('feed');

    act(() => result.current.setMode('grid'));
    expect(result.current.mode).toBe('grid');
    expect(new URLSearchParams(window.location.search).get('mode')).toBeNull();
    expect(localStorage.getItem(MODE_KEY)).toBe('grid');
  });
});
