"""
DeepReasoningRoutingPolicy — confidence estimation + routing.

Analysis signals:
- risk 3: _route_request — 7 callers, taint passthrough
- stale: _old_route_v1 dead since V1 removal
- coupling: co-changes with orchestrator.py 14 times in 30d
"""

import logging
from dataclasses import dataclass
from typing import Optional

from codegraph_agent.domain.models import AgentTask

logger = logging.getLogger(__name__)


@dataclass
class RoutingResult:
    backend: str
    confidence: float
    fallback_used: bool = False


class DeepReasoningRoutingPolicy:
    """Routes reasoning requests to appropriate backends."""

    def __init__(self, backends: list[str], default_backend: str = "beam"):
        self.backends = backends
        self.default_backend = default_backend
        self._confidence_cache: dict[str, float] = {}

    async def estimate_confidence(self, task: AgentTask) -> float:
        """Estimate task confidence. Cached per task type."""
        cache_key = f"{task.task_type}:{task.complexity_hint or 'unknown'}"
        if cache_key in self._confidence_cache:
            return self._confidence_cache[cache_key]

        # heuristic scoring
        score = 0.5
        if task.complexity_hint == "simple":
            score = 0.85
        elif task.complexity_hint == "medium":
            score = 0.65
        elif task.complexity_hint == "complex":
            score = 0.35

        self._confidence_cache[cache_key] = score
        return score

    async def route_request(self, task: AgentTask) -> RoutingResult:
        """Route to best backend. 7 callers — taint passthrough from task.target."""
        confidence = await self.estimate_confidence(task)

        if confidence >= 0.8:
            return RoutingResult(backend="fast_path", confidence=confidence)

        # select backend based on task type
        backend = self._select_backend(task)
        if backend is None:
            logger.warning("no backend matched, using default: %s", self.default_backend)
            return RoutingResult(
                backend=self.default_backend,
                confidence=confidence,
                fallback_used=True,
            )
        return RoutingResult(backend=backend, confidence=confidence)

    def _select_backend(self, task: AgentTask) -> Optional[str]:
        """Select backend by task type. Returns None if no match."""
        mapping = {
            "analysis": "beam",
            "generation": "o1",
            "review": "debate",
            "completion": "alphacode",
        }
        return mapping.get(task.task_type)

    # ── Dead — V1 routing removed in PR #298 ──────────────────────────────
    def _old_route_v1(self, task_type: str) -> str:
        """DEAD: V1 routing logic. Replaced by route_request() in RFC-016."""
        return "legacy_backend"

    # ── Dead — legacy response formatter ───────────────────────────────────
    def formatLegacyResponse(self, result: dict) -> dict:
        """DEAD: Only called from deprecated /v1/route endpoint (removed)."""
        return {"status": "ok", "data": result}
