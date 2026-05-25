import { useMemo } from 'react';
import ScrollRow from './ScrollRow';

const AVATAR_COLORS = ['#e57373','#f06292','#ba68c8','#9575cd','#7986cb','#64b5f6','#4fc3f7','#4dd0e1','#4db6ac','#81c784','#aed581','#dce775','#fff176','#ffd54f','#ffb74d','#ff8a65'];

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function CreatorAvatarRow({ items, onSelectAuthor }) {
  const authors = useMemo(() => {
    const seen = new Set();
    const result = [];
    for (const item of items) {
      const name = item.author;
      if (!name || name === '[deleted]' || seen.has(name)) continue;
      seen.add(name);
      result.push(name);
      if (result.length >= 20) break;
    }
    return result;
  }, [items]);

  if (authors.length === 0) return null;

  return (
    <ScrollRow className="avatar-scroll-row">
      <div className="avatar-row">
        {authors.map((name) => {
          const color = AVATAR_COLORS[hashCode(name) % AVATAR_COLORS.length];
          const initial = name[0]?.toUpperCase() || '?';
          return (
            <button
              key={name}
              type="button"
              className="avatar-item"
              onClick={() => onSelectAuthor(name)}
              title={`u/${name}`}
            >
              <span className="avatar-circle" style={{ backgroundColor: color }}>{initial}</span>
              <span className="avatar-label">{name}</span>
            </button>
          );
        })}
      </div>
    </ScrollRow>
  );
}

export default CreatorAvatarRow;
