import {
  PATTERN_DESCRIPTIONS,
  type ContextChunk,
} from "@quanta/app-ide/entities/firewall";
import { SOURCE_GLYPH, TRUST_LABEL, fmt } from "./firewall-overlay.utils";

interface FirewallChunkRowProps {
  chunk: ContextChunk;
  onPromote: (c: ContextChunk) => void;
  onDismiss: (id: string) => void;
}

export function FirewallChunkRow({
  chunk,
  onPromote,
  onDismiss,
}: FirewallChunkRowProps) {
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
