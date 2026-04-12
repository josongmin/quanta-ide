"""Shared reasoning types used by orchestrator."""

from dataclasses import dataclass


@dataclass
class ReasoningDecision:
    path: str  # "SYSTEM_1_FAST" | "SYSTEM_2_DEEP"
    confidence: float


@dataclass
class ReflectionVerdict:
    should_retry: bool
    reason: str
    confidence: float
