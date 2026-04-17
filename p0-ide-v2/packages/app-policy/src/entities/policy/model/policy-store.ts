import { useSyncExternalStore } from "react";
import type {
  EngineType,
  PolicyCategory,
  PolicyRule,
  PolicyRuleStatus,
  PolicySeverity,
  PolicyTemplateId,
  PolicyViolation,
  SidebarItem,
  ViolationStatus,
} from "@quanta/domain-types/policies";
import { PREFIX_FOR_CATEGORY } from "@quanta/domain-types/policies";
import { SEED_RULES, SEED_VIOLATIONS } from "./sample";

// ── State shape ─────────────────────────────────────────────────

export interface PolicyFilters {
  category: PolicyCategory | "all";
  severity: PolicySeverity | "all";
  ruleStatus: PolicyRuleStatus | "all";
  engine: EngineType | "all";
  violationStatus: ViolationStatus | "all";
  searchQuery: string;
}

export interface PolicyState {
  rules: PolicyRule[];
  violations: PolicyViolation[];
  selectedRuleId: string | null;
  selectedViolationId: string | null;
  activeSidebarItem: SidebarItem;
  draft: Partial<PolicyRule> | null;
  filters: PolicyFilters;
}

// ── Helpers ─────────────────────────────────────────────────────

function nextId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function nextRuleNumber(rules: PolicyRule[], prefix: PolicyCategory): number {
  const p = PREFIX_FOR_CATEGORY[prefix];
  const nums = rules.filter((r) => r.ruleIdPrefix === p).map((r) => r.ruleNumber);
  return nums.length > 0 ? Math.max(...nums) + 1 : 1;
}

function seed(): PolicyState {
  return {
    rules: SEED_RULES,
    violations: SEED_VIOLATIONS,
    selectedRuleId: null,
    selectedViolationId: null,
    activeSidebarItem: "rule-catalog",
    draft: null,
    filters: {
      category: "all",
      severity: "all",
      ruleStatus: "all",
      engine: "all",
      violationStatus: "all",
      searchQuery: "",
    },
  };
}

// ── Store ───────────────────────────────────────────────────────

let state: PolicyState = seed();
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};

export const policyStore = {
  get: (): PolicyState => state,

  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },

  // ── Sidebar navigation ─────────────────────────────────────

  setSidebarItem(item: SidebarItem) {
    state = { ...state, activeSidebarItem: item };
    emit();
  },

  // ── Rule Library ───────────────────────────────────────────

  selectRule(id: string | null) {
    state = { ...state, selectedRuleId: id };
    emit();
  },

  toggleRuleStatus(id: string) {
    state = {
      ...state,
      rules: state.rules.map((r) =>
        r.id === id
          ? { ...r, status: r.status === "active" ? ("inactive" as const) : ("active" as const), updatedAt: Date.now() }
          : r,
      ),
    };
    emit();
  },

  // ── Rule Builder ───────────────────────────────────────────

  startNewRule(templateId?: PolicyTemplateId) {
    state = {
      ...state,
      activeSidebarItem: "authoring",
      draft: {
        templateId,
        source: "template",
        constraint: "deny",
        severity: "medium",
        category: "architecture",
        status: "draft",
        prGateEnabled: false,
        engine: "custom",
        tags: [],
        queryMatches: [],
        sourceScope: {},
        targetScope: {},
      },
    };
    emit();
  },

  updateDraft(patch: Partial<PolicyRule>) {
    state = { ...state, draft: { ...state.draft, ...patch } };
    emit();
  },

  saveDraft() {
    if (!state.draft?.name) return;
    const cat = state.draft.category ?? "architecture";
    const prefix = PREFIX_FOR_CATEGORY[cat];
    const num = nextRuleNumber(state.rules, cat);
    const now = Date.now();
    const newRule: PolicyRule = {
      id: nextId("rule"),
      ruleIdPrefix: prefix,
      ruleNumber: num,
      name: state.draft.name ?? "",
      description: state.draft.description ?? "",
      category: cat,
      severity: state.draft.severity ?? "medium",
      status: state.draft.status ?? "draft",
      source: state.draft.source ?? "template",
      templateId: state.draft.templateId,
      sourceScope: state.draft.sourceScope ?? {},
      targetScope: state.draft.targetScope ?? {},
      constraint: state.draft.constraint ?? "deny",
      owner: state.draft.owner ?? "",
      prGateEnabled: state.draft.prGateEnabled ?? false,
      engine: state.draft.engine ?? "custom",
      tags: state.draft.tags ?? [],
      queryMatches: [],
      violationCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    state = {
      ...state,
      rules: [...state.rules, newRule],
      draft: null,
      activeSidebarItem: "rule-catalog",
      selectedRuleId: newRule.id,
    };
    emit();
  },

  discardDraft() {
    state = { ...state, draft: null, activeSidebarItem: "rule-catalog" };
    emit();
  },

  editRule(id: string) {
    const rule = state.rules.find((r) => r.id === id);
    if (!rule) return;
    state = { ...state, activeSidebarItem: "authoring", draft: { ...rule } };
    emit();
  },

  // ── Violations ─────────────────────────────────────────────

  selectViolation(id: string | null) {
    state = { ...state, selectedViolationId: id };
    emit();
  },

  setViolationStatus(id: string, status: ViolationStatus) {
    state = {
      ...state,
      violations: state.violations.map((v) =>
        v.id === id ? { ...v, status } : v,
      ),
    };
    emit();
  },

  assignViolation(id: string, assignee: string) {
    state = {
      ...state,
      violations: state.violations.map((v) =>
        v.id === id ? { ...v, assignee } : v,
      ),
    };
    emit();
  },

  linkViolationPR(id: string, pr: string) {
    state = {
      ...state,
      violations: state.violations.map((v) =>
        v.id === id ? { ...v, linkedPR: pr } : v,
      ),
    };
    emit();
  },

  // ── Filters ────────────────────────────────────────────────

  setCategoryFilter(category: PolicyCategory | "all") {
    state = { ...state, filters: { ...state.filters, category } };
    emit();
  },

  setSeverityFilter(severity: PolicySeverity | "all") {
    state = { ...state, filters: { ...state.filters, severity } };
    emit();
  },

  setRuleStatusFilter(ruleStatus: PolicyRuleStatus | "all") {
    state = { ...state, filters: { ...state.filters, ruleStatus } };
    emit();
  },

  setEngineFilter(engine: EngineType | "all") {
    state = { ...state, filters: { ...state.filters, engine } };
    emit();
  },

  setViolationStatusFilter(violationStatus: ViolationStatus | "all") {
    state = { ...state, filters: { ...state.filters, violationStatus } };
    emit();
  },

  setSearchQuery(searchQuery: string) {
    state = { ...state, filters: { ...state.filters, searchQuery } };
    emit();
  },

  // ── Derived ────────────────────────────────────────────────

  filteredRules(): PolicyRule[] {
    const { category, severity, ruleStatus, engine, searchQuery } = state.filters;
    const q = searchQuery.toLowerCase();
    return state.rules.filter((r) => {
      if (category !== "all" && r.category !== category) return false;
      if (severity !== "all" && r.severity !== severity) return false;
      if (ruleStatus !== "all" && r.status !== ruleStatus) return false;
      if (engine !== "all" && r.engine !== engine) return false;
      if (q && !r.name.toLowerCase().includes(q) && !r.tags.some((t) => t.toLowerCase().includes(q))) return false;
      return true;
    });
  },

  filteredViolations(): PolicyViolation[] {
    const { violationStatus } = state.filters;
    return state.violations.filter((v) => {
      if (violationStatus !== "all" && v.status !== violationStatus) return false;
      return true;
    });
  },

  categoryCounts(): Record<PolicyCategory | "all", number> {
    const counts: Record<string, number> = { all: state.rules.length };
    for (const r of state.rules) {
      counts[r.category] = (counts[r.category] ?? 0) + 1;
    }
    return counts as Record<PolicyCategory | "all", number>;
  },

  stats() {
    const rules = state.rules;
    const violations = state.violations;
    return {
      totalRules: rules.length,
      activeRules: rules.filter((r) => r.status === "active").length,
      totalViolations: violations.length,
      openViolations: violations.filter((v) => v.status === "open").length,
      criticalViolations: violations.filter((v) => v.severity === "critical").length,
    };
  },
};

// ── Hook ────────────────────────────────────────────────────────

export function usePolicyStore<T>(selector: (s: PolicyState) => T): T {
  return useSyncExternalStore(
    policyStore.subscribe,
    () => selector(state),
    () => selector(state),
  );
}
