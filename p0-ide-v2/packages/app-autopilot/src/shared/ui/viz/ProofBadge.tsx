import { ShieldCheck, ShieldAlert, SquareStack } from "lucide-react";
import { cn } from "@quanta/ui-kit/lib";
import type { ReviewerRecommendationKind, ProofComputedBy } from "@quanta/app-autopilot/entities/proof";
import "./proof-badge.css";

const KIND_TITLE: Record<ReviewerRecommendationKind, string> = {
  skip: "Skip review",
  skim: "Skim only",
  review: "Review",
  focus: "Focus review",
};

const KIND_SUBTITLE: Record<ReviewerRecommendationKind, string> = {
  skip: "mechanical · no surface change",
  skim: "behavior-preserving · strong proof",
  review: "intended change or medium risk",
  focus: "uncertainty or risk remaining",
};

export interface ProofBadgeProps {
  recommendation: ReviewerRecommendationKind;
  computedBy: ProofComputedBy;
  /** Compact variant renders as a chip instead of a card. */
  variant?: "card" | "chip";
  className?: string;
}

export function ProofBadge({
  recommendation,
  computedBy,
  variant = "card",
  className,
}: ProofBadgeProps) {
  const Icon =
    recommendation === "focus" ? ShieldAlert
      : recommendation === "review" ? SquareStack
      : ShieldCheck;

  if (variant === "chip") {
    return (
      <span
        className={cn(
          "ap-proof-chip",
          `ap-proof-chip--${recommendation}`,
          className,
        )}
      >
        <Icon size={12} strokeWidth={2} aria-hidden />
        <span>{KIND_TITLE[recommendation]}</span>
      </span>
    );
  }
  return (
    <div className={cn("ap-proof-badge", `ap-proof-badge--${recommendation}`, className)}>
      <div className="ap-proof-badge__icon">
        <Icon size={20} strokeWidth={1.8} aria-hidden />
      </div>
      <div className="ap-proof-badge__body">
        <div className="ap-proof-badge__title">{KIND_TITLE[recommendation]}</div>
        <div className="ap-proof-badge__sub">{KIND_SUBTITLE[recommendation]}</div>
      </div>
      <div
        className={cn(
          "ap-proof-badge__computed",
          computedBy === "operator_selfreport" && "is-warn",
        )}
        title={computedBy === "metric_engine" ? "Re-computed by metric engine" : "Self-reported by operator"}
      >
        <span className="ap-proof-badge__computed-dot" aria-hidden />
        <span className="ap-proof-badge__computed-label">
          {computedBy === "metric_engine" ? "verifier-backed" : "self-reported"}
        </span>
      </div>
    </div>
  );
}
