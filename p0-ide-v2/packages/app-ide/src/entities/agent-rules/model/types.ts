export interface RulesDocMeta {
  name: string;
  version: number;
  scope?: string;
}

export type Capability = "tool-permission" | "frontmatter" | "scoped" | "plain";

export interface RulesSection {
  title: string;
  level: number;
  body: string;
  scope?: string;
  capabilities: readonly Capability[];
}

export interface RulesDocument {
  meta: RulesDocMeta;
  sections: readonly RulesSection[];
}

export type DiagnosticKind = "unsupported" | "scope" | "format";

export interface Diagnostic {
  kind: DiagnosticKind;
  sectionTitle: string;
  targetId: string;
  message: string;
}

export interface RenderResult {
  output: string;
  diagnostics: readonly Diagnostic[];
}

export interface AdapterCapabilities {
  supportsFrontmatter: boolean;
  supportsToolPermission: boolean;
  supportsScoped: boolean;
}

export interface Adapter {
  id: string;
  label: string;
  outputPath: string;
  capabilities: AdapterCapabilities;
  parse(raw: string): RulesDocument;
  render(doc: RulesDocument): RenderResult;
}

export interface BuildTarget {
  id: string;
  label: string;
  outputPath: string;
  adapterId: string;
}

export interface BuildArtifact {
  targetId: string;
  outputPath: string;
  output: string;
  diagnostics: readonly Diagnostic[];
}

export interface BuildResult {
  artifacts: readonly BuildArtifact[];
  totalDiagnostics: number;
}
