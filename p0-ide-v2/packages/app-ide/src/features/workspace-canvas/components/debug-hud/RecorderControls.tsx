import { usePerfRecorder } from "../../hooks/use-perf-recorder";

export function RecorderControls() {
  // Default-off per recorder contract — user opts in from this HUD.
  const perf = usePerfRecorder();
  const manual = perf.status.manual;
  const stateLabel = perf.status.capturing
    ? manual
      ? `recording… ${perf.status.capturedFrames}f`
      : "capturing…"
    : perf.status.enabled
      ? "armed"
      : "off";

  return (
    <>
      <div className="ws-debug__divider">perf recorder</div>
      <label className="ws-debug__row">
        <input
          type="checkbox"
          checked={perf.status.enabled}
          onChange={e => perf.setEnabled(e.target.checked)}
          disabled={manual}
        />
        <span>auto-record on fps&lt;45</span>
      </label>
      <div className="ws-debug__grid">
        <span className="ws-debug__k">state</span>
        <span className={`ws-debug__v${perf.status.capturing ? " ws-debug__v--hl" : ""}`}>
          {stateLabel}
        </span>
        <span className="ws-debug__k">dumps</span>
        <span className="ws-debug__v">{perf.status.dumpsSent}</span>
        {perf.status.lastError && (
          <>
            <span className="ws-debug__k">err</span>
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
          ? "stop recording and dump (every frame since start, incl. memory + LOD + scene samples)"
          : "start continuous recording — captures every frame until you stop"}
      >
        {manual ? "■ stop & dump" : "● start recording"}
      </button>
      <button
        type="button"
        className="ws-debug__chip"
        style={{ marginTop: 4, width: "100%" }}
        onClick={perf.dumpNow}
        disabled={manual}
        title="dump the last ~3s ring buffer without starting a manual capture"
      >
        dump ring (3s)
      </button>
    </>
  );
}
