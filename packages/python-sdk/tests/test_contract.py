"""Every operation of the public spec has a client method (sync and async)."""

from __future__ import annotations

import json
from pathlib import Path

from vocab_bloom_hub import AsyncVocabBloomClient, VocabBloomClient

SPEC = Path(__file__).resolve().parents[3] / "apps" / "server" / "openapi" / "public-v1.json"

METHOD_BY_OPERATION = {
    "PublicSearchController_search": "search",
    "PublicSearchController_searchDetailed": "search_detailed",
    "PublicWordsController_list": "words",
    "PublicWordsController_byId": "word_by_id",
    "PublicWordsController_byHeadword": "word",
    "PublicWordsController_meanings": "meanings",
    "PublicWordsController_translations": "translations",
    "PublicWordsController_forms": "forms",
    "PublicDictionaryController_random": "random",
    "PublicDictionaryController_meta": "meta",
    "PublicOpenApiController_openapi": "openapi",
}


def test_every_operation_has_a_method() -> None:
    spec = json.loads(SPEC.read_text())
    operations = sorted(op["operationId"] for item in spec["paths"].values() for op in item.values())
    assert operations == sorted(METHOD_BY_OPERATION)
    for method in METHOD_BY_OPERATION.values():
        assert callable(getattr(VocabBloomClient, method))
        assert callable(getattr(AsyncVocabBloomClient, method))
