import { useState } from "react";
import { CheckCheck, Inbox } from "lucide-react";
import { DemoAppHero } from "../../internal/DemoAppHero";

interface Notif { id: string; title: string; body: string; when: string; unread: boolean; cat: string; }

const INITIAL: Notif[] = [
  { id: "1", cat: "Review",  title: "Grace requested your review on PR #482",  body: "\"refactor(rules): split matcher into dedicated module\" — 4 files changed",      when: "2m",  unread: true },
  { id: "2", cat: "Policy",  title: "Policy violated in order-service",        body: "Rule `no-direct-db-access` triggered by commit 9a21f3b on main.",                 when: "14m", unread: true },
  { id: "3", cat: "Billing", title: "Invoice INV-2026-0005 paid",              body: "Payment of $792.00 processed successfully. Receipt emailed to billing@acme.com.", when: "1h",  unread: false },
  { id: "4", cat: "Team",    title: "Margaret Hamilton accepted your invite",  body: "They joined as Engineer and landed on the Home page.",                            when: "3h",  unread: false },
  { id: "5", cat: "System",  title: "API key quanta_live_… expires in 7 days", body: "Rotate the key from Admin · API keys to avoid downtime.",                        when: "1d",  unread: false },
];

export function NotificationsInboxPage() {
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [items, setItems] = useState(INITIAL);
  const visible = tab === "all" ? items : items.filter((i) => i.unread);
  const unreadCount = items.filter((i) => i.unread).length;

  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="Notifications"
        title="Inbox"
        sub="A single stream for reviews, policy violations, billing, and system alerts."
      />
      <div className="demo-app__body">
        <div className="demo-sectionbar">
          <div className="demo-billing-toggle" style={{ marginBottom: 0 }}>
            <button className={tab === "all" ? "is-active" : ""} onClick={() => setTab("all")}>
              All <span className="demo-badge" style={{ marginLeft: 6 }}>{items.length}</span>
            </button>
            <button className={tab === "unread" ? "is-active" : ""} onClick={() => setTab("unread")}>
              Unread <span className="demo-badge demo-badge--accent" style={{ marginLeft: 6 }}>{unreadCount}</span>
            </button>
          </div>
          <span className="demo-sectionbar__spacer" />
          <button
            className="demo-btn demo-btn--ghost"
            onClick={() => setItems((list) => list.map((i) => ({ ...i, unread: false })))}
          >
            <CheckCheck size={13} strokeWidth={1.8} /> Mark all as read
          </button>
        </div>

        <div className="demo-block">
          <div className="demo-block__body demo-block__body--flush">
            {visible.length === 0 && (
              <div className="demo-empty">
                <Inbox size={22} strokeWidth={1.6} />
                <div className="demo-empty__title">You&apos;re all caught up</div>
                <div className="demo-empty__hint">Nothing in your unread queue.</div>
              </div>
            )}
            {visible.map((n) => (
              <div
                key={n.id}
                className={"demo-notif-item" + (n.unread ? " is-unread" : "")}
                onClick={() => setItems((list) => list.map((i) => i.id === n.id ? { ...i, unread: false } : i))}
              >
                <span className="demo-notif-item__dot" />
                <div>
                  <div className="demo-notif-item__title">
                    <span className="demo-badge" style={{ marginRight: 8 }}>{n.cat}</span>
                    {n.title}
                  </div>
                  <div className="demo-notif-item__body">{n.body}</div>
                </div>
                <span className="demo-notif-item__when">{n.when}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
