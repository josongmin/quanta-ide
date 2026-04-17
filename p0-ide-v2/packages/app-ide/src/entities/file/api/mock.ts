import type { FileFacts } from "../model/types";

export const ORCHESTRATOR_SOURCE = `"""
orchestrator.py — Deep Reasoning Orchestrator
==============================================
Coordinates multi-step reasoning across analysis ports.
Owns the plan → execute → persist lifecycle for every
inference request that enters the system.

Architecture
------------
  Request  →  Strategy.select()  →  Plan
  Plan     →  step.run() loop    →  Trace[]
  Trace[]  →  ExperienceStore    →  persist

Related RFCs
  RFC-02  Deep reasoning pipeline
  RFC-07  Trace retention & replay
  RFC-11  Strategy hot-swap

Owner: @songmin (81 %) · @devops-bot (19 %)
"""

from __future__ import annotations

import hashlib
import logging
import time
import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import (
    Any,
    Callable,
    Dict,
    Final,
    Generator,
    List,
    Optional,
    Protocol,
    Sequence,
    Set,
    Tuple,
    TypeVar,
    Union,
)

from .domain.ports import AnalysisPort, ReasoningPort, StoragePort
from .domain.model import (
    AnalysisResult,
    Confidence,
    Evidence,
    Finding,
    Impact,
    Plan,
    Request,
    Response,
    RiskLevel,
    Step,
    StepResult,
    Trace,
)
from .infra.metrics import MetricsCollector, Timer
from .infra.tracer import Tracer, emit_span
from .infra.experience_store import ExperienceStore   # ← infra dep
from .infra.postgres import postgres                  # ← infra dep

logger: Final = logging.getLogger(__name__)

T = TypeVar("T")

# ─── Constants ────────────────────────────────────────────────────

MAX_PLAN_DEPTH: Final[int] = 12
MAX_STEP_TIMEOUT_S: Final[float] = 30.0
TRACE_RETENTION_DAYS: Final[int] = 90
CACHE_TTL_S: Final[int] = 300
FAST_PATH_THRESHOLD: Final[float] = 0.85
TEMP_FEATURE_FLAG: Final[str] = "enable_deep_v2"   # ← dead constant
_LEGACY_RETRY_COUNT: Final[int] = 3                 # ← dead constant
CONFIDENCE_FLOOR: Final[float] = 0.3
BATCH_SIZE: Final[int] = 64
FLUSH_INTERVAL_S: Final[float] = 5.0
RETRY_BACKOFF_BASE: Final[float] = 0.5
RETRY_MAX_ATTEMPTS: Final[int] = 5


# ─── Enums ────────────────────────────────────────────────────────

class StrategyKind(Enum):
    FAST = auto()
    DEEP = auto()
    HYBRID = auto()
    STREAMING = auto()


class StepStatus(Enum):
    PENDING = auto()
    RUNNING = auto()
    COMPLETED = auto()
    FAILED = auto()
    SKIPPED = auto()
    TIMED_OUT = auto()


class TraceLevel(Enum):
    MINIMAL = auto()
    STANDARD = auto()
    VERBOSE = auto()
    DEBUG = auto()


# ─── Data classes ─────────────────────────────────────────────────

@dataclass(frozen=True)
class StrategyConfig:
    """Immutable configuration for a reasoning strategy."""
    kind: StrategyKind
    max_depth: int = MAX_PLAN_DEPTH
    timeout_s: float = MAX_STEP_TIMEOUT_S
    confidence_floor: float = CONFIDENCE_FLOOR
    parallel: bool = False
    trace_level: TraceLevel = TraceLevel.STANDARD
    retry_on_timeout: bool = True


@dataclass
class StepContext:
    """Mutable context passed through the step chain."""
    request_id: str
    parent_span_id: Optional[str] = None
    depth: int = 0
    accumulated_evidence: List[Evidence] = field(default_factory=list)
    visited_nodes: Set[str] = field(default_factory=set)
    metadata: Dict[str, Any] = field(default_factory=dict)
    start_time: float = field(default_factory=time.monotonic)

    @property
    def elapsed_s(self) -> float:
        return time.monotonic() - self.start_time

    def fork(self, step_id: str) -> "StepContext":
        return StepContext(
            request_id=self.request_id,
            parent_span_id=step_id,
            depth=self.depth + 1,
            accumulated_evidence=list(self.accumulated_evidence),
            visited_nodes=set(self.visited_nodes),
            metadata=dict(self.metadata),
        )


@dataclass
class ExecutionMetrics:
    """Captures timing and quality metrics for a single execution."""
    total_steps: int = 0
    completed_steps: int = 0
    failed_steps: int = 0
    skipped_steps: int = 0
    timed_out_steps: int = 0
    total_duration_ms: float = 0.0
    step_durations_ms: List[float] = field(default_factory=list)
    evidence_count: int = 0
    confidence_scores: List[float] = field(default_factory=list)
    cache_hits: int = 0
    cache_misses: int = 0
    retry_count: int = 0

    @property
    def avg_step_duration_ms(self) -> float:
        if not self.step_durations_ms:
            return 0.0
        return sum(self.step_durations_ms) / len(self.step_durations_ms)

    @property
    def avg_confidence(self) -> float:
        if not self.confidence_scores:
            return 0.0
        return sum(self.confidence_scores) / len(self.confidence_scores)

    @property
    def success_rate(self) -> float:
        if self.total_steps == 0:
            return 0.0
        return self.completed_steps / self.total_steps


@dataclass
class TraceEntry:
    """Single entry in an execution trace."""
    step_id: str
    step_name: str
    status: StepStatus
    duration_ms: float
    input_hash: str
    output_summary: Optional[str] = None
    evidence: List[Evidence] = field(default_factory=list)
    error: Optional[str] = None
    children: List["TraceEntry"] = field(default_factory=list)


# ─── Protocols ────────────────────────────────────────────────────

class Strategy(Protocol):
    """Selects and configures a plan for a given request."""

    def select(self, request: Request) -> Plan: ...
    def configure(self, config: StrategyConfig) -> None: ...

    @property
    def fast(self) -> "Strategy": ...

    @property
    def deep(self) -> "Strategy": ...


class StepRunner(Protocol):
    """Executes a single step within a plan."""

    def run(self, step: Step, ctx: StepContext) -> StepResult: ...
    def can_handle(self, step: Step) -> bool: ...
    def estimate_cost(self, step: Step) -> float: ...


class TraceStore(Protocol):
    """Persists execution traces for replay and analysis."""

    def save(self, trace: List[TraceEntry]) -> str: ...
    def load(self, trace_id: str) -> List[TraceEntry]: ...
    def query(self, filters: Dict[str, Any]) -> List[str]: ...


# ─── Cache ────────────────────────────────────────────────────────

class _StepCache:
    """LRU-ish cache for step results keyed by input hash."""

    def __init__(self, max_size: int = 1024, ttl_s: int = CACHE_TTL_S):
        self._store: Dict[str, Tuple[float, StepResult]] = {}
        self._max_size = max_size
        self._ttl_s = ttl_s
        self._hits = 0
        self._misses = 0

    def get(self, key: str) -> Optional[StepResult]:
        entry = self._store.get(key)
        if entry is None:
            self._misses += 1
            return None
        ts, result = entry
        if time.monotonic() - ts > self._ttl_s:
            del self._store[key]
            self._misses += 1
            return None
        self._hits += 1
        return result

    def put(self, key: str, result: StepResult) -> None:
        if len(self._store) >= self._max_size:
            oldest_key = min(self._store, key=lambda k: self._store[k][0])
            del self._store[oldest_key]
        self._store[key] = (time.monotonic(), result)

    def invalidate(self, key: str) -> None:
        self._store.pop(key, None)

    def clear(self) -> None:
        self._store.clear()
        self._hits = 0
        self._misses = 0

    @property
    def stats(self) -> Dict[str, int]:
        return {"hits": self._hits, "misses": self._misses, "size": len(self._store)}


# ─── Retry logic ──────────────────────────────────────────────────

class RetryPolicy:
    """Exponential backoff retry with jitter."""

    def __init__(
        self,
        max_attempts: int = RETRY_MAX_ATTEMPTS,
        base_delay: float = RETRY_BACKOFF_BASE,
        max_delay: float = 16.0,
    ):
        self._max_attempts = max_attempts
        self._base_delay = base_delay
        self._max_delay = max_delay

    def attempts(self) -> Generator[float, None, None]:
        for i in range(self._max_attempts):
            delay = min(self._base_delay * (2 ** i), self._max_delay)
            jitter = delay * 0.1 * (hash(str(i)) % 10) / 10
            yield delay + jitter

    def should_retry(self, error: Exception, attempt: int) -> bool:
        if attempt >= self._max_attempts:
            return False
        if isinstance(error, (TimeoutError, ConnectionError)):
            return True
        if isinstance(error, ValueError):
            return False
        return attempt < 2


class OldRetryPolicy:
    """Legacy retry — kept for backward compat, do not use."""

    def __init__(self, retries: int = _LEGACY_RETRY_COUNT):
        self._retries = retries

    def run(self, fn: Callable[[], T]) -> T:
        last_err: Optional[Exception] = None
        for _ in range(self._retries):
            try:
                return fn()
            except Exception as e:
                last_err = e
                time.sleep(0.5)
        raise last_err  # type: ignore[misc]


# ─── Plan Builder ─────────────────────────────────────────────────

class PlanBuilder:
    """Fluent builder for constructing execution plans."""

    def __init__(self) -> None:
        self._steps: List[Step] = []
        self._metadata: Dict[str, Any] = {}
        self._timeout_s: float = MAX_STEP_TIMEOUT_S

    def add_step(self, step: Step) -> "PlanBuilder":
        self._steps.append(step)
        return self

    def with_metadata(self, key: str, value: Any) -> "PlanBuilder":
        self._metadata[key] = value
        return self

    def with_timeout(self, timeout_s: float) -> "PlanBuilder":
        self._timeout_s = timeout_s
        return self

    def build(self) -> Plan:
        if not self._steps:
            raise ValueError("Plan must have at least one step")
        return Plan(
            steps=self._steps,
            metadata=self._metadata,
            timeout_s=self._timeout_s,
        )


# ─── Validators ───────────────────────────────────────────────────

def validate_request(request: Request) -> List[str]:
    """Pre-flight validation. Returns list of error messages."""
    errors: List[str] = []
    if not request.ctx:
        errors.append("Request context is required")
    if request.depth and request.depth > MAX_PLAN_DEPTH:
        errors.append(f"Depth {request.depth} exceeds max {MAX_PLAN_DEPTH}")
    if request.timeout_s and request.timeout_s > 120:
        errors.append("Timeout exceeds 120s hard limit")
    return errors


def validate_trace(trace: List[TraceEntry]) -> bool:
    """Ensure trace integrity before persistence."""
    if not trace:
        return False
    seen_ids: Set[str] = set()
    for entry in trace:
        if entry.step_id in seen_ids:
            logger.warning("Duplicate step_id in trace: %s", entry.step_id)
            return False
        seen_ids.add(entry.step_id)
    return True


def _hash_input(data: Any) -> str:
    """Deterministic hash of step input for cache keying."""
    raw = str(data).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:16]


# ─── Batch Collector ──────────────────────────────────────────────

class _BatchCollector:
    """Buffers trace entries and flushes in batches."""

    def __init__(self, store: TraceStore, batch_size: int = BATCH_SIZE):
        self._store = store
        self._batch_size = batch_size
        self._buffer: List[TraceEntry] = []
        self._flush_count = 0

    def add(self, entry: TraceEntry) -> None:
        self._buffer.append(entry)
        if len(self._buffer) >= self._batch_size:
            self.flush()

    def flush(self) -> None:
        if not self._buffer:
            return
        self._store.save(list(self._buffer))
        self._flush_count += 1
        self._buffer.clear()

    @property
    def pending(self) -> int:
        return len(self._buffer)


# ─── Analysis helpers ─────────────────────────────────────────────

def compute_risk_score(
    findings: List[Finding],
    complexity: int,
    churn: int,
    coverage: float,
) -> int:
    """Aggregate risk from multiple signals into 0-100 score."""
    base = 50
    severity_weight = sum(
        (10 if f.risk == RiskLevel.CRITICAL else
         6 if f.risk == RiskLevel.HIGH else
         3 if f.risk == RiskLevel.MEDIUM else 1)
        for f in findings
    )
    cpx_penalty = max(0, complexity - 8) * 2
    churn_penalty = min(churn, 20)
    coverage_bonus = int(coverage * 20)
    raw = base + severity_weight + cpx_penalty + churn_penalty - coverage_bonus
    return max(0, min(100, raw))


def classify_impact(blast_radius: int, critical_paths: int) -> Impact:
    """Map blast radius + critical path count to impact tier."""
    if critical_paths >= 3 or blast_radius >= 50:
        return Impact.CRITICAL
    if critical_paths >= 1 or blast_radius >= 20:
        return Impact.HIGH
    if blast_radius >= 5:
        return Impact.MEDIUM
    return Impact.LOW


def merge_evidence(
    existing: List[Evidence],
    new: List[Evidence],
) -> List[Evidence]:
    """Deduplicate and merge evidence lists."""
    seen: Set[str] = {e.id for e in existing}
    merged = list(existing)
    for e in new:
        if e.id not in seen:
            merged.append(e)
            seen.add(e.id)
    return merged


def summarize_trace(trace: List[TraceEntry]) -> Dict[str, Any]:
    """Build a human-readable summary of an execution trace."""
    total = len(trace)
    completed = sum(1 for t in trace if t.status == StepStatus.COMPLETED)
    failed = sum(1 for t in trace if t.status == StepStatus.FAILED)
    total_ms = sum(t.duration_ms for t in trace)
    evidence_count = sum(len(t.evidence) for t in trace)
    return {
        "total_steps": total,
        "completed": completed,
        "failed": failed,
        "total_duration_ms": round(total_ms, 2),
        "evidence_count": evidence_count,
        "success_rate": round(completed / total, 2) if total else 0,
    }


# ─── Main Orchestrator ───────────────────────────────────────────

class DeepReasoningOrchestrator:
    """
    Coordinates multi-step reasoning across analysis ports.

    Lifecycle:
      1. Validate incoming request
      2. Select strategy → build plan
      3. Execute steps (with caching, retry, timeout)
      4. Collect evidence & build trace
      5. Persist trace to ExperienceStore
      6. Return aggregated response

    Thread-safety: instances are NOT thread-safe. Use one per request
    or protect with external locking.
    """

    def __init__(
        self,
        strategy: Strategy,
        store: ExperienceStore,
        metrics: Optional[MetricsCollector] = None,
        tracer: Optional[Tracer] = None,
        config: Optional[StrategyConfig] = None,
    ) -> None:
        self._strategy = strategy
        self._store = store
        self._metrics = metrics or MetricsCollector.noop()
        self._tracer = tracer
        self._config = config or StrategyConfig(kind=StrategyKind.DEEP)
        self._cache = _StepCache()
        self._retry = RetryPolicy()
        self._batch = _BatchCollector(store)
        self._runners: Dict[str, StepRunner] = {}
        self._execution_count = 0

        if config:
            self._strategy.configure(config)

    # ── Public API ────────────────────────────────────────────

    def execute(self, request: Request) -> Response:
        """
        Main entry point. Validates, plans, executes, persists.

        Raises:
            ValueError: if request validation fails
            TimeoutError: if total execution exceeds timeout
        """
        errors = validate_request(request)
        if errors:
            raise ValueError(f"Invalid request: {'; '.join(errors)}")

        self._execution_count += 1
        request_id = str(uuid.uuid4())
        ctx = StepContext(request_id=request_id)
        metrics = ExecutionMetrics()

        with Timer() as total_timer:
            plan = self._build_plan(request, ctx)
            trace = self._execute_plan(plan, ctx, metrics)

        metrics.total_duration_ms = total_timer.elapsed_ms
        self._emit_metrics(metrics, request_id)

        if validate_trace(trace):
            self._store.save(trace)            # ← taint sink
        else:
            logger.error("Trace validation failed for %s", request_id)

        return Response(
            trace=trace,
            plan=plan,
            metrics=summarize_trace(trace),
            request_id=request_id,
        )

    def execute_dry_run(self, request: Request) -> Plan:
        """Build and return the plan without executing it."""
        errors = validate_request(request)
        if errors:
            raise ValueError(f"Invalid request: {'; '.join(errors)}")
        ctx = StepContext(request_id="dry-run")
        return self._build_plan(request, ctx)

    def replay(self, trace_id: str) -> Response:
        """Re-execute a stored trace for debugging."""
        stored = self._store.load(trace_id)
        if not stored:
            raise ValueError(f"Trace {trace_id} not found")
        # rebuild a synthetic request from stored trace
        request = self._reconstruct_request(stored)
        return self.execute(request)

    def register_runner(self, kind: str, runner: StepRunner) -> None:
        """Register a step runner for a specific step kind."""
        self._runners[kind] = runner

    def reset(self) -> None:
        """Clear caches and pending batches."""
        self._cache.clear()
        self._batch.flush()
        self._execution_count = 0

    # ── Strategy selection ────────────────────────────────────

    def _select_strategy(self, kind: str) -> Strategy:
        if kind == "fast":
            return self._strategy.fast
        return self._strategy.deep

    def _build_plan(self, request: Request, ctx: StepContext) -> Plan:
        """Select strategy and build the execution plan."""
        strategy = self._select_strategy(
            "fast" if self._should_fast_path(request) else "deep"
        )
        with emit_span(self._tracer, "build_plan", ctx.request_id):
            plan = strategy.select(request)

        if len(plan.steps) > self._config.max_depth:
            logger.warning(
                "Plan has %d steps, truncating to %d",
                len(plan.steps),
                self._config.max_depth,
            )
            plan = Plan(
                steps=plan.steps[: self._config.max_depth],
                metadata=plan.metadata,
                timeout_s=plan.timeout_s,
            )
        return plan

    def _should_fast_path(self, request: Request) -> bool:
        """Heuristic: skip deep reasoning for high-confidence simple requests."""
        if not request.ctx:
            return False
        if request.ctx.get("force_deep"):
            return False
        confidence = request.ctx.get("prior_confidence", 0)
        return confidence >= FAST_PATH_THRESHOLD

    # ── Plan execution ────────────────────────────────────────

    def _execute_plan(
        self,
        plan: Plan,
        ctx: StepContext,
        metrics: ExecutionMetrics,
    ) -> List[TraceEntry]:
        """Walk through plan steps, respecting timeout and depth."""
        trace: List[TraceEntry] = []
        metrics.total_steps = len(plan.steps)

        for i, step in enumerate(plan.steps):
            if ctx.elapsed_s > self._config.timeout_s:
                logger.warning("Execution timeout after step %d", i)
                remaining = plan.steps[i:]
                for s in remaining:
                    trace.append(self._make_entry(
                        s, StepStatus.TIMED_OUT, 0, "Execution timeout",
                    ))
                    metrics.timed_out_steps += 1
                break

            entry = self._execute_step(step, ctx, metrics)
            trace.append(entry)
            self._batch.add(entry)

            if entry.status == StepStatus.FAILED:
                metrics.failed_steps += 1
                if step.required:
                    logger.error("Required step %s failed, aborting", step.name)
                    break
            elif entry.status == StepStatus.COMPLETED:
                metrics.completed_steps += 1
                ctx.accumulated_evidence = merge_evidence(
                    ctx.accumulated_evidence, entry.evidence,
                )
            else:
                metrics.skipped_steps += 1

        self._batch.flush()
        return trace

    def _execute_step(
        self,
        step: Step,
        ctx: StepContext,
        metrics: ExecutionMetrics,
    ) -> TraceEntry:
        """Execute a single step with caching and retry."""
        input_hash = _hash_input(step.input_data)
        child_ctx = ctx.fork(step.id)

        # Check cache
        cached = self._cache.get(input_hash)
        if cached is not None:
            metrics.cache_hits += 1
            return self._make_entry(
                step, StepStatus.COMPLETED, 0,
                output_summary="(cached)",
                evidence=cached.evidence,
            )
        metrics.cache_misses += 1

        # Find runner
        runner = self._runners.get(step.kind)
        if runner is None or not runner.can_handle(step):
            return self._make_entry(
                step, StepStatus.SKIPPED, 0,
                error=f"No runner for step kind: {step.kind}",
            )

        # Execute with retry
        last_error: Optional[str] = None
        for attempt, delay in enumerate(self._retry.attempts()):
            with Timer() as step_timer:
                try:
                    result = runner.run(step, child_ctx)
                except TimeoutError as e:
                    last_error = f"Timeout: {e}"
                    if self._config.retry_on_timeout:
                        metrics.retry_count += 1
                        time.sleep(delay)
                        continue
                    break
                except Exception as e:
                    last_error = str(e)
                    if self._retry.should_retry(e, attempt):
                        metrics.retry_count += 1
                        time.sleep(delay)
                        continue
                    break

            # Success
            duration_ms = step_timer.elapsed_ms
            metrics.step_durations_ms.append(duration_ms)
            metrics.evidence_count += len(result.evidence)
            if result.confidence is not None:
                metrics.confidence_scores.append(result.confidence)

            self._cache.put(input_hash, result)

            return self._make_entry(
                step, StepStatus.COMPLETED, duration_ms,
                output_summary=result.summary,
                evidence=result.evidence,
            )

        # All retries exhausted
        return self._make_entry(
            step, StepStatus.FAILED, 0,
            error=last_error or "Unknown error",
        )

    # ── Trace helpers ─────────────────────────────────────────

    @staticmethod
    def _make_entry(
        step: Step,
        status: StepStatus,
        duration_ms: float,
        error: Optional[str] = None,
        output_summary: Optional[str] = None,
        evidence: Optional[List[Evidence]] = None,
    ) -> TraceEntry:
        return TraceEntry(
            step_id=step.id,
            step_name=step.name,
            status=status,
            duration_ms=duration_ms,
            input_hash=_hash_input(step.input_data),
            output_summary=output_summary,
            evidence=evidence or [],
            error=error,
        )

    def _reconstruct_request(self, trace: List[TraceEntry]) -> Request:
        """Best-effort request reconstruction from stored trace."""
        first = trace[0] if trace else None
        return Request(
            ctx={"replayed_from": first.step_id if first else "unknown"},
            depth=len(trace),
        )

    # ── Metrics & observability ───────────────────────────────

    def _emit_metrics(self, metrics: ExecutionMetrics, request_id: str) -> None:
        """Push execution metrics to the collector."""
        self._metrics.gauge("orchestrator.steps.total", metrics.total_steps)
        self._metrics.gauge("orchestrator.steps.completed", metrics.completed_steps)
        self._metrics.gauge("orchestrator.steps.failed", metrics.failed_steps)
        self._metrics.timer("orchestrator.duration_ms", metrics.total_duration_ms)
        self._metrics.gauge("orchestrator.evidence_count", metrics.evidence_count)
        self._metrics.gauge("orchestrator.cache.hits", metrics.cache_hits)
        self._metrics.gauge("orchestrator.cache.misses", metrics.cache_misses)
        self._metrics.gauge("orchestrator.retry_count", metrics.retry_count)
        if metrics.confidence_scores:
            self._metrics.gauge(
                "orchestrator.avg_confidence",
                metrics.avg_confidence,
            )
        logger.info(
            "Execution %s: %d/%d steps, %.1fms, %.2f confidence",
            request_id,
            metrics.completed_steps,
            metrics.total_steps,
            metrics.total_duration_ms,
            metrics.avg_confidence,
        )

    # ── Diagnostics ───────────────────────────────────────────

    def diagnostics(self) -> Dict[str, Any]:
        """Return internal state for debugging."""
        return {
            "execution_count": self._execution_count,
            "cache_stats": self._cache.stats,
            "pending_batch": self._batch.pending,
            "registered_runners": list(self._runners.keys()),
            "config": {
                "kind": self._config.kind.name,
                "max_depth": self._config.max_depth,
                "timeout_s": self._config.timeout_s,
                "confidence_floor": self._config.confidence_floor,
            },
        }


# ─── Strategy implementations ────────────────────────────────────

class FastStrategy:
    """Minimal-step strategy for high-confidence requests."""

    def select(self, request: Request) -> Plan:
        builder = PlanBuilder()
        builder.add_step(Step(
            id="fast-analyze",
            name="Quick analysis",
            kind="analyze",
            input_data=request.ctx,
            required=True,
        ))
        builder.add_step(Step(
            id="fast-validate",
            name="Validate result",
            kind="validate",
            input_data=request.ctx,
            required=True,
        ))
        return builder.with_timeout(5.0).build()

    def configure(self, config: StrategyConfig) -> None:
        pass

    @property
    def fast(self) -> "FastStrategy":
        return self

    @property
    def deep(self) -> "DeepStrategy":
        return DeepStrategy()


class DeepStrategy:
    """Multi-step strategy with analysis, cross-ref, and synthesis."""

    def __init__(self) -> None:
        self._max_depth = MAX_PLAN_DEPTH

    def select(self, request: Request) -> Plan:
        builder = PlanBuilder()

        # Phase 1: Gather
        builder.add_step(Step(
            id="deep-parse",
            name="Parse & extract",
            kind="parse",
            input_data=request.ctx,
            required=True,
        ))
        builder.add_step(Step(
            id="deep-analyze",
            name="Deep analysis",
            kind="analyze",
            input_data=request.ctx,
            required=True,
        ))

        # Phase 2: Cross-reference
        builder.add_step(Step(
            id="deep-xref",
            name="Cross-reference",
            kind="cross_ref",
            input_data=request.ctx,
            required=False,
        ))
        builder.add_step(Step(
            id="deep-taint",
            name="Taint analysis",
            kind="taint",
            input_data=request.ctx,
            required=True,
        ))

        # Phase 3: Synthesize
        builder.add_step(Step(
            id="deep-blast",
            name="Blast radius",
            kind="blast_radius",
            input_data=request.ctx,
            required=False,
        ))
        builder.add_step(Step(
            id="deep-synth",
            name="Synthesize findings",
            kind="synthesize",
            input_data=request.ctx,
            required=True,
        ))

        return builder.with_timeout(self._max_depth * 5.0).build()

    def configure(self, config: StrategyConfig) -> None:
        self._max_depth = config.max_depth

    @property
    def fast(self) -> FastStrategy:
        return FastStrategy()

    @property
    def deep(self) -> "DeepStrategy":
        return self


class HybridStrategy:
    """Starts fast, falls back to deep if confidence is low."""

    def __init__(self) -> None:
        self._fast = FastStrategy()
        self._deep = DeepStrategy()
        self._threshold = FAST_PATH_THRESHOLD

    def select(self, request: Request) -> Plan:
        prior = request.ctx.get("prior_confidence", 0) if request.ctx else 0
        if prior >= self._threshold:
            return self._fast.select(request)
        return self._deep.select(request)

    def configure(self, config: StrategyConfig) -> None:
        self._fast.configure(config)
        self._deep.configure(config)
        self._threshold = config.confidence_floor

    @property
    def fast(self) -> FastStrategy:
        return self._fast

    @property
    def deep(self) -> DeepStrategy:
        return self._deep


# ─── Runner implementations ──────────────────────────────────────

class AnalyzeRunner:
    """Runs static analysis on the input context."""

    def run(self, step: Step, ctx: StepContext) -> StepResult:
        findings: List[Finding] = []
        evidence: List[Evidence] = []

        data = step.input_data or {}
        source = data.get("source_code", "")

        if not source:
            return StepResult(
                summary="No source code to analyze",
                evidence=[],
                confidence=1.0,
            )

        lines = source.split("\\n")
        for i, line in enumerate(lines):
            if "eval(" in line or "exec(" in line:
                findings.append(Finding(
                    id=f"F-{uuid.uuid4().hex[:8]}",
                    message=f"Dangerous call at line {i+1}",
                    line=i + 1,
                    risk=RiskLevel.HIGH,
                ))
                evidence.append(Evidence(
                    id=f"E-{uuid.uuid4().hex[:8]}",
                    kind="pattern_match",
                    detail=f"eval/exec at line {i+1}",
                    confidence=0.95,
                ))

        return StepResult(
            summary=f"Found {len(findings)} issues in {len(lines)} lines",
            evidence=evidence,
            confidence=0.85 if findings else 0.95,
            findings=findings,
        )

    def can_handle(self, step: Step) -> bool:
        return step.kind == "analyze"

    def estimate_cost(self, step: Step) -> float:
        return 1.0


class TaintRunner:
    """Traces data flow from sources to sinks."""

    def run(self, step: Step, ctx: StepContext) -> StepResult:
        evidence: List[Evidence] = []
        data = step.input_data or {}

        sources = data.get("taint_sources", [])
        sinks = data.get("taint_sinks", [])

        tainted_paths = 0
        for src in sources:
            for sink in sinks:
                if self._is_reachable(src, sink, data):
                    tainted_paths += 1
                    evidence.append(Evidence(
                        id=f"E-{uuid.uuid4().hex[:8]}",
                        kind="taint_flow",
                        detail=f"{src} → {sink}",
                        confidence=0.9,
                    ))

        return StepResult(
            summary=f"Found {tainted_paths} tainted paths",
            evidence=evidence,
            confidence=0.9 if tainted_paths == 0 else 0.7,
        )

    def _is_reachable(self, source: str, sink: str, data: Dict) -> bool:
        graph = data.get("call_graph", {})
        visited: Set[str] = set()
        queue = [source]
        while queue:
            node = queue.pop(0)
            if node == sink:
                return True
            if node in visited:
                continue
            visited.add(node)
            queue.extend(graph.get(node, []))
        return False

    def can_handle(self, step: Step) -> bool:
        return step.kind == "taint"

    def estimate_cost(self, step: Step) -> float:
        return 3.0


class BlastRadiusRunner:
    """Estimates the change impact blast radius."""

    def run(self, step: Step, ctx: StepContext) -> StepResult:
        data = step.input_data or {}
        changed_files = data.get("changed_files", [])

        dep_graph = data.get("dependency_graph", {})
        affected: Set[str] = set()

        for f in changed_files:
            self._walk_dependents(f, dep_graph, affected)

        impact = classify_impact(len(affected), 0)
        evidence = [Evidence(
            id=f"E-{uuid.uuid4().hex[:8]}",
            kind="blast_radius",
            detail=f"{len(affected)} files affected, impact={impact.name}",
            confidence=0.85,
        )]

        return StepResult(
            summary=f"Blast radius: {len(affected)} files ({impact.name})",
            evidence=evidence,
            confidence=0.85,
        )

    def _walk_dependents(
        self,
        node: str,
        graph: Dict[str, List[str]],
        visited: Set[str],
    ) -> None:
        if node in visited:
            return
        visited.add(node)
        for dep in graph.get(node, []):
            self._walk_dependents(dep, graph, visited)

    def can_handle(self, step: Step) -> bool:
        return step.kind == "blast_radius"

    def estimate_cost(self, step: Step) -> float:
        return 2.0


# ─── _legacy_inference_bridge (dead code) ─────────────────────────

def _legacy_inference_bridge(
    payload: Dict[str, Any],
    store: ExperienceStore,
) -> Optional[Dict[str, Any]]:
    """
    Bridge between the old inference API and the new orchestrator.
    TODO(songmin): remove after migration completes — Q3 target.
    """
    if "query" not in payload:
        return None
    request = Request(ctx=payload, depth=3)
    strategy = FastStrategy()
    orch = DeepReasoningOrchestrator(strategy=strategy, store=store)
    response = orch.execute(request)
    return {
        "result": response.trace,
        "plan": str(response.plan),
    }


# ─── Routing policy (resolve_policy CPX = 14) ────────────────────

def resolve_policy(
    request: Request,
    available_strategies: List[Strategy],
    fallback: Strategy,
    feature_flags: Dict[str, bool],
) -> Strategy:
    """
    Policy-based strategy router.

    Cyclomatic complexity intentionally high — this encodes
    the routing truth table from RFC-11 §4.
    """
    ctx = request.ctx or {}
    kind = ctx.get("strategy_kind", "auto")
    source = ctx.get("source", "unknown")
    priority = ctx.get("priority", "normal")

    if kind == "fast":
        for s in available_strategies:
            if hasattr(s, "fast"):
                return s.fast
        return fallback.fast

    if kind == "deep":
        for s in available_strategies:
            if hasattr(s, "deep"):
                return s.deep
        return fallback.deep

    if kind == "hybrid":
        return HybridStrategy()

    # Auto-routing
    if priority == "critical":
        return fallback.deep

    if source == "ci":
        if feature_flags.get(TEMP_FEATURE_FLAG):
            return HybridStrategy()
        return fallback.fast

    if source == "ide":
        confidence = ctx.get("prior_confidence", 0)
        if confidence >= FAST_PATH_THRESHOLD:
            return fallback.fast
        return fallback.deep

    if source == "api":
        depth = request.depth or 0
        if depth > 6:
            return fallback.deep
        if depth > 3:
            return HybridStrategy()
        return fallback.fast

    return fallback


# ─── Module init ──────────────────────────────────────────────────

def create_orchestrator(
    config: Optional[StrategyConfig] = None,
) -> DeepReasoningOrchestrator:
    """Factory function — wires up default dependencies."""
    strategy = HybridStrategy()
    store = ExperienceStore.default()
    metrics = MetricsCollector.from_env()
    tracer = Tracer.from_env()

    orch = DeepReasoningOrchestrator(
        strategy=strategy,
        store=store,
        metrics=metrics,
        tracer=tracer,
        config=config,
    )

    # Register default runners
    orch.register_runner("analyze", AnalyzeRunner())
    orch.register_runner("taint", TaintRunner())
    orch.register_runner("blast_radius", BlastRadiusRunner())

    return orch
`;

export const ORCHESTRATOR: FileFacts = {
  name: "orchestrator.py",
  loc: 1974,
  blast: 38,
  blastCritical: 3,
  taintCount: 2,
  cpxMax: 9,
  cpxBudgetPct: 91,
  archViolations: 0,
  deadCount: 1,
  riskScore: 78,
  lastModified: "2w",
  owner: "@songmin",
  ownership: [
    { author: "@songmin", pct: 81, role: "primary" },
    { author: "@devops-bot", pct: 19, role: "contributor" },
  ],

  symbols: [
    {
      name: "DeepReasoningOrchestrator",
      kind: "class",
      detail: "Coordinates multi-step reasoning across analysis ports.",
      line: 483,
      layer: "app",
      role: "Orchestrator",
      contract: { verb: "implements", name: "ReasoningPort" },
      why: { label: "RFC-02 · deep reasoning pipeline" },
      riskScore: 78,
      complexity: 9,
      callers: 12,
      callees: 6,
      blast: 38,
      blastCritical: 3,
      stability: 0.71,
      churn90d: 14,
      heat: { level: "hot", rate: "820/min" },
      tests: "0/12",
      blame: { author: "@songmin", when: "2w" },
      tags: ["hotspot", "untested"],
      incidentMatch: { id: "INC-31", similarity: 0.71, reason: "cpx-spike drift" },
      children: [
        {
          name: "execute",
          kind: "method",
          detail: "Runs the selected strategy plan and stores the trace.",
          line: 523,
          layer: "app",
          why: { label: "RFC-02 §3 · plan → run → persist" },
          riskScore: 78,
          complexity: 9,
          bigO: "O(n)",
          callers: 12,
          callees: 4,
          blast: 31,
          blastCritical: 3,
          stability: 0.78,
          churn90d: 9,
          heat: { level: "hot", rate: "820/min" },
          tests: "0/12",
          taint: "sink",
          blame: { author: "@songmin", when: "2w" },
          tags: ["taint-sink", "no-tests"],
          incidentMatch: { id: "INC-47", similarity: 0.87, reason: "same source→sink shape" },
          flowsTo: [
            { line: 523, symbol: "request", hop: "source: request.ctx" },
            { line: 700, symbol: "step.run", hop: "propagate: request.ctx → result" },
            { line: 543, symbol: "trace", hop: "propagate: result → trace" },
            { line: 548, symbol: "_store.save", hop: "sink: trace → save(unvalidated)" },
          ],
          deps: {
            incoming: [
              { name: "HTTPController.handle", layer: "adapter" },
              { name: "WebhookController.receive", layer: "adapter" },
              { name: "ReplayService.step", layer: "app" },
            ],
            outgoing: [
              { name: "Strategy.run", layer: "domain" },
              { name: "ExperienceStore.save", layer: "infra" },
              { name: "Tracer.emit", layer: "infra" },
            ],
            incomingTotal: 12,
            outgoingTotal: 4,
          },
          hotPath: { label: "ingest → reason → persist", rank: 1, total: 18 },
          lastRiskyChange: {
            sha: "1a9c73f",
            author: "@songmin",
            when: "2w",
            risk: 85,
            summary: "inlined trace forwarding — skipped validate_trace()",
          },
          relatedIncidents: [
            { id: "INC-412", similarity: 0.91, when: "2mo" },
            { id: "INC-47", similarity: 0.87, when: "6mo" },
            { id: "INC-31", similarity: 0.71, when: "9mo" },
          ],
          children: [
            {
              name: "request",
              kind: "parameter",
              detail: "Inbound Request — carries untrusted ctx.",
              line: 523,
              taint: "source",
              tags: ["taint-source"],
            },
            {
              name: "plan",
              kind: "variable",
              detail: "Resolved execution plan from the strategy.",
              line: 542,
            },
            {
              name: "trace",
              kind: "variable",
              detail: "Ordered step results — flows into store.save (sink).",
              line: 543,
              taint: "passthrough",
            },
          ],
        },
        {
          name: "_select_strategy",
          kind: "method",
          detail: "Picks fast vs deep strategy based on request kind.",
          line: 588,
          riskScore: 38,
          complexity: 4,
          bigO: "O(1)",
          callers: 1,
          tests: "0/1",
          blame: { author: "@songmin", when: "3w" },
        },
        {
          name: "strategy",
          kind: "parameter",
          detail: "Injected Strategy port.",
          line: 499,
          taint: "source",
          tags: ["taint-source"],
        },
        {
          name: "store",
          kind: "parameter",
          detail: "Injected ExperienceStore port.",
          line: 499,
        },
      ],
    },
    {
      name: "Strategy",
      kind: "class",
      detail: "Abstract reasoning strategy port (fast | deep).",
      line: 202,
      riskScore: 12,
      blame: { author: "@devops-bot", when: "1mo" },
    },
    {
      name: "ExperienceStore",
      kind: "class",
      detail: "Persists reasoning traces for later replay.",
      line: 63,
      layer: "infra",
      role: "Store",
      contract: { verb: "implements", name: "ExperiencePort" },
      why: { label: "ADR-14 · persistent reasoning memory" },
      riskScore: 23,
      complexity: 4,
      bigO: "O(1)",
      callers: 5,
      callees: 2,
      blast: 17,
      blastCritical: 1,
      stability: 0.28,
      churn90d: 2,
      heat: { level: "hot", rate: "1.2k/min" },
      tests: "5/5",
      blame: { author: "@songmin", when: "1mo" },
      incidentMatch: { id: "INC-47", similarity: 0.87, reason: "same source→sink shape" },
      tags: ["port-impl", "stable"],
      deps: {
        incoming: [
          { name: "DeepReasoningOrchestrator.execute", layer: "app" },
          { name: "ReplayService.replay", layer: "app" },
          { name: "AuditStore.snapshot", layer: "infra" },
        ],
        outgoing: [
          { name: "trace_schema.validate", layer: "domain" },
          { name: "postgres.exec", layer: "infra" },
        ],
        incomingTotal: 5,
        outgoingTotal: 2,
      },
      hotPath: { label: "ingest → reason → persist", rank: 2, total: 18 },
      lastRiskyChange: {
        sha: "8c40a1d",
        author: "@songmin",
        when: "3w",
        risk: 72,
        summary: "removed validate_trace() from save() — perf pass",
      },
      relatedIncidents: [
        { id: "INC-412", similarity: 0.91, when: "2mo" },
        { id: "INC-47", similarity: 0.87, when: "6mo" },
      ],
    },
    {
      name: "Request",
      kind: "class",
      detail: "Inbound reasoning request payload.",
      line: 0,
      riskScore: 8,
      blame: { author: "@songmin", when: "1mo" },
    },
    {
      name: "Response",
      kind: "class",
      detail: "Outbound reasoning response with trace + plan.",
      line: 0,
      riskScore: 8,
      blame: { author: "@songmin", when: "1mo" },
    },
  ],

  functionHeaders: [
    {
      line: 483,
      name: "DeepReasoningOrchestrator",
      kind: "class",
      blast: 38,
      complexity: 9,
      tests: "0/12",
      owner: "@songmin",
      riskScore: 78,
      budgetPct: 91,
    },
    {
      line: 499,
      name: "__init__",
      kind: "method",
      blast: 2,
      complexity: 1,
      bigO: "O(1)",
      tests: "0/0",
      owner: "@songmin",
      riskScore: 8,
    },
    {
      line: 523,
      name: "execute",
      kind: "method",
      blast: 31,
      blastCritical: 3,
      complexity: 9,
      bigO: "O(n)",
      tests: "0/12",
      owner: "@songmin",
      taint: "sink",
      riskScore: 78,
      budgetPct: 91,
    },
    {
      line: 588,
      name: "_select_strategy",
      kind: "method",
      blast: 3,
      complexity: 4,
      bigO: "O(1)",
      tests: "0/1",
      owner: "@songmin",
      riskScore: 38,
    },
  ],

  gutter: [
    { line: 48, glyph: "taint-source", title: "infra import: ExperienceStore (domain→infra violation)" },
    { line: 49, glyph: "taint-source", title: "infra import: postgres (domain→infra violation)" },
    { line: 365, glyph: "taint-source", title: "taint source: request.ctx (user input)" },
    { line: 412, glyph: "taint-sink", title: "taint sink: _store.save(trace) — unvalidated" },
    { line: 412, glyph: "incident-match", title: "matches incident #47 (2024-11-15): db_use_after_close" },
    { line: 478, glyph: "taint-through", title: "propagates: runner.run(step, child_ctx)" },
    { line: 680, glyph: "dead", title: "dead code: _legacy_inference_bridge — unused" },
    { line: 700, glyph: "arch-violation", title: "CPX 14 exceeds threshold 10" },
  ],

  minimap: [
    // imports — architecture violation
    { line: 48, severity: 3, kind: "arch" },
    { line: 49, severity: 3, kind: "arch" },
    // constants — dead code
    { line: 68, severity: 1, kind: "dead" },
    { line: 69, severity: 1, kind: "dead" },
    // StepContext — blast radius hub
    { line: 130, severity: 2, kind: "blast" },
    // RetryPolicy — moderate complexity
    { line: 255, severity: 2, kind: "cpx" },
    // DeepReasoningOrchestrator — main class
    { line: 340, severity: 4, kind: "blast" },
    { line: 365, severity: 3, kind: "taint" },
    { line: 412, severity: 4, kind: "taint" },
    { line: 430, severity: 2, kind: "cpx" },
    { line: 478, severity: 3, kind: "taint" },
    // Strategy implementations
    { line: 560, severity: 1, kind: "cpx" },
    { line: 610, severity: 2, kind: "cpx" },
    // Runners — taint analysis
    { line: 650, severity: 2, kind: "taint" },
    { line: 670, severity: 2, kind: "taint" },
    // Dead code
    { line: 680, severity: 3, kind: "dead" },
    // resolve_policy — high complexity
    { line: 700, severity: 4, kind: "cpx" },
    { line: 720, severity: 3, kind: "cpx" },
    // Factory
    { line: 800, severity: 1, kind: "blast" },
  ],

  imports: [],

  callSites: [
    {
      line: 600,
      callee: "Strategy.select",
      calleeFile: "ports/strategy.py",
      effects: ["pure"],
    },
    {
      line: 700,
      callee: "Step.run",
      calleeFile: "ports/step.py",
      effects: ["io:read"],
      taintPath: {
        id: "tp-step",
        owasp: "A03 (Injection)",
        severity: 2,
        steps: [
          { line: 523, symbol: "request", hop: "source", detail: "inbound request.ctx" },
          { line: 700, symbol: "step.run", hop: "propagate", detail: "passes ctx to step implementation" },
        ],
      },
    },
    {
      line: 548,
      callee: "ExperienceStore.save",
      calleeFile: "infra/experience_store.py",
      effects: ["io:write", "persist"],
      taintPath: {
        id: "tp-sink",
        owasp: "A03 (Injection)",
        severity: 3,
        steps: [
          { line: 523, symbol: "request", hop: "source", detail: "untrusted request.ctx" },
          { line: 700, symbol: "step.run", hop: "propagate", detail: "ctx → result" },
          { line: 543, symbol: "trace", hop: "propagate", detail: "result → trace[]" },
          { line: 548, symbol: "_store.save", hop: "sink", detail: "save(trace) — no validation" },
        ],
        sanitizerHints: [
          "validate trace.origin before save",
          "schema-check trace with pydantic model",
          "require signed envelope from step.run",
        ],
      },
    },
  ],

  taintPaths: [
    {
      id: "tp-sink",
      owasp: "A03 (Injection)",
      severity: 3,
      steps: [
        { line: 523, symbol: "request", hop: "source", detail: "untrusted request.ctx" },
        { line: 700, symbol: "step.run", hop: "propagate", detail: "ctx → result" },
        { line: 543, symbol: "trace", hop: "propagate", detail: "result → trace[]" },
        { line: 548, symbol: "_store.save", hop: "sink", detail: "save(trace) — no validation" },
      ],
      sanitizerHints: [
        "validate trace.origin before save",
        "schema-check trace with pydantic model",
      ],
    },
    {
      id: "tp-strategy",
      owasp: "A04 (Insecure Design)",
      severity: 2,
      steps: [
        { line: 499, symbol: "strategy", hop: "source", detail: "injected strategy port" },
        { line: 589, symbol: "self._strategy.fast", hop: "branch", detail: "kind=='fast' path" },
        { line: 591, symbol: "self._strategy.deep", hop: "sink", detail: "default path — unchecked" },
      ],
    },
  ],

  blastTargets: [
    { file: "api/inference_router.py", riskScore: 72, callPath: ["inference_router.handle", "execute"], reason: "direct-caller" },
    { file: "api/stream_handler.py", riskScore: 61, callPath: ["stream_handler.stream", "execute"], reason: "direct-caller" },
    { file: "replay/router.py", riskScore: 48, callPath: ["router.replay_request", "execute"], reason: "direct-caller" },
    { file: "infra/experience_store.py", riskScore: 55, callPath: ["execute", "_store.save"], reason: "shared-data" },
    { file: "tests/integration/test_reasoning.py", riskScore: 12, callPath: ["test_reasoning", "execute"], reason: "test" },
    { file: "observability/trace_sink.py", riskScore: 34, callPath: ["trace_sink.record", "_store.save"], reason: "transitive-caller" },
    { file: "shared/reasoning.py", riskScore: 61, callPath: ["reasoning.compose", "execute"], reason: "transitive-caller" },
    { file: "domain/models.py", riskScore: 31, callPath: ["*", "Response"], reason: "shared-data" },
  ],

  incidents: [
    {
      id: "INC-47",
      date: "2024-11-15",
      title: "experience_store write stalled pipeline under malformed trace",
      patternKind: "taint",
      confidence: 0.87,
      matchDetail: "same source→sink shape: untrusted ctx → store.save without schema check",
      postmortemUrl: "incidents/INC-47",
    },
    {
      id: "INC-31",
      date: "2024-08-02",
      title: "orchestrator complexity regression caused 4x p95 latency",
      patternKind: "cpx-spike",
      confidence: 0.71,
      matchDetail: "execute() cpx 9 crossed team budget (8) — same signature drift as INC-31",
    },
  ],

  behaviorDiff: [
    { line: 9, kind: "syntax", summary: "whitespace" },
    { line: 13, kind: "semantic", summary: "trace.append reordered — now after terminal check was removed", before: "trace.append(result); if result.is_terminal(): break", after: "result = step.run(request.ctx); trace.append(result)" },
    { line: 16, kind: "runtime", summary: "new sink path — _store.save now reachable with unvalidated trace", before: "(no call)", after: "self._store.save(trace)" },
  ],

  nextHops: {
    "ext:right:ExperienceStore.save": [
      { name: "postgres.exec", file: "infra/postgres.py", terminalKind: "db" },
    ],
    "ext:right:Step.run": [
      { name: "Tracer.emit", file: "infra/tracer.py" },
    ],
    "ext:right:Strategy.select": [
      { name: "PlanCache.get", file: "infra/plan_cache.py", terminalKind: "cache" },
    ],
    // ── Ingress entry paths (left side) ───────────────────────────
    "ext:left:HTTPController.handle": [
      { name: "APIGateway.route", file: "api/gateway.py" },
      { name: "LoadBalancer.forward", file: "infra/lb.py", terminalKind: "api" },
    ],
    "ext:left:WebhookController.receive": [
      { name: "WebhookRegistry.dispatch", file: "api/webhook_registry.py" },
      { name: "SignatureVerifier.check", file: "security/verifier.py" },
    ],
    "ext:left:ReplayService.step": [
      { name: "SchedulerJob.trigger", file: "scheduler/job.py" },
      { name: "CronRunner.tick", file: "infra/cron.py", terminalKind: "queue" },
    ],
  },
};

// ═══════════════════════════════════════════════════════════════════
// routing_policy.py — Strategy Routing Policy
// ═══════════════════════════════════════════════════════════════════

export const ROUTING_POLICY_SOURCE = `"""
routing_policy.py — Strategy Routing Policy
============================================
Policy-based strategy router for incoming analysis requests.
Maps request characteristics to reasoning strategies
using the RFC-11 §4 truth table.

Routing dimensions:
  strategy_kind × source × priority × feature_flags → Strategy

Owner: @songmin (94 %) · @ci-bot (6 %)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Dict, Final, List, Optional, Protocol

from .domain.model import Request, Plan
from .domain.ports import StrategyPort
from .infra.feature_flags import FeatureFlagStore    # ← infra dep

logger: Final = logging.getLogger(__name__)

# ─── Constants ────────────────────────────────────────────────────

FAST_PATH_THRESHOLD: Final[float] = 0.85
DEFAULT_TIMEOUT_S: Final[float] = 30.0
ROUTING_VERSION: Final[str] = "v2.1"
_DEPRECATED_FALLBACK: Final[str] = "legacy"    # ← dead constant


# ─── Protocols ────────────────────────────────────────────────────

class Strategy(Protocol):
    """Abstract strategy port."""
    def select(self, request: Request) -> Plan: ...
    @property
    def fast(self) -> "Strategy": ...
    @property
    def deep(self) -> "Strategy": ...


# ─── Data classes ─────────────────────────────────────────────────

@dataclass(frozen=True)
class RoutingDecision:
    """Captures routing decision for audit trail."""
    strategy_kind: str
    reason: str
    source: str
    confidence: float
    flags_consulted: List[str]


@dataclass(frozen=True)
class RoutingConfig:
    """Policy configuration — loaded from environment."""
    fast_threshold: float = FAST_PATH_THRESHOLD
    timeout_s: float = DEFAULT_TIMEOUT_S
    enable_hybrid: bool = True
    audit_decisions: bool = True
    max_depth: int = 12


# ─── Routing Context ─────────────────────────────────────────────

class RoutingContext:
    """Extracts routing-relevant fields from request context."""

    def __init__(self, request: Request, flags: FeatureFlagStore):
        self._request = request
        self._flags = flags
        self._ctx = request.ctx or {}

    @property
    def kind(self) -> str:
        return self._ctx.get("strategy_kind", "auto")

    @property
    def source(self) -> str:
        return self._ctx.get("source", "unknown")

    @property
    def priority(self) -> str:
        return self._ctx.get("priority", "normal")

    @property
    def prior_confidence(self) -> float:
        return float(self._ctx.get("prior_confidence", 0))

    @property
    def depth(self) -> int:
        return self._request.depth or 0

    def flag(self, name: str) -> bool:
        return self._flags.get(name)


# ─── Decision Audit ──────────────────────────────────────────────

class DecisionAuditor:
    """Records routing decisions for post-hoc analysis."""

    def __init__(self) -> None:
        self._log: List[RoutingDecision] = []

    def record(self, decision: RoutingDecision) -> None:
        self._log.append(decision)
        logger.info("Routing: %s (%s)", decision.strategy_kind, decision.reason)

    @property
    def history(self) -> List[RoutingDecision]:
        return list(self._log)


# ─── Core Policy (CPX = 14) ──────────────────────────────────────

def resolve_policy(
    request: Request,
    available_strategies: List[Strategy],
    fallback: Strategy,
    feature_flags: FeatureFlagStore,
    config: Optional[RoutingConfig] = None,
) -> Strategy:
    """
    Policy-based strategy router.
    Cyclomatic complexity 14 — encodes RFC-11 §4 truth table.
    """
    cfg = config or RoutingConfig()
    rctx = RoutingContext(request, feature_flags)

    # ── Explicit kind override ─────────────────────────────────
    if rctx.kind == "fast":
        for s in available_strategies:
            if hasattr(s, "fast"):
                return s.fast
        return fallback.fast

    if rctx.kind == "deep":
        for s in available_strategies:
            if hasattr(s, "deep"):
                return s.deep
        return fallback.deep

    if rctx.kind == "hybrid" and cfg.enable_hybrid:
        return _build_hybrid(available_strategies, fallback)

    # ── Priority-based routing ─────────────────────────────────
    if rctx.priority == "critical":
        return fallback.deep

    if rctx.priority == "low":
        return fallback.fast

    # ── Source-based routing ───────────────────────────────────
    if rctx.source == "ci":
        if rctx.flag("enable_deep_v2"):
            return _build_hybrid(available_strategies, fallback)
        return fallback.fast

    if rctx.source == "ide":
        if rctx.prior_confidence >= cfg.fast_threshold:
            return fallback.fast
        return fallback.deep

    if rctx.source == "api":
        if rctx.depth > 6:
            return fallback.deep
        if rctx.depth > 3:
            return _build_hybrid(available_strategies, fallback)
        return fallback.fast

    if rctx.source == "webhook":
        if rctx.flag("webhook_deep_analysis"):
            return fallback.deep
        return fallback.fast

    return fallback


def _build_hybrid(
    strategies: List[Strategy],
    fallback: Strategy,
) -> Strategy:
    """Compose hybrid from available fast + deep."""
    fast = deep = None
    for s in strategies:
        if hasattr(s, "fast") and not fast:
            fast = s.fast
        if hasattr(s, "deep") and not deep:
            deep = s.deep
    if fast and deep:
        return HybridStrategy(fast, deep)
    return fallback


def validate_routing_config(config: RoutingConfig) -> List[str]:
    """Pre-flight check on routing configuration."""
    errors: List[str] = []
    if not 0 <= config.fast_threshold <= 1:
        errors.append("fast_threshold must be 0..1")
    if config.timeout_s <= 0:
        errors.append("timeout_s must be positive")
    if config.max_depth < 1:
        errors.append("max_depth must be >= 1")
    return errors


# ─── Hybrid Strategy ─────────────────────────────────────────────

class HybridStrategy:
    """Starts fast, falls back to deep if confidence is low."""

    def __init__(self, fast: Strategy, deep: Strategy) -> None:
        self._fast = fast
        self._deep = deep
        self._threshold = FAST_PATH_THRESHOLD

    def select(self, request: Request) -> Plan:
        prior = request.ctx.get("prior_confidence", 0) if request.ctx else 0
        if prior >= self._threshold:
            return self._fast.select(request)
        return self._deep.select(request)

    @property
    def fast(self) -> Strategy:
        return self._fast

    @property
    def deep(self) -> Strategy:
        return self._deep
`;

export const ROUTING_POLICY: FileFacts = {
  name: "routing_policy.py",
  loc: 232,
  blast: 22,
  blastCritical: 1,
  taintCount: 1,
  cpxMax: 14,
  cpxBudgetPct: 140,
  archViolations: 1,
  deadCount: 1,
  riskScore: 62,
  lastModified: "3d",
  owner: "@songmin",
  ownership: [
    { author: "@songmin", pct: 94, role: "primary" },
    { author: "@ci-bot", pct: 6, role: "contributor" },
  ],

  symbols: [
    {
      name: "resolve_policy",
      kind: "function",
      detail: "Policy-based strategy router — RFC-11 §4 truth table.",
      line: 119,
      layer: "app",
      why: { label: "RFC-11 §4 · strategy routing truth table" },
      riskScore: 62,
      complexity: 14,
      bigO: "O(n)",
      callers: 8,
      callees: 4,
      blast: 22,
      blastCritical: 1,
      stability: 0.65,
      churn90d: 11,
      heat: { level: "hot", rate: "340/min" },
      tests: "3/8",
      blame: { author: "@songmin", when: "3d" },
      tags: ["cpx-over-budget", "hotspot"],
      deps: {
        incoming: [
          { name: "Orchestrator._build_plan", layer: "app" },
          { name: "CLIRunner.dispatch", layer: "adapter" },
          { name: "SchedulerService.pick", layer: "app" },
        ],
        outgoing: [
          { name: "FeatureFlagStore.get", layer: "infra" },
        ],
        incomingTotal: 8,
        outgoingTotal: 4,
      },
      hotPath: { label: "ingest → route → reason", rank: 1, total: 22 },
      lastRiskyChange: {
        sha: "e47c2a1",
        author: "@songmin",
        when: "3d",
        risk: 62,
        summary: "added webhook routing path — CPX jumped from 11 to 14",
      },
      relatedIncidents: [
        { id: "INC-39", similarity: 0.73, when: "3mo" },
      ],
    },
    {
      name: "RoutingContext",
      kind: "class",
      detail: "Extracts routing-relevant fields from request context.",
      line: 68,
      layer: "app",
      riskScore: 15,
      complexity: 2,
      callers: 1,
      tests: "2/2",
      blame: { author: "@songmin", when: "1w" },
      children: [
        {
          name: "kind",
          kind: "method",
          detail: "Returns strategy_kind from context.",
          line: 77,
        },
        {
          name: "source",
          kind: "method",
          detail: "Returns request source.",
          line: 81,
        },
        {
          name: "flag",
          kind: "method",
          detail: "Reads a feature flag from the store.",
          line: 96,
          taint: "passthrough",
          tags: ["taint-through"],
        },
      ],
    },
    {
      name: "DecisionAuditor",
      kind: "class",
      detail: "Records routing decisions for post-hoc analysis.",
      line: 102,
      layer: "app",
      riskScore: 8,
      complexity: 1,
      callers: 2,
      tests: "1/1",
      blame: { author: "@songmin", when: "2w" },
    },
    {
      name: "HybridStrategy",
      kind: "class",
      detail: "Starts fast, falls back to deep if confidence is low.",
      line: 212,
      layer: "app",
      riskScore: 18,
      complexity: 3,
      callers: 3,
      callees: 2,
      blast: 8,
      tests: "2/3",
      blame: { author: "@songmin", when: "1w" },
      children: [
        {
          name: "select",
          kind: "method",
          detail: "Delegates to fast or deep based on confidence.",
          line: 220,
          riskScore: 18,
          complexity: 3,
        },
      ],
    },
    {
      name: "_build_hybrid",
      kind: "function",
      detail: "Composes hybrid from available fast + deep strategies.",
      line: 182,
      riskScore: 10,
      complexity: 3,
      callers: 3,
      tests: "1/2",
      blame: { author: "@songmin", when: "1w" },
    },
    {
      name: "validate_routing_config",
      kind: "function",
      detail: "Pre-flight check on routing configuration.",
      line: 198,
      riskScore: 5,
      complexity: 3,
      callers: 2,
      tests: "3/3",
      blame: { author: "@ci-bot", when: "2w" },
    },
    {
      name: "Strategy",
      kind: "class",
      detail: "Abstract strategy port (Protocol).",
      line: 35,
      riskScore: 4,
      blame: { author: "@songmin", when: "1mo" },
    },
  ],

  functionHeaders: [
    {
      line: 119,
      name: "resolve_policy",
      kind: "function",
      blast: 22,
      blastCritical: 1,
      complexity: 14,
      tests: "3/8",
      owner: "@songmin",
      riskScore: 62,
      budgetPct: 140,
    },
    {
      line: 68,
      name: "RoutingContext",
      kind: "class",
      blast: 3,
      complexity: 2,
      tests: "2/2",
      owner: "@songmin",
      riskScore: 15,
    },
    {
      line: 102,
      name: "DecisionAuditor",
      kind: "class",
      blast: 1,
      complexity: 1,
      tests: "1/1",
      owner: "@songmin",
      riskScore: 8,
    },
    {
      line: 182,
      name: "_build_hybrid",
      kind: "function",
      blast: 8,
      complexity: 3,
      tests: "1/2",
      owner: "@songmin",
      riskScore: 10,
    },
    {
      line: 198,
      name: "validate_routing_config",
      kind: "function",
      blast: 1,
      complexity: 3,
      tests: "3/3",
      owner: "@ci-bot",
      riskScore: 5,
    },
    {
      line: 212,
      name: "HybridStrategy",
      kind: "class",
      blast: 8,
      complexity: 3,
      tests: "2/3",
      owner: "@songmin",
      riskScore: 18,
    },
  ],

  gutter: [
    { line: 21, glyph: "arch-violation", title: "infra import: FeatureFlagStore (app → infra violation)" },
    { line: 30, glyph: "dead", title: "dead constant: _DEPRECATED_FALLBACK — unused" },
    { line: 119, glyph: "arch-violation", title: "CPX 14 exceeds budget 10" },
    { line: 158, glyph: "taint-through", title: "feature flag value flows into strategy selection" },
  ],

  minimap: [
    { line: 21, severity: 3, kind: "arch" },
    { line: 30, severity: 1, kind: "dead" },
    { line: 68, severity: 1, kind: "cpx" },
    { line: 119, severity: 4, kind: "cpx" },
    { line: 134, severity: 2, kind: "cpx" },
    { line: 158, severity: 3, kind: "taint" },
    { line: 175, severity: 2, kind: "taint" },
    { line: 212, severity: 2, kind: "cpx" },
  ],

  imports: [],

  callSites: [
    {
      line: 158,
      callee: "FeatureFlagStore.get",
      calleeFile: "infra/feature_flags.py",
      effects: ["io:read"],
      taintPath: {
        id: "tp-flags",
        owasp: "A05 (Security Misconfiguration)",
        severity: 2,
        steps: [
          { line: 123, symbol: "feature_flags", hop: "source", detail: "injected FeatureFlagStore (env config)" },
          { line: 158, symbol: "rctx.flag", hop: "propagate", detail: "flag value controls routing path" },
          { line: 159, symbol: "_build_hybrid", hop: "sink", detail: "unvalidated flag → strategy selection" },
        ],
      },
    },
  ],

  taintPaths: [
    {
      id: "tp-flags",
      owasp: "A05 (Security Misconfiguration)",
      severity: 2,
      steps: [
        { line: 123, symbol: "feature_flags", hop: "source", detail: "injected FeatureFlagStore (env config)" },
        { line: 158, symbol: "rctx.flag", hop: "propagate", detail: "flag value controls routing path" },
        { line: 159, symbol: "_build_hybrid", hop: "sink", detail: "unvalidated flag → strategy selection" },
      ],
    },
  ],

  blastTargets: [
    { file: "orchestrator/orchestrator.py", riskScore: 78, callPath: ["resolve_policy", "_build_plan", "execute"], reason: "direct-caller" },
    { file: "cli/runner.py", riskScore: 42, callPath: ["CLIRunner.dispatch", "resolve_policy"], reason: "direct-caller" },
    { file: "scheduler/job.py", riskScore: 35, callPath: ["SchedulerService.pick", "resolve_policy"], reason: "direct-caller" },
    { file: "api/inference_router.py", riskScore: 72, callPath: ["inference_router.handle", "execute", "resolve_policy"], reason: "transitive-caller" },
  ],

  incidents: [
    {
      id: "INC-39",
      date: "2025-01-22",
      title: "feature flag misconfiguration routed all traffic to deep strategy",
      patternKind: "arch-drift",
      confidence: 0.73,
      matchDetail: "FeatureFlagStore.get without default → all requests took deep path for 4h",
    },
  ],

  behaviorDiff: [
    { line: 146, kind: "semantic", summary: "added hybrid path for explicit kind=hybrid", before: "fallback to deep", after: "cfg.enable_hybrid → _build_hybrid" },
    { line: 174, kind: "semantic", summary: "new webhook source routing added", before: "(no webhook handling)", after: "webhook → deep if flag set" },
  ],

  nextHops: {
    "ext:right:FeatureFlagStore.get": [
      { name: "redis.get", file: "infra/redis_client.py", terminalKind: "cache" },
    ],
    "ext:left:Orchestrator._build_plan": [
      { name: "HTTPController.handle", file: "api/inference_router.py" },
      { name: "WebhookController.receive", file: "api/webhook.py" },
    ],
    "ext:left:CLIRunner.dispatch": [
      { name: "CLIParser.parse", file: "cli/parser.py" },
      { name: "__main__.main", file: "__main__.py", terminalKind: "api" },
    ],
    "ext:left:SchedulerService.pick": [
      { name: "CronRunner.tick", file: "infra/cron.py", terminalKind: "queue" },
    ],
  },
};


// ═══════════════════════════════════════════════════════════════════
// security.py — Request Security & Validation
// ═══════════════════════════════════════════════════════════════════

export const SECURITY_SOURCE = `"""
security.py — Request Security & Validation
============================================
Security layer for the plan orchestration pipeline.
Validates request envelopes, sanitizes untrusted context,
and enforces permission boundaries.

Architecture
------------
  Request  →  validate_envelope()  →  pass/reject
  Request  →  sanitize_context()   →  cleaned context
  Request  →  check_permissions()  →  pass/deny

  ⚠️  Currently NOT called in orchestrator.execute() hot path.
  See RFC-13 §2: "mandatory pre-flight security hook"

Owner: @security-team (72 %) · @songmin (28 %)
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import time
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Any, Dict, Final, FrozenSet, List, Optional, Set, Tuple

from .domain.model import Request
from .domain.ports import AuditPort
from .infra.crypto import verify_hmac, generate_nonce
from .infra.audit_logger import AuditLogger
from .infra.permission_store import PermissionStore

logger: Final = logging.getLogger(__name__)

# ─── Constants ────────────────────────────────────────────────────

MAX_CONTEXT_SIZE_BYTES: Final[int] = 65_536
MAX_NESTING_DEPTH: Final[int] = 8
ENVELOPE_VERSION: Final[str] = "v2"
NONCE_TTL_S: Final[int] = 300
REPLAY_WINDOW_S: Final[int] = 60
_LEGACY_HMAC_KEY: Final[str] = "changeme"     # ← dead / insecure
DANGEROUS_KEYS: Final[FrozenSet[str]] = frozenset({
    "__import__", "eval", "exec", "__builtins__",
    "subprocess", "os.system", "os.popen",
})


# ─── Enums ────────────────────────────────────────────────────────

class SecurityLevel(Enum):
    PUBLIC = auto()
    INTERNAL = auto()
    CONFIDENTIAL = auto()
    RESTRICTED = auto()


class ValidationResult(Enum):
    PASS = auto()
    FAIL_SIGNATURE = auto()
    FAIL_REPLAY = auto()
    FAIL_SIZE = auto()
    FAIL_DEPTH = auto()
    FAIL_DANGEROUS_KEY = auto()
    FAIL_PERMISSION = auto()


# ─── Data classes ─────────────────────────────────────────────────

@dataclass(frozen=True)
class Envelope:
    """Signed request envelope for integrity."""
    version: str
    nonce: str
    timestamp: float
    signature: str
    payload: Dict[str, Any]
    issuer: str


@dataclass(frozen=True)
class SecurityReport:
    """Result of all security checks."""
    passed: bool
    checks: List[Tuple[str, ValidationResult]]
    sanitized_keys: List[str]
    elapsed_ms: float
    level: SecurityLevel


@dataclass
class NonceCache:
    """Tracks seen nonces to prevent replay attacks."""
    _seen: Dict[str, float] = field(default_factory=dict)
    _ttl_s: int = NONCE_TTL_S

    def check_and_record(self, nonce: str) -> bool:
        now = time.monotonic()
        self._evict(now)
        if nonce in self._seen:
            return False
        self._seen[nonce] = now
        return True

    def _evict(self, now: float) -> None:
        expired = [k for k, t in self._seen.items() if now - t > self._ttl_s]
        for k in expired:
            del self._seen[k]


# ─── Envelope Validation ─────────────────────────────────────────

class EnvelopeValidator:
    """Validates signed request envelopes."""

    def __init__(self, secret: str, nonce_cache: Optional[NonceCache] = None):
        self._secret = secret
        self._nonces = nonce_cache or NonceCache()

    def validate(self, envelope: Envelope) -> List[Tuple[str, ValidationResult]]:
        results: List[Tuple[str, ValidationResult]] = []

        # Timestamp freshness
        age = time.time() - envelope.timestamp
        if age > REPLAY_WINDOW_S or age < -5:
            results.append(("timestamp", ValidationResult.FAIL_REPLAY))
            return results

        # Replay protection
        if not self._nonces.check_and_record(envelope.nonce):
            results.append(("nonce", ValidationResult.FAIL_REPLAY))
            return results

        # Signature verification
        expected = self._compute_signature(envelope)
        if not hmac.compare_digest(envelope.signature, expected):
            results.append(("signature", ValidationResult.FAIL_SIGNATURE))
            return results

        results.append(("envelope", ValidationResult.PASS))
        return results

    def _compute_signature(self, envelope: Envelope) -> str:
        msg = f"{envelope.version}:{envelope.nonce}:{envelope.timestamp}"
        return hmac.new(
            self._secret.encode(), msg.encode(), hashlib.sha256,
        ).hexdigest()


# ─── Context Sanitization ────────────────────────────────────────

def sanitize_context(
    ctx: Dict[str, Any],
) -> Tuple[Dict[str, Any], List[str]]:
    """
    Strip dangerous keys and enforce size/depth limits.
    This is the SANITIZER for the taint path:
      request.ctx (source) → sanitize_context → clean ctx
    """
    removed: List[str] = []
    sanitized = _deep_sanitize(ctx, removed, depth=0)

    raw_size = len(str(sanitized).encode("utf-8"))
    if raw_size > MAX_CONTEXT_SIZE_BYTES:
        sanitized = {"_truncated": True, "_original_size": raw_size}
        removed.append("__entire_context__")

    return sanitized, removed


def _deep_sanitize(
    obj: Any, removed: List[str], depth: int,
) -> Any:
    """Recursive sanitizer — strips dangerous keys at all levels."""
    if depth > MAX_NESTING_DEPTH:
        removed.append(f"__depth_{depth}__")
        return None

    if isinstance(obj, dict):
        result: Dict[str, Any] = {}
        for k, v in obj.items():
            if k in DANGEROUS_KEYS or k.startswith("__"):
                removed.append(k)
                continue
            result[k] = _deep_sanitize(v, removed, depth + 1)
        return result

    if isinstance(obj, (list, tuple)):
        return [_deep_sanitize(item, removed, depth + 1) for item in obj]

    if isinstance(obj, str):
        for pattern in DANGEROUS_KEYS:
            if pattern in obj:
                removed.append(f"str:{pattern}")
                return "[REDACTED]"

    return obj


# ─── Permission Checks ───────────────────────────────────────────

class PermissionChecker:
    """RBAC permission enforcement."""

    def __init__(self, store: PermissionStore, audit: AuditLogger):
        self._store = store
        self._audit = audit

    def check(self, issuer: str, action: str, resource: str) -> ValidationResult:
        allowed = self._store.has_permission(issuer, action, resource)
        self._audit.emit(
            event="permission_check",
            issuer=issuer, action=action,
            resource=resource, result="allow" if allowed else "deny",
        )
        if not allowed:
            return ValidationResult.FAIL_PERMISSION
        return ValidationResult.PASS


# ─── Security Pipeline ───────────────────────────────────────────

class SecurityPipeline:
    """
    Full security pipeline: envelope → sanitize → permissions.
    ⚠️  NOT wired into DeepReasoningOrchestrator yet (RFC-13).
    """

    def __init__(
        self, validator: EnvelopeValidator,
        checker: PermissionChecker,
        audit: AuditLogger,
    ):
        self._validator = validator
        self._checker = checker
        self._audit = audit

    def run(self, envelope: Envelope) -> SecurityReport:
        start = time.monotonic()
        all_checks: List[Tuple[str, ValidationResult]] = []

        # Step 1: Validate envelope
        envelope_results = self._validator.validate(envelope)
        all_checks.extend(envelope_results)

        if any(r != ValidationResult.PASS for _, r in envelope_results):
            elapsed = (time.monotonic() - start) * 1000
            self._audit.emit(event="security_reject", reason=str(all_checks))
            return SecurityReport(
                passed=False, checks=all_checks, sanitized_keys=[],
                elapsed_ms=elapsed, level=SecurityLevel.RESTRICTED,
            )

        # Step 2: Sanitize context
        sanitized_ctx, removed = sanitize_context(envelope.payload)

        # Step 3: Permission check
        perm_result = self._checker.check(
            issuer=envelope.issuer, action="execute",
            resource="reasoning_pipeline",
        )
        all_checks.append(("permission", perm_result))

        passed = all(r == ValidationResult.PASS for _, r in all_checks)
        elapsed = (time.monotonic() - start) * 1000

        return SecurityReport(
            passed=passed, checks=all_checks, sanitized_keys=removed,
            elapsed_ms=elapsed,
            level=SecurityLevel.INTERNAL if passed else SecurityLevel.RESTRICTED,
        )


# ─── Rate Limiting ───────────────────────────────────────────────

class RateLimiter:
    """Token bucket rate limiter per issuer."""

    def __init__(self, rate: float = 10.0, burst: int = 20):
        self._rate = rate
        self._burst = burst
        self._buckets: Dict[str, Tuple[float, float]] = {}

    def allow(self, issuer: str) -> bool:
        now = time.monotonic()
        tokens, last = self._buckets.get(issuer, (float(self._burst), now))
        elapsed = now - last
        tokens = min(float(self._burst), tokens + elapsed * self._rate)
        if tokens < 1:
            return False
        self._buckets[issuer] = (tokens - 1, now)
        return True
`;

export const SECURITY: FileFacts = {
  name: "security.py",
  loc: 291,
  blast: 15,
  blastCritical: 0,
  taintCount: 3,
  cpxMax: 6,
  cpxBudgetPct: 60,
  archViolations: 0,
  deadCount: 1,
  riskScore: 45,
  lastModified: "1w",
  owner: "@security-team",
  ownership: [
    { author: "@security-team", pct: 72, role: "primary" },
    { author: "@songmin", pct: 28, role: "contributor" },
  ],

  symbols: [
    {
      name: "SecurityPipeline",
      kind: "class",
      detail: "Full security pipeline: envelope → sanitize → permissions.",
      line: 222,
      layer: "app",
      role: "Pipeline",
      why: { label: "RFC-13 · mandatory pre-flight security" },
      riskScore: 45,
      complexity: 6,
      callers: 5,
      callees: 4,
      blast: 15,
      stability: 0.82,
      churn90d: 4,
      heat: { level: "warm", rate: "180/min" },
      tests: "6/8",
      blame: { author: "@security-team", when: "1w" },
      tags: ["not-wired", "security-critical"],
      deps: {
        incoming: [
          { name: "APIMiddleware.pre_hook", layer: "adapter" },
          { name: "WebhookHandler.verify", layer: "adapter" },
          { name: "GRPCInterceptor.intercept", layer: "adapter" },
        ],
        outgoing: [
          { name: "AuditLogger.emit", layer: "infra" },
        ],
        incomingTotal: 5,
        outgoingTotal: 4,
      },
      children: [
        {
          name: "run",
          kind: "method",
          detail: "Executes all security checks in sequence.",
          line: 237,
          layer: "app",
          riskScore: 45,
          complexity: 6,
          callers: 5,
          taint: "sanitized",
          tags: ["sanitizer"],
          flowsTo: [
            { line: 237, symbol: "envelope", hop: "source: envelope.payload (untrusted)" },
            { line: 242, symbol: "validate", hop: "check: envelope signature" },
            { line: 254, symbol: "sanitize_context", hop: "sanitize: strip dangerous keys" },
            { line: 257, symbol: "check", hop: "gate: RBAC permission" },
          ],
        },
      ],
    },
    {
      name: "EnvelopeValidator",
      kind: "class",
      detail: "Validates signed request envelopes.",
      line: 112,
      layer: "app",
      riskScore: 22,
      complexity: 5,
      callers: 2,
      callees: 2,
      blast: 8,
      tests: "4/4",
      blame: { author: "@security-team", when: "2w" },
      tags: ["security-critical"],
      children: [
        {
          name: "validate",
          kind: "method",
          detail: "Validates envelope: timestamp, nonce, signature.",
          line: 119,
          riskScore: 22,
          complexity: 5,
        },
      ],
    },
    {
      name: "sanitize_context",
      kind: "function",
      detail: "Strips dangerous keys — THE missing sanitizer for orchestrator taint path.",
      line: 151,
      layer: "app",
      riskScore: 30,
      complexity: 4,
      callers: 3,
      blast: 12,
      stability: 0.88,
      heat: { level: "warm", rate: "180/min" },
      tests: "5/6",
      taint: "sanitized",
      blame: { author: "@security-team", when: "1w" },
      tags: ["sanitizer", "security-critical"],
    },
    {
      name: "PermissionChecker",
      kind: "class",
      detail: "RBAC permission enforcement.",
      line: 201,
      layer: "app",
      riskScore: 18,
      complexity: 2,
      callers: 3,
      callees: 2,
      blast: 6,
      tests: "3/3",
      blame: { author: "@security-team", when: "3w" },
      deps: {
        incoming: [
          { name: "SecurityPipeline.run", layer: "app" },
        ],
        outgoing: [
          { name: "PermissionStore.has_permission", layer: "infra" },
        ],
        incomingTotal: 3,
        outgoingTotal: 2,
      },
    },
    {
      name: "NonceCache",
      kind: "class",
      detail: "Tracks seen nonces to prevent replay attacks.",
      line: 91,
      layer: "app",
      riskScore: 12,
      complexity: 2,
      callers: 1,
      tests: "2/2",
      blame: { author: "@security-team", when: "1mo" },
    },
    {
      name: "RateLimiter",
      kind: "class",
      detail: "Token bucket rate limiter per issuer.",
      line: 275,
      layer: "app",
      riskScore: 10,
      complexity: 3,
      callers: 2,
      tests: "2/2",
      blame: { author: "@songmin", when: "2w" },
    },
    {
      name: "_deep_sanitize",
      kind: "function",
      detail: "Recursive sanitizer — strips dangerous keys at all levels.",
      line: 170,
      riskScore: 25,
      complexity: 5,
      callers: 2,
      tests: "4/5",
      taint: "sanitized",
      blame: { author: "@security-team", when: "1w" },
    },
  ],

  functionHeaders: [
    {
      line: 222,
      name: "SecurityPipeline",
      kind: "class",
      blast: 15,
      complexity: 6,
      tests: "6/8",
      owner: "@security-team",
      riskScore: 45,
      budgetPct: 60,
    },
    {
      line: 112,
      name: "EnvelopeValidator",
      kind: "class",
      blast: 8,
      complexity: 5,
      tests: "4/4",
      owner: "@security-team",
      riskScore: 22,
    },
    {
      line: 151,
      name: "sanitize_context",
      kind: "function",
      blast: 12,
      complexity: 4,
      tests: "5/6",
      owner: "@security-team",
      taint: "sanitized",
      riskScore: 30,
    },
    {
      line: 170,
      name: "_deep_sanitize",
      kind: "function",
      blast: 5,
      complexity: 5,
      tests: "4/5",
      owner: "@security-team",
      riskScore: 25,
    },
    {
      line: 201,
      name: "PermissionChecker",
      kind: "class",
      blast: 6,
      complexity: 2,
      tests: "3/3",
      owner: "@security-team",
      riskScore: 18,
    },
    {
      line: 275,
      name: "RateLimiter",
      kind: "class",
      blast: 3,
      complexity: 3,
      tests: "2/2",
      owner: "@songmin",
      riskScore: 10,
    },
  ],

  gutter: [
    { line: 41, glyph: "dead", title: "dead constant: _LEGACY_HMAC_KEY — insecure default 'changeme'" },
    { line: 151, glyph: "taint-sanitized", title: "sanitizer: strips dangerous keys from untrusted ctx" },
    { line: 237, glyph: "taint-source", title: "taint source: envelope.payload (untrusted)" },
    { line: 254, glyph: "taint-through", title: "sanitize_context strips dangerous keys" },
    { line: 210, glyph: "taint-sink", title: "audit: permission result → AuditLogger" },
  ],

  minimap: [
    { line: 41, severity: 2, kind: "dead" },
    { line: 91, severity: 1, kind: "cpx" },
    { line: 112, severity: 2, kind: "cpx" },
    { line: 135, severity: 3, kind: "taint" },
    { line: 151, severity: 3, kind: "taint" },
    { line: 170, severity: 2, kind: "cpx" },
    { line: 222, severity: 2, kind: "blast" },
    { line: 237, severity: 3, kind: "taint" },
    { line: 275, severity: 1, kind: "cpx" },
  ],

  imports: [],

  callSites: [
    {
      line: 210,
      callee: "AuditLogger.emit",
      calleeFile: "infra/audit_logger.py",
      effects: ["io:write", "persist"],
    },
    {
      line: 209,
      callee: "PermissionStore.has_permission",
      calleeFile: "infra/permission_store.py",
      effects: ["io:read"],
    },
  ],

  taintPaths: [
    {
      id: "tp-sanitize",
      owasp: "A03 (Injection)",
      severity: 1,
      steps: [
        { line: 237, symbol: "envelope.payload", hop: "source", detail: "untrusted payload from client" },
        { line: 242, symbol: "validate", hop: "propagate", detail: "signature + nonce verification" },
        { line: 254, symbol: "sanitize_context", hop: "propagate", detail: "strips dangerous keys" },
        { line: 257, symbol: "checker.check", hop: "sink", detail: "RBAC permission enforcement" },
      ],
      sanitizerHints: [
        "sanitize_context is the sanitizer — currently not called from orchestrator.execute()",
        "wire SecurityPipeline.run() before _store.save() to close the taint gap",
      ],
    },
    {
      id: "tp-hmac",
      owasp: "A02 (Cryptographic Failures)",
      severity: 2,
      steps: [
        { line: 115, symbol: "secret", hop: "source", detail: "HMAC secret from config" },
        { line: 134, symbol: "_compute_signature", hop: "propagate", detail: "computes expected HMAC" },
        { line: 135, symbol: "compare_digest", hop: "sink", detail: "constant-time comparison" },
      ],
    },
    {
      id: "tp-audit",
      owasp: "A09 (Security Logging Failures)",
      severity: 1,
      steps: [
        { line: 208, symbol: "issuer", hop: "source", detail: "request issuer identity" },
        { line: 209, symbol: "has_permission", hop: "propagate", detail: "permission lookup" },
        { line: 210, symbol: "audit.emit", hop: "sink", detail: "audit trail for compliance" },
      ],
    },
  ],

  blastTargets: [
    { file: "api/inference_router.py", riskScore: 72, callPath: ["APIMiddleware.pre_hook", "SecurityPipeline.run"], reason: "direct-caller" },
    { file: "api/webhook.py", riskScore: 48, callPath: ["WebhookHandler.verify", "SecurityPipeline.run"], reason: "direct-caller" },
    { file: "api/grpc.py", riskScore: 38, callPath: ["GRPCInterceptor.intercept", "SecurityPipeline.run"], reason: "direct-caller" },
    { file: "orchestrator/orchestrator.py", riskScore: 78, callPath: ["SecurityPipeline.run", "execute (SHOULD)"], reason: "transitive-caller" },
  ],

  incidents: [
    {
      id: "INC-52",
      date: "2025-02-10",
      title: "replay attack bypassed nonce cache — TTL misconfigured",
      patternKind: "taint",
      confidence: 0.81,
      matchDetail: "NonceCache TTL was set to 0 in staging, allowing nonce reuse",
    },
  ],

  behaviorDiff: [
    { line: 151, kind: "semantic", summary: "sanitize_context now strips __dunder__ keys recursively", before: "only checked top-level DANGEROUS_KEYS", after: "recursive _deep_sanitize with depth limit" },
  ],

  nextHops: {
    "ext:right:AuditLogger.emit": [
      { name: "kafka.produce", file: "infra/kafka_client.py", terminalKind: "queue" },
      { name: "elasticsearch.index", file: "infra/es_client.py", terminalKind: "storage" },
    ],
    "ext:right:PermissionStore.has_permission": [
      { name: "postgres.query", file: "infra/postgres.py", terminalKind: "db" },
    ],
    "ext:left:APIMiddleware.pre_hook": [
      { name: "APIGateway.route", file: "api/gateway.py" },
      { name: "nginx.proxy_pass", file: "infra/nginx.conf", terminalKind: "api" },
    ],
    "ext:left:WebhookHandler.verify": [
      { name: "WebhookRegistry.dispatch", file: "api/webhook_registry.py" },
      { name: "GitHub.webhook", terminalKind: "api" },
    ],
    "ext:left:GRPCInterceptor.intercept": [
      { name: "gRPC.channel", terminalKind: "api" },
    ],
  },
};


// ═══════════════════════════════════════════════════════════════════
// Source map & file registry
// ═══════════════════════════════════════════════════════════════════

export const SOURCES: Record<string, string> = {
  "orchestrator.py": ORCHESTRATOR_SOURCE,
  "routing_policy.py": ROUTING_POLICY_SOURCE,
  "security.py": SECURITY_SOURCE,
};

export const FILES: Record<string, FileFacts> = {
  "orchestrator.py": ORCHESTRATOR,
  "routing_policy.py": ROUTING_POLICY,
  "security.py": SECURITY,
};
