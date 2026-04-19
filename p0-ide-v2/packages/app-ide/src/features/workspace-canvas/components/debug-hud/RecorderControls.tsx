import { usePerfRecorder } from "../../hooks/use-perf-recorder";
import { ToggleRow } from "./ToggleRow";

export function RecorderControls() {
  // Default-off per recorder contract — user opts in from this HUD.
  const perf = usePerfRecorder();
  const manual = perf.status.manual;
  const stateLabel = perf.status.capturing
    ? manual
      ? `녹화 중… ${perf.status.capturedFrames}프레임`
      : "캡처 중…"
    : perf.status.enabled
      ? "대기 중"
      : "끔";

  return (
    <>
      <div className="ws-debug__divider">성능 레코더</div>
      <ToggleRow
        label="FPS<45일 때 자동 녹화"
        checked={perf.status.enabled}
        onChange={v => perf.setEnabled(v)}
        disabled={manual}
        disabledReason="수동 녹화 중에는 변경 불가"
      />
      <div className="ws-debug__grid">
        <span className="ws-debug__k">상태</span>
        <span className={`ws-debug__v${perf.status.capturing ? " ws-debug__v--hl" : ""}`}>
          {stateLabel}
        </span>
        <span className="ws-debug__k">덤프</span>
        <span className="ws-debug__v">{perf.status.dumpsSent}</span>
        {perf.status.lastError && (
          <>
            <span className="ws-debug__k">오류</span>
            <span className="ws-debug__v" style={{ color: "#fca5a5" }}>{perf.status.lastError}</span>
          </>
        )}
      </div>
      {perf.status.logDir && (
        <div className="ws-debug__hint" title={perf.status.logDir}>
          → {perf.status.logDir.length > 36 ? "…" + perf.status.logDir.slice(-34) : perf.status.logDir}
        </div>
      )}
      <button
        type="button"
        className="ws-debug__chip"
        style={{
          marginTop: 4,
          width: "100%",
          background: manual ? "#7f1d1d" : undefined,
          color: manual ? "#fecaca" : undefined,
        }}
        onClick={manual ? perf.stopManual : perf.startManual}
        title={manual
          ? "녹화 정지 및 덤프 (시작 이후 모든 프레임, 메모리 + LOD + 씬 샘플 포함)"
          : "연속 녹화 시작 — 정지할 때까지 모든 프레임을 캡처"}
      >
        {manual ? "■ 정지 및 덤프" : "● 녹화 시작"}
      </button>
      <button
        type="button"
        className="ws-debug__chip"
        style={{ marginTop: 4, width: "100%" }}
        onClick={perf.dumpNow}
        disabled={manual}
        title="수동 캡처 없이 최근 약 3초 링 버퍼를 덤프"
      >
        링 덤프 (3초)
      </button>
    </>
  );
}
