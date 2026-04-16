/* InsightsView — metric cards + inline charts */
import { METRIC_CARDS, CALL_EDGES, INCIDENTS, OWNERS } from "./insights-view.mock";
import { InsCard } from "./InsCard";
import {
  BlastChart,
  RiskChart,
  CovChart,
  ComplexChart,
  TestRateChart,
  LatencyChart,
} from "./InsightsCharts";
import { CallGraphSection } from "./CallGraphSection";
import { IncidentSection } from "./IncidentSection";
import { OwnershipSection } from "./OwnershipSection";

const CHART_MAP: Record<string, React.ReactNode> = {
  "Blast Radius": <BlastChart />,
  "Structural Risk": <RiskChart />,
  "Coverage": <CovChart />,
  "Complexity": <ComplexChart />,
  "Test Pass Rate": <TestRateChart />,
  "API Latency p99": <LatencyChart />,
};

export function InsightsView() {
  return (
    <div className="pr-page__insights">
      <div className="pr-page__ins-grid">
        {METRIC_CARDS.map((card) => (
          <InsCard
            key={card.title}
            title={card.title}
            hero={card.hero}
            unit={card.unit}
            delta={card.delta}
            sub={card.sub}
            foot={card.foot}
            tone={card.tone}
            chart={CHART_MAP[card.title]}
          />
        ))}
      </div>
      <CallGraphSection edges={CALL_EDGES} />
      <IncidentSection incidents={INCIDENTS} />
      <OwnershipSection owners={OWNERS} />
    </div>
  );
}
