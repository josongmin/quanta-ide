import { getAdapter } from "./adapters";
import type { BuildArtifact, BuildResult, BuildTarget, RulesDocument } from "./types";

export function buildDocument(doc: RulesDocument, targets: readonly BuildTarget[]): BuildResult {
  const artifacts: BuildArtifact[] = [];
  let totalDiagnostics = 0;
  for (const target of targets) {
    const adapter = getAdapter(target.adapterId);
    if (!adapter) continue;
    const result = adapter.render(doc);
    totalDiagnostics += result.diagnostics.length;
    artifacts.push({
      targetId: target.id,
      outputPath: target.outputPath,
      output: result.output,
      diagnostics: result.diagnostics,
    });
  }
  return { artifacts, totalDiagnostics };
}
