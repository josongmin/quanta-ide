import { useState } from "react";
import { Download, Package } from "lucide-react";
import { DemoAppHero } from "../../internal/DemoAppHero";

type Status = "ready" | "pending" | "failed" | "expired";

interface ExportItem {
  id: string;
  requested: string;
  scope: string;
  size: string;
  status: Status;
}

const HISTORY: ExportItem[] = [
  { id: "e1", requested: "2026-04-18", scope: "Entire workspace",   size: "482 MB", status: "ready" },
  { id: "e2", requested: "2026-03-30", scope: "My personal data",   size: "14 MB",  status: "ready" },
  { id: "e3", requested: "2026-03-02", scope: "Entire workspace",   size: "476 MB", status: "expired" },
  { id: "e4", requested: "2026-02-14", scope: "Entire workspace",   size: "—",      status: "failed" },
  { id: "e5", requested: "2026-02-01", scope: "Audit log only",     size: "22 MB",  status: "ready" },
];

const INCLUDES = [
  { key: "analyses", label: "Code analyses",      hint: "All runs, findings, and attached metadata.", on: true },
  { key: "policies", label: "Policies",           hint: "Custom rules and their evaluation history.", on: true },
  { key: "members",  label: "Members & roles",    hint: "User directory, group membership, SCIM map.", on: true },
  { key: "billing",  label: "Billing history",    hint: "Invoices, receipts, cost allocation by seat.", on: false },
  { key: "audit",    label: "Audit log",          hint: "Immutable record of security-relevant events.", on: true },
];

function statusBadge(s: Status) {
  if (s === "ready")   return <span className="demo-badge demo-badge--success">Ready</span>;
  if (s === "pending") return <span className="demo-badge demo-badge--accent">Pending</span>;
  if (s === "failed")  return <span className="demo-badge demo-badge--danger">Failed</span>;
  return <span className="demo-badge demo-badge--warn">Expired</span>;
}

export function DataExportPage() {
  const [scope, setScope] = useState("workspace");
  const [format, setFormat] = useState("json");
  const [includes, setIncludes] = useState<Record<string, boolean>>(
    () => Object.fromEntries(INCLUDES.map((i) => [i.key, i.on])),
  );

  const selectedCount = Object.values(includes).filter(Boolean).length;

  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="Security"
        title="Data export"
        sub="Download a machine-readable archive of your workspace data. Exports are generated asynchronously and include a signed URL valid for 48 hours."
      />
      <div className="demo-app__body">
        <div className="demo-block">
          <header className="demo-block__head">
            <div>
              <div className="demo-block__title">Request a new export</div>
              <div className="demo-block__sub">We will email you when the archive is ready.</div>
            </div>
          </header>
          <div className="demo-block__body">
            <div className="demo-grid-2">
              <div className="demo-field">
                <label className="demo-field__label">Scope</label>
                <select className="demo-select" value={scope} onChange={(e) => setScope(e.target.value)}>
                  <option value="workspace">Entire workspace</option>
                  <option value="personal">My personal data only</option>
                  <option value="range">Specific date range</option>
                </select>
                <div className="demo-field__hint">Workspace exports require Owner or Admin privileges.</div>
              </div>
              <div className="demo-field">
                <label className="demo-field__label">Format</label>
                <select className="demo-select" value={format} onChange={(e) => setFormat(e.target.value)}>
                  <option value="json">JSON</option>
                  <option value="ndjson">NDJSON</option>
                  <option value="csv">CSV</option>
                </select>
                <div className="demo-field__hint">NDJSON is recommended for large archives.</div>
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--fg)", marginBottom: 8 }}>
                Include in archive
              </div>
              <div className="demo-block" style={{ borderRadius: "var(--radius-sm, 6px)" }}>
                <div className="demo-block__body demo-block__body--flush">
                  {INCLUDES.map((i) => (
                    <div key={i.key} className="demo-row" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                      <div className="demo-row__primary">
                        <div className="demo-row__title">{i.label}</div>
                        <div className="demo-row__sub">{i.hint}</div>
                      </div>
                      <label className="demo-toggle" aria-label={`Include ${i.label}`}>
                        <input
                          type="checkbox"
                          checked={!!includes[i.key]}
                          onChange={(e) => setIncludes((m) => ({ ...m, [i.key]: e.target.checked }))}
                        />
                        <span className="demo-toggle__track" />
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <footer className="demo-block__foot">
            <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-subtle)" }}>
              {selectedCount} of {INCLUDES.length} categories selected
            </span>
            <span className="demo-sectionbar__spacer" />
            <button className="demo-btn demo-btn--primary" disabled={selectedCount === 0}>
              <Package size={13} strokeWidth={1.8} /> Generate export
            </button>
          </footer>
        </div>

        <div className="demo-block">
          <header className="demo-block__head">
            <div>
              <div className="demo-block__title">Export history</div>
              <div className="demo-block__sub">Archives are retained for 30 days. Signed URLs expire after 48 hours.</div>
            </div>
          </header>
          <div className="demo-block__body demo-block__body--flush">
            <table className="demo-table">
              <thead>
                <tr>
                  <th>Requested</th>
                  <th>Scope</th>
                  <th className="is-num" style={{ textAlign: "right" }}>Size</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {HISTORY.map((e) => (
                  <tr key={e.id}>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-subtle)" }}>{e.requested}</td>
                    <td>{e.scope}</td>
                    <td className="is-num">{e.size}</td>
                    <td>{statusBadge(e.status)}</td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className="demo-btn demo-btn--ghost"
                        disabled={e.status !== "ready"}
                        aria-label={`Download ${e.scope} from ${e.requested}`}
                      >
                        <Download size={13} strokeWidth={1.8} /> Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p style={{ fontSize: "var(--fs-xs)", color: "var(--fg-subtle)", marginTop: 4 }}>
          Under GDPR Art. 20 and equivalent regimes, you may request a portable copy of your personal data at any time.
          Archives are encrypted at rest (AES-256-GCM) and signed URLs use short-lived HMAC tokens. Contact&nbsp;
          <span style={{ fontFamily: "var(--font-mono)" }}>privacy@quanta.dev</span> for custom retention requests.
        </p>
      </div>
    </div>
  );
}
