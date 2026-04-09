import { useChangeCard } from "@/features/ide-change-card";
import { useFlowTrace, MOCK_TRACE } from "@/features/ide-flow-trace";
import { useOwnershipMap } from "@/features/ide-ownership-map";
import { usePrDisaster } from "@/features/ide-pr-disaster";
import { useRiskDrawer } from "@/features/ide-risk-drawer";
import { useSemanticPr } from "@/features/ide-semantic-pr";
import { useSimulateChange } from "@/features/ide-simulate-change";
import { useTimeTravel } from "@/features/ide-time-travel";
import { useCommandPalette } from "./useCommandPalette";

export type DispatchTarget = string;

/** Resolved by IdePage at runtime to inject the active file's proposal. */
let suggestedProposalResolver: (() => unknown) | null = null;

export function setSuggestedProposalResolver(fn: () => unknown): void {
  suggestedProposalResolver = fn;
}

/**
 * Dispatch a command action. Call after selecting an item from
 * Command Palette or Context Menu.
 */
export function dispatchCommand(id: DispatchTarget): void {
  switch (id) {
    case "callgraph":
    case "x2":
      scrollInspectorTo("Call Graph");
      break;
    case "blast":
    case "x3":
      scrollInspectorTo("Blast Radius");
      break;
    case "fix":
    case "x4": {
      // Open ChangeCard with the active file's proposal if available,
      // otherwise just scroll the Inspector to the Suggested Fix section.
      if (suggestedProposalResolver) {
        const proposal = suggestedProposalResolver();
        if (proposal) {
          // dynamic typing: dispatcher is wired by IdePage which knows the type
          (useChangeCard.getState().open as (p: unknown) => void)(proposal);
          break;
        }
      }
      scrollInspectorTo("Suggested Fix");
      break;
    }

    case "simulate":
    case "x1":
    case "a2":
      useSimulateChange.getState().open();
      break;
    case "history":
    case "x6":
      useTimeTravel.getState().open();
      break;
    case "dataflow":
    case "taint":
      useFlowTrace.getState().toggle(MOCK_TRACE);
      break;
    case "ask":
    case "n1": case "n2": case "n3": case "n4": case "n5":
      useCommandPalette.getState().open();
      break;

    case "dead":
      useRiskDrawer.getState().open();
      break;

    case "extract":
    case "x5":
      useSimulateChange.getState().open();
      break;

    case "refs":
      scrollInspectorTo("Call Graph");
      break;

    case "pr":
      useSemanticPr.getState().open();
      break;

    case "preflight":
      usePrDisaster.getState().open();
      break;

    case "ownership":
      useOwnershipMap.getState().toggle();
      break;

    case "a1": case "a3": case "a4":
    case "r1": case "r2": case "r3":
      break;

    default:
      break;
  }
}

function scrollInspectorTo(labelText: string): void {
  const labels = document.querySelectorAll(".ide-label");
  for (const el of labels) {
    if (el.textContent.includes(labelText)) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      const section = el.closest(".ide-inspector-section");
      if (section) {
        section.classList.add("is-flash");
        setTimeout(() => { section.classList.remove("is-flash"); }, 800);
      }
      break;
    }
  }
}
