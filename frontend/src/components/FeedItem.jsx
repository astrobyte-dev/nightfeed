import VideoPlayer from './VideoPlayer';
import { getModalItems } from '../utils/media';

function FeedItem({ item }) {
  const modalItems = getModalItems(item);
  const first = modalItems[0];
  if (!first) return null;

  if (first.kind === 'video') {
    return (
      <div className="feed-item">
        <VideoPlayer
          mp4Url={first.url}
          hlsUrl={first.hlsUrl}
          dashUrl={first.dashUrl}
          hasAudio={first.hasAudio}
          sourceKind={first.sourceKind}
          posterUrl={item?.thumbnail || ''}
          className="feed-item__video"
        />
      </div>
    );
  }

  if (first.kind === 'image') {
    return (
      <div className="feed-item">
        <img src={first.url} alt="" className="feed-item__media" />
      </div>
    );
  }

  if (first.kind === 'audio' || first.kind === 'embed') {
    return null;
  }

  if (first.url) {
    return (
      <div className="feed-item">
        <img src={first.url} alt="" className="feed-item__media" />
      </div>
    );
  }

  return null;
}

export default FeedItem;
