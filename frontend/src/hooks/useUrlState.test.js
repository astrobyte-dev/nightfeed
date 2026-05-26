import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSyncUrlState } from '@/hooks/useUrlState';

function setUrl(search) {
  const qs = search ? `?${search}` : '';
  window.history.replaceState(null, '', `/${qs}`);
}

describe('useSyncUrlState', () => {
  beforeEach(() => {
    setUrl('');
  });

  it('writes managed state keys to the URL', () => {
    renderHook(() => useSyncUrlState({ r: 'nsfw', sort: 'hot' }));
    const params = new URLSearchParams(window.location.search);
    expect(params.get('r')).toBe('nsfw');
    expect(params.get('sort')).toBe('hot');
  });

  it('does not write skipped values (empty string, null, undefined, false, zero)', () => {
    renderHook(() =>
      useSyncUrlState({
        r: 'nsfw',
        empty: '',
        nullish: null,
        undef: undefined,
        falsy: false,
        zero: 0
      })
    );
    const params = new URLSearchParams(window.location.search);
    expect(params.get('r')).toBe('nsfw');
    expect(params.has('empty')).toBe(false);
    expect(params.has('nullish')).toBe(false);
    expect(params.has('undef')).toBe(false);
    expect(params.has('falsy')).toBe(false);
    expect(params.has('zero')).toBe(false);
  });

  it('preserves pre-existing unknown params on write (regression for issue 011)', () => {
    setUrl('mode=feed');
    renderHook(() => useSyncUrlState({ r: 'nsfw' }));
    const params = new URLSearchParams(window.location.search);
    expect(params.get('mode')).toBe('feed');
    expect(params.get('r')).toBe('nsfw');
  });

  it('removes managed keys with skipped values from the URL if previously present', () => {
    setUrl('r=nsfw&sort=hot');
    renderHook(() => useSyncUrlState({ r: 'nsfw', sort: '' }));
    const params = new URLSearchParams(window.location.search);
    expect(params.get('r')).toBe('nsfw');
    expect(params.has('sort')).toBe(false);
  });
});
