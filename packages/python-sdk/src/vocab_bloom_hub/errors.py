"""Exceptions of the client.

Every failed request raises one of these. ``code`` is the machine-readable
error of the API (``ErrorCodes`` on the server: ``word_doesnt_found``,
``invalid_cursor``, ``too_many_requests``, ...) or one of the client's own:
``http_error`` for a non-JSON answer (a proxy page, for instance) and
``network_error`` when the request never got an answer.
"""

from __future__ import annotations

from email.utils import parsedate_to_datetime
from typing import Any

import httpx


class VocabBloomError(Exception):
    """A failed request: HTTP ``status`` (0 when it never completed), API ``code``, parsed ``body``."""

    def __init__(self, message: str, *, status: int, code: str, body: Any = None) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.body = body


class NotFoundError(VocabBloomError):
    """404: no headword, id or random entry matches."""

    def __init__(self, message: str, *, code: str, body: Any = None) -> None:
        super().__init__(message, status=404, code=code, body=body)


class RateLimitError(VocabBloomError):
    """429: the rate limit of the public prefix; ``retry_after`` is seconds when the server said."""

    def __init__(self, message: str, *, code: str, body: Any = None, retry_after: float | None) -> None:
        super().__init__(message, status=429, code=code, body=body)
        self.retry_after = retry_after


class NetworkError(VocabBloomError):
    """The request never got an answer: DNS, connection, TLS, timeout."""

    def __init__(self, message: str, cause: BaseException | None = None) -> None:
        super().__init__(message, status=0, code="network_error")
        self.__cause__ = cause


def _retry_after(value: str | None) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except ValueError:
        pass
    try:
        at = parsedate_to_datetime(value)
    except (TypeError, ValueError):
        return None
    from datetime import datetime, timezone

    return max(0.0, (at - datetime.now(timezone.utc)).total_seconds())


def error_from_response(response: httpx.Response) -> VocabBloomError:
    """Turns a non-2xx response into the matching exception (reads the body)."""
    body: Any = None
    code = "http_error"
    try:
        body = response.json()
        message = body.get("message") if isinstance(body, dict) else None
        if isinstance(message, str):
            code = message
        elif isinstance(message, list) and message:
            code = str(message[0])
    except ValueError:
        body = None
    text = f"{response.status_code} {code} ({response.request.url})"
    if response.status_code == 404:
        return NotFoundError(text, code=code, body=body)
    if response.status_code == 429:
        return RateLimitError(
            text, code=code, body=body, retry_after=_retry_after(response.headers.get("retry-after"))
        )
    return VocabBloomError(text, status=response.status_code, code=code, body=body)
