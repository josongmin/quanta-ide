// SBOM — Software Bill of Materials descriptor.
// --------------------------------------------------------------------
// SPDX 2.3 / CycloneDX-style recursive package manifest. Each node in
// the tree carries name + version + license + Sigstore signing state +
// provenance attestation status + CVE count. Top-line summary tiles:
// total packages, signed %, verified provenance %, and package-with-CVE
// count.
//
// Reference: Sigstore · CycloneDX · SPDX 2.3; CISA SBOM guidance
// (aligned with Executive Order 14028 — "Improving the Nation's
// Cybersecurity").

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { SbomView } from "./ui/SbomView";

function SbomModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <SbomView ctx={ctx} />;
}

export const sbomViewDescriptor: ViewDescriptor = {
  id: "sbom",
  label: "SBOM",
  glyph: "⛶",
  hint: "SBOM — 공급망 계보 + provenance",
  tech: "Sigstore × CycloneDX × SPDX 2.3",
  usecase: "공급망 보안. 서명/검증 상태 감사. 규제(EO 14028) 대응.",
  category: "security",
  contexts: ["repo"],
  needs: { tree: true },
  order: 580,
  Component: SbomModeView,
};
