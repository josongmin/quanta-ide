import { useMemo, useState } from "react";
import type { FileFacts } from "@quanta/app-ide/entities/file";
import { getConfigImpact, type ConfigKnob } from "@quanta/app-ide/entities/config-impact";
import { focusStore } from "@quanta/app-ide/stores/focus-store";

const KIND_LABEL: Record<ConfigKnob["kind"], string> = {
  "feature-flag": "Flag",
  env: "Env",
  secret: "Secret",
  "remote-config": "Remote",
};

export function ConfigPane({ file }: { file: FileFacts }) {
  const impact = useMemo(() => getConfigImpact(file.name), [file.name]);
  const [activeId, setActiveId] = useState(impact.knobs[0]?.id);
  const [simValues, setSimValues] = useState<Record<string, string | number | boolean>>(() =>
    Object.fromEntries(impact.knobs.map((k) => [k.id, k.current])),
  );

  const active = impact.knobs.find((k) => k.id === activeId) ?? impact.knobs[0];
  if (!active) return null;

  const simValue = simValues[active.id] ?? active.current;
  const isDirty = simValue !== active.current;

  return (
    <div className="cfg-pane">
      <ul className="cfg-list">
        {impact.knobs.map((k) => {
          const sim = simValues[k.id] ?? k.current;
          const dirty = sim !== k.current;
          return (
            <li key={k.id}>
              <button
                type="button"
                className={`cfg-list__item${k.id === active.id ? " is-active" : ""}${dirty ? " is-dirty" : ""}`}
                onClick={() => setActiveId(k.id)}
              >
                <span className={`cfg-list__kind cfg-list__kind--${k.kind}`}>{KIND_LABEL[k.kind]}</span>
                <span className="cfg-list__name">{k.name}</span>
                <span className="cfg-list__val">
                  {String(k.current)}
                  {dirty && <span className="cfg-list__sim"> → {String(sim)}</span>}
                </span>
                <span className="cfg-list__refs">{k.branches.length}b · {k.refs.length}r</span>
              </button>
            </li>
          );
        })}
      </ul>

      <section className="cfg-detail">
        <header className="cfg-detail__h">
          <div>
            <span className={`cfg-detail__kind cfg-detail__kind--${active.kind}`}>{KIND_LABEL[active.kind]}</span>
            <h3 className="cfg-detail__name">{active.name}</h3>
          </div>
          <span className="cfg-detail__owner">{active.owner}</span>
        </header>
        <p className="cfg-detail__purpose">{active.purpose}</p>

        <div className="cfg-sim">
          <div className="cfg-sim__h">
            <span className="cfg-sim__label">Simulate</span>
            {isDirty && <span className="cfg-sim__diff">unsaved · preview</span>}
          </div>
          <div className="cfg-sim__control">
            {active.type === "bool" && (
              <ToggleSwitch
                value={simValue === true}
                onChange={(v) => setSimValues((s) => ({ ...s, [active.id]: v }))}
              />
            )}
            {active.type === "enum" && active.values && (
              <div className="cfg-sim__seg">
                {active.values.map((v) => (
                  <button
                    key={String(v)}
                    type="button"
                    className={`cfg-sim__seg-btn${simValue === v ? " is-active" : ""}`}
                    onClick={() => setSimValues((s) => ({ ...s, [active.id]: v }))}
                  >
                    {String(v)}
                  </button>
                ))}
              </div>
            )}
            {active.type === "number" && (
              <input
                type="number"
                className="cfg-sim__num"
                value={Number(simValue)}
                onChange={(e) => setSimValues((s) => ({ ...s, [active.id]: Number(e.currentTarget.value) }))}
              />
            )}
            {active.type === "string" && (
              <input
                type="text"
                className="cfg-sim__txt"
                value={String(simValue)}
                onChange={(e) => setSimValues((s) => ({ ...s, [active.id]: e.currentTarget.value }))}
              />
            )}
          </div>
        </div>

        <div className="cfg-branches">
          <h4 className="cfg-branches__h">Branches gated by this knob</h4>
          {active.branches.map((b, i) => {
            const matches = simulateBranchTaken(b.when, simValue);
            return (
              <div key={i} className={`cfg-branch${matches ? " is-taken" : " is-skipped"}`}>
                <div className="cfg-branch__head">
                  <code className="cfg-branch__when">{b.when}</code>
                  <span className={`cfg-branch__state${matches ? " is-taken" : " is-skipped"}`}>
                    {matches ? "TAKEN" : "skipped"}
                  </span>
                </div>
                <div className="cfg-branch__effect">{b.effect}</div>
                <ul className="cfg-branch__refs">
                  {b.refs.map((r, j) => (
                    <li key={j}>
                      <button
                        type="button"
                        className="cfg-branch__ref"
                        onClick={() => focusStore.jumpTo(r.line)}
                      >
                        <span className="cfg-branch__ref-loc">{r.file}:{r.line}</span>
                        <code className="cfg-branch__ref-snip">{r.snippet}</code>
                      </button>
                    </li>
                  ))}
                </ul>
                {b.reaches.length > 0 && (
                  <div className="cfg-branch__reach">
                    reaches:
                    {b.reaches.map((r) => (
                      <code key={r} className="cfg-branch__reach-sym">{r}</code>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {active.refs.length > 0 && (
          <div className="cfg-refs">
            <h4 className="cfg-refs__h">Other references ({active.refs.length})</h4>
            <ul>
              {active.refs.map((r, i) => (
                <li key={i}>
                  <button type="button" className="cfg-refs__row" onClick={() => focusStore.jumpTo(r.line)}>
                    <span className="cfg-refs__loc">{r.file}:{r.line}</span>
                    <code className="cfg-refs__snip">{r.snippet}</code>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

function ToggleSwitch({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      className={`cfg-toggle${value ? " is-on" : ""}`}
      onClick={() => onChange(!value)}
    >
      <span className="cfg-toggle__track">
        <span className="cfg-toggle__thumb" />
      </span>
      <span className="cfg-toggle__label">{value ? "true" : "false"}</span>
    </button>
  );
}

function simulateBranchTaken(when: string, value: string | number | boolean): boolean {
  const w = when.replace(/\s+/g, "");
  if (w.includes("===true")) return value === true;
  if (w.includes("===false")) return value === false;
  if (w.includes(">=")) {
    const right = Number(w.split(">=")[1]);
    if (!Number.isNaN(right)) return Number(value) >= right;
  }
  if (w.includes(">")) {
    const right = Number(w.split(">")[1]);
    if (!Number.isNaN(right)) return Number(value) > right;
  }
  return true;
}
