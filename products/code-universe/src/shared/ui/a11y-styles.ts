// A11y styles
// --------------------------------------------------------------------
// One-time stylesheet injection that adds a consistent `:focus-visible`
// outline to every button / input / anchor inside the Code Universe
// surface. The default browser outline is inconsistent (Safari hides
// it, Chrome shows a weak default) and our inline-style buttons strip
// `outline` to avoid a double ring in hover state — so keyboard users
// get no affordance at all unless we re-introduce one here.
//
// WCAG 2.4.7 (Focus Visible) — keyboard focus must be distinguishable.
// The ring is 2px indigo with 2px offset, matching macOS/Chrome
// conventions. Scoped under `[data-product="code-universe"]` so it
// doesn't leak into the host shell / legacy tabs.

const INJECTED = "cu-a11y-styles";

export function ensureA11yStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(INJECTED)) return;
  const el = document.createElement("style");
  el.id = INJECTED;
  el.textContent = `
[data-product="code-universe"] :focus-visible,
[data-product="code-universe"] button:focus-visible,
[data-product="code-universe"] input:focus-visible,
[data-product="code-universe"] [role="button"]:focus-visible,
[data-product="code-universe"] [tabindex]:focus-visible {
  outline: 2px solid #6366f1;
  outline-offset: 2px;
  border-radius: 4px;
}
[data-product="code-universe"] button:focus:not(:focus-visible),
[data-product="code-universe"] input:focus:not(:focus-visible) {
  outline: none;
}
/* Modal / palette overlays keep their ring even without
 * :focus-visible so screen-reader users arrowing into the results
 * see a consistent indicator. */
[data-product="code-universe"] [role="dialog"] :focus {
  outline: 2px solid #6366f1;
  outline-offset: 2px;
}
/* Reduced motion — honour user preference by killing the
 * tier-reveal + toast entry animations so vestibular-sensitive
 * users aren't lurched through transitions. */
@media (prefers-reduced-motion: reduce) {
  [data-product="code-universe"] *,
  [data-product="code-universe"] *::before,
  [data-product="code-universe"] *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
  }
}
`;
  document.head.appendChild(el);
}
