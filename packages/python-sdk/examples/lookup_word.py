"""Look up a headword in a Vocab Bloom Hub instance."""

from __future__ import annotations

import argparse
import sys
from collections.abc import Callable, Sequence

from vocab_bloom_hub import (
    Meta,
    NetworkError,
    NotFoundError,
    VocabBloomClient,
    VocabBloomError,
    Word,
)


def _print_dataset_attribution(meta: Meta) -> None:
    dataset_name = meta.title or meta.dataset
    if dataset_name:
        print(f"Dataset: {dataset_name}")
    print(f"License: {meta.license} ({meta.license_url})")
    print(f"Attribution: {meta.attribution}")
    if meta.attribution_url:
        print(f"Attribution URL: {meta.attribution_url}")
    if meta.license_text:
        print(f"License text: {meta.license_text}")
    if meta.notice:
        print(f"Notice: {meta.notice}")


def _print_word(word: Word) -> None:
    print(f"\n{word.word} ({word.part_of_speech.value})")
    if word.modified:
        print("  Note: this entry has been modified on this instance.")
    if not word.meanings:
        print("  No meanings available.")
        return
    for meaning in word.meanings:
        print(f"  - {meaning.definition}")


def main(
    argv: Sequence[str] | None = None,
    *,
    client_factory: Callable[[str], VocabBloomClient] = VocabBloomClient,
) -> int:
    parser = argparse.ArgumentParser(description="Look up a headword in a Vocab Bloom Hub instance.")
    parser.add_argument("--base-url", required=True, help="instance origin, such as https://dict.example.com")
    parser.add_argument("headword", help="word to look up")
    args = parser.parse_args(argv)

    try:
        with client_factory(args.base_url) as client:
            meta = client.meta().data
            entries = client.word(args.headword).data
    except NotFoundError:
        print(f"error: word not found: {args.headword}", file=sys.stderr)
        return 1
    except NetworkError:
        print("error: could not reach the dictionary instance", file=sys.stderr)
        return 2
    except VocabBloomError as error:
        print(f"error: dictionary request failed ({error.code})", file=sys.stderr)
        return 2

    if not entries:
        print(f"error: word not found: {args.headword}", file=sys.stderr)
        return 1

    _print_dataset_attribution(meta)
    for entry in entries:
        _print_word(entry)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
