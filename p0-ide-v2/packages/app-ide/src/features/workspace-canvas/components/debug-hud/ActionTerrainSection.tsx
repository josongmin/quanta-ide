import { useMemo } from "react";
import {
  actionTerrainStore,
  useActionTerrainStore,
  useActionTerrainRender,
  ACTION_TERRAIN_HEIGHT_RANGE,
} from "../../store/action-terrain-store";
import { useFeature, featureFlagsStore } from "../../store/feature-flags-store";
import { ToggleRow } from "./ToggleRow";

const TOP_N = 5;

function basename(id: string): string {
  const i = id.lastIndexOf("/");
  return i >= 0 ? id.slice(i + 1) : id;
}

export function ActionTerrainSection() {
  const on = useFeature("action-terrain.mode");
  const mode = useActionTerrainStore(s => s.mode);
  const heightScale = useActionTerrainStore(s => s.heightScale);
  const coneDirection = useActionTerrainStore(s => s.coneDirection);
  const roi = useActionTerrainRender(s => s.roi);
  const enabled = useActionTerrainRender(s => s.enabled);

  const top = useMemo(() => {
    if (!roi) return [];
    return roi.ordered.slice(0, TOP_N);
  }, [roi]);

  return (
    <>
      <div className="ws-debug__divider">액션 지형</div>
      <ToggleRow
        label="기능 활성"
        checked={on}
        onChange={v => featureFlagsStore.setFlag("action-terrain.mode", v)}
      />
      <ToggleRow
        label="아이소 모드"
        checked={mode}
        onChange={v => actionTerrainStore.setMode(v)}
        disabled={!on}
        disabledReason="먼저 '기능 활성'을 켜세요"
        hint="⌘⇧A 단축키"
      />
      <div className="ws-debug__row ws-debug__row--aligned">
        <span className="ws-debug__row-label">높이</span>
        <input
          type="range"
          min={ACTION_TERRAIN_HEIGHT_RANGE.min}
          max={ACTION_TERRAIN_HEIGHT_RANGE.max}
          step={0.05}
          value={heightScale}
          onChange={e => actionTerrainStore.setHeightScale(parseFloat(e.target.value))}
          disabled={!mode}
          className="ws-debug__row-slider"
        />
        <span className="ws-debug__row-value">{heightScale.toFixed(2)}×</span>
      </div>
      <div className="ws-debug__row ws-debug__row--aligned">
        <span className="ws-debug__row-label">콘 방향</span>
        <div className="ws-debug__lod ws-debug__row-chips">
          {(["blast", "fix"] as const).map(d => (
            <button
              key={d}
              type="button"
              className={`ws-debug__chip${coneDirection === d ? " is-on" : ""}`}
              onClick={() => actionTerrainStore.setConeDirection(d)}
              disabled={!mode}
            >
              {d === "blast" ? "영향 범위" : "수정 범위"}
            </button>
          ))}
        </div>
      </div>

      {!enabled ? (
        <div className="ws-debug__hint">모드 비활성 — ⌘⇧A 로 토글하세요.</div>
      ) : top.length === 0 ? (
        <div className="ws-debug__hint">아직 ROI 점수가 없습니다 (그래프 미로드).</div>
      ) : (
        <>
          <div className="ws-debug__divider">상위 {top.length}개 ROI</div>
          <div className="ws-debug__roi-list">
            {top.map(s => (
              <div
                key={s.fileId}
                className="ws-debug__sticky-row"
                title={s.fileId}
                onClick={() => actionTerrainStore.selectFile(s.fileId)}
              >
                <span className="ws-debug__sticky-text">
                  #{s.rank} {basename(s.fileId)}
                </span>
                <span className="ws-debug__roi-bar">
                  <span
                    className="ws-debug__roi-bar-fill"
                    style={{ width: `${Math.max(2, s.score)}%` }}
                  />
                </span>
                <span className="ws-debug__roi-num">
                  {Math.round(s.score)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
