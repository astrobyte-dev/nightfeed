import { useState } from 'react';
import { useRelatedSubreddits } from '../hooks/useRelatedSubreddits';

const COLLAPSED_LIMIT = 8;

function formatSubs(n) {
  if (!n) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

function StarIcon({ filled }) {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  );
}

export default function RelatedSubsRow({ subreddit, onPickSubreddit, onToggleSave, isSaved, hiddenSet }) {
  const { items, loading } = useRelatedSubreddits(subreddit);
  const [expanded, setExpanded] = useState(false);

  if (!subreddit || subreddit.includes('+')) return null;
  const visibleAll = items.filter((s) => !hiddenSet?.has(s.name.toLowerCase()));
  if (visibleAll.length === 0 && !loading) return null;

  const visible = expanded ? visibleAll : visibleAll.slice(0, COLLAPSED_LIMIT);
  const canExpand = visibleAll.length > COLLAPSED_LIMIT;

  return (
    <div className="related-subs">
      <div className="related-subs-header">
        <span className="related-subs-title">Related to r/{subreddit}</span>
        {loading && <span className="related-subs-loading">finding…</span>}
      </div>
      <div className="related-subs-list">
        {visible.map((sub) => {
          const subs = formatSubs(sub.subscribers);
          return (
            <div key={sub.name} className="related-sub-card">
              <button
                type="button"
                className="related-sub-main"
                onClick={() => onPickSubreddit?.(sub.name)}
                title={sub.title || sub.description || `r/${sub.name}`}
              >
                <span className="related-sub-name">r/{sub.name}</span>
                <span className="related-sub-meta">
                  {subs && <span className="related-sub-subs">{subs}</span>}
                  {sub.title && <span className="related-sub-title">{sub.title}</span>}
                </span>
              </button>
              {onToggleSave && (
                <button
                  type="button"
                  className={`related-sub-save ${isSaved?.(sub.name) ? 'active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); onToggleSave(sub); }}
                  aria-pressed={isSaved?.(sub.name) ? 'true' : 'false'}
                  aria-label={isSaved?.(sub.name) ? 'Remove from saved' : 'Save'}
                  title={isSaved?.(sub.name) ? 'Saved' : 'Save'}
                >
                  <StarIcon filled={isSaved?.(sub.name)} />
                </button>
              )}
            </div>
          );
        })}
        {canExpand && (
          <button
            type="button"
            className="related-subs-toggle"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? 'Show less' : `+${visibleAll.length - COLLAPSED_LIMIT} more`}
          </button>
        )}
      </div>
    </div>
  );
}
