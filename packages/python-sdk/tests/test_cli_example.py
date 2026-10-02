from __future__ import annotations

import importlib.util
from collections.abc import Callable
from pathlib import Path
from types import ModuleType

import httpx
import pytest

from vocab_bloom_hub import VocabBloomClient

EXAMPLE_PATH = Path(__file__).parents[1] / "examples" / "lookup_word.py"
SPEC = importlib.util.spec_from_file_location("lookup_word_example", EXAMPLE_PATH)
assert SPEC is not None and SPEC.loader is not None
EXAMPLE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(EXAMPLE)
assert isinstance(EXAMPLE, ModuleType)


def meta_payload() -> dict[str, object]:
    return {
        "api_version": "1",
        "app_version": "1.0",
        "dataset_version": None,
        "license": "CC-BY-4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0/",
        "attribution": "Example Dictionary",
        "notice": "Example dataset notice.",
        "attribution_url": "https://example.test/credits",
        "license_text": "Please credit Example Dictionary.",
        "counts": {
            "entries": 1,
            "words": 1,
            "phrases": 0,
            "grammar_patterns": 0,
            "word_forms": 0,
            "meanings": 1,
            "meaning_translations": 0,
            "short_translations": 0,
        },
        "available_languages": {"source": ["en"], "translations": []},
    }


def word_payload(
    word_id: int,
    word: str,
    *,
    meanings: list[dict[str, object]] | None = None,
    modified: bool = False,
) -> dict[str, object]:
    return {
        "id": word_id,
        "word": word,
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
        "meanings": meanings or [],
        "short_translations": [],
        "modified": modified,
    }


def meaning_payload(definition: str) -> dict[str, object]:
    return {
        "id": 1,
        "sort_order": 1,
        "title": definition,
        "definition": definition,
        "is_obsolete": False,
        "examples": [],
        "categories": [],
        "meaning_level": None,
        "area_variant": "common",
        "language_register": None,
        "translations": [],
        "synonyms": [],
        "antonyms": [],
    }


def make_client_factory(
    handler: Callable[[httpx.Request], httpx.Response],
) -> Callable[[str], VocabBloomClient]:
    return lambda base_url: VocabBloomClient(base_url, transport=httpx.MockTransport(handler))


def test_lookup_prints_definitions_empty_meanings_and_attribution(capsys: pytest.CaptureFixture[str]) -> None:
    def handle(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/meta"):
            return httpx.Response(200, json={"data": meta_payload()})
        assert request.url.path.endswith("/words/run")
        return httpx.Response(
            200,
            json={
                "data": [
                    word_payload(1, "run", meanings=[meaning_payload("move quickly")], modified=True),
                    word_payload(2, "run"),
                ],
                "meta": {"word": "run", "count": 2, "variants": []},
            },
        )

    result = EXAMPLE.main(
        ["--base-url", "https://dictionary.example.test", "run"],
        client_factory=make_client_factory(handle),
    )

    output = capsys.readouterr()
    assert result == 0
    assert "License: CC-BY-4.0" in output.out
    assert "Attribution: Example Dictionary" in output.out
    assert "https://example.test/credits" in output.out
    assert "Please credit Example Dictionary." in output.out
    assert "Notice: Example dataset notice." in output.out
    assert "run (noun)" in output.out
    assert "move quickly" in output.out
    assert "modified on this instance" in output.out
    assert "No meanings available." in output.out
    assert "Traceback" not in output.err


def test_lookup_reports_not_found_without_traceback(capsys: pytest.CaptureFixture[str]) -> None:
    def handle(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/meta"):
            return httpx.Response(200, json={"data": meta_payload()})
        return httpx.Response(404, json={"message": "word_doesnt_found"})

    result = EXAMPLE.main(
        ["--base-url", "https://dictionary.example.test", "missing"],
        client_factory=make_client_factory(handle),
    )

    output = capsys.readouterr()
    assert result == 1
    assert "word not found: missing" in output.err
    assert "Traceback" not in output.err


def test_lookup_reports_network_failure_without_traceback(capsys: pytest.CaptureFixture[str]) -> None:
    def handle(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused", request=request)

    result = EXAMPLE.main(
        ["--base-url", "https://dictionary.example.test", "run"],
        client_factory=make_client_factory(handle),
    )

    output = capsys.readouterr()
    assert result == 2
    assert "could not reach the dictionary instance" in output.err
    assert "Traceback" not in output.err


def test_lookup_reports_other_sdk_error_without_traceback(capsys: pytest.CaptureFixture[str]) -> None:
    def handle(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/meta"):
            return httpx.Response(200, json={"data": meta_payload()})
        return httpx.Response(503, json={"message": "service_unavailable"})

    result = EXAMPLE.main(
        ["--base-url", "https://dictionary.example.test", "run"],
        client_factory=make_client_factory(handle),
    )

    output = capsys.readouterr()
    assert result == 2
    assert "dictionary request failed (service_unavailable)" in output.err
    assert "Traceback" not in output.err


def test_lookup_handles_empty_response_data(capsys: pytest.CaptureFixture[str]) -> None:
    def handle(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/meta"):
            return httpx.Response(200, json={"data": meta_payload()})
        return httpx.Response(200, json={"data": [], "meta": {"word": "missing", "count": 0, "variants": []}})

    result = EXAMPLE.main(
        ["--base-url", "https://dictionary.example.test", "missing"],
        client_factory=make_client_factory(handle),
    )

    output = capsys.readouterr()
    assert result == 1
    assert "word not found: missing" in output.err
    assert "Traceback" not in output.err
