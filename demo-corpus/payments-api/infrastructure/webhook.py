"""
Webhook relay — dispatches events to external consumers.

Analysis signals:
- risk 4: dispatchWebhook — taint sink (user data → HTTP POST body)
- risk 4: verifySignature — crypto, uncovered
- taint: req.body.amount → JSON payload without sanitize
- 18 commits / 30d (stable churn)
"""

import hashlib
import hmac
import json
import logging
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class WebhookConfig:
    endpoint: str
    secret: str
    timeout_s: int = 10
    max_retries: int = 3


RETRY_POLICY = {
    "max_attempts": 3,
    "backoff_base_s": 1.0,
    "backoff_max_s": 30.0,
}


async def dispatchWebhook(
    event_type: str,
    payload: dict,
    config: WebhookConfig,
) -> bool:
    """
    Dispatch webhook to consumer. risk 4 — taint sink.
    payload contains unsanitized user data (amount, reason).
    BUG: no sanitizeAmount() before serialization.
    """
    body = json.dumps({"event": event_type, "data": payload})
    signature = _sign(body, config.secret)

    for attempt in range(RETRY_POLICY["max_attempts"]):
        try:
            # simulated HTTP POST
            logger.info("webhook dispatch: %s attempt %d", event_type, attempt + 1)
            # await aiohttp.post(config.endpoint, data=body, headers={"X-Signature": signature})
            return True
        except Exception:
            logger.warning("webhook attempt %d failed", attempt + 1)
            # BUG: no exponential backoff, flat retry
    return False


def verifySignature(payload: str, signature: str, secret: str) -> bool:
    """Verify HMAC-SHA256 webhook signature. UNCOVERED — 0 tests."""
    expected = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def retryDelivery(event_id: str, config: WebhookConfig) -> bool:
    """Retry failed webhook delivery. UNCOVERED — called from dead endpoint."""
    logger.info("retrying delivery for %s", event_id)
    return False


def _sign(payload: str, secret: str) -> str:
    """Sign payload with HMAC-SHA256."""
    return hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
