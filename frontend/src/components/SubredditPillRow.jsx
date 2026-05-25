import { useMemo, useState } from 'react';
import { NSFW_DIRECTORY, NSFW_TOP_PICKS } from '../utils/nsfwDirectory';

const COLLAPSED_LIMIT = 14;

function SubredditPillRow({ activeSubreddit, onSelectSubreddit, hiddenSubreddits }) {
  const [expanded, setExpanded] = useState(false);

  const pills = useMemo(() => {
    const hidden = new Set((hiddenSubreddits || []).map((s) => s.toLowerCase()));
    const topSet = new Set(NSFW_TOP_PICKS);
    const all = new Set();

    const result = NSFW_TOP_PICKS.filter((name) => !hidden.has(name.toLowerCase()));

    for (const section of NSFW_DIRECTORY) {
      for (const name of section.items) {
        if (!topSet.has(name) && !hidden.has(name.toLowerCase()) && !all.has(name)) {
          result.push(name);
          all.add(name);
        }
      }
    }

    return result;
  }, [hiddenSubreddits]);

  const visible = expanded ? pills : pills.slice(0, COLLAPSED_LIMIT);
  const canExpand = pills.length > COLLAPSED_LIMIT;

  return (
    <div className="pill-row">
      {visible.map((name) => (
        <button
          key={name}
          type="button"
          className={`subreddit-pill ${activeSubreddit?.toLowerCase() === name.toLowerCase() ? 'active' : ''}`}
          onClick={() => onSelectSubreddit(name)}
        >
          r/{name}
        </button>
      ))}
      {canExpand && (
        <button
          type="button"
          className="subreddit-pill subreddit-pill-toggle"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Show less' : `+${pills.length - COLLAPSED_LIMIT} more`}
        </button>
      )}
    </div>
  );
}

export default SubredditPillRow;
