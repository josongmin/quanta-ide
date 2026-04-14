import "./statusbar.css";

export function Statusbar() {
  return (
    <footer className="statusbar" role="status">
      <div className="statusbar__left">
        <span className="dot dot--ok" />
        <span>main</span>
        <span className="sep">·</span>
        <span>Python 3.12</span>
      </div>
      <div className="statusbar__right">
        <span>Ln 12, Col 8</span>
        <span className="sep">·</span>
        <span>UTF-8</span>
        <span className="sep">·</span>
        <span>LF</span>
      </div>
    </footer>
  );
}
