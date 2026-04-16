export function IconCloudUp() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 11h8a3 3 0 0 0 0-6 3.5 3.5 0 0 0-7 .5A2.5 2.5 0 0 0 4 11z" />
      <path d="M8 3v5M6 5l2-2 2 2" />
    </svg>
  );
}

export function IconSettings() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="8" cy="8" r="2" />
      <path d="M8 1v2M8 13v2M15 8h-2M3 8H1M13.2 2.8l-1.4 1.4M4.2 11.8l-1.4 1.4M13.2 13.2l-1.4-1.4M4.2 4.2 2.8 2.8" />
    </svg>
  );
}

export function IconPrGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="5" cy="5" r="2.2" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="11" cy="11" r="2.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6.5 6.5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function IconCloudGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 11h8a3 3 0 0 0 0-6 3.5 3.5 0 0 0-7 .5A2.5 2.5 0 0 0 4 11z" />
    </svg>
  );
}

export function IconChevDown() {
  return (
    <svg width="8" height="8" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="4 6 8 10 12 6" />
    </svg>
  );
}

export function IconChevDownTiny({ className }: { className?: string }) {
  return (
    <svg className={className} width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="4 6 8 10 12 6" />
    </svg>
  );
}

export function IconChevSidebar({ open }: { open: boolean }) {
  return (
    <svg className={`git-panel__chev${open ? " is-open" : ""}`} width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="6 3 11 8 6 13" />
    </svg>
  );
}

export function IconRefresh() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2.5 9A5.5 5.5 0 0 0 8 14.5v0a5.5 5.5 0 0 0 5-3.5M13.5 7A5.5 5.5 0 0 0 8 1.5v0a5.5 5.5 0 0 0-5 3.5M1.5 8h4.5V3.5M14.5 8H10v4.5" />
    </svg>
  );
}

export function IconCloudDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 11h8a3 3 0 0 0 0-6 3.5 3.5 0 0 0-7 .5A2.5 2.5 0 0 0 4 11z" />
      <path d="M8 13V7M6 9l2-2 2 2" />
    </svg>
  );
}

export function IconPull() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 2v9M5 8l3 3 3-3M3 14h10" />
    </svg>
  );
}

export function IconPush() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 14V5M5 6l3-3 3 3M3 2h10" />
    </svg>
  );
}
