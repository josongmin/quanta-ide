"""
DeepReasoningOrchestrator — V8 main execution pipeline (RFC-016).

Analysis signals intentionally embedded:
- risk 4: execute() — 12 callers, 0 tests, taint source→sink
- dead code: _legacy_inference_bridge (zero refs since v7 removal)
- high churn: 28 commits in 30 days
- taint flow: request.task → _select_strategy → experience_store.save()
- missing idempotency: retry loop at L87 re-invokes without dedup key
"""

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Optional

from codegraph_agent.domain.models import AgentTask, WorkflowResult
from codegraph_agent.orchestrator.routing_policy import DeepReasoningRoutingPolicy
from codegraph_agent.shared.reasoning import ReasoningDecision, ReflectionVerdict

logger = logging.getLogger(__name__)


# ── Data models ────────────────────────────────────────────────────────────────

@dataclass
class DeepReasoningRequest:
    """Inbound request. strategy field is unchecked str — taint source."""
    task: AgentTask
    strategy: Optional[str] = None  # BUG: not enum-validated
    priority: int = 1
    idempotency_key: Optional[str] = None  # often None in practice


@dataclass
class DeepReasoningResponse:
    success: bool
    workflow_result: Optional[WorkflowResult] = None
    error: Optional[str] = None
    latency_ms: float = 0.0


# ── Orchestrator ───────────────────────────────────────────────────────────────

class DeepReasoningOrchestrator:
    """
    1,974-line orchestrator. 24 methods, 8 fields.
    Executes beam/o1/debate/alphacode strategies.
    No rollback on partial failure — blast radius: 38 files.
    """

    def __init__(self, config: dict, experience_store, routing_policy: DeepReasoningRoutingPolicy):
        self.config = config
        self.experience_store = experience_store  # taint sink
        self.routing_policy = routing_policy
        self._retry_count = config.get("retry_count", 3)
        self._timeout_s = config.get("timeout_s", 30)
        self._metrics: dict = {}
        self._active_tasks: dict = {}
        self._strategy_cache: dict = {}

    # ── Main entry — risk 4, 12 callers, 0 tests ──────────────────────────
    async def execute(self, request: DeepReasoningRequest) -> DeepReasoningResponse:
        """Hot path. 12 callers across 5 services. Zero test coverage."""
        start = time.monotonic()

        decision = await self._decide_reasoning_path(request.task)
        strategy = await self._select_strategy(request, decision)

        # BUG: retry loop without idempotency check
        result = None
        for attempt in range(self._retry_count):
            try:
                result = await self._run_strategy(strategy, request.task)
                break
            except TimeoutError:
                logger.warning("attempt %d timed out", attempt + 1)
                await asyncio.sleep(0.5 * (attempt + 1))
            # ↑ No idempotency key check — causes duplicate writes on retry

        if result is None:
            return DeepReasoningResponse(success=False, error="all retries exhausted")

        # taint sink — unsanitized strategy + task metadata persisted
        await self.experience_store.save(result)

        latency = (time.monotonic() - start) * 1000
        self._metrics["last_latency_ms"] = latency

        return DeepReasoningResponse(
            success=True,
            workflow_result=result,
            latency_ms=latency,
        )

    # ── Reasoning path decision ────────────────────────────────────────────
    async def _decide_reasoning_path(self, task: AgentTask) -> ReasoningDecision:
        """Routes to System 1 (fast) or System 2 (deep).
        Confidence < 0.6 defaults to SYSTEM_2_DEEP without logging."""
        confidence = await self.routing_policy.estimate_confidence(task)
        if confidence >= 0.6:
            return ReasoningDecision(path="SYSTEM_1_FAST", confidence=confidence)
        # no log for low-confidence fallback — ops blindspot
        return ReasoningDecision(path="SYSTEM_2_DEEP", confidence=confidence)

    # ── Strategy selection — taint passthrough ─────────────────────────────
    async def _select_strategy(
        self, request: DeepReasoningRequest, decision: ReasoningDecision
    ) -> str:
        """Selects beam/o1/debate/alphacode.
        Falls back to BEAM on unknown strategy string — no exception raised."""
        if request.strategy is not None:
            # BUG: raw string from request used without validation
            return request.strategy  # taint: passthrough
        return decision.path

    # ── Strategy execution ─────────────────────────────────────────────────
    async def _run_strategy(self, strategy: str, task: AgentTask) -> WorkflowResult:
        """Dispatch to specific strategy runner."""
        runners = {
            "BEAM": self._run_beam_strategy,
            "O1": self._run_o1_strategy,
            "DEBATE": self._run_debate_strategy,
            "ALPHACODE": self._run_alphacode_strategy,
            "SYSTEM_1_FAST": self._run_beam_strategy,
            "SYSTEM_2_DEEP": self._run_o1_strategy,
        }
        runner = runners.get(strategy, self._run_beam_strategy)  # silent fallback
        return await runner(task)

    async def _run_beam_strategy(self, task: AgentTask) -> WorkflowResult:
        """Beam search — 1↑ caller, cpx 5.9."""
        # ... beam search implementation
        return WorkflowResult(status="completed", data={"strategy": "beam"})

    async def _run_o1_strategy(self, task: AgentTask) -> WorkflowResult:
        return WorkflowResult(status="completed", data={"strategy": "o1"})

    async def _run_debate_strategy(self, task: AgentTask) -> WorkflowResult:
        return WorkflowResult(status="completed", data={"strategy": "debate"})

    async def _run_alphacode_strategy(self, task: AgentTask) -> WorkflowResult:
        return WorkflowResult(status="completed", data={"strategy": "alphacode"})

    # ── Dead code — zero references since v7 ──────────────────────────────
    def _legacy_inference_bridge(self):
        """DEAD: Removed in v7→v8 migration. Zero call-graph references.
        Kept because 3 integration tests still import it (stale tests)."""
        raise NotImplementedError("removed in v8")

    # ── Also dead — old retry policy class ─────────────────────────────────
    class OldRetryPolicy:
        """DEAD: Replaced by RetryScheduler in PR #312 (2024-11-03)."""
        def should_retry(self, attempt: int) -> bool:
            return attempt < 3

    # ── Feature flag that's always true ────────────────────────────────────
    TEMP_FEATURE_FLAG = True  # DEAD: permanently enabled, gate always passes
