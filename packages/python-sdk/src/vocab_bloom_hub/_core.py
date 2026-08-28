"""Request building and response parsing shared by the sync and the async client."""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from enum import Enum
from typing import Any, TypeVar
from urllib.parse import quote

import httpx
from pydantic import BaseModel
from typing_extensions import TypedDict

from .cache import CacheEntry, MemoryCache, ResponseCache
from .errors import NetworkError, error_from_response

PUBLIC_API_PREFIX = "/api/v1"

ModelT = TypeVar("ModelT", bound=BaseModel)

Scalar = str | int | float | bool | Enum
ParamValue = Scalar | Iterable[Scalar] | None


class WordFilters(TypedDict, total=False):
    """The filters of the list and the random draw; values of one filter are OR-ed, filters are AND-ed."""

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


class Core:
    """The stateless part of a client: URL, headers, cache, parsing."""

    def __init__(self, base_url: str, headers: Mapping[str, str] | None, cache: bool | ResponseCache) -> None:
        self.base_url = trim_base_url(base_url)
        self.headers = {"Accept": "application/json", **(headers or {})}
        # explicit `is` checks: an empty MemoryCache is falsy (it has __len__)
        if cache is True:
            self.cache: ResponseCache | None = MemoryCache()
        elif cache is False:
            self.cache = None
        else:
            self.cache = cache

    def prepare_get(self, path: str, params: Mapping[str, Any] | None) -> PreparedGet:
        url = str(httpx.URL(self.base_url + path, params=build_params(params or {})))
        cached = self.cache.get(url) if self.cache else None
        headers = dict(self.headers)
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
