export interface ServiceNode {
  id: string;
  name: string;
  owner: string;
  status: "healthy" | "degraded" | "down";
}

export interface ServiceEdge {
  from: string;
  to: string;
  protocol: "gRPC" | "HTTP" | "Kafka" | "DB";
  impacted: boolean;
}

export interface CrossServiceImpact {
  originService: string;
  originSymbol: string;
  services: ServiceNode[];
  edges: ServiceEdge[];
  totalImpacted: number;
}

export const SAMPLE_CROSS_SERVICE: CrossServiceImpact = {
  originService: "payments-api",
  originSymbol: "processRefund",
  totalImpacted: 4,
  services: [
    { id: "payments", name: "payments-api", owner: "@payments-team", status: "healthy" },
    { id: "billing", name: "billing-service", owner: "@billing-team", status: "healthy" },
    { id: "webhook", name: "webhook-relay", owner: "@infra-team", status: "degraded" },
    { id: "ledger", name: "ledger-service", owner: "@finance-team", status: "healthy" },
    { id: "notify", name: "notification-svc", owner: "@platform-team", status: "healthy" },
    { id: "audit", name: "audit-trail", owner: "@compliance-team", status: "healthy" },
  ],
  edges: [
    { from: "payments", to: "billing", protocol: "gRPC", impacted: true },
    { from: "payments", to: "webhook", protocol: "HTTP", impacted: true },
    { from: "payments", to: "ledger", protocol: "gRPC", impacted: true },
    { from: "billing", to: "notify", protocol: "Kafka", impacted: true },
    { from: "ledger", to: "audit", protocol: "Kafka", impacted: false },
    { from: "webhook", to: "notify", protocol: "HTTP", impacted: false },
  ],
};
