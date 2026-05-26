import FeedItem from './FeedItem';
import '../styles/feed.css';

function FeedMode({ items }) {
  return (
    <div className="feed-mode" role="region" aria-label="Feed mode">
      {items.map((item) => (
        <FeedItem key={item.id} item={item} />
      ))}
    </div>
  );
}

export default FeedMode;
