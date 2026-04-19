import { useMemo } from "react";
import { useFeature } from "../store/feature-flags-store";
import { useSceneStore } from "../store/scene-store";
import { useRoomFocus, roomFocusStore } from "../store/room-focus-store";
import { interactionStore } from "../store/interaction-store";
import { computeRoomFlow, type RoomCall, type RoomSymbolNode } from "../lib/room-flow";

// Room flow panel (R3) — function-internal view.
// -------------------------------------------------------------------
// Opens as a floating pane when the user clicks a function row in the
// right inspector's Public surface list. Shows the function's calls
// grouped into three lanes:
//
//   inbound  — who calls into me (cross-file, usually external API)
//   internal — calls to sibling functions inside the same file
//   outbound — external calls (other files / modules)
//
// Plus a side-effects rail if the function triggers any
// `effect`/`dataflow`/`taint-propagation` edges. Click any row in
// any lane → select the peer file and drop the Room panel so the
// user lands at the next natural zoom level (Block).

function basename(id: string): string {
  const i = id.lastIndexOf("/");
  return i >= 0 ? id.slice(i + 1) : id;
}

export function RoomFlowPanel() {
  const enabled = useFeature("power.figmaShell");
  const focused = useRoomFocus(s => s);
  const graph = useSceneStore(s => s.graph);

  const flow = useMemo(() => {
    if (!focused.fileId || !focused.symbol || !graph) return null;
    return computeRoomFlow(graph, focused.fileId);
  }, [focused, graph]);

  const symbol: RoomSymbolNode | null = useMemo(() => {
    if (!flow || !focused.symbol) return null;
    return flow.symbols.find(s => s.name === focused.symbol) ?? null;
  }, [flow, focused.symbol]);

  if (!enabled || !focused.fileId || !focused.symbol || !symbol) return null;

  return (
    <div className="ws-roomflow" role="dialog" aria-label={`Room flow for ${focused.symbol}`}>
      <div className="ws-roomflow__head">
        <div>
          <div className="ws-roomflow__eyebrow">
            Room · {basename(focused.fileId)}
          </div>
          <div className="ws-roomflow__title">
            {symbol.name}
            {symbol.looksLikeEntry && <span className="ws-roomflow__tag ws-roomflow__tag--entry">entry</span>}
            {symbol.looksLikeLeaf && <span className="ws-roomflow__tag ws-roomflow__tag--leaf">leaf</span>}
          </div>
          <div className="ws-roomflow__meta">
            lines {symbol.startLine}–{symbol.endLine} · cpx {symbol.complexity}
          </div>
        </div>
        <button
          type="button"
          className="ws-figma-chip"
          onClick={() => roomFocusStore.clear()}
          title="Close"
        >
          close ⏎
        </button>
      </div>
      <div className="ws-roomflow__body">
        <CallLane
          title="Inbound"
          calls={symbol.inbound}
          hint="Callers"
          emptyHint="no inbound refs"
          accent="#22d3ee"
        />
        <CallLane
          title="Internal"
          calls={symbol.internal}
          hint="Same-file siblings"
          emptyHint="no same-file calls"
          accent="#a78bfa"
        />
        <CallLane
          title="Outbound"
          calls={symbol.outbound}
          hint="External calls"
          emptyHint="no outbound calls"
          accent="#fb923c"
        />
        {symbol.effects.length > 0 && (
          <CallLane
            title="Side effects"
            calls={symbol.effects}
            hint="dataflow / taint / effect kinds"
            emptyHint="no side effects"
            accent="#ef4444"
          />
        )}
      </div>
    </div>
  );
}

function CallLane({
  title, calls, hint, emptyHint, accent,
}: {
  title: string;
  calls: readonly RoomCall[];
  hint: string;
  emptyHint: string;
  accent: string;
}) {
  return (
    <div className="ws-roomflow__lane">
      <div className="ws-roomflow__lane-head">
        <span className="ws-roomflow__lane-dot" style={{ background: accent }} />
        <span className="ws-roomflow__lane-title">{title}</span>
        <span className="ws-roomflow__lane-count">{calls.length}</span>
      </div>
      <div className="ws-roomflow__lane-hint">{hint}</div>
      {calls.length === 0 ? (
        <div className="ws-roomflow__lane-empty">{emptyHint}</div>
      ) : (
        <div className="ws-roomflow__lane-list">
          {calls.slice(0, 10).map(call => (
            <button
              key={call.edgeId}
              type="button"
              className="ws-figma-row"
              onClick={() => {
                interactionStore.selectFile(call.peerFileId);
                roomFocusStore.clear();
              }}
              title={`${call.kind} · ${call.peerFileId}${call.peerSymbol ? ` · ${call.peerSymbol}` : ""}`}
            >
              <span className="ws-figma-row__lbl" style={{ fontFamily: "var(--figma-mono)" }}>
                {call.peerSymbol ?? basename(call.peerFileId)}
              </span>
              <span className="ws-figma-row__meta">{call.kind}</span>
            </button>
          ))}
          {calls.length > 10 && (
            <div className="ws-figma-panel__hint">(+{calls.length - 10} more)</div>
          )}
        </div>
      )}
    </div>
  );
}
