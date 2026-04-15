import type { ReactNode } from "react";

function Hint({ keys, children }: { keys: string; children: ReactNode }) {
  return (
    <span className="cp__hint">
      <kbd>{keys}</kbd>
      <span className="cp__hint-label">{children}</span>
    </span>
  );
}

interface FooterHintsProps {
  resultCount: number;
  devMode: boolean;
}

export function FooterHints({ resultCount, devMode }: FooterHintsProps) {
  return (
    <div className="cp__foot">
      <span className="cp__foot-count">
        {resultCount} {resultCount === 1 ? "result" : "results"}
      </span>
      <div className="cp__foot-hints">
        <Hint keys="↑↓">navigate</Hint>
        <Hint keys="↵">run</Hint>
        <Hint keys="esc">dismiss</Hint>
        {!devMode && <Hint keys=">dev">dev</Hint>}
      </div>
    </div>
  );
}
