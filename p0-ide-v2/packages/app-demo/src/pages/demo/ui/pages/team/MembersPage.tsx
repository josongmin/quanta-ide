import { useState } from "react";
import { MoreHorizontal, Search, UserPlus } from "lucide-react";
import { DemoAppHero } from "../../internal/DemoAppHero";
import { initials } from "../../internal/avatar-utils";

const MEMBERS = [
  { name: "Ada Lovelace",     email: "ada@acme.com",     role: "Owner",       status: "active",   joined: "2025-03-02", dot: "success" },
  { name: "Alan Turing",      email: "alan@acme.com",    role: "Admin",       status: "active",   joined: "2025-03-05", dot: "success" },
  { name: "Grace Hopper",     email: "grace@acme.com",   role: "Engineer",    status: "active",   joined: "2025-04-14", dot: "success" },
  { name: "Linus Torvalds",   email: "linus@acme.com",   role: "Engineer",    status: "active",   joined: "2025-05-01", dot: "success" },
  { name: "Margaret Hamilton",email: "margaret@acme.com",role: "Engineer",    status: "invited",  joined: "—",          dot: "warn" },
  { name: "Donald Knuth",     email: "don@acme.com",     role: "Reviewer",    status: "active",   joined: "2025-07-22", dot: "success" },
  { name: "Rich Hickey",      email: "rich@acme.com",    role: "Engineer",    status: "suspended",joined: "2025-08-01", dot: "danger" },
];

const STATUS_BADGE: Record<string, string> = {
  active: "demo-badge demo-badge--success",
  invited: "demo-badge demo-badge--warn",
  suspended: "demo-badge demo-badge--danger",
};

const ROLE_TONE: Record<string, string> = {
  Owner: "demo-badge demo-badge--accent",
  Admin: "demo-badge demo-badge--accent",
  Engineer: "demo-badge",
  Reviewer: "demo-badge",
};

export function MembersPage() {
  const [q, setQ] = useState("");
  const shown = MEMBERS.filter((m) => !q || m.name.toLowerCase().includes(q.toLowerCase()) || m.email.includes(q));

  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="Team"
        title="Members"
        sub="Everyone with access to this workspace. Owners can change roles and remove seats."
      />
      <div className="demo-app__body">
        <div className="demo-sectionbar">
          <div className="demo-sectionbar__title">7 people · 12 seats used of 25</div>
          <span className="demo-sectionbar__spacer" />
          <div
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              border: "1px solid var(--border)", padding: "0 10px", height: 28,
              borderRadius: "var(--radius-sm)", background: "var(--bg)",
              color: "var(--fg-subtle)", fontSize: "var(--fs-xs)",
            }}
          >
            <Search size={13} strokeWidth={2} />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter members"
              style={{ border: 0, outline: "none", background: "transparent", color: "var(--fg)", font: "inherit", width: 160 }}
            />
          </div>
          <button className="demo-btn demo-btn--primary">
            <UserPlus size={13} strokeWidth={1.8} /> Invite member
          </button>
        </div>

        <div className="demo-block">
          <div className="demo-block__body demo-block__body--flush">
            <table className="demo-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((m) => (
                  <tr key={m.email}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span className="demo-avatar">{initials(m.name)}</span>
                        <div>
                          <div style={{ fontWeight: 500 }}>{m.name}</div>
                          <div style={{ color: "var(--fg-subtle)", fontSize: "var(--fs-10)" }}>{m.email}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className={ROLE_TONE[m.role] ?? "demo-badge"}>{m.role}</span></td>
                    <td>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span className={`demo-dot demo-dot--${m.dot}`} /> {m.status}
                      </span>
                    </td>
                    <td style={{ color: "var(--fg-subtle)", fontFamily: "var(--font-mono)", fontSize: 11 }}>{m.joined}</td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        aria-label="More actions"
                        className="demo-btn demo-btn--ghost"
                        style={{ padding: 0, width: 28, height: 28 }}
                      >
                        <MoreHorizontal size={14} strokeWidth={1.8} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {shown.length === 0 && <div className="demo-empty"><div className="demo-empty__title">No members match</div></div>}
          </div>
        </div>

        <p style={{ marginTop: 12, fontSize: "var(--fs-xs)", color: "var(--fg-subtle)" }}>
          Status badge: <span className={STATUS_BADGE.active}>active</span>{" "}
          <span className={STATUS_BADGE.invited}>invited</span>{" "}
          <span className={STATUS_BADGE.suspended}>suspended</span>
        </p>
      </div>
    </div>
  );
}
