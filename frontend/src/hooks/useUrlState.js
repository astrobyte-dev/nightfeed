import { useEffect, useRef } from 'react';

function readParams() {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const out = {};
  for (const [k, v] of params.entries()) out[k] = v;
  return out;
}

export function getInitialUrlState() {
  return readParams();
}

export function useSyncUrlState(state) {
  const lastWritten = useRef('');

  useEffect(() => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(state)) {
      if (v === undefined || v === null || v === '' || v === false) continue;
      if (typeof v === 'number' && v === 0) continue;
      params.set(k, String(v));
    }
    const search = params.toString();
    if (search === lastWritten.current) return;
    lastWritten.current = search;
    const url = `${window.location.pathname}${search ? '?' + search : ''}${window.location.hash}`;
    window.history.replaceState(window.history.state, '', url);
  }, [state]);
}
