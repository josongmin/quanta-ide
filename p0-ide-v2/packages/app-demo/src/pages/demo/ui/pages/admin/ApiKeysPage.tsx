import { useState } from "react";
import { Copy, Eye, EyeOff, Trash2, Plus } from "lucide-react";
import { DemoAppHero } from "../../internal/DemoAppHero";

interface Key { id: string; name: string; prefix: string; scopes: string[]; lastUsed: string; created: string; status: "active" | "revoked"; }

const KEYS: Key[] = [
  { id: "k1", name: "CI — prod",              prefix: "quanta_live_8c",  scopes: ["analysis:read", "policy:read"],          lastUsed: "12 min ago", created: "2026-04-02", status: "active" },
  { id: "k2", name: "GitHub Action",          prefix: "quanta_live_a1",  scopes: ["analysis:read", "analysis:write"],        lastUsed: "2 hours ago", created: "2026-03-21", status: "active" },
  { id: "k3", name: "Local script — Ada",     prefix: "quanta_live_fe",  scopes: ["analysis:read"],                          lastUsed: "5 days ago",  created: "2026-02-18", status: "active" },
  { id: "k4", name: "Old integration (Datadog)", prefix: "quanta_live_21", scopes: ["webhooks:write"],                       lastUsed: "—",           created: "2025-11-04", status: "revoked" },
];

export function ApiKeysPage() {
  const [revealed, setRevealed] = useState<string | null>(null);
  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="Admin"
        title="API keys"
        sub="Programmatic access tokens. Keys are shown once at creation time — store them securely."
      />
      <div className="demo-app__body">
        <div className="demo-sectionbar">
          <span className="demo-sectionbar__spacer" />
          <button className="demo-btn demo-btn--primary"><Plus size={13} strokeWidth={1.8} /> Create new key</button>
        </div>

        <div className="demo-block">
          <div className="demo-block__body demo-block__body--flush">
            <table className="demo-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Key</th>
                  <th>Scopes</th>
                  <th>Last used</th>
                  <th>Created</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {KEYS.map((k) => (
                  <tr key={k.id}>
                    <td>{k.name}</td>
                    <td className="is-mono">
                      <span>{k.prefix}</span>
                      <span style={{ color: "var(--fg-subtle)" }}>
                        {revealed === k.id ? "34f9b2c1e7d88" : "…"}
                      </span>
                    </td>
                    <td>
                      {k.scopes.map((s) => (
                        <span key={s} className="demo-badge" style={{ marginRight: 4 }}>{s}</span>
                      ))}
                    </td>
                    <td style={{ color: "var(--fg-subtle)" }}>{k.lastUsed}</td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-subtle)" }}>{k.created}</td>
                    <td>
                      <span className={"demo-badge" + (k.status === "active" ? " demo-badge--success" : " demo-badge--danger")}>
                        {k.status}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: 4 }}>
                        <button
                          className="demo-btn demo-btn--ghost"
                          style={{ padding: 0, width: 28, height: 28 }}
                          aria-label={revealed === k.id ? "Hide key" : "Reveal key"}
                          onClick={() => setRevealed((r) => (r === k.id ? null : k.id))}
                          disabled={k.status === "revoked"}
                        >
                          {revealed === k.id ? <EyeOff size={13} strokeWidth={1.8} /> : <Eye size={13} strokeWidth={1.8} />}
                        </button>
                        <button className="demo-btn demo-btn--ghost" style={{ padding: 0, width: 28, height: 28 }} aria-label="Copy" disabled={k.status === "revoked"}>
                          <Copy size={13} strokeWidth={1.8} />
                        </button>
                        <button className="demo-btn demo-btn--danger" style={{ padding: 0, width: 28, height: 28 }} aria-label="Revoke" disabled={k.status === "revoked"}>
                          <Trash2 size={13} strokeWidth={1.8} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="demo-block">
          <header className="demo-block__head">
            <div>
              <div className="demo-block__title">Quickstart</div>
              <div className="demo-block__sub">Make a signed request from your terminal.</div>
            </div>
          </header>
          <div className="demo-block__body">
            <pre className="demo-code">{`curl https://api.quanta.dev/v1/analyses \\
  -H "Authorization: Bearer quanta_live_8c…" \\
  -H "Content-Type: application/json" \\
  -d '{ "repo": "acme/order-service", "ref": "main" }'`}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
