import { ServerCrash, RefreshCw, Activity } from "lucide-react";
import { Brand } from "../../internal/Brand";
import { useDemoNav } from "../../DemoPage";

export function ServerErrorPage() {
  const nav = useDemoNav();
  const incidentId = "INC-2026-04-19-abc123";
  return (
    <>
      <Brand />
      <div className="demo-card">
        <div
          style={{
            width: 44, height: 44, borderRadius: 999,
            background: "var(--bg-danger-subtle)", color: "var(--danger)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            marginBottom: 12,
          }}
        >
          <ServerCrash size={22} strokeWidth={1.8} />
        </div>
        <h1 className="demo-card__title">Something broke on our end</h1>
        <p className="demo-card__sub">
          We&apos;ve been notified and are on it. This usually resolves in a few minutes — feel free to retry,
          or check the status page for live updates.
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            padding: "8px 12px",
            borderRadius: "var(--radius-sm)",
            background: "var(--bg-subtle)",
            border: "1px solid var(--border-subtle)",
            marginBottom: 12,
          }}
        >
          <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-subtle)" }}>Incident ID</span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--fs-xs)",
              color: "var(--fg)",
            }}
          >
            {incidentId}
          </span>
        </div>

        <div className="demo-form">
          <button className="demo-btn demo-btn--primary demo-btn--block" type="button">
            <RefreshCw size={14} strokeWidth={1.8} /> Try again
          </button>
          <button
            className="demo-btn demo-btn--ghost demo-btn--block"
            type="button"
            onClick={() => nav.navigate("legal.status")}
          >
            <Activity size={14} strokeWidth={1.8} /> Check status page
          </button>
        </div>

        <p
          style={{
            marginTop: 16,
            fontSize: "var(--fs-xs)",
            color: "var(--fg-subtle)",
            textAlign: "center",
          }}
        >
          If the problem persists, contact{" "}
          <span style={{ fontFamily: "var(--font-mono)", color: "var(--fg)" }}>support@quanta.dev</span>
        </p>
      </div>

      <p style={{ marginTop: 24, fontSize: "var(--fs-10)", color: "var(--fg-subtle)", letterSpacing: "0.06em" }}>
        Error code: <span style={{ fontFamily: "var(--font-mono)" }}>500 INTERNAL_SERVER_ERROR</span>
      </p>
    </>
  );
}
