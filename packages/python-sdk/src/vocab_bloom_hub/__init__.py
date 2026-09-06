"""Typed Python client for the Vocab Bloom Hub public dictionary API (``/api/v1``)."""

from importlib import metadata as _metadata

from ._core import PUBLIC_API_PREFIX, ListOptions, WordFilters
from .async_client import AsyncVocabBloomClient
from .cache import CacheEntry, MemoryCache, ResponseCache
from .client import VocabBloomClient
from .errors import NetworkError, NotFoundError, RateLimitError, VocabBloomError
from .models import *  # noqa: F403 - the readable names of the contract
from .models import __all__ as _models_all

# The installed distribution's version (issue #401): pyproject.toml is the
# single source, bumped by scripts/bump-version.mjs; PyPI's normalized form
# ("0.1.0a3" for "0.1.0-alpha.3"). A source checkout that is not installed
# has no metadata and answers "0.0.0"
try:
    __version__ = _metadata.version("vocab-bloom-hub")
except _metadata.PackageNotFoundError:  # pragma: no cover - not installed
    __version__ = "0.0.0"

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
