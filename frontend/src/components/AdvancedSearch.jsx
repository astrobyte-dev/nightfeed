import { useEffect, useRef, useState } from 'react';
import TagChipInput from './TagChipInput';
import { useFocusTrap } from '../hooks/useFocusTrap';

const DURATION_PRESETS = [
  { label: 'Any', min: null, max: null },
  { label: '<15s', min: null, max: 15 },
  { label: '15s–1m', min: 15, max: 60 },
  { label: '1–5m', min: 60, max: 300 },
  { label: '5–15m', min: 300, max: 900 },
  { label: '>15m', min: 900, max: null }
];

export const DEFAULT_ADVANCED = {
  include: [],
  exclude: [],
  performers: [],
  durationMin: null,
  durationMax: null,
  minScore: 0,
  aspectRatio: 'any',
  hasAudio: 'any',
  dateRange: 'any',
  mediaType: 'any',
  quality: 'any'
};

export const QUALITY_THRESHOLDS = {
  sd: { min: 0, max: 719 },
  hd: { min: 720, max: 1079 },
  fullhd: { min: 1080, max: 2159 },
  '4k': { min: 2160, max: Infinity }
};

export function countActiveFilters(adv) {
  let n = 0;
  if (adv.include?.length) n += adv.include.length;
  if (adv.exclude?.length) n += adv.exclude.length;
  if (adv.performers?.length) n += adv.performers.length;
  if (adv.durationMin != null || adv.durationMax != null) n += 1;
  if (adv.minScore > 0) n += 1;
  if (adv.aspectRatio && adv.aspectRatio !== 'any') n += 1;
  if (adv.hasAudio && adv.hasAudio !== 'any') n += 1;
  if (adv.dateRange && adv.dateRange !== 'any') n += 1;
  if (adv.mediaType && adv.mediaType !== 'any') n += 1;
  if (adv.quality && adv.quality !== 'any') n += 1;
  return n;
}

export default function AdvancedSearch({ open, onClose, source, value, onApply, onReset }) {
  const [draft, setDraft] = useState(value || DEFAULT_ADVANCED);
  const modalRef = useRef(null);
  useFocusTrap(modalRef, open);

  useEffect(() => {
    if (open) setDraft(value || DEFAULT_ADVANCED);
  }, [open, value]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) { if (e.key === 'Escape') onClose?.(); }
    window.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  function update(patch) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  function applyDurationPreset(min, max) {
    update({ durationMin: min, durationMax: max });
  }

  function handleApply() {
    onApply?.(draft);
    onClose?.();
  }

  function handleReset() {
    setDraft(DEFAULT_ADVANCED);
    onReset?.();
  }

  const isEporner = source === 'eporner';

  return (
    <div className="adv-backdrop" onMouseDown={onClose}>
      <div
        ref={modalRef}
        className="adv-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="adv-title"
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="adv-head">
          <div>
            <h2 id="adv-title">Advanced search</h2>
            <p className="adv-sub">Searching {isEporner ? 'Eporner' : 'Reddit'}</p>
          </div>
          <button type="button" className="adv-close" onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </header>

        <div className="adv-body">
          <div className="adv-section">
            <label className="adv-label">Must include
              <span className="adv-hint">All of these terms must match</span>
            </label>
            <TagChipInput
              value={draft.include}
              onChange={(v) => update({ include: v })}
              placeholder="e.g. blonde, pov, lingerie — press enter"
              ariaLabel="Required keywords"
            />
          </div>

          <div className="adv-section">
            <label className="adv-label">Must exclude
              <span className="adv-hint">Hide results containing any of these</span>
            </label>
            <TagChipInput
              value={draft.exclude}
              onChange={(v) => update({ exclude: v })}
              placeholder="e.g. compilation, anime"
              ariaLabel="Excluded keywords"
            />
          </div>

          {isEporner && (
            <div className="adv-section">
              <label className="adv-label">Performers / stars
                <span className="adv-hint">Names get folded into the query</span>
              </label>
              <TagChipInput
                value={draft.performers}
                onChange={(v) => update({ performers: v })}
                placeholder="e.g. mia khalifa, riley reid"
                ariaLabel="Performers"
              />
            </div>
          )}

          <div className="adv-grid">
            <div className="adv-section">
              <label className="adv-label">Duration</label>
              <div className="adv-pill-group">
                {DURATION_PRESETS.map((p) => {
                  const active = draft.durationMin === p.min && draft.durationMax === p.max;
                  return (
                    <button key={p.label} type="button" className={`adv-pill ${active ? 'active' : ''}`} onClick={() => applyDurationPreset(p.min, p.max)}>
                      {p.label}
                    </button>
                  );
                })}
              </div>
              <div className="adv-range">
                <input
                  type="number"
                  className="adv-input adv-range-input"
                  placeholder="min sec"
                  min="0"
                  value={draft.durationMin ?? ''}
                  onChange={(e) => update({ durationMin: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) })}
                />
                <span className="adv-range-sep">–</span>
                <input
                  type="number"
                  className="adv-input adv-range-input"
                  placeholder="max sec"
                  min="0"
                  value={draft.durationMax ?? ''}
                  onChange={(e) => update({ durationMax: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) })}
                />
              </div>
            </div>

            <div className="adv-section">
              <label className="adv-label">Aspect ratio</label>
              <div className="adv-pill-group">
                {[
                  { v: 'any', l: 'Any' },
                  { v: 'portrait', l: 'Portrait' },
                  { v: 'landscape', l: 'Landscape' },
                  { v: 'square', l: 'Square' }
                ].map((o) => (
                  <button key={o.v} type="button" className={`adv-pill ${draft.aspectRatio === o.v ? 'active' : ''}`} onClick={() => update({ aspectRatio: o.v })}>
                    {o.l}
                  </button>
                ))}
              </div>
            </div>

            <div className="adv-section">
              <label className="adv-label">Media type</label>
              <div className="adv-pill-group">
                {[
                  { v: 'any', l: 'Any' },
                  { v: 'videos', l: 'Videos' },
                  { v: 'images', l: 'Images' },
                  { v: 'audio', l: 'Audio' }
                ].map((o) => (
                  <button key={o.v} type="button" className={`adv-pill ${draft.mediaType === o.v ? 'active' : ''}`} onClick={() => update({ mediaType: o.v })}>
                    {o.l}
                  </button>
                ))}
              </div>
            </div>

            {!isEporner && (
              <div className="adv-section">
                <label className="adv-label">Date range</label>
                <div className="adv-pill-group">
                  {[
                    { v: 'any', l: 'Any time' },
                    { v: 'hour', l: 'Past hour' },
                    { v: 'day', l: 'Today' },
                    { v: 'week', l: 'Week' },
                    { v: 'month', l: 'Month' },
                    { v: 'year', l: 'Year' }
                  ].map((o) => (
                    <button key={o.v} type="button" className={`adv-pill ${draft.dateRange === o.v ? 'active' : ''}`} onClick={() => update({ dateRange: o.v })}>
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="adv-section">
              <label className="adv-label">{isEporner ? 'Min rating' : 'Min score'}</label>
              <div className="adv-pill-group">
                {(isEporner ? [0, 50, 60, 70, 80, 90] : [0, 25, 100, 250, 500, 1000, 2500]).map((s) => (
                  <button key={s} type="button" className={`adv-pill ${draft.minScore === s ? 'active' : ''}`} onClick={() => update({ minScore: s })}>
                    {s === 0 ? 'Any' : (isEporner ? `${s}%+` : `${s}+`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="adv-section">
              <label className="adv-label">Audio</label>
              <div className="adv-pill-group">
                {[
                  { v: 'any', l: 'Any' },
                  { v: 'yes', l: 'Has audio' },
                  { v: 'no', l: 'Silent' }
                ].map((o) => (
                  <button key={o.v} type="button" className={`adv-pill ${draft.hasAudio === o.v ? 'active' : ''}`} onClick={() => update({ hasAudio: o.v })}>
                    {o.l}
                  </button>
                ))}
              </div>
            </div>

            <div className="adv-section">
              <label className="adv-label">Quality
                <span className="adv-hint">Based on video height</span>
              </label>
              <div className="adv-pill-group">
                {[
                  { v: 'any', l: 'Any' },
                  { v: 'sd', l: 'SD' },
                  { v: 'hd', l: 'HD 720p+' },
                  { v: 'fullhd', l: 'Full HD 1080p+' },
                  { v: '4k', l: '4K' }
                ].map((o) => (
                  <button key={o.v} type="button" className={`adv-pill ${draft.quality === o.v ? 'active' : ''}`} onClick={() => update({ quality: o.v })}>
                    {o.l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <footer className="adv-foot">
          <button type="button" className="adv-text-btn" onClick={handleReset}>Reset all</button>
          <div className="adv-foot-actions">
            <button type="button" className="adv-btn" onClick={onClose}>Cancel</button>
            <button type="button" className="adv-btn primary" onClick={handleApply}>
              Apply{countActiveFilters(draft) > 0 ? ` (${countActiveFilters(draft)})` : ''}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
