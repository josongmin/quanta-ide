import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

interface IdeSuggestedFixProps {
  title: string;
  code: ReactNode;
  meta: { k: string; v: string }[];
  onApply?: () => void;
  onDismiss?: () => void;
}

export function IdeSuggestedFix({ title, code, meta, onApply, onDismiss }: IdeSuggestedFixProps) {
  const { t } = useTranslation();
  return (
    <div className="ide-fix">
      <div className="ide-fix-title">{title}</div>
      <pre className="ide-fix-code">{code}</pre>
      <div className="ide-fix-meta">
        {meta.map((m) => (
          <div key={m.k} style={{ display: "contents" }}>
            <span className="ide-fix-meta-k">{m.k}</span>
            <span className="ide-fix-meta-v">{m.v}</span>
          </div>
        ))}
      </div>
      <div className="ide-fix-actions">
        <button type="button" className="ide-btn" onClick={onDismiss}>
          {t("ide.suggestedFix.dismiss")}<span className="ide-btn-key">⎋</span>
        </button>
        <button type="button" className="ide-btn is-primary" onClick={onApply}>
          {t("ide.suggestedFix.apply")}<span className="ide-btn-key">⏎</span>
        </button>
      </div>
    </div>
  );
}
