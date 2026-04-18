import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  FileImage,
  MoreHorizontal,
  Paperclip,
  Plus,
  Send,
  X,
} from "lucide-react";
import { useDemoNav } from "../../DemoPage";
import { DemoAppHero } from "../../internal/DemoAppHero";
import { initials, pickPalette } from "../../internal/avatar-utils";

type MessageKind = "message" | "system";

interface Attachment {
  name: string;
  size: string;
}

interface ThreadItem {
  kind: MessageKind;
  author?: string;
  role?: string;
  time?: string;
  body?: string;
  attachments?: Attachment[];
  system?: string;
}

const THREAD: ThreadItem[] = [
  {
    kind: "message",
    author: "Ada Lovelace",
    role: "Acme Inc. · Platform lead",
    time: "2026-04-18 · 09:22 KST",
    body: "Hi team — our CI job for PR #482 keeps hanging on the Quanta analyses step. The runner checks out, posts the 'analysis queued' status, and then stalls at 00:12 with no further logs. Retrying the workflow reproduces it 3/3 times. We pinned engine 4.2.1 last week; the same PR passed on main yesterday. Anything server-side we should know about?",
  },
  {
    kind: "message",
    author: "Ada Lovelace",
    role: "Acme Inc. · Platform lead",
    time: "2026-04-18 · 09:26 KST",
    body: "Attaching the raw CI log and a screenshot of the stuck job — happy to enable verbose mode on a retry if that helps.",
    attachments: [
      { name: "ci-stuck-analysis.log", size: "184 KB" },
      { name: "pr-482-stuck-screenshot.png", size: "612 KB" },
    ],
  },
  {
    kind: "message",
    author: "Mei Zhang",
    role: "Quanta · Support engineer",
    time: "2026-04-18 · 11:04 KST",
    body: "Thanks Ada — I can see the request arriving at analyses-us-west-2 but it never acks the follow-up chunk. Your log shows a TLS session resumption on a stale ticket, which lines up with an incident we rolled back at 08:50 KST. I have restarted the analysis worker assigned to your workspace and kicked the job manually; it finished in 41s. Can you re-run PR #482 and confirm it now passes end-to-end?",
  },
  {
    kind: "system",
    system:
      "Priority changed High \u2192 Normal by Mei Zhang · 2 hours ago",
  },
  {
    kind: "message",
    author: "Ada Lovelace",
    role: "Acme Inc. · Platform lead",
    time: "2026-04-18 · 13:11 KST",
    body: "Re-ran the workflow twice — both green, and analyses came back in ~38s and ~44s. Thanks for the fast turnaround. One question: is there anything we should add on our side (e.g. longer keep-alive, retry on idempotent POST) so we do not hit this again if there is a future rollback?",
  },
];

const CANNED = [
  "Can you share a CI log?",
  "We can enable verbose mode on a retry",
  "This is a known issue — tracking in #ENG-4821",
  "I'll escalate to the engine on-call",
];

const LABELS = ["engine", "ci", "analyses", "regression"];

const RELATED = [
  {
    id: "TK-2026-00099",
    title: "Flaky analyses step on self-hosted runners",
    status: "open" as const,
  },
  {
    id: "TK-2025-00812",
    title: "TLS session tickets causing idle hangs",
    status: "resolved" as const,
  },
];

function SidebarCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        background: "var(--bg)",
        overflow: "hidden",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
          padding: "var(--space-2h) var(--space-3)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: "var(--fs-10)",
            fontWeight: "var(--fw-bold)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--fg-subtle)",
          }}
        >
          {title}
        </h3>
        <span style={{ marginLeft: "auto" }}>{action}</span>
      </header>
      <div style={{ padding: "var(--space-3)" }}>{children}</div>
    </section>
  );
}

function SidebarPerson({ name, role }: { name: string; role: string }) {
  const pal = pickPalette(name);
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-2)",
      }}
    >
      <span
        className="demo-avatar"
        style={{ background: pal.bg, color: pal.fg, width: 22, height: 22, fontSize: 10 }}
        aria-hidden="true"
      >
        {initials(name)}
      </span>
      <div style={{ lineHeight: 1.2 }}>
        <div style={{ fontSize: "var(--fs-sm)", color: "var(--fg)" }}>{name}</div>
        <div style={{ fontSize: "var(--fs-10)", color: "var(--fg-subtle)" }}>{role}</div>
      </div>
    </div>
  );
}

function KvRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "90px minmax(0, 1fr)",
        alignItems: "center",
        gap: "var(--space-2)",
        padding: "var(--space-1h) 0",
        borderBottom: "1px dashed var(--border)",
        fontSize: "var(--fs-xs)",
      }}
    >
      <span style={{ color: "var(--fg-subtle)" }}>{k}</span>
      <span style={{ color: "var(--fg)" }}>{v}</span>
    </div>
  );
}

function AttachmentChip({ a }: { a: Attachment }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-1h)",
        padding: "var(--space-1) var(--space-2)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        background: "var(--bg-subtle)",
        fontSize: "var(--fs-xs)",
        color: "var(--fg)",
        cursor: "pointer",
      }}
    >
      <FileImage size={12} strokeWidth={1.8} aria-hidden="true" />
      <span style={{ fontFamily: "var(--font-mono)" }}>{a.name}</span>
      <span style={{ color: "var(--fg-subtle)" }}>· {a.size}</span>
    </span>
  );
}

export function TicketDetailPage() {
  const nav = useDemoNav();
  const [reply, setReply] = useState("");
  const [cannedOpen, setCannedOpen] = useState(false);
  const [labels, setLabels] = useState<string[]>(LABELS);
  const [addingLabel, setAddingLabel] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [hoverRelated, setHoverRelated] = useState<string | null>(null);

  const removeLabel = (l: string) => setLabels((prev) => prev.filter((x) => x !== l));
  const addLabel = () => {
    const v = newLabel.trim().toLowerCase();
    if (!v || labels.includes(v)) {
      setAddingLabel(false);
      setNewLabel("");
      return;
    }
    setLabels((prev) => [...prev, v]);
    setNewLabel("");
    setAddingLabel(false);
  };

  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="Support"
        title="Analysis stuck on CI for PR #482"
        sub="#TK-2026-00142 · Opened 2026-04-18 by Ada Lovelace · Awaiting Quanta reply"
      />
      <div className="demo-app__body">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 280px",
            gap: "var(--space-4)",
            alignItems: "flex-start",
          }}
        >
          {/* LEFT: conversation */}
          <div style={{ minWidth: 0 }}>
            <div className="demo-sectionbar">
              <button
                type="button"
                className="demo-btn demo-btn--ghost"
                style={{ padding: "0 var(--space-2h)", height: 30 }}
                onClick={() => nav.navigate("support.tickets")}
                aria-label="Back to all tickets"
              >
                <ArrowLeft size={13} strokeWidth={1.8} /> Back to tickets
              </button>
              <span className="demo-badge demo-badge--warn">Awaiting reply</span>
              <span
                style={{
                  fontSize: "var(--fs-10)",
                  color: "var(--fg-subtle)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                SLA 4h remaining
              </span>
              <span className="demo-sectionbar__spacer" />
              <button
                type="button"
                className="demo-btn demo-btn--primary"
                style={{ padding: "0 var(--space-3)", height: 30 }}
                aria-label="Mark ticket as resolved"
              >
                <CheckCircle2 size={13} strokeWidth={1.8} /> Mark resolved
              </button>
              <button
                type="button"
                className="demo-btn demo-btn--ghost"
                style={{ padding: 0, width: 30, height: 30, justifyContent: "center" }}
                aria-label="More actions"
              >
                <MoreHorizontal size={14} strokeWidth={1.8} />
              </button>
            </div>

            {/* Thread */}
            <div
              className="demo-block"
              style={{ padding: "var(--space-4) var(--space-4) var(--space-3)" }}
            >
              {THREAD.map((item, i) => {
                if (item.kind === "system") {
                  return (
                    <div
                      key={i}
                      role="status"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "var(--space-2)",
                        padding: "var(--space-2) 0",
                        margin: "var(--space-2) 0",
                        fontSize: "var(--fs-10)",
                        color: "var(--fg-subtle)",
                        letterSpacing: "0.04em",
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: "var(--accent)",
                          flex: "0 0 auto",
                        }}
                        aria-hidden="true"
                      />
                      {item.system}
                    </div>
                  );
                }
                const author = item.author ?? "";
                const pal = pickPalette(author);
                const isLast = i === THREAD.length - 1;
                return (
                  <article
                    key={i}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "40px 1fr",
                      gap: "var(--space-2h)",
                      paddingBottom: "var(--space-4)",
                      marginBottom: "var(--space-4)",
                      borderBottom: isLast ? "none" : "1px solid var(--border)",
                    }}
                  >
                    <span
                      className="demo-avatar"
                      style={{
                        background: pal.bg,
                        color: pal.fg,
                        width: 36,
                        height: 36,
                      }}
                      aria-hidden="true"
                    >
                      {initials(author)}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <header
                        style={{
                          display: "flex",
                          alignItems: "baseline",
                          flexWrap: "wrap",
                          gap: "var(--space-2)",
                          marginBottom: "var(--space-1)",
                        }}
                      >
                        <strong
                          style={{ fontSize: "var(--fs-sm)", color: "var(--fg)" }}
                        >
                          {author}
                        </strong>
                        <span
                          style={{
                            fontSize: "var(--fs-10)",
                            color: "var(--fg-subtle)",
                          }}
                        >
                          {item.role}
                        </span>
                        <span
                          style={{
                            fontSize: "var(--fs-10)",
                            color: "var(--fg-subtle)",
                          }}
                        >
                          · {item.time}
                        </span>
                      </header>
                      <div
                        style={{
                          fontSize: "var(--fs-sm)",
                          lineHeight: "var(--lh-relaxed)",
                          color: "var(--fg)",
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {item.body}
                      </div>
                      {item.attachments && item.attachments.length > 0 && (
                        <div
                          style={{
                            marginTop: "var(--space-2)",
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "var(--space-1h)",
                          }}
                        >
                          {item.attachments.map((a) => (
                            <AttachmentChip key={a.name} a={a} />
                          ))}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}

              {/* Reply composer */}
              <div
                style={{
                  border: "1px solid var(--border-strong)",
                  borderRadius: "var(--radius-md)",
                  background: "var(--bg)",
                  padding: "var(--space-2h)",
                  marginTop: "var(--space-2)",
                }}
              >
                <textarea
                  className="demo-textarea"
                  placeholder="Write a reply to the Quanta team…"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  aria-label="Reply to ticket"
                  style={{
                    border: 0,
                    outline: "none",
                    minHeight: 96,
                    padding: 0,
                    resize: "vertical",
                    background: "transparent",
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                    marginTop: "var(--space-2)",
                  }}
                >
                  <button
                    type="button"
                    className="demo-btn demo-btn--ghost"
                    style={{ padding: "0 var(--space-2h)", height: 28 }}
                    aria-label="Attach file"
                  >
                    <Paperclip size={12} strokeWidth={1.8} /> Attach
                  </button>
                  <div style={{ position: "relative" }}>
                    <button
                      type="button"
                      className="demo-btn demo-btn--ghost"
                      style={{ padding: "0 var(--space-2h)", height: 28 }}
                      aria-haspopup="listbox"
                      aria-expanded={cannedOpen}
                      onClick={() => setCannedOpen((v) => !v)}
                    >
                      Canned reply{" "}
                      <ChevronDown size={12} strokeWidth={1.8} />
                    </button>
                    {cannedOpen && (
                      <ul
                        role="listbox"
                        style={{
                          position: "absolute",
                          top: "calc(100% + 4px)",
                          left: 0,
                          zIndex: 2,
                          minWidth: 260,
                          listStyle: "none",
                          padding: "var(--space-1)",
                          margin: 0,
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius-sm)",
                          background: "var(--bg)",
                          boxShadow: "var(--shadow-md)",
                        }}
                      >
                        {CANNED.map((c) => (
                          <li key={c}>
                            <button
                              type="button"
                              onClick={() => {
                                setReply((r) => (r ? `${r}\n${c}` : c));
                                setCannedOpen(false);
                              }}
                              style={{
                                width: "100%",
                                textAlign: "left",
                                padding: "var(--space-1h) var(--space-2)",
                                border: 0,
                                background: "transparent",
                                color: "var(--fg)",
                                fontSize: "var(--fs-sm)",
                                cursor: "pointer",
                                borderRadius: "var(--radius-xs)",
                              }}
                              onMouseEnter={(e) => {
                                (e.currentTarget.style.background =
                                  "var(--bg-hover)");
                              }}
                              onMouseLeave={(e) => {
                                (e.currentTarget.style.background = "transparent");
                              }}
                            >
                              {c}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <span className="demo-sectionbar__spacer" />
                  <span
                    style={{
                      fontSize: "var(--fs-10)",
                      color: "var(--fg-subtle)",
                    }}
                  >
                    {reply.length} characters
                  </span>
                  <button
                    type="button"
                    className="demo-btn demo-btn--primary"
                    style={{ padding: "0 var(--space-3)", height: 28 }}
                    aria-label="Send reply"
                    disabled={reply.trim().length === 0}
                  >
                    <Send size={12} strokeWidth={1.8} /> Send reply
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: sidebar */}
          <aside
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-3)",
              position: "sticky",
              top: "var(--space-3)",
            }}
          >
            <SidebarCard title="Details">
              <div>
                <KvRow
                  k="Status"
                  v={
                    <span className="demo-badge demo-badge--warn">
                      Awaiting reply
                    </span>
                  }
                />
                <KvRow
                  k="Priority"
                  v={<span className="demo-badge">Normal</span>}
                />
                <KvRow
                  k="Reporter"
                  v={<SidebarPerson name="Ada Lovelace" role="Acme Inc." />}
                />
                <KvRow
                  k="Agent"
                  v={<SidebarPerson name="Mei Zhang" role="Quanta support" />}
                />
                <KvRow k="Created" v="2026-04-18 09:22 KST" />
                <KvRow k="Last update" v="2 hours ago" />
                <div
                  style={{
                    paddingTop: "var(--space-2)",
                    fontSize: "var(--fs-xs)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ color: "var(--fg-subtle)" }}>SLA</span>
                    <span style={{ color: "var(--fg)" }}>4h remaining</span>
                  </div>
                  <div className="demo-progress demo-progress--accent">
                    <div className="demo-progress__bar">
                      <div
                        className="demo-progress__fill"
                        style={{ width: "40%" }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </SidebarCard>

            <SidebarCard
              title="Labels"
              action={
                !addingLabel && (
                  <button
                    type="button"
                    className="demo-btn demo-btn--ghost"
                    style={{
                      padding: "0 var(--space-1h)",
                      height: 22,
                      fontSize: "var(--fs-10)",
                    }}
                    onClick={() => setAddingLabel(true)}
                    aria-label="Add label"
                  >
                    <Plus size={10} strokeWidth={2} /> Add
                  </button>
                )
              }
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "var(--space-1h)",
                }}
              >
                {labels.map((l) => (
                  <span
                    key={l}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "2px var(--space-1h) 2px var(--space-2)",
                      borderRadius: "var(--radius-pill)",
                      background: "var(--bg-subtle)",
                      border: "1px solid var(--border)",
                      fontSize: "var(--fs-10)",
                      color: "var(--fg-muted)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {l}
                    <button
                      type="button"
                      onClick={() => removeLabel(l)}
                      aria-label={`Remove label ${l}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: 0,
                        background: "transparent",
                        color: "var(--fg-subtle)",
                        cursor: "pointer",
                        padding: 0,
                        width: 14,
                        height: 14,
                      }}
                    >
                      <X size={10} strokeWidth={2} />
                    </button>
                  </span>
                ))}
                {addingLabel && (
                  <input
                    autoFocus
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    onBlur={addLabel}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addLabel();
                      if (e.key === "Escape") {
                        setAddingLabel(false);
                        setNewLabel("");
                      }
                    }}
                    placeholder="new-label"
                    aria-label="New label"
                    style={{
                      border: "1px dashed var(--border-strong)",
                      borderRadius: "var(--radius-pill)",
                      padding: "2px var(--space-2)",
                      fontSize: "var(--fs-10)",
                      fontFamily: "var(--font-mono)",
                      outline: "none",
                      background: "var(--bg)",
                      color: "var(--fg)",
                      minWidth: 80,
                    }}
                  />
                )}
              </div>
            </SidebarCard>

            <SidebarCard title="Related tickets">
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {RELATED.map((r) => {
                  const isHover = hoverRelated === r.id;
                  return (
                    <li
                      key={r.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Open related ticket ${r.id}`}
                      onClick={() => nav.navigate("support.ticket")}
                      onMouseEnter={() => setHoverRelated(r.id)}
                      onMouseLeave={() => setHoverRelated(null)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") nav.navigate("support.ticket");
                      }}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 1fr) auto",
                        alignItems: "center",
                        gap: "var(--space-2)",
                        padding: "var(--space-1h)",
                        borderRadius: "var(--radius-sm)",
                        cursor: "pointer",
                        background: isHover ? "var(--bg-hover)" : undefined,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: "var(--fs-xs)",
                            fontWeight: "var(--fw-medium)",
                            color: "var(--fg)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {r.title}
                        </div>
                        <div
                          style={{
                            fontSize: "var(--fs-10)",
                            color: "var(--fg-subtle)",
                            fontFamily: "var(--font-mono)",
                          }}
                        >
                          {r.id}
                        </div>
                      </div>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <span
                          className={
                            r.status === "open"
                              ? "demo-badge demo-badge--accent"
                              : "demo-badge"
                          }
                          style={{ padding: "0 6px", height: 18, fontSize: 9 }}
                        >
                          {r.status === "open" ? "Open" : "Resolved"}
                        </span>
                        <ArrowRight
                          size={12}
                          strokeWidth={1.8}
                          style={{ color: "var(--fg-subtle)" }}
                        />
                      </span>
                    </li>
                  );
                })}
              </ul>
            </SidebarCard>
          </aside>
        </div>
      </div>
    </div>
  );
}
