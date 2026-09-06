"""Request building and response parsing shared by the sync and the async client."""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from enum import Enum
from typing import Any, TypeVar
from urllib.parse import quote

import httpx
from pydantic import BaseModel
from typing_extensions import TypedDict

from ._version import USER_AGENT
from .cache import CacheEntry, MemoryCache, ResponseCache
from .errors import NetworkError, error_from_response

PUBLIC_API_PREFIX = "/api/v1"

ModelT = TypeVar("ModelT", bound=BaseModel)

Scalar = str | int | float | bool | Enum
ParamValue = Scalar | Iterable[Scalar] | None


class WordFilters(TypedDict, total=False):
    """The filters of the list and the random draw; values of one filter are OR-ed, filters are AND-ed.

    ``search`` is a case-insensitive headword prefix, ``is_obsolete`` keeps obsolete or current entries only.
    """

    search: str | None
    is_obsolete: bool | None
    part_of_speech: Iterable[str | Enum]
    word_level: Iterable[str | Enum]
    language_register: Iterable[str | Enum]
    category: Iterable[str | Enum]
    area_variant: Iterable[str | Enum]
    form_of_word: Iterable[str | Enum]


class ListOptions(WordFilters, total=False):
    cursor: str | None
    limit: int | None
    with_meanings: bool | None
    with_translations: bool | None


class RequestOptions(TypedDict, total=False):
    """Per-call overrides (issue #408), the ``options=`` keyword of every method: ``headers`` are merged
    over the client's, ``timeout`` replaces the client's for this request."""

    headers: Mapping[str, str] | None
    timeout: float | httpx.Timeout | None


class RetryOptions(TypedDict, total=False):
    """Opt-in retry of the GET reads (issue #408): a ``429`` or a ``5xx`` answer is tried again after
    ``Retry-After`` when the server sent it, otherwise after ``backoff``, twice and four times ``backoff``, …
    seconds; ``attempts`` counts every try, the first included. POST requests, ``4xx`` answers and
    network errors are never retried."""

    attempts: int
    backoff: float


DEFAULT_RETRY: RetryOptions = {"attempts": 3, "backoff": 0.5}


def _scalar(value: Scalar) -> str:
    if isinstance(value, Enum):
        return str(value.value)
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def build_params(values: Mapping[str, ParamValue]) -> dict[str, str | list[str]]:
    """Query parameters: ``None`` dropped, enums by value, lists as repeated keys."""
    params: dict[str, str | list[str]] = {}
    for key, value in values.items():
        if value is None:
            continue
        if isinstance(value, str | int | float | bool | Enum):
            params[key] = _scalar(value)
        else:
            params[key] = [_scalar(item) for item in value]
    return params


def build_json(values: Mapping[str, Any]) -> dict[str, Any]:
    """A JSON body: ``None`` dropped, enums by value, iterables as lists."""
    body: dict[str, Any] = {}
    for key, value in values.items():
        if value is None:
            continue
        if isinstance(value, Enum):
            body[key] = value.value
        elif isinstance(value, str | bytes):
            body[key] = value
        elif isinstance(value, Iterable):
            body[key] = [item.value if isinstance(item, Enum) else item for item in value]
        else:
            body[key] = value
    return body


def trim_base_url(base_url: str) -> str:
    return base_url.rstrip("/") + PUBLIC_API_PREFIX


def headword_path(headword: str, suffix: str = "") -> str:
    return "/words/" + quote(headword, safe="") + suffix


@dataclass
class PreparedGet:
    url: str
    headers: dict[str, str]
    cached: CacheEntry | None


def _retry_after_seconds(value: str | None) -> float | None:
    if value is None:
        return None
    try:
        return max(0.0, float(value))
    except ValueError:
        pass
    try:
        at = parsedate_to_datetime(value)
    except (TypeError, ValueError):
        return None
    return max(0.0, (at - datetime.now(timezone.utc)).total_seconds())


class Core:
    """The stateless part of a client: URL, headers, cache, parsing, the retry policy."""

    def __init__(
        self,
        base_url: str,
        headers: Mapping[str, str] | None,
        cache: bool | ResponseCache,
        retry: RetryOptions | None = None,
    ) -> None:
        self.base_url = trim_base_url(base_url)
        self.headers = {"Accept": "application/json", "User-Agent": USER_AGENT, **(headers or {})}
        # explicit `is` checks: an empty MemoryCache is falsy (it has __len__)
        if cache is True:
            self.cache: ResponseCache | None = MemoryCache()
        elif cache is False:
            self.cache = None
        else:
            self.cache = cache
        self.retry: RetryOptions | None = {**DEFAULT_RETRY, **retry} if retry is not None else None

    def request_headers(self, options: RequestOptions | None) -> dict[str, str]:
        return {**self.headers, **((options or {}).get("headers") or {})}

    def send_kwargs(self, options: RequestOptions | None) -> dict[str, Any]:
        """The httpx keyword arguments a per-request option adds (the timeout)."""
        timeout = (options or {}).get("timeout")
        return {"timeout": timeout} if timeout is not None else {}

    def retry_delay(self, response: httpx.Response, attempt: int) -> float | None:
        """Seconds to wait before trying a GET again, or ``None`` when the answer stands.

        ``attempt`` is the number of the try that just answered, the first being 1.
        """
        if self.retry is None:
            return None
        if response.status_code != 429 and response.status_code < 500:
            return None
        if attempt >= self.retry["attempts"]:
            return None
        server = _retry_after_seconds(response.headers.get("retry-after"))
        return server if server is not None else self.retry["backoff"] * 2 ** (attempt - 1)

    def prepare_get(
        self, path: str, params: Mapping[str, Any] | None, options: RequestOptions | None = None
    ) -> PreparedGet:
        url = str(httpx.URL(self.base_url + path, params=build_params(params or {})))
        cached = self.cache.get(url) if self.cache else None
        headers = self.request_headers(options)
        if cached is not None:
            headers["If-None-Match"] = cached.etag
        return PreparedGet(url=url, headers=headers, cached=cached)

    def finish_get(self, prepared: PreparedGet, response: httpx.Response, model: type[ModelT]) -> ModelT:
        if response.status_code == 304 and prepared.cached is not None:
            return model.model_validate(prepared.cached.body)
        if response.is_error:
            raise error_from_response(response)
        body = response.json()
        etag = response.headers.get("etag")
        if self.cache is not None and etag:
            self.cache.set(prepared.url, CacheEntry(etag=etag, body=body))
        return model.model_validate(body)

    def finish_get_raw(self, prepared: PreparedGet, response: httpx.Response) -> Any:
        if response.status_code == 304 and prepared.cached is not None:
            return prepared.cached.body
        if response.is_error:
            raise error_from_response(response)
        return response.json()

    def finish_post(self, response: httpx.Response, model: type[ModelT]) -> ModelT:
        if response.is_error:
            raise error_from_response(response)
        return model.model_validate(response.json())


def network_error(url: str, cause: httpx.HTTPError) -> NetworkError:
    return NetworkError(f"Request to {url} failed: {cause}", cause)
