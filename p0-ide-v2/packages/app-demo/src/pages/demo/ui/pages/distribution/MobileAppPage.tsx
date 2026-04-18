import type { CSSProperties, ReactNode } from "react";
import {
  Apple,
  Play,
  Bell,
  MessageSquare,
  Check,
  Zap,
  Fingerprint,
  Wifi,
  Smartphone,
  Download,
} from "lucide-react";
import { DemoAppHero } from "../../internal/DemoAppHero";

interface Feature {
  icon: typeof Bell;
  title: string;
  blurb: string;
}

const FEATURES: Feature[] = [
  {
    icon: Bell,
    title: "Push for violations",
    blurb: "Only the ones you own. Policy severity routed to notification channel of your choice.",
  },
  {
    icon: MessageSquare,
    title: "Chat with the agent",
    blurb: "Full conversation memory, code blocks, and symbol references — same agent as the desktop app.",
  },
  {
    icon: Check,
    title: "Approve PRs anywhere",
    blurb: "Review diffs, request changes, or approve — Quanta pre-summarizes the blast radius for you.",
  },
  {
    icon: Zap,
    title: "Instant cold start",
    blurb: "Opens in under 400ms. Pre-hydrates your most-viewed workspace on launch.",
  },
  {
    icon: Fingerprint,
    title: "Face ID / fingerprint",
    blurb: "Unlock with biometrics. Session tokens pinned to device, revocable from the admin console.",
  },
  {
    icon: Wifi,
    title: "Offline sync",
    blurb: "Triage last-seen findings on the subway. Actions flush the moment you're back online.",
  },
];

type SkeletonOpts = {
  width: string | number;
  height: number;
  opacity?: number;
  radius?: number;
  marginTop?: number;
};

function Skel({ width, height, opacity = 1, radius = 6, marginTop }: SkeletonOpts) {
  return (
    <div
      aria-hidden="true"
      style={{
        width,
        height,
        background: "var(--bg-muted)",
        borderRadius: radius,
        opacity,
        marginTop,
      }}
    />
  );
}

interface PhoneProps {
  width?: number;
  height?: number;
  children: ReactNode;
}

function PhoneFrame({ width = 240, height = 480, children }: PhoneProps) {
  const padding = width < 200 ? 7 : 10;
  const notchWidth = width < 200 ? 78 : 100;
  return (
    <div
      style={{
        width,
        height,
        margin: "0 auto",
        background: "var(--fg)",
        borderRadius: width < 200 ? 28 : 36,
        padding,
        boxShadow: "var(--shadow-md)",
        flex: "0 0 auto",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "var(--bg)",
          borderRadius: width < 200 ? 22 : 28,
          padding: "var(--space-3)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-2)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Notch */}
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 6,
            left: "50%",
            transform: "translateX(-50%)",
            width: notchWidth,
            height: 18,
            background: "var(--fg)",
            borderRadius: "0 0 14px 14px",
          }}
        />
        {/* Status bar (leaves room for notch) */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 8,
            color: "var(--fg-subtle)",
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.04em",
            paddingTop: 2,
            marginBottom: "var(--space-2)",
          }}
        >
          <span>9:41</span>
          <span>•••</span>
        </div>
        {children}
      </div>
    </div>
  );
}

function PrimaryPhone() {
  return (
    <PhoneFrame>
      {/* App header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-1h)",
          marginTop: 8,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 22,
            height: 22,
            background: "var(--fg)",
            color: "var(--bg)",
            borderRadius: "var(--radius-sm)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "var(--fw-bold)",
            fontSize: 11,
            letterSpacing: "-0.02em",
          }}
        >
          q
        </span>
        <span
          style={{
            fontSize: "var(--fs-xs)",
            fontWeight: "var(--fw-semibold)",
            color: "var(--fg)",
          }}
        >
          Inbox
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 9,
            color: "var(--fg-subtle)",
            fontFamily: "var(--font-mono)",
            padding: "1px 6px",
            borderRadius: 999,
            background: "var(--bg-muted)",
          }}
        >
          12
        </span>
      </div>

      {/* Filter chips */}
      <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
        <span
          style={{
            fontSize: 8,
            background: "var(--fg)",
            color: "var(--bg)",
            padding: "2px 6px",
            borderRadius: 999,
            fontWeight: "var(--fw-semibold)",
          }}
        >
          For you
        </span>
        <span
          style={{
            fontSize: 8,
            background: "var(--bg-subtle)",
            color: "var(--fg-muted)",
            padding: "2px 6px",
            borderRadius: 999,
          }}
        >
          Mentions
        </span>
        <span
          style={{
            fontSize: 8,
            background: "var(--bg-subtle)",
            color: "var(--fg-muted)",
            padding: "2px 6px",
            borderRadius: 999,
          }}
        >
          Alerts
        </span>
      </div>

      {/* List rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
        {[
          { title: "PR #2184 · reviewer assigned", body: "acme/core-api · blast radius 17", time: "2m", tone: "var(--warn)" as string },
          { title: "Policy: no-cross-module-imports", body: "Blocked on src/router.ts:142",     time: "9m", tone: "var(--danger)" as string },
          { title: "Ada replied in review",         body: "\u201CLGTM once the type narrows.\u201D",    time: "22m", tone: "var(--accent)" as string },
          { title: "Analysis completed",            body: "risk 0.42 · 48 symbols touched",    time: "1h", tone: "var(--success)" as string },
        ].map((r) => (
          <div
            key={r.title}
            style={{
              display: "grid",
              gridTemplateColumns: "18px 1fr auto",
              gap: 6,
              alignItems: "center",
              padding: "6px 8px",
              background: "var(--bg-subtle)",
              borderRadius: 8,
            }}
          >
            <span
              aria-hidden="true"
              style={{ width: 6, height: 6, borderRadius: "50%", background: r.tone }}
            />
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: "var(--fw-semibold)",
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
                  fontSize: 8,
                  color: "var(--fg-subtle)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {r.body}
              </div>
            </div>
            <span
              style={{
                fontSize: 8,
                color: "var(--fg-subtle)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {r.time}
            </span>
          </div>
        ))}
      </div>

      {/* Bottom tab bar */}
      <div
        style={{
          marginTop: "auto",
          display: "flex",
          justifyContent: "space-around",
          padding: "8px 0 4px",
          borderTop: "1px solid var(--border)",
        }}
      >
        {[Bell, MessageSquare, Check, Smartphone].map((Ic, i) => (
          <span
            key={i}
            style={{ color: i === 0 ? "var(--fg)" : "var(--fg-subtle)" }}
            aria-hidden="true"
          >
            <Ic size={14} strokeWidth={1.8} />
          </span>
        ))}
      </div>
    </PhoneFrame>
  );
}

interface MiniPhoneProps {
  caption: string;
  children: ReactNode;
}

function MiniPhoneTile({ caption, children }: MiniPhoneProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--space-2)",
        minWidth: 180,
        flex: "0 0 auto",
      }}
    >
      <PhoneFrame width={180} height={360}>
        {children}
      </PhoneFrame>
      <div
        style={{
          fontSize: "var(--fs-10)",
          color: "var(--fg-subtle)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          fontWeight: "var(--fw-semibold)",
          textAlign: "center",
        }}
      >
        {caption}
      </div>
    </div>
  );
}

const STORE_BTN_STYLE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 16px",
  height: 52,
  background: "var(--fg)",
  color: "var(--bg)",
  border: "1px solid var(--fg)",
  borderRadius: 12,
  cursor: "pointer",
  font: "inherit",
  transition: "transform 0.14s ease, opacity 0.14s ease",
};

function AppStoreButton() {
  return (
    <button type="button" style={STORE_BTN_STYLE} aria-label="Download on the App Store">
      <Apple size={26} strokeWidth={1.6} aria-hidden="true" style={{ fill: "var(--bg)" }} />
      <span style={{ textAlign: "left", lineHeight: 1.1 }}>
        <span style={{ display: "block", fontSize: 9, letterSpacing: "0.04em", opacity: 0.8 }}>
          Download on the
        </span>
        <span style={{ display: "block", fontSize: 16, fontWeight: "var(--fw-semibold)", letterSpacing: "-0.01em" }}>
          App Store
        </span>
      </span>
    </button>
  );
}

function PlayStoreButton() {
  return (
    <button type="button" style={STORE_BTN_STYLE} aria-label="Get it on Google Play">
      <Play size={24} strokeWidth={1.4} aria-hidden="true" style={{ fill: "var(--bg)" }} />
      <span style={{ textAlign: "left", lineHeight: 1.1 }}>
        <span style={{ display: "block", fontSize: 9, letterSpacing: "0.08em", opacity: 0.8, textTransform: "uppercase" }}>
          Get it on
        </span>
        <span style={{ display: "block", fontSize: 16, fontWeight: "var(--fw-semibold)", letterSpacing: "-0.01em" }}>
          Google Play
        </span>
      </span>
    </button>
  );
}

function FakeQr() {
  // Deterministic-looking QR: 8x8 grid with anchor squares in 3 corners.
  const cells = Array.from({ length: 64 }, (_, i) => {
    const row = Math.floor(i / 8);
    const col = i % 8;
    const isCorner =
      (row < 3 && col < 3) ||
      (row < 3 && col > 4) ||
      (row > 4 && col < 3);
    const anchor = isCorner && (row === 0 || row === 2 || col === 0 || col === 2 || (row === 7 && col === 7));
    const hash = Math.sin(i * 1.7 + row * 0.3) > 0 || isCorner;
    return (
      <span
        key={i}
        aria-hidden="true"
        style={{ background: anchor || hash ? "var(--fg)" : "var(--bg)" }}
      />
    );
  });
  return (
    <div
      style={{
        width: 96,
        height: 96,
        background: "var(--bg)",
        border: "1px solid var(--border)",
        display: "grid",
        gridTemplateColumns: "repeat(8, 1fr)",
        flex: "0 0 auto",
      }}
    >
      {cells}
    </div>
  );
}

export function MobileAppPage() {
  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="Distribution"
        title="Quanta on the go"
        sub="Triage violations, approve PRs, and chat with the agent from your phone. iOS and Android, synced."
      />
      <div className="demo-app__body">
        {/* Hero split */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 360px",
            gap: "var(--space-6)",
            marginBottom: "var(--space-6)",
            alignItems: "start",
          }}
        >
          {/* Left: pitch + download */}
          <section>
            <h2
              style={{
                fontSize: "var(--fs-2xl)",
                fontWeight: 800,
                letterSpacing: "-0.02em",
                margin: 0,
                lineHeight: "var(--lh-tight)",
              }}
            >
              Your workspace, in your pocket.
            </h2>
            <p
              style={{
                color: "var(--fg-muted)",
                fontSize: "var(--fs-sm)",
                lineHeight: "var(--lh-relaxed)",
                maxWidth: 520,
                marginTop: "var(--space-3)",
              }}
            >
              Push notifications for policy violations. Approve reviews from the line at the coffee
              shop. Chat with the agent while you walk. Same auth, same workspace, same agent state —
              synced every 10 seconds.
            </p>

            <div
              style={{
                display: "flex",
                gap: "var(--space-3)",
                marginTop: "var(--space-4)",
                flexWrap: "wrap",
              }}
            >
              <AppStoreButton />
              <PlayStoreButton />
            </div>

            {/* QR */}
            <div
              style={{
                marginTop: "var(--space-4)",
                padding: "var(--space-3)",
                background: "var(--bg-subtle)",
                border: "1px dashed var(--border)",
                borderRadius: "var(--radius-md)",
                display: "flex",
                alignItems: "center",
                gap: "var(--space-3)",
                maxWidth: 420,
              }}
            >
              <FakeQr />
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "var(--fs-xs)",
                    fontWeight: "var(--fw-semibold)",
                    color: "var(--fg)",
                  }}
                >
                  Scan to install
                </div>
                <div
                  style={{
                    fontSize: "var(--fs-10)",
                    color: "var(--fg-subtle)",
                    marginTop: 2,
                    lineHeight: "var(--lh-relaxed)",
                  }}
                >
                  Auto-detects iOS or Android. Opens the right store.
                </div>
                <div
                  style={{
                    marginTop: "var(--space-1h)",
                    fontSize: "var(--fs-10)",
                    fontFamily: "var(--font-mono)",
                    color: "var(--fg-muted)",
                    letterSpacing: "0.04em",
                  }}
                >
                  quanta.dev/mobile
                </div>
              </div>
            </div>

            {/* Small meta stats */}
            <div
              style={{
                display: "flex",
                gap: "var(--space-5)",
                marginTop: "var(--space-4)",
                fontSize: "var(--fs-10)",
                color: "var(--fg-subtle)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                fontWeight: "var(--fw-semibold)",
              }}
            >
              <span>4.8 ★ on App Store</span>
              <span>4.7 ★ on Play</span>
              <span>12+ / Everyone</span>
            </div>
          </section>

          {/* Right: phone mockup */}
          <aside>
            <PrimaryPhone />
          </aside>
        </div>

        {/* Features grid */}
        <div className="demo-sectionbar">
          <span className="demo-sectionbar__title">Every workflow you use on desktop</span>
          <span className="demo-sectionbar__desc">Just smaller. And quieter.</span>
        </div>
        <div className="demo-grid-3" style={{ marginBottom: "var(--space-6)" }}>
          {FEATURES.map((f) => {
            const Ic = f.icon;
            return (
              <div key={f.title} className="demo-catalog__card" style={{ cursor: "default" }}>
                <div className="demo-catalog__card-head">
                  <span className="demo-catalog__card-icon">
                    <Ic size={15} strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <span className="demo-catalog__card-cat">feature</span>
                </div>
                <div className="demo-catalog__card-title">{f.title}</div>
                <div className="demo-catalog__card-blurb">{f.blurb}</div>
              </div>
            );
          })}
        </div>

        {/* Screenshots strip */}
        <div className="demo-sectionbar">
          <span className="demo-sectionbar__title">Screenshots</span>
          <span className="demo-sectionbar__desc">A peek at the three most-used views</span>
        </div>
        <div
          style={{
            display: "flex",
            gap: "var(--space-4)",
            padding: "var(--space-4) var(--space-2)",
            overflowX: "auto",
            marginBottom: "var(--space-6)",
          }}
        >
          <MiniPhoneTile caption="01 · Inbox">
            <Skel width="55%" height={10} marginTop={10} />
            <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
              <Skel width={36} height={14} radius={999} />
              <Skel width={44} height={14} radius={999} opacity={0.6} />
              <Skel width={34} height={14} radius={999} opacity={0.6} />
            </div>
            {[0.9, 0.8, 0.7, 0.6, 0.5, 0.4].map((o, i) => (
              <div
                key={i}
                style={{
                  marginTop: 8,
                  padding: 6,
                  borderRadius: 6,
                  background: "var(--bg-subtle)",
                  display: "grid",
                  gridTemplateColumns: "12px 1fr 20px",
                  alignItems: "center",
                  gap: 5,
                  opacity: o,
                }}
              >
                <Skel width={6} height={6} radius={999} />
                <div>
                  <Skel width="80%" height={6} />
                  <Skel width="55%" height={4} marginTop={3} opacity={0.7} />
                </div>
                <Skel width={18} height={4} opacity={0.6} />
              </div>
            ))}
          </MiniPhoneTile>

          <MiniPhoneTile caption="02 · Code review">
            <Skel width="40%" height={10} marginTop={10} />
            <Skel width="70%" height={6} marginTop={4} opacity={0.6} />
            <div
              style={{
                marginTop: 8,
                padding: 6,
                borderRadius: 6,
                background: "#0a0a0a",
                color: "#e4e4e4",
                fontFamily: "var(--font-mono)",
                fontSize: 7,
                lineHeight: 1.6,
                height: 160,
                overflow: "hidden",
              }}
            >
              <div>@@ -142,4 +142,7 @@</div>
              <div style={{ color: "#ff8080" }}>- return db.users.find(id)</div>
              <div style={{ color: "#80ffa0" }}>+ const u = await db.users.find(id)</div>
              <div style={{ color: "#80ffa0" }}>+ if (!u) throw new NotFound();</div>
              <div style={{ color: "#80ffa0" }}>+ return u;</div>
              <div style={{ opacity: 0.5 }}>... 14 symbols touched</div>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <div
                style={{
                  flex: 1,
                  textAlign: "center",
                  padding: "4px 0",
                  borderRadius: 6,
                  background: "var(--bg-muted)",
                  fontSize: 8,
                  fontWeight: "var(--fw-semibold)",
                  color: "var(--fg-muted)",
                }}
              >
                Request
              </div>
              <div
                style={{
                  flex: 1,
                  textAlign: "center",
                  padding: "4px 0",
                  borderRadius: 6,
                  background: "var(--fg)",
                  color: "var(--bg)",
                  fontSize: 8,
                  fontWeight: "var(--fw-bold)",
                }}
              >
                Approve
              </div>
            </div>
          </MiniPhoneTile>

          <MiniPhoneTile caption="03 · Agent chat">
            <Skel width="35%" height={10} marginTop={10} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
              <div
                style={{
                  alignSelf: "flex-end",
                  maxWidth: "80%",
                  background: "var(--fg)",
                  color: "var(--bg)",
                  fontSize: 7,
                  padding: "5px 7px",
                  borderRadius: "8px 8px 2px 8px",
                  lineHeight: 1.4,
                }}
              >
                Why is risk.score slow on main?
              </div>
              <div
                style={{
                  alignSelf: "flex-start",
                  maxWidth: "85%",
                  background: "var(--bg-subtle)",
                  color: "var(--fg)",
                  fontSize: 7,
                  padding: "5px 7px",
                  borderRadius: "8px 8px 8px 2px",
                  lineHeight: 1.4,
                }}
              >
                The blast-radius pass hit a large dependency cycle in
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}> core/db.ts</span>.
                I can propose a cut-set.
              </div>
              <div
                style={{
                  alignSelf: "flex-start",
                  maxWidth: "80%",
                  background: "var(--bg-subtle)",
                  color: "var(--fg-muted)",
                  fontSize: 7,
                  padding: "5px 7px",
                  borderRadius: "8px 8px 8px 2px",
                  fontStyle: "italic",
                }}
              >
                typing…
              </div>
            </div>
            <div
              style={{
                marginTop: "auto",
                padding: "5px 7px",
                background: "var(--bg-subtle)",
                borderRadius: 999,
                fontSize: 7,
                color: "var(--fg-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>Ask a question…</span>
              <span style={{ color: "var(--fg)", fontWeight: "var(--fw-bold)" }}>⇧</span>
            </div>
          </MiniPhoneTile>

          <MiniPhoneTile caption="04 · Offline mode">
            <Skel width="50%" height={10} marginTop={10} />
            <div
              style={{
                marginTop: 10,
                padding: 8,
                background: "var(--bg-warn-subtle)",
                border: "1px dashed var(--border-warn-subtle)",
                borderRadius: 6,
                fontSize: 8,
                color: "var(--fg)",
                lineHeight: 1.4,
              }}
            >
              <strong>You are offline.</strong> Last sync 2m ago. Actions queued locally.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 8, opacity: 0.7 }}>
              <Skel width="100%" height={22} />
              <Skel width="100%" height={22} />
              <Skel width="100%" height={22} />
            </div>
            <div
              style={{
                marginTop: "auto",
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 8,
                color: "var(--fg-subtle)",
              }}
            >
              <Wifi size={9} strokeWidth={2} aria-hidden="true" /> 3 actions will flush on reconnect
            </div>
          </MiniPhoneTile>
        </div>

        {/* Beta program */}
        <div
          style={{
            padding: "var(--space-5)",
            background: "var(--bg-accent-subtle)",
            border: "1px solid var(--border-accent-subtle)",
            borderRadius: "var(--radius-lg)",
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: "var(--space-5)",
            alignItems: "center",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "var(--fs-10)",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                fontWeight: "var(--fw-bold)",
                color: "var(--accent)",
                marginBottom: "var(--space-1)",
              }}
            >
              Beta program
            </div>
            <h3
              style={{
                margin: 0,
                fontSize: "var(--fs-lg)",
                fontWeight: "var(--fw-semibold)",
                letterSpacing: "-0.01em",
              }}
            >
              Run the next version 2 weeks early.
            </h3>
            <p
              style={{
                margin: "var(--space-1h) 0 0 0",
                fontSize: "var(--fs-xs)",
                color: "var(--fg-muted)",
                lineHeight: "var(--lh-relaxed)",
                maxWidth: 520,
              }}
            >
              Join the TestFlight or Play Beta track. Early builds include agent voice mode, repo
              bookmarks, and CarPlay / Android Auto briefings. Opt out any time.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <button
              type="button"
              className="demo-btn demo-btn--ghost"
              style={{ display: "inline-flex", gap: 6, justifyContent: "center" }}
            >
              <Apple size={13} strokeWidth={1.8} aria-hidden="true" /> Join TestFlight
            </button>
            <button
              type="button"
              className="demo-btn demo-btn--ghost"
              style={{ display: "inline-flex", gap: 6, justifyContent: "center" }}
            >
              <Download size={13} strokeWidth={1.8} aria-hidden="true" /> Join Play Beta
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
