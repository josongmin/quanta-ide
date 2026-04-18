import { Filter, Download } from "lucide-react";
import { DemoAppHero } from "../../internal/DemoAppHero";

const ENTRIES = [
  { when: "2026-04-19 14:22 KST", what: "Policy `no-direct-db-access` was attached to `order-service`.", who: "ada@acme.com · api" },
  { when: "2026-04-19 13:58 KST", what: "API key `quanta_live_8c…` was created with scope `analysis:read`.", who: "alan@acme.com · web" },
  { when: "2026-04-19 12:04 KST", what: "Member `rich@acme.com` was suspended.",                              who: "ada@acme.com · web" },
  { when: "2026-04-19 11:41 KST", what: "Role `Engineer` had capability `policy.write` granted (partial).",    who: "ada@acme.com · web" },
  { when: "2026-04-19 10:03 KST", what: "Workspace billing cycle was changed to yearly.",                      who: "ada@acme.com · billing-portal" },
  { when: "2026-04-18 22:17 KST", what: "Webhook `https://hooks.acme.com/ci` delivery failed (retry 3/6).",    who: "system" },
  { when: "2026-04-18 19:55 KST", what: "Invite sent to `linda@acme.com`.",                                    who: "alan@acme.com · web" },
  { when: "2026-04-18 18:42 KST", what: "SSO provider OIDC metadata rotated.",                                 who: "ada@acme.com · web" },
  { when: "2026-04-18 15:10 KST", what: "Policy `secrets-in-commits` triggered on commit `9a21f3b`.",          who: "system · ci" },
  { when: "2026-04-18 09:01 KST", what: "Login succeeded from 182.210.53.12 (Seoul, KR).",                     who: "ada@acme.com · web" },
];

export function AuditLogPage() {
  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="Admin"
        title="Audit log"
        sub="Immutable record of all security-relevant actions. Retained 2 years on Team, 7 years on Enterprise."
      />
      <div className="demo-app__body">
        <div className="demo-sectionbar">
          <button className="demo-btn demo-btn--ghost"><Filter size={13} strokeWidth={1.8} /> Filter</button>
          <select className="demo-select" defaultValue="24h" style={{ width: 140 }}>
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="custom">Custom range…</option>
          </select>
          <input className="demo-input" placeholder="Search by actor, action, or resource" style={{ flex: 1, maxWidth: 320 }} />
          <span className="demo-sectionbar__spacer" />
          <button className="demo-btn demo-btn--ghost"><Download size={13} strokeWidth={1.8} /> Export CSV</button>
        </div>

        <div className="demo-block">
          <div className="demo-block__body demo-block__body--flush">
            <ul className="demo-log">
              {ENTRIES.map((e, i) => (
                <li key={i} className="demo-log__item">
                  <span className="demo-log__when">{e.when}</span>
                  <span className="demo-log__what">{e.what}</span>
                  <span className="demo-log__who">{e.who}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
