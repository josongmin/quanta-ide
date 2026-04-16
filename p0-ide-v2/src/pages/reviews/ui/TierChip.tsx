import { TIER_LABEL, TIER_REVIEW_HINT, type PatchTier } from "@/entities/proof-pr";

export function TierChip({ tier, count }: { tier: PatchTier; count: number }) {
  return (
    <span className={`rev-tier rev-tier--${tier}`}>
      <span className="rev-tier__count">{count}</span>
      <span className="rev-tier__label">{TIER_LABEL[tier]}</span>
      <span className="rev-tier__hint">{TIER_REVIEW_HINT[tier]}</span>
    </span>
  );
}
