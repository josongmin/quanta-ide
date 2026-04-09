import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useEscapeKey } from "@/shared/hooks";
import { useRepoSelection } from "@/shared/hooks/useRepoSelection";
import { REPOS, REPO_NAMES, type RepoName } from "@/entities/repo";
import { CircuitCanvas } from "./CircuitCanvas";
import { CountUp } from "@/shared/ui";
import { getSignalTooltip } from "../model/signal-tooltips";
import { crossfade, EASE_SMOOTH, MODAL_FADE, MODAL_SHELL } from "../model/variants";

export function RepoModal() {
  const { isOpen, close, current, setCurrent } = useRepoSelection();
  const [local, setLocal] = useState<RepoName>(current);
  const [activeQuestion, setActiveQuestion] = useState(0);
  const [treeExpanded, setTreeExpanded] = useState(false);
  const seedsRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (isOpen) setLocal(current); }, [isOpen, current]);
  useEffect(() => { setActiveQuestion(0); setTreeExpanded(false); }, [local]);
  useEscapeKey(isOpen, close);

  const handleSeedKeyDown = useCallback((e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const container = seedsRef.current;
    if (!container) return;
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>("button.repo-modal-seed"));
    const idx = buttons.indexOf(e.currentTarget);
    if (idx === -1) return;
    const next = e.key === "ArrowDown"
      ? buttons[(idx + 1) % buttons.length]
      : buttons[(idx - 1 + buttons.length) % buttons.length];
    next?.focus();
  }, []);

  const pick = (n: RepoName) => { setLocal(n); setCurrent(n); };
  const data = REPOS[local];
  const preview = data.questions[activeQuestion] ?? data.questions[0];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div className="repo-modal is-open" role="dialog" aria-modal="true"
          {...MODAL_FADE}>
          <motion.div className="repo-modal-backdrop" onClick={close} />
          <motion.div className="repo-modal-shell" {...MODAL_SHELL}>
            <CircuitCanvas />
            <button type="button" className="repo-modal-close" onClick={close} aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
            </button>
            <div className="repo-modal-card">
              <div className="repo-modal-main">
                <aside className="repo-modal-sidebar">
                  <div className="repo-modal-tabs-wrap">
                    <div className="repo-modal-tabs">
                      <div className="repo-modal-sidebar-label">Sample repos</div>
                      {REPO_NAMES.map((n, i) => {
                        const repo = REPOS[n];
                        return (
                        <motion.button key={n} type="button" className={`repo-modal-tab${n === local ? " is-active" : ""}`} onClick={() => pick(n)}
                          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: i * 0.04, ease: EASE_SMOOTH }}>
                          <div className="repo-modal-tab-topline">
                            <span className="repo-modal-tab-kind">{repo.kind}</span>
                          </div>
                          <div className="repo-modal-tab-name">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="repo-modal-tab-icon">
                              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.342-3.369-1.342-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
                            </svg>
                            {n}
                          </div>
                          <div className="repo-modal-tab-path">{repo.tree.split("\n").slice(1, 4).map((line) => line.replace(/^[│├└─\s]+/, "").replace(/\/$/, "")).join("  /  ")}</div>
                          <div className="repo-modal-tab-meta">
                            <span>{repo.language}</span>
                            <span>{repo.meta.find((item) => item.k === "Lines")?.v ?? repo.meta[1]?.v} LoC</span>
                            <span>{repo.meta[0]?.v} {repo.meta[0]?.k}</span>
                          </div>
                        </motion.button>
                        );
                      })}

                    </div>
                  </div>
                </aside>

                <div className="repo-modal-content">
                  <AnimatePresence mode="wait">
                  <motion.div key={local} {...crossfade} className="repo-modal-content-anim">
                  <header className="repo-modal-head">
                    <div className="repo-modal-head-row">
                      <span className="repo-modal-dot" aria-hidden="true">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4.75 7.75A2.75 2.75 0 0 1 7.5 5h3.13c.73 0 1.42.3 1.93.84l.8.82c.5.52 1.2.81 1.92.81h1.22a2.75 2.75 0 0 1 2.75 2.75v5.28A2.75 2.75 0 0 1 16.5 18.25h-9A2.75 2.75 0 0 1 4.75 15.5z"/>
                          <path d="M8.5 11.25h7"/>
                        </svg>
                      </span>
                      <span className="repo-modal-kind">{data.kind}</span>
                      <h2 className="repo-modal-name">{local}</h2>
                      <span className="repo-modal-status"><span className="repo-modal-status-pulse" />Indexed</span>
                    </div>
                    <div className="repo-modal-submeta">
                      <span className="repo-modal-submeta-pill">{data.language}</span>
                      <span className="repo-modal-submeta-pill">{data.meta.find((item) => item.k === "Lines")?.v ?? "?"} lines of code</span>
                      <span className="repo-modal-submeta-pill">{preview.ask}</span>
                    </div>
                  </header>

                  <div className="repo-modal-meta-row">
                    {data.meta.map((m) => (<div key={m.k} className="repo-modal-meta"><div className="repo-modal-meta-k">{m.k}</div><div className="repo-modal-meta-v"><CountUp value={m.v} /></div></div>))}
                  </div>

                  <div className="repo-modal-body">
                    <div className="repo-modal-section-label">// Complexity Signals</div>
                    <div className="repo-modal-signals">
                      {data.signals.map((signal) => <span key={signal} className="repo-modal-signal" title={getSignalTooltip(signal)}>{signal}</span>)}
                    </div>

                    <div className="repo-modal-section-label">// Ask p0</div>
                    <div className="repo-modal-seeds" ref={seedsRef}>
                      {data.questions.map((question, index) => {
                        const isActive = index === activeQuestion;
                        return (
                          <div key={question.ask} className="repo-modal-accordion">
                            <button type="button" className={`repo-modal-seed${isActive ? " is-active" : ""}`} onClick={() => setActiveQuestion(index)} onKeyDown={handleSeedKeyDown}>
                              {question.ask}
                            </button>
                            <AnimatePresence>
                            {isActive && (
                              <motion.div
                                className="repo-modal-preview"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.25, ease: EASE_SMOOTH }}
                              >
                                <div className="repo-modal-preview-inner">
                                  <div className="repo-modal-preview-stats">
                                    {question.stats.map((stat) => (
                                      <div key={stat.k} className="repo-modal-preview-stat">
                                        <div className="repo-modal-preview-stat-k">{stat.k}</div>
                                        <div className="repo-modal-preview-stat-v">{stat.v}</div>
                                      </div>
                                    ))}
                                  </div>
                                  <h3 className="repo-modal-preview-title">{question.answerTitle}</h3>
                                  <p className="repo-modal-preview-summary">{question.answerSummary}</p>
                                  <div className="repo-modal-preview-list">
                                    {question.answerBullets.map((bullet) => <div key={bullet} className="repo-modal-preview-item">{bullet}</div>)}
                                  </div>
                                  <div className="repo-modal-preview-artifacts">
                                    <div className="repo-modal-preview-artifacts-label">Artifacts</div>
                                    <div className="repo-modal-preview-artifacts-list">
                                      {question.artifacts.map((artifact) => <span key={artifact} className="repo-modal-preview-artifact">{artifact}</span>)}
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>

                    <div className="repo-modal-section-label">// System Shape</div>
                    <pre className="repo-modal-tree"><span className="repo-modal-tree-hash">{"# "}</span>{treeExpanded ? data.tree : data.tree.split("\n").slice(0, 8).join("\n")}</pre>
                    {data.tree.split("\n").length > 8 && (
                      <button
                        type="button"
                        className="repo-modal-tree-toggle"
                        onClick={() => setTreeExpanded((v) => !v)}
                        aria-expanded={treeExpanded}
                      >
                        {treeExpanded ? "Show less" : "Show more"}
                      </button>
                    )}
                  </div>
                  </motion.div>
                  </AnimatePresence>
                </div>
              </div>

            </div>
            <footer className="repo-modal-foot">
              <p className="repo-modal-foot-note">Pick the hardest sample → inspect the answer → bring your own repo.</p>
              <div className="repo-modal-actions">
                <button type="button" className="repo-modal-cta repo-modal-cta-secondary">
                  Try hardest question
                </button>
                <button type="button" className="repo-modal-cta">
                  Analyze this repo
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                </button>
              </div>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
