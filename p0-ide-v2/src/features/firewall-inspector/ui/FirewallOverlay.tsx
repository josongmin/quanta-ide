import { useEffect, useState } from "react";
import { focusStore, useFocusStore } from "@/shared/model/focus-store";
import { toast } from "@/shared/model/toast-store";
import {
  firewallStore,
  useFirewallStore,
  PATTERN_DESCRIPTIONS,
  type ContextChunk,
  type FirewallStats,
  type TrustLevel,
} from "@/entities/firewall";
import "./firewall-overlay.css";

const TRUST_ORDER: TrustLevel[] = ["trusted", "semi-trusted", "untrusted", "tainted"];
const TRUST_LABEL: Record<TrustLevel, string> = {
  trusted: "trusted",
  "semi-trusted": "semi",
  untrusted: "untrusted",
  tainted: "tainted",
};
const SOURCE_GLYPH: Record<string, string> = {
  "user-prompt":  "U",
  "local-file":   "F",
  "local-doc":    "§",
  "engine-fact":  "E",
  "mcp-response": "M",
  "web-fetch":    "W",
  "paste":        "P",
  "tool-output":  "T",
};

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return String(n);
}

export function FirewallOverlay() {
  const open = useFocusStore((s) => s.firewallOpen);
  const chunks = useFirewallStore((s) => s.chunks);
  const [confirm, setConfirm] = useState<ContextChunk | null>(null);

  useEffect(() => {
    if (!open) setConfirm(null);
  }, [open]);

  if (!open) return null;

  const active = chunks.filter((c) => !c.dismissed);
  const stats: FirewallStats = {
    total: active.length,
    byTrust: active.reduce(
      (a, c) => ({ ...a, [c.trust]: a[c.trust] + 1 }),
      { trusted: 0, "semi-trusted": 0, untrusted: 0, tainted: 0 } as Record<TrustLevel, number>,
    ),
    byTrustTokens: active.reduce(
      (a, c) => ({ ...a, [c.trust]: a[c.trust] + c.tokens }),
      { trusted: 0, "semi-trusted": 0, untrusted: 0, tainted: 0 } as Record<TrustLevel, number>,
    ),
    suspicious: active.filter((c) => c.scan.suspicious).length,
    promoted: active.filter((c) => c.promoted).length,
  };
  const totalTokens = TRUST_ORDER.reduce((a, t) => a + stats.byTrustTokens[t], 0);

  function doPromote() {
    if (!confirm) return;
    firewallStore.promote(confirm.id);
    toast.success(
      "Chunk promoted to trusted",
      `${confirm.source.label} · now participates in agent decisions`,
      "firewall",
    );
    setConfirm(null);
  }
  function doDismiss(id: string) {
    firewallStore.dismiss(id);
    toast.warn("Chunk dismissed", "Removed from context window", "firewall");
  }

  return (
    <>
      <div className="fwov" role="dialog" aria-modal="true" aria-label="Prompt injection firewall">
        <div className="fwov__scrim" onClick={() => focusStore.toggleFirewall(false)} aria-hidden />
        <div className="fwov__panel">
          <header className="fwov__head">
            <span className="fwov__kicker">Firewall</span>
            <span className="fwov__title">context provenance · session</span>
            <span className="fwov__right">
              {stats.total} chunks · {fmt(totalTokens)} tok
              {stats.suspicious > 0 && (
                <span className="fwov__suspicious">· {stats.suspicious} suspicious</span>
              )}
            </span>
            <button
              type="button"
              className="fwov__close"
              aria-label="Close"
              onClick={() => focusStore.toggleFirewall(false)}
            >×</button>
          </header>

          <div className="fwov__body">
            {stats.suspicious > 0 && (
              <div className="fw-alert">
                <span className="fw-alert__icon" aria-hidden>⚠</span>
                <span className="fw-alert__body">
                  <strong>{stats.suspicious}</strong> untrusted chunk{stats.suspicious > 1 ? "s" : ""} matched injection patterns.
                  Confirm required before the agent may act on them.
                </span>
              </div>
            )}

            <div className="fw-dist">
              <div className="fw-dist__label">Trust distribution</div>
              <div className="fw-dist__bar" aria-hidden>
                {(() => {
                  let left = 0;
                  return TRUST_ORDER.map((t) => {
                    const tok = stats.byTrustTokens[t];
                    const pct = totalTokens > 0 ? (tok / totalTokens) * 100 : 0;
                    const l = left;
                    left += pct;
                    return (
                      <span
                        key={t}
                        className={`fw-dist__seg fw-dist__seg--${t.replace("-", "")}`}
                        style={{ left: `${l}%`, width: `${pct}%` }}
                        title={`${t} · ${stats.byTrust[t]} chunks · ${fmt(tok)} tok`}
                      />
                    );
                  });
                })()}
              </div>
              <div className="fw-dist__legend">
                {TRUST_ORDER.map((t) => (
                  <span key={t} className={`fw-dist__chip fw-dist__chip--${t.replace("-", "")}`}>
                    <span className="fw-dist__dot" aria-hidden />
                    <span className="fw-dist__chip-label">{TRUST_LABEL[t]}</span>
                    <span className="fw-dist__chip-count">{stats.byTrust[t]}</span>
                    <span className="fw-dist__chip-tok">{fmt(stats.byTrustTokens[t])}</span>
                  </span>
                ))}
              </div>
            </div>

            <div className="fw-list-h">
              <span className="fw-list-h__label">Chunks</span>
              <span className="fw-list-h__count">{active.length}</span>
            </div>
            <ul className="fw-list">
              {active.map((c) => (
                <FirewallChunkRow
                  key={c.id}
                  chunk={c}
                  onPromote={setConfirm}
                  onDismiss={doDismiss}
                />
              ))}
            </ul>
          </div>

          <footer className="fw-foot">
            <span className="fw-foot__hint">
              <span className="symtip__kbd">Esc</span> dismiss
              <span className="symtip__kbd">⌘⇧F</span> toggle
            </span>
          </footer>
        </div>
      </div>

      {confirm && (
        <PromoteConfirmModal
          chunk={confirm}
          onConfirm={doPromote}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}

function FirewallChunkRow({
  chunk,
  onPromote,
  onDismiss,
}: {
  chunk: ContextChunk;
  onPromote: (c: ContextChunk) => void;
  onDismiss: (id: string) => void;
}) {
  const suspicious = chunk.scan.suspicious;
  return (
    <li
      className={[
        "fw-row",
        `fw-row--${chunk.trust.replace("-", "")}`,
        suspicious ? "is-suspicious" : "",
        chunk.promoted ? "is-promoted" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="fw-row__glyph" aria-hidden>
        {SOURCE_GLYPH[chunk.source.kind] ?? "?"}
      </span>
      <div className="fw-row__body">
        <div className="fw-row__head">
          <span className="fw-row__label" title={chunk.source.label}>
            {chunk.source.label}
          </span>
          <span className={`fw-row__trust fw-row__trust--${chunk.trust.replace("-", "")}`}>
            {TRUST_LABEL[chunk.trust]}
          </span>
          {chunk.promoted && <span className="fw-row__promoted">promoted</span>}
          {chunk.source.verified && <span className="fw-row__verified">verified</span>}
        </div>
        <div className="fw-row__meta">
          <span className="fw-row__turn">t{chunk.turn}</span>
          <span className="fw-row__sep">·</span>
          <span className="fw-row__kind">{chunk.source.kind}</span>
          <span className="fw-row__sep">·</span>
          <span className="fw-row__tok">{fmt(chunk.tokens)} tok</span>
          {chunk.used ? (
            <>
              <span className="fw-row__sep">·</span>
              <span className="fw-row__used">used</span>
            </>
          ) : null}
        </div>
        {suspicious && (
          <div className="fw-row__scan">
            {chunk.scan.hits.map((h) => (
              <span
                key={h.patternId}
                className="fw-row__hit"
                title={PATTERN_DESCRIPTIONS[h.patternId]}
              >
                <span className="fw-row__hit-id">{h.patternId}</span>
                <span className="fw-row__hit-conf">{(h.confidence * 100).toFixed(0)}%</span>
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="fw-row__actions">
        {chunk.trust === "tainted" && !chunk.promoted && (
          <button type="button" className="fw-row__btn fw-row__btn--primary" onClick={() => onPromote(chunk)}>
            Promote →
          </button>
        )}
        {chunk.trust === "untrusted" && (
          <button type="button" className="fw-row__btn" onClick={() => onPromote(chunk)}>
            Confirm
          </button>
        )}
        <button type="button" className="fw-row__btn fw-row__btn--ghost" onClick={() => onDismiss(chunk.id)}>
          Drop
        </button>
      </div>
    </li>
  );
}

function PromoteConfirmModal({
  chunk,
  onConfirm,
  onCancel,
}: {
  chunk: ContextChunk;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCancel();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onCancel]);

  return (
    <div className="fw-confirm" role="dialog" aria-label="Firewall confirm">
      <div className="fw-confirm__scrim" onClick={onCancel} aria-hidden />
      <div className="fw-confirm__panel">
        <header className="fw-confirm__head">
          <span className="fw-confirm__kicker">Firewall · promote</span>
          <span className="fw-confirm__title">Use untrusted context in agent decisions?</span>
          <button type="button" className="fw-confirm__close" onClick={onCancel} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="fw-confirm__body">
          <dl className="fw-confirm__meta">
            <div className="fw-confirm__row"><dt>Source</dt><dd>{chunk.source.label}</dd></div>
            <div className="fw-confirm__row"><dt>Kind</dt><dd><code>{chunk.source.kind}</code></dd></div>
            <div className="fw-confirm__row">
              <dt>Trust</dt>
              <dd>
                <span className={`fw-row__trust fw-row__trust--${chunk.trust.replace("-", "")}`}>
                  {TRUST_LABEL[chunk.trust]}
                </span>
              </dd>
            </div>
            <div className="fw-confirm__row"><dt>Tokens</dt><dd>{fmt(chunk.tokens)}</dd></div>
          </dl>

          {chunk.scan.suspicious && (
            <div className="fw-confirm__scan">
              <div className="fw-confirm__scan-h">Scanner hits</div>
              <ul className="fw-confirm__scan-list">
                {chunk.scan.hits.map((h) => (
                  <li key={h.patternId} className="fw-confirm__scan-row">
                    <span className="fw-confirm__scan-id">{h.patternId}</span>
                    <span className="fw-confirm__scan-desc">{PATTERN_DESCRIPTIONS[h.patternId]}</span>
                    <span className="fw-confirm__scan-conf">{(h.confidence * 100).toFixed(0)}%</span>
                    {h.excerpt && <span className="fw-confirm__scan-excerpt">"{h.excerpt}"</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="fw-confirm__preview">
            <div className="fw-confirm__preview-h">Preview</div>
            <pre className="fw-confirm__preview-body">{chunk.preview}</pre>
          </div>
        </div>
        <footer className="fw-confirm__foot">
          <span className="fw-confirm__hint">
            <kbd>Esc</kbd> cancel
          </span>
          <div className="fw-confirm__actions">
            <button type="button" className="btn btn--ghost" onClick={onCancel}>Deny</button>
            <button type="button" className="btn btn--primary" onClick={onConfirm}>
              Allow &amp; promote
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
