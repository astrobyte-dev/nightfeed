export function formatScore(score) {
  return new Intl.NumberFormat().format(score || 0);
}

export function formatPostDate(createdUtc) {
  if (!createdUtc) return 'Unknown date';
  return new Date(createdUtc * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}