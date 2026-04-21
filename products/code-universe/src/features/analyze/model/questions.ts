import type { Entity, EntityTree } from "@quanta/canvas-engine";
import { entityStore } from "../../../entities/entity";
import { mindMapStore } from "../../mind-map";
import { viewModeStore } from "../../view-mode";

// Analysis questions
// --------------------------------------------------------------------
// Instead of asking the user "which visualization do you want", the
// Inspector presents a list of NATURAL-LANGUAGE QUESTIONS ("what uses
// this?", "what breaks if I change it?", "package coupling here?"). A
// click on a question runs an `applyQuestion` orchestrator that:
//   1. Sets the active view mode (treemap / mindmap / chord / …)
//   2. Sets the focus / anchor / scope state appropriate to the view
//   3. Opens overlays (mind-map, later: blast, cycle) where needed
//
// Views remain user-facing via the toolbar for power users, but the
// primary flow is question → preset. This removes the "what does chord
// even show" paralysis that the raw view picker invited.

export type QuestionId =
  | "what-uses-this"
  | "what-does-this-use"
  | "blast-radius"
  | "package-coupling"
  | "cycles-here"
  | "risk-hotspots"
  | "what-layers-violate"
  | "refactor-priority";

export interface AnalysisQuestion {
  id: QuestionId;
  /** User-facing label — short imperative sentence, Korean primary +
   *  English hint so the Inspector reads naturally for both audiences. */
  label: string;
  /** Secondary one-line description of WHAT the view will show. */
  hint: string;
  /** Which entity kinds this question is meaningful for. Grey out the
   *  button when the selected entity isn't in the set. */
  applicableKinds: readonly Entity["kind"][];
}

const ALL_CONTAINER_KINDS = ["universe", "galaxy", "street"] as const;
const ALL_KINDS = ["universe", "galaxy", "street", "building", "floor", "room"] as const;

export const QUESTIONS: readonly AnalysisQuestion[] = [
  {
    id: "what-uses-this",
    label: "뭐가 이걸 쓰나?",
    hint: "Callers / fan-in — radial view, callers aggregator highlighted",
    applicableKinds: ALL_KINDS,
  },
  {
    id: "what-does-this-use",
    label: "이게 뭘 쓰나?",
    hint: "Callees / fan-out — radial view, callees aggregator highlighted",
    applicableKinds: ALL_KINDS,
  },
  {
    id: "blast-radius",
    label: "바꾸면 뭐가 터지나?",
    hint: "Blast radius — entities reachable via transitive dependency",
    applicableKinds: ALL_KINDS,
  },
  {
    id: "package-coupling",
    label: "패키지끼리 얼마나 얽혀있나?",
    hint: "Chord view — galaxy-to-galaxy import ribbons at workspace scope",
    applicableKinds: ALL_CONTAINER_KINDS,
  },
  {
    id: "cycles-here",
    label: "이 안에 순환 있나?",
    hint: "Arc diagram — backward edges = cycles",
    applicableKinds: ALL_CONTAINER_KINDS,
  },
  {
    id: "risk-hotspots",
    label: "위험 어디 집중됐나?",
    hint: "Churn × Risk 2×2 scatter — quadrant view",
    applicableKinds: ALL_CONTAINER_KINDS,
  },
  {
    id: "what-layers-violate",
    label: "Which layers are violated?",
    hint: "Architecture layer dependency violations",
    applicableKinds: ALL_CONTAINER_KINDS,
  },
  {
    id: "refactor-priority",
    label: "What should I fix first?",
    hint: "ROI-ranked refactor actions",
    applicableKinds: ALL_CONTAINER_KINDS,
  },
];

/** Pre-flight check — is this question meaningful for the given entity?
 *  Inspector buttons call this to grey out inapplicable actions. */
export function isQuestionApplicable(q: AnalysisQuestion, kind: Entity["kind"]): boolean {
  return q.applicableKinds.includes(kind);
}

/** Execute a question against a specific entity. Orchestrates view
 *  mode + focus/anchor + overlay opens in the right order so the
 *  canvas lands on the "answer" in one shot. */
export function applyQuestion(questionId: QuestionId, entity: Entity, _tree: EntityTree): void {
  switch (questionId) {
    case "what-uses-this":
    case "what-does-this-use": {
      // Both answers land in the mind-map centred on the entity; the
      // caller/callee aggregator is already part of the mind-map
      // layout, so no special filter is needed today. A future hint
      // could tell the mind-map to pre-expand the relevant aggregator.
      entityStore.selectEntity(entity.id);
      entityStore.setAnchor(entity.id);
      mindMapStore.openOn(entity.id);
      viewModeStore.setMode("mindmap");
      return;
    }
    case "blast-radius": {
      // MVP: reuse the mind-map for now — the callers aggregator
      // approximates "what breaks" for non-transitive cases. A future
      // dedicated blast view will light up hop-N rings explicitly.
      entityStore.selectEntity(entity.id);
      entityStore.setAnchor(entity.id);
      mindMapStore.openOn(entity.id);
      viewModeStore.setMode("mindmap");
      return;
    }
    case "package-coupling": {
      // Switch to chord view. The chord builder defaults to
      // galaxy-level leaves, so workspace scope (scopeId = null)
      // already produces the package-coupling ring. For container
      // entities other than universe, we could scope to the nearest
      // ancestor package, but universe-wide chord is usually the most
      // informative starting point.
      entityStore.selectEntity(entity.id);
      entityStore.setAnchor(null); // no focus filter — chord needs the whole picture
      mindMapStore.close();
      viewModeStore.setMode("chord");
      return;
    }
    case "cycles-here": {
      entityStore.selectEntity(entity.id);
      mindMapStore.close();
      viewModeStore.setMode("arc-cycles");
      return;
    }
    case "risk-hotspots": {
      entityStore.selectEntity(entity.id);
      mindMapStore.close();
      viewModeStore.setMode("quadrant");
      return;
    }
    case "what-layers-violate": {
      entityStore.selectEntity(entity.id);
      mindMapStore.close();
      viewModeStore.setMode("arch-layers");
      return;
    }
    case "refactor-priority": {
      entityStore.selectEntity(entity.id);
      mindMapStore.close();
      viewModeStore.setMode("refactor-terrain");
      return;
    }
  }
}
