import { useMemo } from "react";
import { useCursorsStore } from "../../store/cursors-store";
import { usePresenceStore } from "../../store/presence-store";
import { followStore, useFollowStore } from "../../store/follow-store";
import { useFeature } from "../../store/feature-flags-store";

interface FollowCandidate {
  id: string;
  label: string;
  color: string;
}

function cssColor(n: number): string {
  return `#${n.toString(16).padStart(6, "0")}`;
}

export function FollowSection() {
  const enabled = useFeature("collab.follow");
  const cursors = useCursorsStore(s => s.cursors);
  const agents = usePresenceStore(s => s.agents);
  const targetId = useFollowStore(s => s.targetUserId);

  const candidates = useMemo<readonly FollowCandidate[]>(() => {
    const out: FollowCandidate[] = [];
    for (const c of cursors) {
      out.push({ id: c.userId, label: c.label, color: c.color });
    }
    for (const a of agents) {
      if (out.some(o => o.id === a.agentId)) continue;
      out.push({ id: a.agentId, label: a.label, color: cssColor(a.color) });
    }
    return out;
  }, [cursors, agents]);

  if (!enabled) {
    return (
      <>
        <div className="ws-debug__divider">follow</div>
        <div className="ws-debug__hint">
          enable <code>collab.follow</code> in features to use follow mode.
        </div>
      </>
    );
  }

  return (
    <>
      <div className="ws-debug__divider">follow</div>
      {candidates.length === 0 ? (
        <div className="ws-debug__hint">no users / agents present.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {candidates.map(c => {
            const isTarget = c.id === targetId;
            return (
              <div
                key={c.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "10px 1fr auto",
                  gap: 6,
                  alignItems: "center",
                  padding: "3px 6px",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 4,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: c.color,
                    display: "inline-block",
                  }}
                />
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {c.label}
                </span>
                <button
                  type="button"
                  className={`ws-debug__chip${isTarget ? " is-on" : ""}`}
                  onClick={() => followStore.toggle(c.id)}
                  title={isTarget ? "stop following" : "follow"}
                >
                  {isTarget ? "stop" : "follow"}
                </button>
              </div>
            );
          })}
        </div>
      )}
      {targetId && (
        <div className="ws-debug__hint" style={{ marginTop: 4 }}>
          press ESC or click the banner to stop.
        </div>
      )}
    </>
  );
}
