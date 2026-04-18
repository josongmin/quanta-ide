import { useEffect, useState } from "react";
import { usePresenceStore, type AgentActivity } from "../../store/presence-store";
import { interactionStore } from "../../store/interaction-store";
import { useSceneStore } from "../../store/scene-store";
import { useRenderSettings, renderSettingsStore } from "../../store/render-settings-store";

function colorToCss(n: number): string {
  return `#${n.toString(16).padStart(6, "0")}`;
}

function basename(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx >= 0 ? path.slice(idx + 1) : path;
}

function formatAge(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.round(m / 60)}h ago`;
}

const ACTIVITY_SHORT: Record<AgentActivity, string> = {
  reading: "read",
  editing: "edit",
  analyzing: "scan",
  idle: "idle",
};

export function AgentsSection() {
  const agents = usePresenceStore(s => s.agents);
  const graph = useSceneStore(s => s.graph);
  const showAgentPresence = useRenderSettings(s => s.showAgentPresence);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const fileById = new Map<string, { id: string; name: string }>();
  if (graph) {
    for (const f of graph.files) fileById.set(f.id, { id: f.id, name: f.name });
  }

  return (
    <>
      <label className="ws-debug__row">
        <input
          type="checkbox"
          checked={showAgentPresence}
          onChange={e => renderSettingsStore.setShowAgentPresence(e.target.checked)}
        />
        <span>show presence rings</span>
      </label>

      <div className="ws-debug__divider">agents ({agents.length})</div>
      {agents.length === 0 ? (
        <div className="ws-debug__hint">no agents present.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {agents.map(a => {
            const entry = a.focusFileId ? fileById.get(a.focusFileId) : undefined;
            const name = entry ? entry.name : "—";
            const title = entry ? basename(entry.id) : undefined;
            const age = now - a.updatedAt;
            return (
              <button
                key={a.agentId}
                type="button"
                className="ws-debug__row"
                onClick={() => {
                  if (a.focusFileId) interactionStore.selectFile(a.focusFileId);
                }}
                disabled={!a.focusFileId}
                style={{
                  display: "grid",
                  gridTemplateColumns: "10px 1fr auto",
                  gap: 6,
                  alignItems: "center",
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 4,
                  padding: "4px 6px",
                  cursor: a.focusFileId ? "pointer" : "default",
                  textAlign: "left",
                }}
                title={title ?? "no file"}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: colorToCss(a.color),
                    display: "inline-block",
                  }}
                />
                <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                  <span style={{ fontWeight: 600 }}>
                    {a.label}
                    <span style={{ marginLeft: 6, opacity: 0.6, fontWeight: 400 }}>
                      {ACTIVITY_SHORT[a.activity]}
                    </span>
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      opacity: 0.7,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {name}
                  </span>
                </span>
                <span style={{ fontSize: 10, opacity: 0.55, fontVariantNumeric: "tabular-nums" }}>
                  {formatAge(age)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
