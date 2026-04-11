/* ── Chat message types ─────────────────────────────────────────────── */

export interface CodeBlock { lang: string; file?: string; code: string }
export interface MetricItem { label: string; value: string | number; risk?: boolean }
export type BulletItem = string;
export type ArtifactItem = string;

export type MsgContent =
  | { type: "text"; text: string }
  | { type: "code"; block: CodeBlock }
  | { type: "metrics"; items: MetricItem[] }
  | { type: "bullets"; items: BulletItem[] }
  | { type: "artifacts"; items: ArtifactItem[] };

export interface ChatMsg { id: string; role: "user" | "agent"; parts: MsgContent[] }

export interface SessionChat { messages: ChatMsg[]; typing: boolean }
