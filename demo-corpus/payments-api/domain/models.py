"""Domain models shared across the payments-api."""

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class AgentTask:
    task_id: str
    task_type: str  # "analysis" | "generation" | "review" | "completion"
    target: str
    complexity_hint: Optional[str] = None  # "simple" | "medium" | "complex"
    metadata: dict = field(default_factory=dict)


@dataclass
class WorkflowResult:
    status: str  # "completed" | "failed" | "partial"
    data: dict = field(default_factory=dict)
    errors: list[str] = field(default_factory=list)


@dataclass
class RefundRequest:
    """Refund domain object. amount is user-controlled — taint source."""
    transaction_id: str
    amount: float  # taint source: from user input
    reason: str
    actor: str
    idempotency_key: Optional[str] = None


@dataclass
class FeeCalculation:
    base_amount: float
    fee_rate: float
    fee_amount: float
    total: float
    rule_id: str
