import { Check, Minus } from "lucide-react";
import { DemoAppHero } from "../../internal/DemoAppHero";

type Level = "full" | "partial" | "none";

interface Row { capability: string; owner: Level; admin: Level; engineer: Level; reviewer: Level; viewer: Level; }

const ROWS: Row[] = [
  { capability: "View code & canvas",           owner: "full",   admin: "full",    engineer: "full",    reviewer: "full",   viewer: "full" },
  { capability: "Run analysis engines",          owner: "full",   admin: "full",    engineer: "full",    reviewer: "full",   viewer: "none" },
  { capability: "Edit & propose changes",        owner: "full",   admin: "full",    engineer: "full",    reviewer: "partial",viewer: "none" },
  { capability: "Approve / merge PRs",           owner: "full",   admin: "full",    engineer: "none",    reviewer: "full",   viewer: "none" },
  { capability: "Author & enforce policies",     owner: "full",   admin: "full",    engineer: "partial", reviewer: "none",   viewer: "none" },
  { capability: "Invite & manage members",       owner: "full",   admin: "full",    engineer: "none",    reviewer: "none",   viewer: "none" },
  { capability: "Billing & invoices",            owner: "full",   admin: "partial", engineer: "none",    reviewer: "none",   viewer: "none" },
  { capability: "Delete workspace",              owner: "full",   admin: "none",    engineer: "none",    reviewer: "none",   viewer: "none" },
];

function Cell({ lvl }: { lvl: Level }) {
  if (lvl === "full") return <Check size={14} strokeWidth={2} style={{ color: "var(--success)" }} />;
  if (lvl === "partial") return <span style={{ color: "var(--warn)", fontSize: "var(--fs-xs)", fontWeight: 600 }}>Partial</span>;
  return <Minus size={14} strokeWidth={2} style={{ color: "var(--fg-subtle)" }} />;
}

export function RolesPage() {
  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="Team"
        title="Roles & permissions"
        sub="Capability matrix. Roles are additive and can be customized on Enterprise."
      />
      <div className="demo-app__body">
        <div className="demo-block">
          <div className="demo-block__body demo-block__body--flush">
            <table className="demo-prefs">
              <thead>
                <tr>
                  <th>Capability</th>
                  <th>Owner</th>
                  <th>Admin</th>
                  <th>Engineer</th>
                  <th>Reviewer</th>
                  <th>Viewer</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r) => (
                  <tr key={r.capability}>
                    <td>{r.capability}</td>
                    <td><Cell lvl={r.owner} /></td>
                    <td><Cell lvl={r.admin} /></td>
                    <td><Cell lvl={r.engineer} /></td>
                    <td><Cell lvl={r.reviewer} /></td>
                    <td><Cell lvl={r.viewer} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="demo-block__foot">
            <span style={{ marginRight: "auto", fontSize: "var(--fs-xs)", color: "var(--fg-subtle)" }}>
              Need finer control? Custom roles are available on the Enterprise plan.
            </span>
            <button className="demo-btn demo-btn--ghost">Export matrix</button>
            <button className="demo-btn demo-btn--primary">Create custom role</button>
          </div>
        </div>
      </div>
    </div>
  );
}
