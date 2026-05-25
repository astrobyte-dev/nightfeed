function ErrorIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function EmptyIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function StateMessage({ variant = 'empty', title, message, primaryLabel, onPrimary, secondaryLabel, onSecondary }) {
  return (
    <div className={`state-panel state-panel-${variant}`} role={variant === 'error' ? 'alert' : 'status'}>
      <div className="state-panel-icon">
        {variant === 'error' ? <ErrorIcon /> : <EmptyIcon />}
      </div>
      {title && <h3 className="state-panel-title">{title}</h3>}
      {message && <p className="state-panel-message">{message}</p>}
      {(primaryLabel || secondaryLabel) && (
        <div className="state-panel-actions">
          {primaryLabel && (
            <button type="button" className="state-panel-button primary" onClick={onPrimary}>
              {primaryLabel}
            </button>
          )}
          {secondaryLabel && (
            <button type="button" className="state-panel-button" onClick={onSecondary}>
              {secondaryLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default StateMessage;
