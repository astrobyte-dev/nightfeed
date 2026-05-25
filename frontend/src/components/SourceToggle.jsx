function RedditIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 5l1.5 4.5h4.5l-3.6 2.7 1.4 4.4-3.8-2.8-3.8 2.8 1.4-4.4-3.6-2.7h4.5z" fill="#fff"/>
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="23 7 16 12 23 17 23 7"/>
      <rect x="1" y="5" width="15" height="14" rx="2"/>
    </svg>
  );
}

function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
      <path d="M21.6 7.2a3 3 0 0 0-2.1-2.1C17.6 4.6 12 4.6 12 4.6s-5.6 0-7.5.5A3 3 0 0 0 2.4 7.2C2 9.1 2 12 2 12s0 2.9.4 4.8a3 3 0 0 0 2.1 2.1c1.9.5 7.5.5 7.5.5s5.6 0 7.5-.5a3 3 0 0 0 2.1-2.1c.4-1.9.4-4.8.4-4.8s0-2.9-.4-4.8z"/>
      <polygon points="10,15.5 16,12 10,8.5" fill="#fff"/>
    </svg>
  );
}

function CoomerIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  );
}

const SOURCES = [
  { value: 'reddit', label: 'Reddit', Icon: RedditIcon },
  { value: 'eporner', label: 'Eporner', Icon: VideoIcon },
  { value: 'coomer', label: 'Coomer', Icon: CoomerIcon },
  { value: 'youtube', label: 'YouTube', Icon: YouTubeIcon }
];

export default function SourceToggle({ value, onChange }) {
  return (
    <div className="source-toggle" role="tablist" aria-label="Content source">
      {SOURCES.map(({ value: v, label, Icon }) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={value === v}
          className={`source-pill ${value === v ? 'active' : ''}`}
          onClick={() => onChange(v)}
          title={`Browse ${label}`}
        >
          <Icon />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
