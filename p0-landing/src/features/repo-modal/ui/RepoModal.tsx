import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useModalStore } from "@/app/stores/useModalStore";
import { useRepoStore } from "@/app/stores/useRepoStore";
import { REPOS, REPO_NAMES, type RepoName } from "@/entities/repo/model/data";

export function RepoModal() {
  const { isOpen, close } = useModalStore();
  const { current, setCurrent } = useRepoStore();
  const [local, setLocal] = useState<RepoName>(current);
  const [activeQuestion, setActiveQuestion] = useState(0);

  useEffect(() => { if (isOpen) setLocal(current); }, [isOpen, current]);
  useEffect(() => { setActiveQuestion(0); }, [local]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    if (isOpen) document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [isOpen, close]);

  const pick = (n: RepoName) => { setLocal(n); setCurrent(n); };
  const data = REPOS[local];
  const preview = data.questions[activeQuestion] ?? data.questions[0];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div className="repo-modal is-open" style={{ "--accent": "#8b7cff", "--ink": "#0a0a14", "--ink-2": "#4b4b5a", "--ink-3": "#8a8a99", "--line": "#ececf2", "--line-2": "#f3f3f8", "--paper": "#fff", "--paper-2": "#fafafc" } as React.CSSProperties}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
          <motion.div className="repo-modal-backdrop" onClick={close} />
          <motion.div className="repo-modal-shell" initial={{ y: 10, scale: 0.985 }} animate={{ y: 0, scale: 1 }} exit={{ y: 10, scale: 0.985 }} transition={{ duration: 0.26, ease: [0.2, 0.85, 0.2, 1] }}>
            <div className="repo-modal-card">
              <div className="repo-modal-top">
                <button type="button" className="repo-modal-close" onClick={close} aria-label="Close">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
                </button>
              </div>

              <div className="repo-modal-main">
                <aside className="repo-modal-sidebar">
                  <div className="repo-modal-sidebar-label">Sample repos</div>
                  <div className="repo-modal-tabs-wrap">
                    <div className="repo-modal-tabs">
                      {REPO_NAMES.map((n) => {
                        const repo = REPOS[n];
                        return (
                        <button key={n} type="button" className={`repo-modal-tab${n === local ? " is-active" : ""}`} onClick={() => pick(n)}>
                          <div className="repo-modal-tab-topline">
                            <span className="repo-modal-tab-icon" aria-hidden="true">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4.75 7.75A2.75 2.75 0 0 1 7.5 5h3.13c.73 0 1.42.3 1.93.84l.8.82c.5.52 1.2.81 1.92.81h1.22a2.75 2.75 0 0 1 2.75 2.75v5.28A2.75 2.75 0 0 1 16.5 18.25h-9A2.75 2.75 0 0 1 4.75 15.5z"/>
                                <path d="M8.5 11.25h7"/>
                                <path d="M8.5 14.25h4.5"/>
                              </svg>
                            </span>
                            <span className="repo-modal-tab-kind">{repo.kind}</span>
                          </div>
                          <div className="repo-modal-tab-name">{n}</div>
                          <div className="repo-modal-tab-path">{repo.tree.split("\n").slice(1, 4).map((line) => line.replace(/^[│├└─\s]+/, "").replace(/\/$/, "")).join("  /  ")}</div>
                          <div className="repo-modal-tab-meta">
                            <span>{repo.language}</span>
                            <span>{repo.meta.find((item) => item.k === "Lines")?.v ?? repo.meta[1]?.v} LoC</span>
                            <span>{repo.meta[0]?.v} {repo.meta[0]?.k}</span>
                          </div>
                        </button>
                        );
                      })}
                    </div>
                  </div>
                </aside>

                <div className="repo-modal-content">
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
                    {data.meta.map((m) => (<div key={m.k} className="repo-modal-meta"><div className="repo-modal-meta-k">{m.k}</div><div className="repo-modal-meta-v">{m.v}</div></div>))}
                  </div>

                  <div className="repo-modal-body">
                    <section className="repo-modal-col repo-modal-col-left">
                      <div className="repo-modal-story-grid">
                        <div className="repo-modal-story-card">
                          <div className="repo-modal-section-label">Main Failure Mode</div>
                          <p className="repo-modal-scenario">{data.pain}</p>
                        </div>
                        <div className="repo-modal-story-card repo-modal-story-card-accent">
                          <div className="repo-modal-section-label">What p0 Returns</div>
                          <p className="repo-modal-scenario">{data.outcome}</p>
                        </div>
                      </div>
                      <div className="repo-modal-section-label">Hard Questions To Ask</div>
                      <div className="repo-modal-seeds">
                        {data.questions.map((question, index) => (
                          <button key={question.ask} type="button" className={`repo-modal-seed${index === activeQuestion ? " is-active" : ""}`} onClick={() => setActiveQuestion(index)}>
                            {question.ask}
                          </button>
                        ))}
                      </div>
                    </section>
                    <section className="repo-modal-col repo-modal-col-right">
                      <div className="repo-modal-section-label">Complexity Signals</div>
                      <div className="repo-modal-signals">
                        {data.signals.map((signal) => <span key={signal} className="repo-modal-signal">{signal}</span>)}
                      </div>
                      <div className="repo-modal-section-label">Answer Preview</div>
                      <div className="repo-modal-preview">
                        <div className="repo-modal-preview-kicker">Sample output</div>
                        <h3 className="repo-modal-preview-title">{preview.answerTitle}</h3>
                        <p className="repo-modal-preview-summary">{preview.answerSummary}</p>
                        <div className="repo-modal-preview-stats">
                          {preview.stats.map((stat) => (
                            <div key={stat.k} className="repo-modal-preview-stat">
                              <div className="repo-modal-preview-stat-k">{stat.k}</div>
                              <div className="repo-modal-preview-stat-v">{stat.v}</div>
                            </div>
                          ))}
                        </div>
                        <div className="repo-modal-preview-list">
                          {preview.answerBullets.map((bullet) => <div key={bullet} className="repo-modal-preview-item">{bullet}</div>)}
                        </div>
                        <div className="repo-modal-preview-artifacts">
                          <div className="repo-modal-preview-artifacts-label">Artifacts generated</div>
                          <div className="repo-modal-preview-artifacts-list">
                            {preview.artifacts.map((artifact) => <span key={artifact} className="repo-modal-preview-artifact">{artifact}</span>)}
                          </div>
                        </div>
                      </div>
                      <div className="repo-modal-section-label">System Shape</div>
                      <pre className="repo-modal-tree">{data.tree.split("\n").slice(0, 8).join("\n")}</pre>
                    </section>
                  </div>
                </div>
              </div>

              <footer className="repo-modal-foot">
                <p className="repo-modal-foot-note">Pick the hardest sample, inspect the answer pattern, then bring your own repo.</p>
                <div className="repo-modal-actions">
                  <button type="button" className="repo-modal-cta repo-modal-cta-secondary">
                    Open hardest question
                  </button>
                  <button type="button" className="repo-modal-cta">
                    Analyze this repo
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                  </button>
                </div>
              </footer>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
