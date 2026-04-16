import { useMemo, useState } from "react";
import {
  PRS,
  FILES,
  FINDINGS,
  REVIEWS,
  type Finding,
  type ReviewComment,
} from "@quanta/app-pr/entities/pr";

export function usePrPage() {
  const [activePrId, setActivePrId] = useState<string>("pr-1284");
  const [mode, setMode] = useState<"diff" | "insights" | "graph" | "tests">("diff");
  const [activePath, setActivePath] = useState<string>("src/payments/retry_handler.py");
  const [findings, setFindings] = useState<Finding[]>(FINDINGS);
  const [reviews, setReviews] = useState<ReviewComment[]>(REVIEWS);
  const [reviewedPaths, setReviewedPaths] = useState<Set<string>>(
    () => new Set(FILES.filter((f) => f.reviewed).map((f) => f.path)),
  );
  const [queueFilter, setQueueFilter] = useState<"all" | "mine" | "review">("all");
  const [splitView, setSplitView] = useState(false);

  const activePr = useMemo(() => PRS.find((p) => p.id === activePrId)!, [activePrId]);
  const activeFile = useMemo(() => FILES.find((f) => f.path === activePath)!, [activePath]);

  const reviewedCount = reviewedPaths.size;
  const totalFiles = FILES.length;
  const reviewedPct = Math.round((reviewedCount / totalFiles) * 100);

  const openFindings = findings.filter((f) => !f.applied);
  const autofixable = openFindings.filter((f) => f.autofix);
  const openReviews = reviews.filter((r) => !r.resolved && !r.applied);

  const applyFinding = (id: number) =>
    setFindings((list) => list.map((f) => (f.id === id ? { ...f, applied: true } : f)));
  const applyReview = (id: number) =>
    setReviews((list) => list.map((r) => (r.id === id ? { ...r, applied: true, resolved: true } : r)));
  const resolveReview = (id: number) =>
    setReviews((list) => list.map((r) => (r.id === id ? { ...r, resolved: true } : r)));

  const toggleReviewed = (path: string) =>
    setReviewedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const applyAllAutofix = () =>
    setFindings((list) => list.map((f) => (f.autofix && !f.applied ? { ...f, applied: true } : f)));

  const filteredPrs = PRS.filter((p) => {
    if (queueFilter === "mine") return p.author === "songmin";
    if (queueFilter === "review") return p.reviewers.some((r) => r.name === "songmin");
    return true;
  });

  return {
    activePrId,
    setActivePrId,
    mode,
    setMode,
    activePath,
    setActivePath,
    findings,
    reviews,
    reviewedPaths,
    queueFilter,
    setQueueFilter,
    splitView,
    setSplitView,
    activePr,
    activeFile,
    reviewedCount,
    totalFiles,
    reviewedPct,
    openFindings,
    autofixable,
    openReviews,
    applyFinding,
    applyReview,
    resolveReview,
    toggleReviewed,
    applyAllAutofix,
    filteredPrs,
  };
}
