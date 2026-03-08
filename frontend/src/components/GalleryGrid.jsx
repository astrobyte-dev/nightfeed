import GalleryCard from './GalleryCard';

function GalleryGrid({ items, onOpen }) {
  if (!items.length) {
    return null;
  }

  return (
    <section className="gallery-grid">
      {items.map((post) => (
        <GalleryCard key={post.id} post={post} onOpen={onOpen} />
      ))}
    </section>
  );
}

export default GalleryGrid;