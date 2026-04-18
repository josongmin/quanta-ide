const PREFS: Array<{ key: string; label: string; hint: string; on: boolean }> = [
  { key: "theme",       label: "Follow system theme",           hint: "Switch to dark mode automatically when your OS does.", on: true },
  { key: "keys.vim",    label: "Vim keybindings",               hint: "Use vim-style navigation and editing.", on: false },
  { key: "density",     label: "Compact density",               hint: "Tighter row heights and padding.", on: false },
  { key: "sounds",      label: "Subtle sounds",                 hint: "Play a short tone when an analysis run completes.", on: true },
  { key: "motion",      label: "Reduce motion",                 hint: "Minimize transitions and parallax.", on: false },
  { key: "telemetry",   label: "Share anonymous usage telemetry", hint: "Helps us prioritize improvements. Never includes code.", on: true },
];

export function AccountPreferencesPage() {
  return (
    <div className="demo-app">
      <header className="demo-app__hero">
        <span className="demo-app__hero-kicker">Profile</span>
        <h1 className="demo-app__hero-title">Preferences</h1>
        <p className="demo-app__hero-sub">Personal defaults that travel with your account across workspaces.</p>
      </header>
      <div className="demo-app__body">
        <div className="demo-block">
          <div className="demo-block__body demo-block__body--flush">
            {PREFS.map((p) => (
              <div key={p.key} className="demo-row" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                <div className="demo-row__primary">
                  <div className="demo-row__title">{p.label}</div>
                  <div className="demo-row__sub">{p.hint}</div>
                </div>
                <label className="demo-toggle">
                  <input type="checkbox" defaultChecked={p.on} aria-label={p.label} />
                  <span className="demo-toggle__track" />
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="demo-block">
          <header className="demo-block__head">
            <div>
              <div className="demo-block__title">Keyboard shortcuts</div>
              <div className="demo-block__sub">Rebind core shortcuts across your workspace.</div>
            </div>
            <span className="demo-sectionbar__spacer" />
            <button className="demo-btn demo-btn--ghost">Reset to defaults</button>
            <button className="demo-btn demo-btn--ghost">Import from VSCode</button>
          </header>
          <div className="demo-block__body demo-block__body--flush">
            <table className="demo-table">
              <thead>
                <tr><th>Command</th><th>Binding</th><th style={{ textAlign: "right" }}></th></tr>
              </thead>
              <tbody>
                <tr><td>Command palette</td><td className="is-mono">⌘ K</td><td style={{ textAlign: "right" }}><button className="demo-btn demo-btn--ghost" style={{ height: 24, padding: "0 8px", fontSize: "var(--fs-10)" }}>Rebind</button></td></tr>
                <tr><td>Toggle settings</td><td className="is-mono">⌘ ,</td><td style={{ textAlign: "right" }}><button className="demo-btn demo-btn--ghost" style={{ height: 24, padding: "0 8px", fontSize: "var(--fs-10)" }}>Rebind</button></td></tr>
                <tr><td>Toggle agent</td><td className="is-mono">⌘ J</td><td style={{ textAlign: "right" }}><button className="demo-btn demo-btn--ghost" style={{ height: 24, padding: "0 8px", fontSize: "var(--fs-10)" }}>Rebind</button></td></tr>
                <tr><td>Try demo</td><td className="is-mono">⌘ ⇧ D</td><td style={{ textAlign: "right" }}><button className="demo-btn demo-btn--ghost" style={{ height: 24, padding: "0 8px", fontSize: "var(--fs-10)" }}>Rebind</button></td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
