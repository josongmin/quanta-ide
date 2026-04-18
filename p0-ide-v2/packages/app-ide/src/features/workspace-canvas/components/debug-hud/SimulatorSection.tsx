import { perfSimulator, usePerfSimulator, type CpuPreset, type MemPreset } from "../../lib/perf-simulator";

const CPU_OPTIONS: readonly { value: CpuPreset; label: string; hint: string }[] = [
  { value: "off",    label: "off",    hint: "native speed" },
  { value: "light",  label: "light",  hint: "+6ms/frame  ≈ M1 Air on 10k files" },
  { value: "medium", label: "medium", hint: "+12ms/frame ≈ mid-tier Intel laptop" },
  { value: "heavy",  label: "heavy",  hint: "+20ms/frame ≈ 5-yr-old i5 / ChromeBook" },
];

const MEM_OPTIONS: readonly { value: MemPreset; label: string }[] = [
  { value: "off",    label: "off" },
  { value: "200mb",  label: "+200MB" },
  { value: "500mb",  label: "+500MB" },
  { value: "1gb",    label: "+1GB"  },
];

function fmtMB(n: number): string {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)}KB`;
  return `${(n / (1024 * 1024)).toFixed(0)}MB`;
}

export function SimulatorSection() {
  const state = usePerfSimulator(s => s);

  return (
    <>
      <div className="ws-debug__divider" title="Simulate lower-tier hardware to sanity-check how the canvas feels on slower machines.">
        perf simulator
      </div>

      <div className="ws-debug__grid">
        <span className="ws-debug__k" title="Busy-wait at the top of each animation frame, stealing budget from the real render.">cpu</span>
        <span className="ws-debug__v">
          <select
            value={state.cpuPreset}
            onChange={e => perfSimulator.setCpuPreset(e.target.value as CpuPreset)}
            className="ws-debug__select"
            title={CPU_OPTIONS.find(o => o.value === state.cpuPreset)?.hint}
          >
            {CPU_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </span>

        <span className="ws-debug__k" title="Hold ArrayBuffers to pressure V8. Simulates GC behavior of a 2-3× larger repo.">mem</span>
        <span className="ws-debug__v">
          <select
            value={state.memPreset}
            onChange={e => perfSimulator.setMemPreset(e.target.value as MemPreset)}
            className="ws-debug__select"
          >
            {MEM_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </span>

        <span className="ws-debug__k" title="Measured ms spent burning CPU this frame (EWMA).">burn</span>
        <span className={`ws-debug__v${state.lastBurnMs > 0 ? " ws-debug__v--hl" : ""}`}>
          {state.lastBurnMs > 0 ? `${state.lastBurnMs.toFixed(1)}ms` : "—"}
        </span>

        <span className="ws-debug__k">ballast</span>
        <span className="ws-debug__v">
          {state.memBytes > 0 ? fmtMB(state.memBytes) : "—"}
        </span>
      </div>

      {(state.cpuPreset !== "off" || state.memPreset !== "off") && (
        <button
          type="button"
          className="ws-debug__chip"
          style={{ marginTop: 4, width: "100%" }}
          onClick={() => perfSimulator.reset()}
          title="Clear CPU throttle + release memory ballast"
        >
          reset simulator
        </button>
      )}

      <div className="ws-debug__hint">
        Degrades live canvas. Pair with recording to capture a slow-machine trace.
      </div>
    </>
  );
}
