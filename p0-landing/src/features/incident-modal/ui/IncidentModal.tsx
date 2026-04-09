import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useIncidentModalStore } from "@/app/stores/useIncidentModalStore";

export function IncidentModal() {
  const { isOpen, close } = useIncidentModalStore();

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    if (isOpen) document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [isOpen, close]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="repo-modal incident-modal is-open"
          style={{
            "--ink": "#e4e4e7",
            "--ink-2": "#a1a1aa",
            "--ink-3": "#71717a",
            "--line": "rgba(255,255,255,.08)",
            "--line-2": "rgba(255,255,255,.04)",
            "--paper": "#0f0f14",
            "--paper-2": "#18181f",
            "--paper-3": "#1e1e28",
          } as React.CSSProperties}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
        >
          <motion.div className="repo-modal-backdrop" onClick={close} />
          <motion.div
            className="repo-modal-shell"
            initial={{ y: 10, scale: 0.985 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 10, scale: 0.985 }}
            transition={{ duration: 0.26, ease: [0.2, 0.85, 0.2, 1] }}
          >
            <button type="button" className="repo-modal-close" onClick={close} aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </svg>
            </button>
            <div className="repo-modal-card">
              <div className="repo-modal-top" />

              <div className="repo-modal-main">
                <aside className="repo-modal-sidebar">
                  <div className="repo-modal-sidebar-label">Real incidents</div>
                  <div className="repo-modal-tabs-wrap">
                    <div className="repo-modal-tabs">
                      {/* Incident tabs will be populated with data */}
                    </div>
                  </div>
                </aside>

                <div className="repo-modal-content">
                  <header className="repo-modal-head">
                    <div className="repo-modal-head-row">
                      <span className="repo-modal-dot" aria-hidden="true">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                          <line x1="12" y1="9" x2="12" y2="13" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                      </span>
                      <h2 className="repo-modal-name">Incident Modal</h2>
                      <span className="repo-modal-status">
                        <span className="repo-modal-status-pulse" />
                        Active
                      </span>
                    </div>
                  </header>

                  <div className="repo-modal-body">
                    <div className="repo-modal-section-label">// Coming soon</div>
                    <p style={{ color: "var(--ink-3)", fontSize: "0.88rem" }}>
                      Real-world incident case studies will be available here.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <footer className="repo-modal-foot">
              <p className="repo-modal-foot-note">See how p0 catches real-world incidents before they happen.</p>
              <div className="repo-modal-actions">
                <button type="button" className="repo-modal-cta" onClick={close}>
                  Close
                </button>
              </div>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
