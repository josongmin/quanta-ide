"""
Billing service — charge cycles and plan management.

Analysis signals:
- risk 3: chargeCycle — hot path via orchestrator, uncovered
- transitive dependency: orchestrator → fee → billing
"""

import logging
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class BillingPlan:
    plan_id: str
    name: str
    base_rate: float
    cycle_days: int = 30


@dataclass
class ChargeResult:
    success: bool
    amount: float
    plan_id: str
    error: Optional[str] = None


class BillingService:
    """Billing cycle management. chargeCycle is hot path."""

    def __init__(self, ledger_service, fee_calculator):
        self.ledger = ledger_service
        self.fee_calc = fee_calculator

    async def chargeCycle(self, customer_id: str, plan: BillingPlan) -> ChargeResult:
        """
        Execute billing charge cycle. risk 3 — hot path.
        UNCOVERED — 0 tests.
        Transitive: orchestrator → fee → billing → ledger.
        """
        try:
            fee = self.fee_calc(plan.base_rate)
            # ... charge logic
            logger.info("charged customer %s: %.2f", customer_id, fee.total)
            return ChargeResult(success=True, amount=fee.total, plan_id=plan.plan_id)
        except Exception as e:
            return ChargeResult(success=False, amount=0, plan_id=plan.plan_id, error=str(e))
