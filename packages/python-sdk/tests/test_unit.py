"""The client without a server: URL building, error mapping, the cache, cursor iteration."""

from __future__ import annotations

import json
from collections.abc import Callable
from typing import Any

import httpx
import pytest

from vocab_bloom_hub import (
    USER_AGENT,
    AsyncVocabBloomClient,
    MemoryCache,
    NetworkError,
    NotFoundError,
    PartOfSpeech,
    RateLimitError,
    VocabBloomClient,
    VocabBloomError,
)


def transport(handler: Callable[[httpx.Request], httpx.Response]) -> httpx.MockTransport:
    return httpx.MockTransport(handler)


def json_response(body: object, status: int = 200, headers: dict[str, str] | None = None) -> httpx.Response:
    return httpx.Response(status, json=body, headers=headers)


PAGE_EMPTY = {"data": [], "meta": {"limit": 20, "has_more": False, "next_cursor": None}}


def test_url_under_api_v1_and_repeated_list_filters() -> None:
    seen: list[httpx.Request] = []

    def handle(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return json_response(PAGE_EMPTY)

    client = VocabBloomClient("https://dict.example.com/", transport=transport(handle))
    client.words(
        part_of_speech=["noun", PartOfSpeech.verb],
        with_meanings=True,
        limit=5,
        cursor=None,
        search="ru",
        is_obsolete=False,
    )
    url = seen[0].url
    assert f"{url.scheme}://{url.host}{url.path}" == "https://dict.example.com/api/v1/words"
    assert url.params.get_list("part_of_speech") == ["noun", "verb"]
    assert url.params["with_meanings"] == "true"
    assert url.params["limit"] == "5"
    assert "cursor" not in url.params
    # the prefix and obsolete filters of issue #403
    assert url.params["search"] == "ru"
    assert url.params["is_obsolete"] == "false"
    assert seen[0].headers["accept"] == "application/json"


def test_headword_encoding_and_search_as_get() -> None:
    seen: list[httpx.Request] = []

    def handle(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        if request.url.path.endswith("/search"):
            return json_response({"data": [], "meta": {"count": 0, "fuzzy": False, "short_term": False}})
        if request.url.path.endswith("/search/detailed"):
            return json_response(
                {
                    "data": [],
                    "meta": {"page": 1, "limit": 10, "has_more": False, "fuzzy": False, "short_term": False},
                }
            )
        return json_response({"data": [], "meta": {"word": "put up with", "count": 0}})

    client = VocabBloomClient("http://localhost:3010", headers={"X-App": "test"}, transport=transport(handle))
    client.word("put up with")
    assert str(seen[0].url) == "http://localhost:3010/api/v1/words/put%20up%20with"
    # the searches go as GET with the fields in the query string (issue #396)
    client.search("run", limit=3, type=None)
    assert seen[1].method == "GET"
    assert str(seen[1].url) == "http://localhost:3010/api/v1/search?search=run&limit=3"
    assert seen[1].headers["x-app"] == "test"
    client.search_detailed("run", with_meanings=True, translation_languages=["ru"])
    assert seen[2].method == "GET"
    assert dict(seen[2].url.params.multi_items()) == {
        "search": "run",
        "with_meanings": "true",
        "translation_languages": "ru",
    }


def test_words_batch_posts_the_spellings() -> None:
    seen: list[httpx.Request] = []

    def handle(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return json_response({"data": [], "meta": {"count": 0, "not_found": ["run", "ran"]}})

    client = VocabBloomClient("http://localhost:3010", transport=transport(handle))
    batch = client.words_batch(("run", "ran"))
    assert str(seen[0].url) == "http://localhost:3010/api/v1/words/batch"
    assert seen[0].method == "POST"
    assert json.loads(seen[0].content) == {"words": ["run", "ran"]}
    assert batch.meta.not_found == ["run", "ran"]


def test_typed_errors() -> None:
    answers = iter(
        [
            json_response({"statusCode": 404, "message": "word_doesnt_found", "error": True}, 404),
            json_response(
                {"statusCode": 429, "message": "too_many_requests", "error": True}, 429, {"retry-after": "42"}
            ),
            json_response({"statusCode": 400, "message": "invalid_cursor", "error": True}, 400),
            httpx.Response(502, text="<html>bad gateway</html>"),
        ]
    )
    client = VocabBloomClient("http://localhost", transport=transport(lambda request: next(answers)))

    with pytest.raises(NotFoundError) as not_found:
        client.word("nope")
    assert (not_found.value.status, not_found.value.code) == (404, "word_doesnt_found")

    with pytest.raises(RateLimitError) as limited:
        client.meta()
    assert (limited.value.code, limited.value.retry_after) == ("too_many_requests", 42.0)

    with pytest.raises(VocabBloomError) as bad:
        client.words(cursor="x")
    assert (bad.value.status, bad.value.code, bad.value.body["message"]) == (
        400,
        "invalid_cursor",
        "invalid_cursor",
    )

    with pytest.raises(VocabBloomError) as proxy:
        client.meta()
    assert (proxy.value.status, proxy.value.code, proxy.value.body) == (502, "http_error", None)


def test_network_error_wraps_transport_failures() -> None:
    def handle(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused")

    client = VocabBloomClient("http://localhost", transport=transport(handle))
    with pytest.raises(NetworkError) as error:
        client.meta()
    assert error.value.status == 0
    assert isinstance(error.value.__cause__, httpx.ConnectError)


def test_etag_cache_revalidates_and_answers_304_from_it() -> None:
    body = {
        "data": {
            "api_version": "1",
            "app_version": "0",
            "dataset_version": None,
            "license": "CC-BY-4.0",
            "license_url": "u",
            "attribution": "a",
            "counts": {
                k: 0
                for k in [
                    "entries",
                    "words",
                    "phrases",
                    "grammar_patterns",
                    "word_forms",
                    "meanings",
                    "meaning_translations",
                    "short_translations",
                ]
            },
            "available_languages": {"source": ["en"], "translations": ["ru"]},
        }
    }
    seen: list[httpx.Request] = []

    def handle(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        if len(seen) == 1:
            return json_response(body, headers={"etag": 'W/"abc"'})
        if len(seen) == 2:
            assert request.headers["if-none-match"] == 'W/"abc"'
            return httpx.Response(304)
        return json_response(
            {**body, "data": {**body["data"], "api_version": "2"}}, headers={"etag": 'W/"def"'}
        )

    cache = MemoryCache(10)
    client = VocabBloomClient("http://localhost", cache=cache, transport=transport(handle))
    assert client.meta().data.api_version == "1"
    assert client.meta().data.api_version == "1"
    assert len(cache) == 1
    assert client.meta().data.api_version == "2"
    assert cache.get(str(seen[2].url)) is not None
    assert cache.get(str(seen[2].url)).etag == 'W/"def"'  # type: ignore[union-attr]


# The public projection of an entry (issue #392): every field the contract
# lists, with the grammar left null the way an unannotated row answers
def fake_word(i: int) -> dict[str, Any]:
    return {
        "id": i,
        "word": f"w{i}",
        "part_of_speech": "noun",
        "form_of_word": "base_form",
        "is_obsolete": False,
        "is_abbreviation": False,
        "word_level": None,
        "area_variant": None,
        "categories": [],
        "language_register": None,
        "description": None,
        "transcription": None,
        "pattern": None,
        "noun___irregular_plural": None,
        "noun___uncountable": None,
        "noun___is_proper": None,
        "noun___always_plural": None,
        "verb___is_irregular": None,
        "verb___transitivity": None,
        "verb___is_phrasal": None,
        "verb___phrasal_object_pattern": None,
        "base_phrasal": None,
        "forms": [],
        "meanings": [],
        "short_translations": [],
    }


def test_iter_words_walks_every_page() -> None:
    seen: list[str | None] = []

    def page(ids: list[int], next_cursor: str | None) -> httpx.Response:
        data = [fake_word(i) for i in ids]
        return json_response(
            {
                "data": data,
                "meta": {"limit": 2, "has_more": next_cursor is not None, "next_cursor": next_cursor},
            }
        )

    pages = iter([page([1, 2], "c1"), page([3, 4], "c2"), page([5], None)])

    def handle(request: httpx.Request) -> httpx.Response:
        seen.append(request.url.params.get("cursor"))
        assert request.url.params["word_level"] == "A1"
        return next(pages)

    client = VocabBloomClient("http://localhost", transport=transport(handle))
    assert [w.id for w in client.iter_words(limit=2, word_level=["A1"])] == [1, 2, 3, 4, 5]
    assert seen == [None, "c1", "c2"]


def test_memory_cache_evicts_least_recently_used() -> None:
    from vocab_bloom_hub import CacheEntry

    cache = MemoryCache(2)
    cache.set("a", CacheEntry("1", 1))
    cache.set("b", CacheEntry("2", 2))
    cache.get("a")
    cache.set("c", CacheEntry("3", 3))
    assert cache.get("b") is None
    assert cache.get("a") is not None
    assert len(cache) == 2


def test_version_is_the_installed_distribution_version() -> None:
    """``__version__`` comes from the package metadata (issue #401): the version of
    pyproject.toml in PyPI's normalized form, so it cannot drift from a release."""
    import importlib.metadata
    import re
    from pathlib import Path

    import vocab_bloom_hub

    assert vocab_bloom_hub.__version__ == importlib.metadata.version("vocab-bloom-hub")
    pyproject = (Path(__file__).parents[1] / "pyproject.toml").read_text()
    match = re.search(r'^version = "([^"]+)"$', pyproject, re.M)
    assert match is not None
    # 1.2.3-alpha.4 → 1.2.3a4, -beta.4 → b4, -rc.4 → rc4 (PEP 440)
    normalized = re.sub(
        r"-(alpha|beta|rc)\.(\d+)$",
        lambda m: {"alpha": "a", "beta": "b", "rc": "rc"}[m[1]] + m[2],
        match[1],
    )
    assert vocab_bloom_hub.__version__ == normalized


def test_user_agent_is_versioned_and_overridable() -> None:
    import vocab_bloom_hub

    assert f"vocab-bloom-hub-python/{vocab_bloom_hub.__version__}" == USER_AGENT
    seen: list[httpx.Request] = []

    def handle(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return json_response(PAGE_EMPTY)

    VocabBloomClient("http://localhost", transport=transport(handle)).words()
    assert seen[0].headers["user-agent"] == USER_AGENT
    VocabBloomClient(
        "http://localhost", headers={"User-Agent": "my-app/1"}, transport=transport(handle)
    ).words()
    assert seen[1].headers["user-agent"] == "my-app/1"


def test_per_request_options_merge_headers_and_set_the_timeout() -> None:
    seen: list[httpx.Request] = []

    def handle(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        if request.method == "POST":
            return json_response({"data": [], "meta": {"count": 0, "not_found": ["run"]}})
        return json_response(PAGE_EMPTY)

    client = VocabBloomClient("http://localhost", headers={"X-App": "app"}, transport=transport(handle))
    client.words(options={"headers": {"X-Request": "1"}, "timeout": 2.5}, search="ru")
    assert seen[0].headers["x-app"] == "app"
    assert seen[0].headers["x-request"] == "1"
    assert seen[0].url.params["search"] == "ru"
    assert seen[0].extensions["timeout"]["read"] == 2.5
    client.words_batch(["run"], options={"headers": {"X-Request": "2"}})
    assert seen[1].headers["x-request"] == "2"


LIMITED = {"statusCode": 429, "message": "too_many_requests", "error": True}
FAILING = {"statusCode": 503, "message": "unavailable", "error": True}


def test_retry_is_off_by_default() -> None:
    calls = 0

    def handle(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return json_response(LIMITED, status=429, headers={"retry-after": "0"})

    with pytest.raises(RateLimitError):
        VocabBloomClient("http://localhost", transport=transport(handle)).meta()
    assert calls == 1


def test_retry_honours_retry_after_then_backs_off_until_an_answer(monkeypatch: pytest.MonkeyPatch) -> None:
    import time

    slept: list[float] = []
    monkeypatch.setattr(time, "sleep", slept.append)
    answers = [
        json_response(LIMITED, status=429, headers={"retry-after": "2"}),
        json_response(FAILING, status=503),
        json_response({"data": {"ok": True}}),
    ]
    calls = 0

    def handle(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return answers[calls - 1]

    client = VocabBloomClient("http://localhost", retry={"backoff": 0.25}, transport=transport(handle))
    prepared = client._core.prepare_get("/meta", None)
    response = client._send_get(prepared, None)
    assert response.json() == {"data": {"ok": True}}
    assert calls == 3
    # Retry-After of the 429, then the backoff of the second try (0.25 doubled)
    assert slept == [2.0, 0.5]


def test_retry_gives_up_after_attempts_and_never_touches_a_post(monkeypatch: pytest.MonkeyPatch) -> None:
    import time

    monkeypatch.setattr(time, "sleep", lambda _: None)
    calls = 0

    def handle(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return json_response(FAILING, status=503)

    client = VocabBloomClient("http://localhost", retry={"attempts": 2}, transport=transport(handle))
    with pytest.raises(VocabBloomError) as failed:
        client.meta()
    assert failed.value.status == 503
    assert calls == 2
    calls = 0
    with pytest.raises(VocabBloomError):
        client.words_batch(["run"])
    assert calls == 1


def test_iter_search_detailed_walks_every_page() -> None:
    seen: list[str | None] = []

    def page(ids: list[int], has_more: bool, number: int) -> httpx.Response:
        return json_response(
            {
                "data": [fake_word(i) for i in ids],
                "meta": {
                    "page": number,
                    "limit": 2,
                    "has_more": has_more,
                    "fuzzy": False,
                    "short_term": False,
                },
            }
        )

    def handle(request: httpx.Request) -> httpx.Response:
        seen.append(request.url.params.get("page"))
        return page([1, 2], True, 1) if len(seen) == 1 else page([3], False, 2)

    client = VocabBloomClient("http://localhost", transport=transport(handle))
    assert [w.id for w in client.iter_search_detailed("w", limit=2)] == [1, 2, 3]
    assert seen == ["1", "2"]


async def test_async_client_retries_iterates_pages_and_builds_a_dataframe(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import asyncio

    slept: list[float] = []

    async def fake_sleep(seconds: float) -> None:
        slept.append(seconds)

    monkeypatch.setattr(asyncio, "sleep", fake_sleep)
    calls = 0

    def handle(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        if request.url.path.endswith("/meta") and calls == 1:
            return json_response(LIMITED, status=429, headers={"retry-after": "1"})
        if request.url.path.endswith("/search/detailed"):
            number = int(request.url.params["page"])
            return json_response(
                {
                    "data": [fake_word(number)],
                    "meta": {
                        "page": number,
                        "limit": 1,
                        "has_more": number < 2,
                        "fuzzy": False,
                        "short_term": False,
                    },
                }
            )
        if request.url.path.endswith("/words"):
            return json_response(
                {"data": [fake_word(7)], "meta": {"limit": 20, "has_more": False, "next_cursor": None}}
            )
        return json_response({"data": {"ok": True}})

    async with AsyncVocabBloomClient(
        "http://localhost", retry={}, transport=httpx.MockTransport(handle)
    ) as client:
        prepared = client._core.prepare_get("/meta", None)
        assert (await client._send_get(prepared, None)).json() == {"data": {"ok": True}}
        assert slept == [1.0]
        assert [w.id async for w in client.iter_search_detailed("w", limit=1)] == [1, 2]
        frame = await client.words_dataframe(search="w", options={"headers": {"X-Request": "df"}})
        assert list(frame["word"]) == ["w7"]
