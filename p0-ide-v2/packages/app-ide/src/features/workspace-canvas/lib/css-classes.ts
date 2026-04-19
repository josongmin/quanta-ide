// Add new class names here before referencing them in JSX — keeps a single
// allow-list so typos become type errors instead of missing styles at
// runtime. Values mirror selectors in workspace-canvas.css.

export const WS_CLASSES = {
  debugGroups: "ws-debug__groups",
  debugGroupTab: "ws-debug__group-tab",
  debugTabs: "ws-debug__tabs",
  debugTab: "ws-debug__tab",
  debugBody: "ws-debug__body",
  debugGrid: "ws-debug__grid",
  debugToggle: "ws-debug__launcher",
  debugK: "ws-debug__k",
  debugV: "ws-debug__v",

  loading: "ws-loading",
  loadingInner: "ws-loading__inner",
  loadingSpinner: "ws-loading__spinner",
  loadingMessage: "ws-loading__message",

  evidence: "ws-evidence",
  evidenceHeader: "ws-evidence__header",
  evidenceTitle: "ws-evidence__title",
  evidenceSeverity: "ws-evidence__severity",
  evidenceKind: "ws-evidence__kind",
  evidenceRule: "ws-evidence__rule",
  evidenceClose: "ws-evidence__close",
  evidenceSummary: "ws-evidence__summary",
  evidenceMeta: "ws-evidence__meta",
  evidenceSteps: "ws-evidence__steps",
  evidenceStep: "ws-evidence__step",
  evidenceStepHead: "ws-evidence__step-head",
  evidenceStepNum: "ws-evidence__step-num",
  evidenceStepRole: "ws-evidence__step-role",
  evidenceStepLoc: "ws-evidence__step-loc",
  evidenceSnippet: "ws-evidence__snippet",
  evidenceStepDesc: "ws-evidence__step-desc",
  evidenceFooter: "ws-evidence__footer",
  evidenceHint: "ws-evidence__hint",

  sticky: "ws-sticky",
  stickyHeader: "ws-sticky__header",
  stickyAuthor: "ws-sticky__author",
  stickyActions: "ws-sticky__actions",
  stickyResolve: "ws-sticky__resolve",
  stickyClose: "ws-sticky__close",
  stickyBody: "ws-sticky__body",
  stickyTextarea: "ws-sticky__textarea",
  stickyText: "ws-sticky__text",
  stickyPlaceholder: "ws-sticky__placeholder",
  stickyColorpicker: "ws-sticky__colorpicker",
  stickyDot: "ws-sticky__dot",
  stickyPin: "ws-sticky__pin",

  minimap: "ws-minimap",
  minimapCanvas: "ws-minimap__canvas",
  minimapFrame: "ws-minimap__frame",

  streetCard: "street-card",
  groundCard: "ground-card",
} as const;

export type WsClassName = (typeof WS_CLASSES)[keyof typeof WS_CLASSES];
