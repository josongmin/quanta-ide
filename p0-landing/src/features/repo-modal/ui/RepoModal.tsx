import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useModalStore } from "@/app/stores/useModalStore";
import { useRepoStore } from "@/app/stores/useRepoStore";
import { REPOS, REPO_NAMES, type RepoName } from "@/entities/repo/model/data";

export function RepoModal() {
  const { isOpen, close } = useModalStore();
  const { current, setCurrent } = useRepoStore();
  const [local, setLocal] = useState<RepoName>(current);

  useEffect(() => { if (isOpen) setLocal(current); }, [isOpen, current]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    if (isOpen) document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [isOpen, close]);

  const pick = (n: RepoName) => { setLocal(n); setCurrent(n); };
  const data = REPOS[local];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div className="repo-modal is-open" style={{ "--accent": data.color, "--ink": "#0a0a14", "--ink-2": "#4b4b5a", "--ink-3": "#8a8a99", "--line": "#ececf2", "--line-2": "#f3f3f8", "--paper": "#fff", "--paper-2": "#fafafc" } as React.CSSProperties}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
          <motion.div className="repo-modal-backdrop" onClick={close} />
          <motion.div className="repo-modal-shell" initial={{ y: 10, scale: 0.985 }} animate={{ y: 0, scale: 1 }} exit={{ y: 10, scale: 0.985 }} transition={{ duration: 0.26, ease: [0.2, 0.85, 0.2, 1] }}>
            <div className="repo-modal-card">
              <button type="button" className="repo-modal-close" onClick={close} aria-label="Close">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
              </button>

              <div className="repo-modal-tabs">
                {REPO_NAMES.map((n) => (
                  <button key={n} type="button" className={`repo-modal-tab${n === local ? " is-active" : ""}`} onClick={() => pick(n)}>
                    <span className="repo-modal-tab-dot" style={{ "--dot": REPOS[n].color } as React.CSSProperties} />
                    {n}
                  </button>
                ))}
              </div>

              <header className="repo-modal-head">
                <div className="repo-modal-head-row">
                  <span className="repo-modal-dot" style={{ "--dot": data.color } as React.CSSProperties} />
                  <h2 className="repo-modal-name">{local}</h2>
                  <span className="repo-modal-status"><span className="repo-modal-status-pulse" />Indexed</span>
                </div>
                <p className="repo-modal-desc">{data.desc}</p>
                <div className="repo-modal-stack">{data.stack.map((s) => <span key={s} className="repo-modal-pill">{s}</span>)}</div>
              </header>

              <div className="repo-modal-meta-row">
                {data.meta.map((m) => (<div key={m.k} className="repo-modal-meta"><div className="repo-modal-meta-k">{m.k}</div><div className="repo-modal-meta-v">{m.v}</div></div>))}
              </div>

              <div className="repo-modal-body">
                <section className="repo-modal-col repo-modal-col-left">
                  <div className="repo-modal-section-label">SCENARIO</div>
                  <p className="repo-modal-scenario">{data.scenario}</p>
                  <div className="repo-modal-section-label">TRY ASKING</div>
                  <div className="repo-modal-seeds">{data.seeds.map((s) => <button key={s} type="button" className="repo-modal-seed">{s}</button>)}</div>
                </section>
                <section className="repo-modal-col repo-modal-col-right">
                  <div className="repo-modal-section-label">STRUCTURE</div>
                  <pre className="repo-modal-tree">{data.tree}</pre>
                </section>
              </div>

              <footer className="repo-modal-foot">
                <button type="button" className="repo-modal-cta">
                  Run p0 on this repo
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                </button>
              </footer>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
