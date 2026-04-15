export function LogButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="agst-log-btn"
      onClick={onClick}
      aria-label={`${label} log`}
    >
      <span className="agst-log-btn__icon" aria-hidden>☰</span>
      <span className="agst-log-btn__txt">log</span>
    </button>
  );
}
