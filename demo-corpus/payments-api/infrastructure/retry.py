"""
RetryScheduler — configurable retry with backoff.

Analysis signals:
- risk 3: RetryScheduler — coupled with orchestrator retry loop
- uncovered: backoff() — 0 tests
- dead: MAX_RETRIES const (replaced by config-driven value)
"""

import asyncio
import logging
from dataclasses import dataclass
from typing import Callable, Awaitable, TypeVar

logger = logging.getLogger(__name__)
T = TypeVar("T")

# DEAD: replaced by config-driven retry_count in orchestrator
MAX_RETRIES = 3


@dataclass
class RetryConfig:
    max_attempts: int = 3
    base_delay_s: float = 0.5
    max_delay_s: float = 30.0
    exponential: bool = True


class RetryScheduler:
    """Configurable async retry with exponential backoff. risk 3."""

    def __init__(self, config: RetryConfig = RetryConfig()):
        self.config = config
        self._attempt_count = 0

    async def execute(self, fn: Callable[[], Awaitable[T]]) -> T:
        """Execute fn with retries. 3 callers."""
        last_error: Exception | None = None
        for attempt in range(self.config.max_attempts):
            try:
                self._attempt_count = attempt + 1
                return await fn()
            except Exception as e:
                last_error = e
                delay = self._compute_delay(attempt)
                logger.warning("retry %d/%d, next in %.1fs", attempt + 1, self.config.max_attempts, delay)
                await asyncio.sleep(delay)
        raise last_error  # type: ignore[misc]

    def _compute_delay(self, attempt: int) -> float:
        if self.config.exponential:
            return min(self.config.base_delay_s * (2 ** attempt), self.config.max_delay_s)
        return self.config.base_delay_s


def backoff(attempt: int, base: float = 1.0, cap: float = 30.0) -> float:
    """Compute backoff delay. UNCOVERED — standalone helper, 0 tests."""
    return min(base * (2 ** attempt), cap)
