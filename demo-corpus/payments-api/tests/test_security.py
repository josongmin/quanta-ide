"""
Security tool tests — PARTIAL COVERAGE (2/7 functions tested).
"""

import pytest

from codegraph_agent.tools.plan_orchestration.security import AnalyzeControlFlowTool, StepToolResult


@pytest.fixture
def tool():
    return AnalyzeControlFlowTool(semgrep_bin="echo", config_path="/dev/null")


def test_build_cfg(tool):
    cfg = tool._build_cfg("test.py")
    assert cfg["target"] == "test.py"


def test_identify_guards(tool):
    guards = tool._identify_security_guards({}, [])
    assert "auth_middleware" in guards


# NOTE: _analyze_taint_path_control_flow, _run_semgrep_analysis — UNTESTED
# _run_semgrep_analysis has subprocess.run with shell=True (security finding)
