import { useTranslation } from "react-i18next";

export interface FlowStep {
  group: string;
  step: string;
  tag?: "source" | "sink";
  sink?: boolean;
}

interface IdeDataFlowProps {
  steps: FlowStep[];
}

export function IdeDataFlow({ steps }: IdeDataFlowProps) {
  const { t } = useTranslation();
  return (
    <div className="ide-flow">
      {steps.map((s, i) => (
        <div key={`${s.group}-${s.step}-${i.toString()}`} className={`ide-flow-row${s.sink ? " is-sink" : ""}`}>
          <span>{t(`ide.dataFlow.${s.group}.${s.step}`)}</span>
          {s.tag !== undefined && <span className="ide-flow-tag">{t(`ide.dataFlow.tags.${s.tag}`)}</span>}
        </div>
      ))}
    </div>
  );
}
