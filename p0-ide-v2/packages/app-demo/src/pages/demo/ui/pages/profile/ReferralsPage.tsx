import { Copy, Mail, Share2, AtSign, Gift, Link2 } from "lucide-react";
import { useDemoNav } from "../../DemoPage";
import { DemoAppHero } from "../../internal/DemoAppHero";

interface Activity {
  initials: string;
  name: string;
  status: "Signed up" | "Joined team" | "Converted";
  credit: string;
  date: string;
}

const ACTIVITY: Activity[] = [
  { initials: "AL", name: "Ada Lovelace",    status: "Converted",   credit: "$20",  date: "Apr 14, 2026" },
  { initials: "GH", name: "Grace Hopper",    status: "Joined team", credit: "$10",  date: "Apr 09, 2026" },
  { initials: "LT", name: "Linus Torvalds",  status: "Converted",   credit: "$20",  date: "Apr 02, 2026" },
  { initials: "DK", name: "Donald Knuth",    status: "Signed up",   credit: "—",    date: "Mar 27, 2026" },
  { initials: "AT", name: "Alan Turing",     status: "Converted",   credit: "$20",  date: "Mar 12, 2026" },
];

function StatusBadge({ status }: { status: Activity["status"] }) {
  if (status === "Converted")   return <span className="demo-badge demo-badge--success">Converted</span>;
  if (status === "Joined team") return <span className="demo-badge demo-badge--accent">Joined team</span>;
  return <span className="demo-badge">Signed up</span>;
}

export function ReferralsPage() {
  const nav = useDemoNav();
  const link = "https://quanta.dev/r/ada-2f9c";

  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="Profile"
        title="Referrals & credits"
        sub="Invite your network. Earn Quanta credits applied to your next invoice."
      />
      <div className="demo-app__body">

        <div className="demo-block">
          <header className="demo-block__head">
            <div>
              <div className="demo-block__title">Your link</div>
              <div className="demo-block__sub">Share this anywhere — we track signups automatically.</div>
            </div>
          </header>
          <div className="demo-block__body">
            <div style={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr) auto", gap: 10, alignItems: "center" }}>
              <div
                style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: "var(--bg-muted)", color: "var(--fg-muted)",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                }}
                aria-hidden
              >
                <Link2 size={16} strokeWidth={1.8} />
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--fs-sm)",
                  padding: "8px 10px",
                  background: "var(--bg-subtle)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--fg)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {link}
              </div>
              <button className="demo-btn demo-btn--primary">
                <Copy size={13} strokeWidth={1.8} /> Copy link
              </button>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <button className="demo-btn demo-btn--ghost">
                <Mail size={13} strokeWidth={1.8} /> Email
              </button>
              <button className="demo-btn demo-btn--ghost">
                <Share2 size={13} strokeWidth={1.8} /> Share on social
              </button>
              <button className="demo-btn demo-btn--ghost">
                <AtSign size={13} strokeWidth={1.8} /> Mention on X
              </button>
            </div>
          </div>
        </div>

        <div className="demo-grid-3" style={{ marginBottom: 16 }}>
          <div className="demo-stat">
            <div className="demo-stat__label">Credits earned</div>
            <div className="demo-stat__value">$120</div>
            <div className="demo-stat__delta">Applied to next invoice</div>
          </div>
          <div className="demo-stat">
            <div className="demo-stat__label">Friends joined</div>
            <div className="demo-stat__value">8</div>
            <div className="demo-stat__delta">5 converted · 3 in trial</div>
          </div>
          <div className="demo-stat">
            <div className="demo-stat__label">Pending payouts</div>
            <div className="demo-stat__value">$40</div>
            <div className="demo-stat__delta">Releases after 14-day trial</div>
          </div>
        </div>

        <div className="demo-block">
          <header className="demo-block__head">
            <div>
              <div className="demo-block__title">Activity</div>
              <div className="demo-block__sub">Latest referrals tied to your link.</div>
            </div>
          </header>
          <div className="demo-block__body demo-block__body--flush">
            <table className="demo-table">
              <thead>
                <tr>
                  <th>Friend</th>
                  <th>Status</th>
                  <th className="is-num" style={{ textAlign: "right" }}>Credit</th>
                  <th style={{ textAlign: "right" }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {ACTIVITY.map((a) => (
                  <tr key={a.name}>
                    <td>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                        <div className="demo-avatar" aria-hidden>{a.initials}</div>
                        <span>{a.name}</span>
                      </div>
                    </td>
                    <td><StatusBadge status={a.status} /></td>
                    <td className="is-num">{a.credit}</td>
                    <td style={{ textAlign: "right", color: "var(--fg-muted)" }}>{a.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="demo-block">
          <header className="demo-block__head">
            <div>
              <div className="demo-block__title">How it works</div>
              <div className="demo-block__sub">Three steps, no paperwork.</div>
            </div>
          </header>
          <div className="demo-block__body">
            <div className="demo-grid-3">
              {[
                { n: "1", title: "Share your link", sub: "Post it on your team channel, a tweet, or drop it in a DM." },
                { n: "2", title: "They sign up",    sub: "Your friend creates a free account using your link." },
                { n: "3", title: "You both earn $20 credit", sub: "Applied when they upgrade to any paid plan." },
              ].map((s) => (
                <div
                  key={s.n}
                  style={{
                    padding: "var(--space-3)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    background: "var(--bg)",
                  }}
                >
                  <div
                    style={{
                      width: 28, height: 28, borderRadius: 999,
                      background: "var(--bg-muted)", color: "var(--fg)",
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      fontSize: "var(--fs-sm)", fontWeight: 600, marginBottom: 8,
                    }}
                  >
                    <Gift size={14} strokeWidth={1.8} />
                  </div>
                  <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600 }}>{s.title}</div>
                  <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", marginTop: 4, lineHeight: 1.5 }}>
                    {s.sub}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-subtle)", marginTop: 4 }}>
          Credits are non-transferable and expire 12 months after issue. See the full{" "}
          <button className="demo-link" onClick={() => nav.navigate("legal.terms")}>
            referral terms
          </button>.
        </div>

      </div>
    </div>
  );
}
