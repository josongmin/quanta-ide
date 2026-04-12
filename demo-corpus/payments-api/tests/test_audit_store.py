"""
Audit store tests — FULL COVERAGE (5/5 functions tested).
This is the "safe" file in the demo: low risk, fully tested.
"""

import sqlite3
import tempfile
from pathlib import Path

import pytest

from infrastructure.audit_store import AuditEntry, store_request


@pytest.fixture
def db_path(tmp_path):
    db = tmp_path / "test_audit.db"
    conn = sqlite3.connect(str(db))
    conn.execute("CREATE TABLE audit (event TEXT, actor TEXT, ts REAL, payload TEXT)")
    conn.commit()
    conn.close()
    return db


def test_store_request_basic(db_path):
    entry = AuditEntry(event="refund.created", actor="user@test.com", timestamp=1700000000.0)
    store_request(entry, db_path)

    conn = sqlite3.connect(str(db_path))
    rows = conn.execute("SELECT * FROM audit").fetchall()
    conn.close()
    assert len(rows) == 1
    assert rows[0][0] == "refund.created"


def test_store_request_with_payload(db_path):
    entry = AuditEntry(
        event="payment.charged",
        actor="billing@system",
        timestamp=1700000001.0,
        payload={"amount": 99.99, "plan": "premium"},
    )
    store_request(entry, db_path)

    conn = sqlite3.connect(str(db_path))
    rows = conn.execute("SELECT payload FROM audit").fetchall()
    conn.close()
    assert "99.99" in rows[0][0]


def test_validate_event_empty():
    with pytest.raises(ValueError, match="event must not be empty"):
        AuditEntry(event="  ", actor="test", timestamp=0.0)


def test_validate_event_strips_whitespace():
    entry = AuditEntry(event="  refund.created  ", actor="test", timestamp=0.0)
    assert entry.event == "refund.created"


def test_store_multiple_entries(db_path):
    for i in range(5):
        entry = AuditEntry(event=f"event_{i}", actor="batch", timestamp=float(i))
        store_request(entry, db_path)

    conn = sqlite3.connect(str(db_path))
    count = conn.execute("SELECT COUNT(*) FROM audit").fetchone()[0]
    conn.close()
    assert count == 5
