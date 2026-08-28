"""Regenerates src/vocab_bloom_hub/_generated/models.py from the server's public
OpenAPI document with datamodel-code-generator, or with --check fails when the
committed file is behind the spec (CI runs the check).

    uv run python scripts/generate_models.py [--check]
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = ROOT.parents[1] / "apps" / "server" / "openapi" / "public-v1.json"
OUTPUT = ROOT / "src" / "vocab_bloom_hub" / "_generated" / "models.py"
HEADER = (
    "# Generated from apps/server/openapi/public-v1.json by scripts/generate_models.py — do not edit.\n"
    "# ruff: noqa\n"
    "# mypy: ignore-errors"
)


def generate(target: Path) -> None:
    subprocess.run(
        [
            sys.executable,
            "-m",
            "datamodel_code_generator",
            "--input",
            str(SPEC),
            "--input-file-type",
            "openapi",
            "--output",
            str(target),
            "--output-model-type",
            "pydantic_v2.BaseModel",
            "--target-python-version",
            "3.10",
            "--use-standard-collections",
            "--use-union-operator",
            "--field-constraints",
            "--collapse-root-models",
            # a required field marked nullable stays `T | None` (without --strict-nullable it becomes `T`)
            "--strict-nullable",
            "--use-schema-description",
            "--use-double-quotes",
            "--disable-timestamp",
            "--custom-file-header",
            HEADER,
            "--formatters",
            "ruff-format",
        ],
        check=True,
    )


def main(argv: list[str]) -> int:
    if "--check" in argv:
        # next to the committed file, so the formatter applies the package's pyproject.toml
        fresh = OUTPUT.with_name(".models.fresh.py")
        try:
            generate(fresh)
            stale = not OUTPUT.exists() or fresh.read_bytes() != OUTPUT.read_bytes()
        finally:
            fresh.unlink(missing_ok=True)
        if stale:
            print(
                f"{OUTPUT} is stale: run `uv run python scripts/generate_models.py` and commit the result.",
                file=sys.stderr,
            )
            return 1
        print(f"{OUTPUT} is up to date")
        return 0
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    generate(OUTPUT)
    print(f"Wrote {OUTPUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
