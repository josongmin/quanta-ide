"""
Orchestrator tests — ZERO COVERAGE.
This file exists but contains no working tests, demonstrating the
"0/12 tests" signal for execute() in the IDE demo.
"""

import pytest

# NOTE: No tests for execute(), _decide_reasoning_path, _select_strategy,
# _run_beam_strategy, _run_o1_strategy, _run_debate_strategy, _run_alphacode_strategy,
# _legacy_inference_bridge, OldRetryPolicy, TEMP_FEATURE_FLAG
#
# This is the highest-risk file in the demo:
# - 12 callers, 0 tests
# - taint flow: request → strategy → experience_store.save()
# - retry loop without idempotency
# - 28 commits in 30 days (highest churn)


@pytest.mark.skip(reason="TODO: write tests for execute() — tracked in JIRA-1234")
def test_execute_placeholder():
    """Placeholder — never runs."""
    pass


@pytest.mark.skip(reason="TODO: test retry idempotency — INC-2024-0312")
def test_retry_idempotency():
    """Should verify idempotency key prevents duplicate writes."""
    pass
