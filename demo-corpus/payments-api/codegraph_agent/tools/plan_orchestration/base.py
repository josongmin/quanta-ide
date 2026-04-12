"""
Base tool classes for plan orchestration.

StepTool ABC + StepToolResult. All plan tools extend StepTool.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class StepToolResult:
    success: bool
    data: dict = field(default_factory=dict)
    confidence: float = 0.0


class QueryDSLMixin:
    """Mixin for tools that query code via DSL (tree-sitter, semgrep, etc)."""

    def _parse_query(self, query: str) -> dict:
        return {"parsed": query}

    def _execute_query(self, parsed: dict, target: str) -> list:
        return []


class StepTool(ABC, QueryDSLMixin):
    """Abstract base for all plan orchestration tools."""

    @abstractmethod
    def execute(self, target: str) -> StepToolResult:
        ...

    def validate_target(self, target: str) -> bool:
        """Override to add target validation."""
        return bool(target and target.strip())
