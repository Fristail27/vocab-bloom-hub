"""Conditional requests for GET answers.

The public API sends an ``ETag`` with every successful GET and answers
``304 Not Modified`` to a matching ``If-None-Match``. The cache keeps the
last body per URL and hands it back on a 304, so a repeated read costs a
round trip without a payload. In memory, per client instance, bounded by
``max_entries`` (least recently used out).
"""

from __future__ import annotations

from collections import OrderedDict
from dataclasses import dataclass
from typing import Any, Protocol


@dataclass(frozen=True)
class CacheEntry:
    etag: str
    body: Any


class ResponseCache(Protocol):
    def get(self, url: str) -> CacheEntry | None: ...

    def set(self, url: str, entry: CacheEntry) -> None: ...


class MemoryCache:
    def __init__(self, max_entries: int = 500) -> None:
        self._entries: OrderedDict[str, CacheEntry] = OrderedDict()
        self._max_entries = max_entries

    def get(self, url: str) -> CacheEntry | None:
        entry = self._entries.get(url)
        if entry is not None:
            self._entries.move_to_end(url)
        return entry

    def set(self, url: str, entry: CacheEntry) -> None:
        self._entries[url] = entry
        self._entries.move_to_end(url)
        while len(self._entries) > self._max_entries:
            self._entries.popitem(last=False)

    def __len__(self) -> int:
        return len(self._entries)
