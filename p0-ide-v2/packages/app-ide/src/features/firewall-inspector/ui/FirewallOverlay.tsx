import { useEffect, useState } from "react";
import { focusStore, useFocusStore } from "@quanta/app-ide/stores/focus-store";
import { toast } from "@quanta/shell/stores/toast-store";
import { firewallStore, useFirewallStore, type ContextChunk } from "@quanta/app-ide/entities/firewall";
import { computeStats, fmt } from "./firewall-overlay.utils";
import { FirewallChunkRow } from "./FirewallChunkRow";
import { PromoteConfirmModal } from "./PromoteConfirmModal";
import { TrustDistribution } from "./TrustDistribution";
import "./firewall-overlay.css";

export function FirewallOverlay() {
  const open = useFocusStore((s) => s.firewallOpen);
  const chunks = useFirewallStore((s) => s.chunks);
  const [confirm, setConfirm] = useState<ContextChunk | null>(null);

  useEffect(() => { if (!open) setConfirm(null); }, [open]);

  if (!open) return null;

  const { active, stats, totalTokens } = computeStats(chunks);
  const close = () => focusStore.toggleFirewall(false);

  function doPromote() {
    if (!confirm) return;
    firewallStore.promote(confirm.id);
    toast.success("Chunk promoted to trusted", `${confirm.source.label} · now participates in agent decisions`, "firewall");
    setConfirm(null);
  }
  function doDismiss(id: string) {
    firewallStore.dismiss(id);
    toast.warn("Chunk dismissed", "Removed from context window", "firewall");
  }

  return (
    <>
      <div className="fwov" role="dialog" aria-modal="true" aria-label="Prompt injection firewall">
        <div className="fwov__scrim" onClick={close} aria-hidden />
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
            <button type="button" className="fwov__close" aria-label="Close" onClick={close}>×</button>
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

            <TrustDistribution stats={stats} totalTokens={totalTokens} />

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
