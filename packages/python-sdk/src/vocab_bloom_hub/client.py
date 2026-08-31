"""The synchronous client."""

from __future__ import annotations

from collections.abc import Iterable, Iterator, Mapping
from enum import Enum
from typing import TYPE_CHECKING, Any

import httpx
from typing_extensions import Unpack

from . import models as m
from ._core import Core, ListOptions, ModelT, WordFilters, build_json, headword_path, network_error
from .cache import ResponseCache

if TYPE_CHECKING:
    import pandas


class VocabBloomClient:
    """Typed client of the public read-only API.

    Every method is one endpoint and returns the ``{ data, meta }`` envelope
    the API answers with, as a pydantic model; failures raise
    :class:`~vocab_bloom_hub.VocabBloomError` (or ``NotFoundError``,
    ``RateLimitError``, ``NetworkError``). No authentication: the public
    prefix has none. Use it as a context manager to close the connection pool.

    :param base_url: origin of the instance, e.g. ``https://dict.example.com``; ``/api/v1`` is appended
    :param headers: sent with every request
    :param timeout: seconds, per request
    :param cache: ``True`` for an in-memory ETag cache, or your own :class:`ResponseCache`; off by default
    :param transport: a custom ``httpx`` transport (tests, instrumentation)
    """

    def __init__(
        self,
        base_url: str,
        *,
        headers: Mapping[str, str] | None = None,
        timeout: float | httpx.Timeout = 10.0,
        cache: bool | ResponseCache = False,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self._core = Core(base_url, headers, cache)
        self._http = httpx.Client(timeout=timeout, transport=transport)

    # ---------------------------------------------------------- lifecycle

    def close(self) -> None:
        self._http.close()

    def __enter__(self) -> VocabBloomClient:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    # ------------------------------------------------------------- search

    def search(
        self, search: str, *, type: str | Enum | None = None, limit: int | None = None
    ) -> m.SearchResponse:
        """Flat search: relevance tiers, typo tolerance, no meanings joined."""
        return self._post("/search", {"search": search, "type": type, "limit": limit}, m.SearchResponse)

    def search_detailed(
        self,
        search: str,
        *,
        type: str | Enum | None = None,
        limit: int | None = None,
        page: int | None = None,
        with_meanings: bool | None = None,
        with_translations: bool | None = None,
        translation_languages: Iterable[str | Enum] | None = None,
    ) -> m.DetailedSearchResponse:
        """Paged search with meanings and translations on request."""
        body = {
            "search": search,
            "type": type,
            "limit": limit,
            "page": page,
            "with_meanings": with_meanings,
            "with_translations": with_translations,
            "translation_languages": translation_languages,
        }
        return self._post("/search/detailed", body, m.DetailedSearchResponse)

    # -------------------------------------------------------------- reads

    def word(self, headword: str) -> m.HeadwordResponse:
        """All entries of a headword: parts of speech, forms, meanings, translations, links."""
        return self._get(headword_path(headword), None, m.HeadwordResponse)

    def word_by_id(self, id: int) -> m.WordResponse:
        """One entry by its numeric id."""
        return self._get(f"/words/id/{id}", None, m.WordResponse)

    def meanings(self, headword: str) -> m.MeaningsResponse:
        """The meanings of every entry of a headword."""
        return self._get(headword_path(headword, "/meanings"), None, m.MeaningsResponse)

    def translations(
        self, headword: str, *, language: Iterable[str | Enum] | None = None
    ) -> m.TranslationsResponse:
        """Short and per-meaning translations of a headword, optionally limited to languages."""
        return self._get(
            headword_path(headword, "/translations"), {"language": language}, m.TranslationsResponse
        )

    def forms(self, headword: str) -> m.FormsResponse:
        """Inflected forms of every entry of a headword."""
        return self._get(headword_path(headword, "/forms"), None, m.FormsResponse)

    # --------------------------------------------------------------- list

    def words(self, **options: Unpack[ListOptions]) -> m.WordsResponse:
        """One page of the filtered list, ordered by (word, id).

        Pass ``meta.next_cursor`` back as ``cursor`` for the next page; it is ``None`` on the last one.
        """
        return self._get("/words", options, m.WordsResponse)

    def iter_words(self, **options: Unpack[ListOptions]) -> Iterator[m.Word]:
        """Every entry matching the filters, page after page, until the last one."""
        query: dict[str, Any] = {k: v for k, v in options.items() if k != "cursor"}
        cursor: str | None = None
        while True:
            page = self.words(**query, cursor=cursor)
            yield from page.data
            cursor = page.meta.next_cursor
            if cursor is None:
                return

    def random(self, **filters: Unpack[WordFilters]) -> m.WordResponse:
        """A random entry matching the filters."""
        return self._get("/random", filters, m.WordResponse)

    # --------------------------------------------------------------- meta

    def meta(self) -> m.MetaResponse:
        """Versions, data license and counts of the instance."""
        return self._get("/meta", None, m.MetaResponse)

    def openapi(self) -> dict[str, Any]:
        """The OpenAPI 3 document of the instance."""
        prepared = self._core.prepare_get("/openapi.json", None)
        response = self._send("GET", prepared.url, headers=prepared.headers)
        document: dict[str, Any] = self._core.finish_get_raw(prepared, response)
        return document

    # -------------------------------------------------------- suggestions

    def suggest(
        self,
        headword: str,
        *,
        message: str | None = None,
        word_id: int | None = None,
        kind: str | Enum | None = None,
        edits: Iterable[Mapping[str, Any]] | None = None,
    ) -> m.SuggestionCreatedResponse:
        """Files reader feedback into the instance's moderation queue (issue #327).

        A free-text report by default; ``kind="edit"`` with ``edits`` — a list
        of ``{"target_type", "target_id", "changes"}`` items covering every
        touched piece of the word form — proposes concrete values the admin
        can apply in one click. Strictly rate-limited per client.
        """
        body = {
            "headword": headword,
            "message": message,
            "word_id": word_id,
            "kind": kind,
            "edits": [dict(edit) for edit in edits] if edits is not None else None,
        }
        return self._post("/suggestions", body, m.SuggestionCreatedResponse)

    # ------------------------------------------------------------- pandas

    def words_dataframe(self, **options: Unpack[ListOptions]) -> pandas.DataFrame:
        """The whole filtered list as a DataFrame, one row per entry (needs the ``pandas`` extra).

        Nested collections (``meanings``, ``forms``, ``short_translations``) stay as lists in their cells.
        """
        try:
            import pandas
        except ImportError as error:  # pragma: no cover - depends on the environment
            raise ImportError(
                "words_dataframe needs pandas: pip install 'vocab-bloom-hub[pandas]'"
            ) from error
        rows = [word.model_dump(mode="json") for word in self.iter_words(**options)]
        return pandas.json_normalize(rows, max_level=0)

    # ----------------------------------------------------------- plumbing

    def _get(self, path: str, params: Mapping[str, Any] | None, model: type[ModelT]) -> ModelT:
        prepared = self._core.prepare_get(path, params)
        response = self._send("GET", prepared.url, headers=prepared.headers)
        return self._core.finish_get(prepared, response, model)

    def _post(self, path: str, body: Mapping[str, Any], model: type[ModelT]) -> ModelT:
        url = self._core.base_url + path
        response = self._send("POST", url, headers=self._core.headers, json=build_json(body))
        return self._core.finish_post(response, model)

    def _send(self, method: str, url: str, **kwargs: Any) -> httpx.Response:
        try:
            return self._http.request(method, url, **kwargs)
        except httpx.HTTPError as error:
            raise network_error(url, error) from error
