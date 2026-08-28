"""Typed Python client for the Vocab Bloom Hub public dictionary API (``/api/v1``)."""

from ._core import PUBLIC_API_PREFIX, ListOptions, WordFilters
from .async_client import AsyncVocabBloomClient
from .cache import CacheEntry, MemoryCache, ResponseCache
from .client import VocabBloomClient
from .errors import NetworkError, NotFoundError, RateLimitError, VocabBloomError
from .models import *  # noqa: F403 - the readable names of the contract
from .models import __all__ as _models_all

__version__ = "0.0.1"

__all__ = [
    "PUBLIC_API_PREFIX",
    "AsyncVocabBloomClient",
    "CacheEntry",
    "ListOptions",
    "MemoryCache",
    "NetworkError",
    "NotFoundError",
    "RateLimitError",
    "ResponseCache",
    "VocabBloomClient",
    "VocabBloomError",
    "WordFilters",
    *_models_all,
]
