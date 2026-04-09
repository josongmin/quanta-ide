export interface FlowStep {
  label: string;
  tag?: string;
  sink?: boolean;
}

interface IdeDataFlowProps {
  steps: FlowStep[];
}

export function IdeDataFlow({ steps }: IdeDataFlowProps) {
  return (
    <div className="ide-flow">
      {steps.map((s, i) => (
        <div key={`${s.label}-${i.toString()}`} className={`ide-flow-row${s.sink ? " is-sink" : ""}`}>
          <span>{s.label}</span>
          {s.tag && <span className="ide-flow-tag">{s.tag}</span>}
        </div>
      ))}
    </div>
  );
}
