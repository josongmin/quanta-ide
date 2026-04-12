"""
Audit store — compliance-grade event logging.

Analysis signals:
- risk 2: store_request — 5 callers, well-tested
- LOW risk overall: simple write path, validated input
- compliance: PII field 'email' logged without masking (AUDIT-DATA-007)
"""

import json
import sqlite3
from pathlib import Path

from pydantic import BaseModel, Field, field_validator


class AuditEntry(BaseModel):
    """Audit log entry. Pydantic-validated."""
    event: str
    actor: str
    timestamp: float
    payload: dict = Field(default_factory=dict)
    # BUG: email in payload logged without PII masking
    # Compliance finding: DATA-007

    @field_validator("event")
    @classmethod
    def validate_event(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("event must not be empty")
        return v.strip()


def store_request(entry: AuditEntry, db_path: Path) -> None:
    """
    Write audit entry to SQLite. risk 2 — 5 callers, all tested.
    Low blast radius (8 files).
    """
    conn = sqlite3.connect(str(db_path))
    conn.execute(
        "INSERT INTO audit (event, actor, ts, payload) VALUES (?, ?, ?, ?)",
        (entry.event, entry.actor, entry.timestamp, json.dumps(entry.payload)),
    )
    conn.commit()
    conn.close()
