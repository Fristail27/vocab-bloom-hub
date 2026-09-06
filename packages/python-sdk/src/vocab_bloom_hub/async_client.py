"""The asynchronous client (``httpx.AsyncClient``)."""

from __future__ import annotations

from collections.abc import AsyncIterator, Iterable, Mapping, Sequence
from enum import Enum
from typing import Any

import httpx
from typing_extensions import Unpack

from . import models as m
from ._core import Core, ListOptions, ModelT, WordFilters, build_json, headword_path, network_error
from .cache import ResponseCache


class AsyncVocabBloomClient:
    """The asynchronous twin of :class:`~vocab_bloom_hub.VocabBloomClient`: the same methods, awaited.

    Use it as an async context manager (``async with``) to close the connection pool.
    """

    def __init__(
        self,
        base_url: str,
        *,
        headers: Mapping[str, str] | None = None,
        timeout: float | httpx.Timeout = 10.0,
        cache: bool | ResponseCache = False,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._core = Core(base_url, headers, cache)
        self._http = httpx.AsyncClient(timeout=timeout, transport=transport)

    async def aclose(self) -> None:
        await self._http.aclose()

    async def __aenter__(self) -> AsyncVocabBloomClient:
        return self

    async def __aexit__(self, *exc: object) -> None:
        await self.aclose()

    async def search(
        self, search: str, *, type: str | Enum | None = None, limit: int | None = None
    ) -> m.SearchResponse:
        return await self._get("/search", {"search": search, "type": type, "limit": limit}, m.SearchResponse)

    async def search_detailed(
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
        params = {
            "search": search,
            "type": type,
            "limit": limit,
            "page": page,
            "with_meanings": with_meanings,
            "with_translations": with_translations,
            "translation_languages": translation_languages,
        }
        return await self._get("/search/detailed", params, m.DetailedSearchResponse)

    async def word(self, headword: str) -> m.HeadwordResponse:
        return await self._get(headword_path(headword), None, m.HeadwordResponse)

    async def words_batch(self, words: Sequence[str]) -> m.WordsBatchResponse:
        return await self._post("/words/batch", {"words": list(words)}, m.WordsBatchResponse)

    async def word_by_id(self, id: int) -> m.WordResponse:
        return await self._get(f"/words/id/{id}", None, m.WordResponse)

    async def meanings(self, headword: str) -> m.MeaningsResponse:
        return await self._get(headword_path(headword, "/meanings"), None, m.MeaningsResponse)

    async def translations(
        self, headword: str, *, language: Iterable[str | Enum] | None = None
    ) -> m.TranslationsResponse:
        return await self._get(
            headword_path(headword, "/translations"), {"language": language}, m.TranslationsResponse
        )

    async def forms(self, headword: str) -> m.FormsResponse:
        return await self._get(headword_path(headword, "/forms"), None, m.FormsResponse)

    async def synonyms(self, headword: str) -> m.LinksResponse:
        return await self._get(headword_path(headword, "/synonyms"), None, m.LinksResponse)

    async def antonyms(self, headword: str) -> m.LinksResponse:
        return await self._get(headword_path(headword, "/antonyms"), None, m.LinksResponse)

    async def words(self, **options: Unpack[ListOptions]) -> m.WordsResponse:
        return await self._get("/words", options, m.WordsResponse)

    async def iter_words(self, **options: Unpack[ListOptions]) -> AsyncIterator[m.Word]:
        query: dict[str, Any] = {k: v for k, v in options.items() if k != "cursor"}
        cursor: str | None = None
        while True:
            page = await self.words(**query, cursor=cursor)
            for word in page.data:
                yield word
            cursor = page.meta.next_cursor
            if cursor is None:
                return

    async def random(self, **filters: Unpack[WordFilters]) -> m.WordResponse:
        return await self._get("/random", filters, m.WordResponse)

    async def meta(self) -> m.MetaResponse:
        return await self._get("/meta", None, m.MetaResponse)

    async def openapi(self) -> dict[str, Any]:
        prepared = self._core.prepare_get("/openapi.json", None)
        response = await self._send("GET", prepared.url, headers=prepared.headers)
        document: dict[str, Any] = self._core.finish_get_raw(prepared, response)
        return document

    async def suggest(
        self,
        headword: str,
        *,
        message: str | None = None,
        word_id: int | None = None,
        kind: str | Enum | None = None,
        edits: Iterable[Mapping[str, Any]] | None = None,
    ) -> m.SuggestionCreatedResponse:
        """Files reader feedback into the instance's moderation queue (issue #327)."""
        body = {
            "headword": headword,
            "message": message,
            "word_id": word_id,
            "kind": kind,
            "edits": [dict(edit) for edit in edits] if edits is not None else None,
        }
        return await self._post("/suggestions", body, m.SuggestionCreatedResponse)

    async def _get(self, path: str, params: Mapping[str, Any] | None, model: type[ModelT]) -> ModelT:
        prepared = self._core.prepare_get(path, params)
        response = await self._send("GET", prepared.url, headers=prepared.headers)
        return self._core.finish_get(prepared, response, model)

    async def _post(self, path: str, body: Mapping[str, Any], model: type[ModelT]) -> ModelT:
        url = self._core.base_url + path
        response = await self._send("POST", url, headers=self._core.headers, json=build_json(body))
        return self._core.finish_post(response, model)

    async def _send(self, method: str, url: str, **kwargs: Any) -> httpx.Response:
        try:
            return await self._http.request(method, url, **kwargs)
        except httpx.HTTPError as error:
            raise network_error(url, error) from error
