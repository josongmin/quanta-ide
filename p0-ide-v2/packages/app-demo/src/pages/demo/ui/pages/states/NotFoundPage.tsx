import { SearchX, Home, ArrowRight } from "lucide-react";
import { Brand } from "../../internal/Brand";
import { useDemoNav } from "../../DemoPage";

interface Destination { label: string; target: string; }

const POPULAR: Destination[] = [
  { label: "Pricing",      target: "billing.pricing" },
  { label: "Help center",  target: "legal.help" },
  { label: "Status page",  target: "legal.status" },
  { label: "Log in",       target: "auth.login" },
];

export function NotFoundPage() {
  const nav = useDemoNav();
  return (
    <>
      <Brand />
      <div className="demo-card">
        <div
          style={{
            width: 44, height: 44, borderRadius: 999,
            background: "var(--bg-subtle)", color: "var(--fg-subtle)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            marginBottom: 12,
          }}
        >
          <SearchX size={22} strokeWidth={1.8} />
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 32,
            fontWeight: 600,
            letterSpacing: "0.02em",
            color: "var(--fg-subtle)",
            marginBottom: 4,
          }}
        >
          404
        </div>
        <h1 className="demo-card__title">Page not found</h1>
        <p className="demo-card__sub">
          The page you&apos;re looking for may have been moved, renamed, or it might be private. Double-check
          the URL, or head back to somewhere familiar.
        </p>

        <div className="demo-form">
          <button
            className="demo-btn demo-btn--primary demo-btn--block"
            type="button"
            onClick={() => nav.navigate("catalog")}
          >
            <Home size={14} strokeWidth={1.8} /> Back to home
          </button>
          <button className="demo-btn demo-btn--ghost demo-btn--block" type="button">
            Report a broken link
          </button>
        </div>

        <div style={{ marginTop: 20 }}>
          <div
            style={{
              fontSize: "var(--fs-10)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--fg-subtle)",
              marginBottom: 8,
            }}
          >
            Popular destinations
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 4 }}>
            {POPULAR.map((d) => (
              <li key={d.target}>
                <button
                  className="demo-link"
                  type="button"
                  onClick={() => nav.navigate(d.target)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  {d.label} <ArrowRight size={12} strokeWidth={1.8} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p style={{ marginTop: 24, fontSize: "var(--fs-10)", color: "var(--fg-subtle)", letterSpacing: "0.06em" }}>
        Error code: <span style={{ fontFamily: "var(--font-mono)" }}>404 NOT_FOUND</span>
      </p>
    </>
  );
}
