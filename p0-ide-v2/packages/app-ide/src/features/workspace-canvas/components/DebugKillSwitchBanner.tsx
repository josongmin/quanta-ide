import { useDebugSettings, debugSettingsStore } from "../store/debug-settings-store";

// Debug kill-switch rescue banner.
// -------------------------------------------------------------------
// `forceLod` and `freezeScene` are developer-only kill-switches that
// disable the zoom→LOD feedback loop / layout worker respectively.
// When a kill-switch is on, the canvas can look frozen to anyone who
// doesn't know the debug HUD exists — the LOD chip row is the only
// other surface that exposes the pinned state, and a user who closed
// the HUD has no affordance to discover "the canvas isn't broken,
// it's just pinned".
//
// This banner is the always-visible rescue surface:
//   - Renders ONLY when at least one kill-switch is active.
//   - Describes what's pinned in plain Korean.
//   - A single "해제" button calls `debugSettingsStore.resetDebugKnobs()`
//     to clear everything atomically.
//
// The banner is positioned absolutely at the top of the canvas and
// deliberately high-contrast (amber). Not a toast — toasts can be
// dismissed and hidden by subsequent toasts, and the user would be
// right back to the silent-pin state. The banner persists until the
// kill-switches are cleared.
export function DebugKillSwitchBanner() {
  const forceLod = useDebugSettings(s => s.forceLod);
  const freezeScene = useDebugSettings(s => s.freezeScene);

  const lodPinned = forceLod !== "auto";
  if (!lodPinned && !freezeScene) return null;

  const parts: string[] = [];
  if (lodPinned) parts.push(`LOD=${forceLod}`);
  if (freezeScene) parts.push("scene frozen");
  const label = parts.join(" · ");

  return (
    <div className="ws-killswitch-banner" role="status" aria-live="polite">
      <span className="ws-killswitch-banner__dot" aria-hidden />
      <span className="ws-killswitch-banner__label">
        DEBUG 킬스위치 활성 — <strong>{label}</strong>. 캔버스가 멈춰 보이면 해제하세요.
      </span>
      <button
        type="button"
        className="ws-killswitch-banner__btn"
        onClick={() => debugSettingsStore.resetDebugKnobs()}
      >
        해제
      </button>
    </div>
  );
}
