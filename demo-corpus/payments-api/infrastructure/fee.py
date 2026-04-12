"""
Fee calculation — blast radius direct caller of orchestrator.

Analysis signals:
- risk 4: calculateFee — tainted amount, no validation
- uncovered: validateFeeRule, applyDiscount (0 tests)
- 22 commits in 30d (rising churn)
"""

from dataclasses import dataclass
from typing import Optional

from domain.models import FeeCalculation


@dataclass
class FeeRule:
    rule_id: str
    rate: float
    min_amount: float
    max_amount: float
    active: bool = True


# Fee rule registry — loaded from config
FEE_RULES: list[FeeRule] = [
    FeeRule(rule_id="standard", rate=0.029, min_amount=0.50, max_amount=10000),
    FeeRule(rule_id="premium", rate=0.015, min_amount=1.00, max_amount=50000),
    FeeRule(rule_id="micro", rate=0.05, min_amount=0.01, max_amount=5.00),
]


def calculateFee(amount: float, rule_id: str = "standard") -> FeeCalculation:
    """
    Calculate fee for transaction. risk 4 — amount is user-controlled.
    No input validation: negative amounts produce negative fees.
    12 callers, 0 tests.
    """
    rule = next((r for r in FEE_RULES if r.rule_id == rule_id), FEE_RULES[0])
    # BUG: no bounds check on amount
    fee_amount = amount * rule.rate
    return FeeCalculation(
        base_amount=amount,
        fee_rate=rule.rate,
        fee_amount=fee_amount,
        total=amount + fee_amount,
        rule_id=rule.rule_id,
    )


def validateFeeRule(rule: FeeRule) -> bool:
    """Validate fee rule constraints. UNCOVERED — 0 tests."""
    if rule.rate < 0 or rule.rate > 1:
        return False
    if rule.min_amount >= rule.max_amount:
        return False
    return True


def applyDiscount(amount: float, discount_pct: float) -> float:
    """Apply discount. UNCOVERED — 0 tests. No bounds check on discount_pct."""
    return amount * (1 - discount_pct / 100)


@dataclass
class FeeConfig:
    """Fee configuration type. risk 2 — co-changes with calculateFee."""
    default_rule: str = "standard"
    override_rules: dict[str, str] = None  # type: ignore[assignment]
    enabled: bool = True
