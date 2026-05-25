import { useEffect, useRef, useState } from 'react';

let activeId = null;
const listeners = new Set();

function setActive(id) {
  if (activeId === id) return;
  activeId = id;
  for (const fn of listeners) fn(activeId);
}

export function useHoverPreview() {
  const idRef = useRef(Symbol('hover-preview'));
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    function listener(current) {
      setIsActive(current === idRef.current);
    }
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      if (activeId === idRef.current) setActive(null);
    };
  }, []);

  function activate() { setActive(idRef.current); }
  function deactivate() { if (activeId === idRef.current) setActive(null); }

  return { isActive, activate, deactivate };
}
