// MemoryVault view descriptor.
// --------------------------------------------------------------------
// Persistent facts the agent remembers about this repo.
// Kind filter × fact cards with confidence / source / usage.
//
// Reference: LangMem / Letta (MemGPT) persistent memory; Claude
// Projects knowledge; Anthropic "Creating effective Claude Projects"
// (2024).

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { MemoryVaultView } from "./ui/MemoryVaultView";

function MemoryVaultModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  return <MemoryVaultView ctx={ctx} />;
}

export const memoryVaultViewDescriptor: ViewDescriptor = {
  id: "memory-vault",
  label: "Memory",
  glyph: "▥",
  hint: "에이전트 메모리 금고",
  tech: "team-curated + agent-inferred facts × confidence × verification",
  usecase: "에이전트가 이 repo만의 규약/함정을 기억. 매 세션 재설명 불필요.",
  category: "ai",
  contexts: ["repo"],
  needs: { tree: true },
  order: 970,
  Component: MemoryVaultModeView,
};
