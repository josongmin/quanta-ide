export function ExpandAllIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 6 8 2 12 6" />
      <polyline points="4 10 8 14 12 10" />
    </svg>
  );
}

export function CollapseAllIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 3 8 7 12 3" />
      <polyline points="4 13 8 9 12 13" />
    </svg>
  );
}

export function ClockIcon() {
  return (
    <svg width="7" height="7" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6" />
      <polyline points="8 4 8 8 11 10" />
    </svg>
  );
}

export function PaletteIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 14A6 6 0 1 1 14 8c0 1.1-.9 2-2 2h-1.2a1.2 1.2 0 0 0-.9 2 1.2 1.2 0 0 1-1 2z" />
      <circle cx="5.5" cy="7" r=".7" fill="currentColor" stroke="none" />
      <circle cx="8" cy="5" r=".7" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="7" r=".7" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ChevronDownTiny() {
  return (
    <svg width="8" height="8" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 6 8 10 12 6" />
    </svg>
  );
}

export function GitBranchIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="4" cy="3" r="1.6" />
      <circle cx="4" cy="13" r="1.6" />
      <circle cx="12" cy="6" r="1.6" />
      <path d="M4 4.6v6.8" />
      <path d="M12 7.6c0 2.4-2 3.4-4 3.4" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

export function DatabaseIcon() {
  return (
    <svg className="ide-dep-icon" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="8" cy="4" rx="5.5" ry="2.2" />
      <path d="M2.5 4v8c0 1.2 2.5 2.2 5.5 2.2s5.5-1 5.5-2.2V4" />
      <path d="M2.5 8c0 1.2 2.5 2.2 5.5 2.2s5.5-1 5.5-2.2" />
    </svg>
  );
}

export function ProjectLinkIcon() {
  return (
    <svg className="ide-dep-icon" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 9.5l3-3" />
      <path d="M9 7l1.8-1.8a2 2 0 0 0-2.8-2.8L6.2 4.2" />
      <path d="M7 9l-1.8 1.8a2 2 0 0 0 2.8 2.8L9.8 11.8" />
    </svg>
  );
}

export function ApiIcon() {
  return (
    <svg className="ide-dep-icon" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="5.5" />
      <path d="M2.5 8h11" />
      <path d="M8 2.5c-1.8 2-2.8 3.8-2.8 5.5s1 3.5 2.8 5.5" />
      <path d="M8 2.5c1.8 2 2.8 3.8 2.8 5.5s-1 3.5-2.8 5.5" />
    </svg>
  );
}

export function ServiceIcon() {
  return (
    <svg className="ide-dep-icon" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="2" />
      <path d="M8 2.5v1.5M8 12v1.5M3.2 4.8l1 1M11.8 11.2l1 1M2.5 8H4M12 8h1.5M3.2 11.2l1-1M11.8 4.8l1-1" />
    </svg>
  );
}
