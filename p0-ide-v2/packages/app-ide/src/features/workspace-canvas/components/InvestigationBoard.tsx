import { useMemo, useState } from "react";
import { useFeature } from "../store/feature-flags-store";
import { useFigmaMode, figmaModeStore } from "../store/figma-mode-store";
import { useSceneStore } from "../store/scene-store";
import { useInteractionStore, interactionStore } from "../store/interaction-store";
import { pinsStore, usePinsStore, type Pin, type PinKind } from "../store/pins-store";

// Investigation board (R4) — bottom drawer panel.
// -------------------------------------------------------------------
// Figma-style "scratchpad" that collects pinned files / evidence /
// paths plus free-form notes. Visible when the shell mode is
// `investigate`; collapses cleanly when the user switches back.
//
// Three quick-actions on the header row so users don't have to hunt
// for an "add" button:
//   * Pin current file
//   * Pin open evidence
//   * Pin current path query
// Each no-ops when the prerequisite state is missing so the buttons
// are always discoverable.

const KIND_LABEL: Record<PinKind, string> = {
  file: "File",
  edge: "Evidence",
  path: "Path",
};

const KIND_COLOR: Record<PinKind, string> = {
  file: "#38bdf8",
  edge: "#f472b6",
  path: "#a78bfa",
};

function basename(id: string): string {
  const i = id.lastIndexOf("/");
  return i >= 0 ? id.slice(i + 1) : id;
}

export function InvestigationBoard() {
  const enabled = useFeature("power.figmaShell");
  const mode = useFigmaMode(s => s.mode);
  const pins = usePinsStore(s => s.pins);
  const selectedFileId = useInteractionStore(s => s.viewState.selectedFileId);
  const evidenceId = useInteractionStore(s => s.inspectedEvidenceId);
  const pathQuery = useInteractionStore(s => s.pathQuery);
  const graph = useSceneStore(s => s.graph);

  const groups = useMemo(() => {
    const by: Record<PinKind, Pin[]> = { file: [], edge: [], path: [] };
    for (const p of pins) by[p.kind].push(p);
    return by;
  }, [pins]);

  if (!enabled || mode !== "investigate") return null;

  const pinCurrentFile = () => {
    if (!selectedFileId) return;
    if (pins.some(p => p.kind === "file" && p.target === selectedFileId)) return;
    const file = graph?.files.find(f => f.id === selectedFileId);
    pinsStore.add({
      kind: "file",
      target: selectedFileId,
      label: file?.name ?? basename(selectedFileId),
      note: "",
    });
  };

  const pinCurrentEvidence = () => {
    if (!evidenceId) return;
    if (pins.some(p => p.kind === "edge" && p.target === evidenceId)) return;
    const proof = graph?.proofs?.[evidenceId];
    pinsStore.add({
      kind: "edge",
      target: evidenceId,
      label: proof?.summary?.slice(0, 60) ?? evidenceId,
      note: "",
    });
  };

  const pinCurrentPath = () => {
    if (!pathQuery) return;
    const target = `${pathQuery.sourceFileId}→${pathQuery.targetFileId}`;
    if (pins.some(p => p.kind === "path" && p.target === target)) return;
    pinsStore.add({
      kind: "path",
      target,
      label: `${basename(pathQuery.sourceFileId)} → ${basename(pathQuery.targetFileId)}`,
      note: "",
    });
  };

  return (
    <aside className="ws-investigation" role="complementary" aria-label="Investigation board">
      <div className="ws-investigation__head">
        <span className="ws-investigation__eyebrow">Investigation · {pins.length} pins</span>
        <div className="ws-investigation__actions">
          <button
            type="button"
            className="ws-figma-chip"
            onClick={pinCurrentFile}
            disabled={!selectedFileId}
            title={selectedFileId ? `Pin ${basename(selectedFileId)}` : "Select a file to enable"}
          >
            + file
          </button>
          <button
            type="button"
            className="ws-figma-chip"
            onClick={pinCurrentEvidence}
            disabled={!evidenceId}
            title={evidenceId ? "Pin the open evidence" : "⌘+click an edge to enable"}
          >
            + evidence
          </button>
          <button
            type="button"
            className="ws-figma-chip"
            onClick={pinCurrentPath}
            disabled={!pathQuery}
            title={pathQuery ? "Pin the current path query" : "Run a shift+click path to enable"}
          >
            + path
          </button>
          <button
            type="button"
            className="ws-figma-chip"
            onClick={() => pinsStore.reset()}
            disabled={pins.length === 0}
          >
            clear all
          </button>
          <button
            type="button"
            className="ws-figma-chip"
            onClick={() => figmaModeStore.setMode("explore")}
            title="Leave Investigate mode"
          >
            close ⏎
          </button>
        </div>
      </div>
      <div className="ws-investigation__body">
        {pins.length === 0 ? (
          <div className="ws-investigation__empty">
            <div className="ws-investigation__empty-title">Nothing pinned yet</div>
            <div className="ws-investigation__empty-body">
              Select a file, open evidence, or run a path query — then use the buttons above to pin it.
            </div>
          </div>
        ) : (
          <div className="ws-investigation__groups">
            {(Object.keys(groups) as PinKind[]).map(kind => (
              <PinGroup key={kind} kind={kind} pins={groups[kind]} />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function PinGroup({ kind, pins }: { kind: PinKind; pins: readonly Pin[] }) {
  if (pins.length === 0) return null;
  return (
    <div className="ws-investigation__group">
      <div className="ws-investigation__group-head">
        <span
          className="ws-investigation__group-dot"
          style={{ background: KIND_COLOR[kind] }}
        />
        {KIND_LABEL[kind]}
        <span className="ws-figma-panel__section-meta">{pins.length}</span>
      </div>
      <div className="ws-investigation__group-body">
        {pins.map(p => <PinCard key={p.id} pin={p} />)}
      </div>
    </div>
  );
}

function PinCard({ pin }: { pin: Pin }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(pin.note);

  const jumpTo = () => {
    if (pin.kind === "file") {
      interactionStore.selectFile(pin.target);
      return;
    }
    if (pin.kind === "edge") {
      interactionStore.setInspectedEvidence(pin.target);
      figmaModeStore.setRightTab("evidence");
      return;
    }
    if (pin.kind === "path") {
      const [from, to] = pin.target.split("→");
      if (from && to) {
        interactionStore.setPathQuery({
          sourceFileId: from,
          targetFileId: to,
          mode: "shortest",
        });
      }
    }
  };

  return (
    <div className="ws-investigation__pin">
      <div className="ws-investigation__pin-head">
        <button
          type="button"
          className="ws-investigation__pin-title"
          onClick={jumpTo}
          title={pin.target}
        >
          {pin.label ?? pin.target}
        </button>
        <button
          type="button"
          className="ws-investigation__pin-x"
          onClick={() => pinsStore.remove(pin.id)}
          title="Remove"
        >×</button>
      </div>
      {editing ? (
        <textarea
          autoFocus
          className="ws-figma-textarea ws-investigation__pin-note"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={() => {
            pinsStore.setNote(pin.id, draft.trim());
            setEditing(false);
          }}
          rows={3}
          placeholder="Add a note…"
        />
      ) : (
        <button
          type="button"
          className={`ws-investigation__pin-note ws-investigation__pin-note--view${pin.note ? "" : " is-empty"}`}
          onClick={() => setEditing(true)}
        >
          {pin.note || "add a note…"}
        </button>
      )}
    </div>
  );
}
