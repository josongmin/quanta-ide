import { useFlowTrace, MOCK_TRACE } from "@/features/ide-flow-trace";
import { useRiskDrawer } from "@/features/ide-risk-drawer";
import { useSimulateChange } from "@/features/ide-simulate-change";
import { useTimeTravel } from "@/features/ide-time-travel";
import { useCommandPalette } from "./useCommandPalette";

export type DispatchTarget = string;

/**
 * Dispatch a command action. Call after selecting an item from
 * Command Palette or Context Menu.
 */
export function dispatchCommand(id: DispatchTarget): void {
  switch (id) {
    // scroll to inspector section
    case "callgraph":
    case "x2":
      scrollInspectorTo("Call Graph");
      break;
    case "blast":
    case "x3":
      scrollInspectorTo("Blast Radius");
      break;
    case "fix":
    case "x4":
      scrollInspectorTo("Suggested Fix");
      break;

    // open panels
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

    // risk drawer
    case "dead":
      useRiskDrawer.getState().open();
      break;

    // extract = simulate in extract mode (for demo, same panel)
    case "extract":
    case "x5":
      useSimulateChange.getState().open();
      break;

    // find references — scroll to call graph as proxy
    case "refs":
      scrollInspectorTo("Call Graph");
      break;

    // "ask" type commands — open command palette pre-filled
    case "a1": case "a3": case "a4":
    case "r1": case "r2": case "r3":
      // already handled by palette close — just close
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
      // brief highlight
      const section = el.closest(".ide-inspector-section");
      if (section) {
        section.classList.add("is-flash");
        setTimeout(() => { section.classList.remove("is-flash"); }, 800);
      }
      break;
    }
  }
}
