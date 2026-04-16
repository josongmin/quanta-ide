import type { ComponentType } from "react";
import "./pr-page.css";
import type { Mode, FileDiff, Finding, ReviewComment } from "@/entities/pr";
import { DiffView } from "./views/DiffView";
import { InsightsView } from "./views/InsightsView";
import { GraphView } from "./views/GraphView";
import { TestsView } from "./views/TestsView";
import { usePrPage } from "../model/use-pr-page";
import { PrSidebar } from "./internal/PrSidebar";
import { PrHeader } from "./internal/PrHeader";
import { PrFindingsPanel } from "./internal/PrFindingsPanel";
import { PrReviewsPanel } from "./internal/PrReviewsPanel";

type ViewProps = {
  file: FileDiff;
  findings: Finding[];
  reviews: ReviewComment[];
};

const VIEW_REGISTRY: Record<Mode, ComponentType<ViewProps>> = {
  diff: ({ file, findings, reviews }) => (
    <DiffView file={file} findings={findings} reviews={reviews} />
  ),
  insights: () => <InsightsView />,
  graph: () => <GraphView />,
  tests: () => <TestsView />,
};


export function PrPage() {
  const s = usePrPage();

  const View = VIEW_REGISTRY[s.mode];

  return (
    <div className="pr-page">
      {/* ══════ LEFT: PR queue + file list ══════ */}
      <PrSidebar
        activePrId={s.activePrId}
        setActivePrId={s.setActivePrId}
        activePath={s.activePath}
        setActivePath={s.setActivePath}
        queueFilter={s.queueFilter}
        setQueueFilter={s.setQueueFilter}
        filteredPrs={s.filteredPrs}
        reviewedPaths={s.reviewedPaths}
        reviewedCount={s.reviewedCount}
        totalFiles={s.totalFiles}
      />

      {/* ══════ CENTER: header + canvas ══════ */}
      <main className="pr-page__main">
        <PrHeader
          activePr={s.activePr}
          mode={s.mode}
          setMode={s.setMode}
          splitView={s.splitView}
          setSplitView={s.setSplitView}
          activePath={s.activePath}
          reviewedPaths={s.reviewedPaths}
          toggleReviewed={s.toggleReviewed}
          openFindings={s.openFindings}
          autofixable={s.autofixable}
          openReviews={s.openReviews}
          reviewedPct={s.reviewedPct}
        />

        <div className="pr-page__canvas">
          <View file={s.activeFile} findings={s.findings} reviews={s.reviews} />
        </div>
      </main>

      {/* ══════ RIGHT: static engine + reviews ══════ */}
      <aside className="pr-page__right">
        <PrFindingsPanel
          findings={s.findings}
          openFindings={s.openFindings}
          autofixable={s.autofixable}
          applyFinding={s.applyFinding}
          applyAllAutofix={s.applyAllAutofix}
        />
        <PrReviewsPanel
          reviews={s.reviews}
          openReviews={s.openReviews}
          applyReview={s.applyReview}
          resolveReview={s.resolveReview}
        />
      </aside>
    </div>
  );
}
