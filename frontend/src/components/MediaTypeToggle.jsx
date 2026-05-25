function VideoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="23 7 16 12 23 17 23 7"/>
      <rect x="1" y="5" width="15" height="14" rx="2"/>
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>
  );
}

function AudioIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 10v4M7 6v12M11 8v8M15 4v16M19 9v6"/>
    </svg>
  );
}

function AllIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="8" y1="6" x2="21" y2="6"/>
      <line x1="8" y1="12" x2="21" y2="12"/>
      <line x1="8" y1="18" x2="21" y2="18"/>
      <line x1="3" y1="6" x2="3.01" y2="6"/>
      <line x1="3" y1="12" x2="3.01" y2="12"/>
      <line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
  );
}

const OPTIONS = [
  { value: 'videos', label: 'Videos', Icon: VideoIcon },
  { value: 'images', label: 'Images', Icon: ImageIcon },
  { value: 'audio', label: 'Audio', Icon: AudioIcon },
  { value: 'all', label: 'All', Icon: AllIcon }
];

function MediaTypeToggle({ value, onChange, counts }) {
  return (
    <div className="media-type-toggle" role="tablist" aria-label="Media type">
      {OPTIONS.map(({ value: v, label, Icon }) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={value === v}
          className={`media-type-pill ${value === v ? 'active' : ''}`}
          onClick={() => onChange(v)}
        >
          <Icon />
          <span>{label}</span>
          {counts && typeof counts[v] === 'number' && (
            <span className="media-type-count">{counts[v]}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export default MediaTypeToggle;
