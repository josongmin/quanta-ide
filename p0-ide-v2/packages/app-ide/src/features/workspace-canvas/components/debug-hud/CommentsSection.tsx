import { useMemo } from "react";
import { commentsStore, useCommentsStore } from "../../store/comments-store";
import { viewportStore } from "../../store/viewport-store";
import { useFeature } from "../../store/feature-flags-store";

function preview(body: string): string {
  const t = body.trim();
  if (t.length === 0) return "(empty)";
  return t.length > 48 ? t.slice(0, 45) + "…" : t;
}

function panToWorld(x: number, y: number) {
  const vp = viewportStore.getState().viewport;
  if (vp.width <= 0 || vp.height <= 0 || vp.scale <= 0) return;
  const nx = vp.width / 2 - x * vp.scale;
  const ny = vp.height / 2 - y * vp.scale;
  viewportStore.setViewport({ ...vp, x: nx, y: ny });
}

export function CommentsSection() {
  const enabled = useFeature("collab.comments");
  const threads = useCommentsStore(s => s.threads);

  const unresolved = useMemo(
    () => threads.filter(t => !t.resolved),
    [threads],
  );

  if (!enabled) {
    return (
      <>
        <div className="ws-debug__divider">comments</div>
        <div className="ws-debug__hint">
          enable <code>collab.comments</code> in features to use threads.
        </div>
      </>
    );
  }

  return (
    <>
      <div className="ws-debug__divider">
        comments ({threads.length})
        {unresolved.length < threads.length && (
          <span style={{ color: "#22c55e" }}> · {threads.length - unresolved.length} done</span>
        )}
      </div>
      {unresolved.length === 0 ? (
        <div className="ws-debug__hint">no open threads.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 1, marginTop: 2 }}>
          {unresolved.slice(0, 8).map(t => {
            const last = t.messages[t.messages.length - 1];
            return (
              <div
                key={t.id}
                className="ws-debug__sticky-row"
                onClick={() => {
                  panToWorld(t.posX, t.posY);
                  commentsStore.setOpen(t.id);
                }}
                title={last?.body ?? "(empty)"}
              >
                <span
                  className="ws-debug__sticky-dot"
                  style={{ background: "#7dd3fc" }}
                />
                <span className="ws-debug__sticky-text">
                  {t.targetKind === "file" ? t.targetId.split("/").pop() : t.targetKind}
                  {" — "}
                  {preview(last?.body ?? "")}
                </span>
                <input
                  type="checkbox"
                  className="ws-debug__sticky-check"
                  checked={t.resolved}
                  onClick={e => e.stopPropagation()}
                  onChange={() => commentsStore.toggleResolved(t.id)}
                  title="resolve"
                />
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
