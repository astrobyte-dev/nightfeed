function SimpcityThreadList({ items, activeThreadId, onOpenThread }) {
  if (!items.length) return null;

  return (
    <section className="simpcity-thread-list">
      {items.map((thread) => (
        <article
          key={thread.id}
          className={`simpcity-thread-card ${activeThreadId === thread.id ? 'active' : ''}`}
          onClick={() => onOpenThread(thread)}
        >
          <div className="simpcity-thread-copy">
            <p className="simpcity-thread-kicker">{thread.category || 'SimpCity'} / {thread.section || 'Thread'}</p>
            <h3>{thread.title}</h3>
            <p className="simpcity-thread-meta">Creator: {thread.creator || thread.author || 'simpcity'}</p>
            <p className="simpcity-thread-meta">Posted by {thread.threadAuthor || 'simpcity'} - {thread.mediaCount || 0} media - {thread.replyCount || 0} replies</p>
          </div>
          {thread.coverImageUrl ? (
            <img src={thread.coverImageUrl} alt={thread.title} loading="lazy" className="simpcity-thread-thumb" />
          ) : (
            <div className="simpcity-thread-thumb simpcity-thread-thumb-fallback">No cover</div>
          )}
        </article>
      ))}
    </section>
  );
}

export default SimpcityThreadList;
