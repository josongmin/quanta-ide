"""
Routing policy tests — PARTIAL COVERAGE (1/9 functions tested).
Intentionally sparse to show coverage gap in demo.
"""

import pytest

from domain.models import AgentTask
from codegraph_agent.orchestrator.routing_policy import DeepReasoningRoutingPolicy


@pytest.fixture
def policy():
    return DeepReasoningRoutingPolicy(backends=["beam", "o1", "debate"], default_backend="beam")


@pytest.mark.asyncio
async def test_estimate_confidence_simple(policy):
    task = AgentTask(task_id="t1", task_type="analysis", target="test.py", complexity_hint="simple")
    confidence = await policy.estimate_confidence(task)
    assert confidence == 0.85


# NOTE: route_request, _select_backend, _old_route_v1, formatLegacyResponse — all UNTESTED
# This is intentional: demonstrates coverage gap in demo
