export function PrivacyPage() {
  return (
    <div className="demo-app">
      <header className="demo-app__hero">
        <span className="demo-app__hero-kicker">Legal</span>
        <h1 className="demo-app__hero-title">Privacy Policy</h1>
        <p className="demo-app__hero-sub">Last updated: April 1, 2026</p>
      </header>
      <div className="demo-app__body">
        <div className="demo-prose">
          <p>
            Quanta respects your privacy. This policy explains what we collect, how we use it, and
            the choices you have.
          </p>

          <h2>What we collect</h2>
          <ul>
            <li><strong>Account data</strong> — name, email, organization, authentication identifiers.</li>
            <li><strong>Workspace data</strong> — source code, analysis outputs, rules, and settings you upload.</li>
            <li><strong>Usage data</strong> — feature interactions, performance traces, and error reports.</li>
            <li><strong>Device data</strong> — IP, browser, OS for security and abuse prevention.</li>
          </ul>

          <h2>How we use it</h2>
          <ul>
            <li>To provide and improve the Services.</li>
            <li>To communicate about updates and security.</li>
            <li>To detect, prevent, and respond to abuse.</li>
          </ul>

          <h2>Your code is yours</h2>
          <p>
            We never train public models on your code. Analysis is performed in per-workspace
            sandboxes. Enterprise customers can opt into customer-managed encryption keys.
          </p>

          <h2>Retention</h2>
          <p>
            Active workspace data is retained while your account is active. Deleted workspaces are
            purged within 30 days. Backups are rotated within 90 days.
          </p>

          <h2>Your rights</h2>
          <p>
            Depending on your region, you may have the right to access, correct, delete, or export
            your personal data. Contact{" "}
            <a className="demo-link" href="mailto:privacy@quanta.dev">privacy@quanta.dev</a>.
          </p>

          <h2>Subprocessors</h2>
          <p>A current list is maintained at <span className="demo-link">quanta.dev/subprocessors</span>.</p>

          <h2>Contact</h2>
          <p>Data Protection Officer — <a className="demo-link" href="mailto:dpo@quanta.dev">dpo@quanta.dev</a>.</p>
        </div>
      </div>
    </div>
  );
}
