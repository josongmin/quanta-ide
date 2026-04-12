"""
Ledger — financial entry management.

Analysis signals:
- risk 3: postEntry — writes to DB, 8 callers
- risk 3: reconcile — complex logic, uncovered
- coupling: co-changes with fee.ts 12 times
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class LedgerEntry:
    entry_id: str
    transaction_id: str
    amount: float
    entry_type: str  # "credit" | "debit" | "refund"
    timestamp: datetime = field(default_factory=datetime.utcnow)
    metadata: dict = field(default_factory=dict)


class LedgerService:
    """Financial ledger. postEntry has 8 callers across 3 services."""

    def __init__(self, db_connection):
        self.db = db_connection
        self._entries: list[LedgerEntry] = []

    async def postEntry(self, entry: LedgerEntry) -> bool:
        """
        Post ledger entry. risk 3 — DB write, 8 callers.
        Not wrapped in transaction — partial writes possible.
        """
        # BUG: no transaction wrapper
        self._entries.append(entry)
        logger.info("ledger entry posted: %s %s %.2f", entry.entry_id, entry.entry_type, entry.amount)
        return True

    async def reconcile(self, transaction_id: str) -> Optional[float]:
        """
        Reconcile all entries for a transaction. risk 3 — UNCOVERED.
        Complex: sums credits, debits, refunds and checks balance.
        """
        entries = [e for e in self._entries if e.transaction_id == transaction_id]
        if not entries:
            return None

        total = 0.0
        for e in entries:
            if e.entry_type == "credit":
                total += e.amount
            elif e.entry_type in ("debit", "refund"):
                total -= e.amount
        return total

    async def rollbackEntry(self, entry_id: str) -> bool:
        """Rollback a specific entry. UNCOVERED."""
        self._entries = [e for e in self._entries if e.entry_id != entry_id]
        return True
