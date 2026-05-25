import { useEffect, useRef, useState } from 'react';

function MoreIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.8"/>
      <circle cx="12" cy="12" r="1.8"/>
      <circle cx="19" cy="12" r="1.8"/>
    </svg>
  );
}

export default function CardMenu({ items, label = 'More actions' }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onDoc(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    }
    function onKey(e) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const visible = items.filter(Boolean);
  if (visible.length === 0) return null;

  return (
    <div ref={wrapRef} className="card-menu">
      <button
        type="button"
        className="card-menu-trigger"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
      >
        <MoreIcon />
      </button>
      {open && (
        <div className="card-menu-popover" role="menu" onClick={(e) => e.stopPropagation()}>
          {visible.map((item, i) => (
            <button
              key={i}
              type="button"
              role="menuitem"
              className={`card-menu-item ${item.danger ? 'danger' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                item.onSelect?.();
              }}
            >
              {item.icon && <span className="card-menu-item-icon">{item.icon}</span>}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
