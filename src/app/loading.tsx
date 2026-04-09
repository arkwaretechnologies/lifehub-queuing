export default function Loading() {
  return (
    <div className="lh-loader-overlay" role="status" aria-live="polite" aria-label="Loading…">
      <div className="lh-loader-card">
        <div className="lh-loader-brand">
          <div className="lh-loader-logo" aria-hidden="true" />
          <div className="lh-loader-text">
            <div className="lh-loader-title">Lifehub</div>
            <div className="lh-loader-subtitle">Loading module…</div>
          </div>
        </div>
        <div className="lh-loader-bar" aria-hidden="true">
          <div className="lh-loader-barFill" />
        </div>
        <div className="lh-loader-hint">Please wait…</div>
      </div>
    </div>
  );
}

