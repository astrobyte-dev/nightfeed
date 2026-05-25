import { DEFAULT_ADVANCED } from './AdvancedSearch';

function FilterChip({ label, value, onClear }) {
  return (
    <span className="active-filter-chip">
      <span className="active-filter-label">{label}:</span>
      <span className="active-filter-value">{value}</span>
      <button type="button" className="active-filter-clear" onClick={onClear} aria-label={`Clear ${label}`}>×</button>
    </span>
  );
}

function formatDuration(min, max) {
  const fmt = (s) => {
    if (s == null) return null;
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.round(s / 60)}m`;
    return `${(s / 3600).toFixed(1)}h`;
  };
  if (min != null && max != null) return `${fmt(min)}–${fmt(max)}`;
  if (min != null) return `>${fmt(min)}`;
  if (max != null) return `<${fmt(max)}`;
  return null;
}

export default function ActiveFiltersStrip({ adv, onChange, onOpenAdvanced, onClearAll }) {
  if (!adv) return null;

  const chips = [];

  adv.include?.forEach((tag, i) => {
    chips.push({ key: `inc-${i}`, label: 'Include', value: tag, onClear: () => onChange({ ...adv, include: adv.include.filter((_, idx) => idx !== i) }) });
  });
  adv.exclude?.forEach((tag, i) => {
    chips.push({ key: `exc-${i}`, label: 'Exclude', value: `-${tag}`, onClear: () => onChange({ ...adv, exclude: adv.exclude.filter((_, idx) => idx !== i) }) });
  });
  adv.performers?.forEach((tag, i) => {
    chips.push({ key: `perf-${i}`, label: 'Star', value: tag, onClear: () => onChange({ ...adv, performers: adv.performers.filter((_, idx) => idx !== i) }) });
  });

  const dur = formatDuration(adv.durationMin, adv.durationMax);
  if (dur) chips.push({ key: 'dur', label: 'Duration', value: dur, onClear: () => onChange({ ...adv, durationMin: null, durationMax: null }) });

  if (adv.aspectRatio && adv.aspectRatio !== 'any') chips.push({ key: 'ar', label: 'Aspect', value: adv.aspectRatio, onClear: () => onChange({ ...adv, aspectRatio: 'any' }) });
  if (adv.mediaType && adv.mediaType !== 'any') chips.push({ key: 'mt', label: 'Type', value: adv.mediaType, onClear: () => onChange({ ...adv, mediaType: 'any' }) });
  if (adv.dateRange && adv.dateRange !== 'any') chips.push({ key: 'dr', label: 'Date', value: adv.dateRange, onClear: () => onChange({ ...adv, dateRange: 'any' }) });
  if (adv.hasAudio && adv.hasAudio !== 'any') chips.push({ key: 'ha', label: 'Audio', value: adv.hasAudio, onClear: () => onChange({ ...adv, hasAudio: 'any' }) });
  if (adv.minScore > 0) chips.push({ key: 'ms', label: 'Min', value: String(adv.minScore), onClear: () => onChange({ ...adv, minScore: 0 }) });
  if (adv.quality && adv.quality !== 'any') {
    const qLabel = adv.quality === 'sd' ? 'SD' : adv.quality === 'hd' ? 'HD' : adv.quality === 'fullhd' ? 'Full HD' : adv.quality === '4k' ? '4K' : adv.quality;
    chips.push({ key: 'q', label: 'Quality', value: qLabel, onClear: () => onChange({ ...adv, quality: 'any' }) });
  }

  if (chips.length === 0) return null;

  return (
    <div className="active-filters">
      <button type="button" className="active-filters-edit" onClick={onOpenAdvanced} title="Edit filters">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
        </svg>
        Filters · {chips.length}
      </button>
      <div className="active-filters-list">
        {chips.map((c) => <FilterChip key={c.key} {...c} />)}
      </div>
      <button type="button" className="active-filters-clear" onClick={onClearAll}>Clear all</button>
    </div>
  );
}
