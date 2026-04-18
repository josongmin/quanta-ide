import { perfSimulator, usePerfSimulator, type CpuPreset, type MemPreset } from "../../lib/perf-simulator";

const CPU_OPTIONS: readonly { value: CpuPreset; label: string; hint: string }[] = [
  { value: "off",    label: "끔",     hint: "네이티브 속도" },
  { value: "light",  label: "가벼움", hint: "+6ms/프레임  ≈ 파일 10k개의 M1 Air" },
  { value: "medium", label: "보통",   hint: "+12ms/프레임 ≈ 중급 Intel 노트북" },
  { value: "heavy",  label: "무거움", hint: "+20ms/프레임 ≈ 5년 된 i5 / 크롬북" },
];

const MEM_OPTIONS: readonly { value: MemPreset; label: string }[] = [
  { value: "off",    label: "끔" },
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
      <div className="ws-debug__divider" title="저사양 하드웨어를 시뮬레이션하여 느린 기기에서 캔버스가 어떻게 느껴지는지 확인합니다.">
        성능 시뮬레이터
      </div>

      <div className="ws-debug__grid">
        <span className="ws-debug__k" title="매 애니메이션 프레임 시작 시 비지 웨이트하여 실제 렌더 예산을 소모합니다.">CPU</span>
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

        <span className="ws-debug__k" title="ArrayBuffer를 유지해 V8에 메모리 압박을 가합니다. 2~3배 큰 저장소의 GC 동작을 시뮬레이션합니다.">메모리</span>
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

        <span className="ws-debug__k" title="이 프레임에서 CPU 소모에 쓴 측정 시간 (EWMA).">소모</span>
        <span className={`ws-debug__v${state.lastBurnMs > 0 ? " ws-debug__v--hl" : ""}`}>
          {state.lastBurnMs > 0 ? `${state.lastBurnMs.toFixed(1)}ms` : "—"}
        </span>

        <span className="ws-debug__k">밸러스트</span>
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
          title="CPU 스로틀 해제 + 메모리 밸러스트 해제"
        >
          시뮬레이터 초기화
        </button>
      )}

      <div className="ws-debug__hint">
        라이브 캔버스의 성능이 저하됩니다. 녹화와 함께 사용하여 저사양 기기 트레이스를 캡처하세요.
      </div>
    </>
  );
}
