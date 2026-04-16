import type { ReactNode } from "react";
import { attentionItems, type AttentionItem, type AttentionKind } from "../../lib/home-picker.mock";

const ICON: Record<AttentionKind, () => ReactNode> = {
  violation: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  "review-request": () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  "ci-failure": () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
  security: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  mention: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" />
    </svg>
  ),
};

const URGENCY_CLS: Record<string, string> = {
  high: "hp__attn-item--high",
  medium: "hp__attn-item--medium",
  low: "hp__attn-item--low",
};

const KIND_LABEL: Record<AttentionKind, string> = {
  violation: "Violation",
  "review-request": "Review",
  "ci-failure": "CI",
  security: "Security",
  mention: "Mention",
};

export function AttentionQueue() {
  return (
    <section className="hp__panel">
      <div className="hp__panel-head">
        <span className="hp__panel-label">Needs attention</span>
        <span className="hp__panel-count">{attentionItems.length}</span>
      </div>
      <ul className="hp__attn-list">
        {attentionItems.map((item) => (
          <AttentionRow key={item.id} item={item} />
        ))}
      </ul>
    </section>
  );
}

function AttentionRow({ item }: { item: AttentionItem }) {
  const Icon = ICON[item.kind];
  return (
    <li className={`hp__attn-item ${URGENCY_CLS[item.urgency]}`} tabIndex={0}>
      <span className={`hp__attn-icon hp__attn-icon--${item.kind}`} aria-hidden>
        <Icon />
      </span>
      <span className="hp__attn-body">
        <span className="hp__attn-title">{item.title}</span>
        <span className="hp__attn-meta">
          <span className="hp__attn-kind">{KIND_LABEL[item.kind]}</span>
          <span className="hp__attn-sep" aria-hidden>&middot;</span>
          <span>{item.repo}</span>
          <span className="hp__attn-sep" aria-hidden>&middot;</span>
          <span>{item.time}</span>
        </span>
      </span>
    </li>
  );
}
