import { ChevronRight } from "lucide-react";
import { CATEGORIES, type DemoPageMeta } from "../demo-registry";

export interface DemoCrumbsProps {
  page: DemoPageMeta;
  onReset: () => void;
}

export function DemoCrumbs({ page, onReset }: DemoCrumbsProps) {
  return (
    <header className="demo-crumbs">
      <button
        type="button"
        className="demo-crumbs__root"
        onClick={onReset}
      >
        Try demo
      </button>
      <ChevronRight size={13} strokeWidth={1.8} className="demo-crumbs__sep" aria-hidden />
      <span className="demo-crumbs__cat">
        {CATEGORIES.find((c) => c.id === page.category)?.label}
      </span>
      {page.id !== "catalog" && (
        <>
          <ChevronRight size={13} strokeWidth={1.8} className="demo-crumbs__sep" aria-hidden />
          <span className="demo-crumbs__current">{page.label}</span>
        </>
      )}
      <span className="demo-crumbs__spacer" />
      <span className="demo-crumbs__tag">Preview</span>
    </header>
  );
}
