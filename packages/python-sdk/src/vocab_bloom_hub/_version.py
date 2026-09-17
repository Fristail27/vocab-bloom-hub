"""The version of the installed distribution and the User-Agent built from it (issues #401, #408)."""

import re
from importlib import metadata as _metadata


def _normalize(version: str) -> str:
    """PEP 440's normalized spelling of a semver pre-release (``0.2.0-beta.1`` → ``0.2.0b1``).

    Build backends used to write the normalized form into the package metadata;
    hatchling 1.32.3 started keeping the spelling of pyproject.toml, so the
    normalization is done here to keep ``__version__`` and the User-Agent stable.
    """
    return re.sub(
        r"-(alpha|beta|rc)\.(\d+)$",
        lambda m: {"alpha": "a", "beta": "b", "rc": "rc"}[m[1]] + m[2],
        version.lower(),
    )


# pyproject.toml is the single source, bumped by scripts/bump-version.mjs;
# PyPI's normalized form ("0.1.0a3" for "0.1.0-alpha.3"). A source checkout
# that is not installed has no metadata and answers "0.0.0"
try:
    __version__ = _normalize(_metadata.version("vocab-bloom-hub"))
except _metadata.PackageNotFoundError:  # pragma: no cover - not installed
    __version__ = "0.0.0"

# Sent as User-Agent unless the caller overrides the header, so an operator
# can tell SDK traffic apart in the request log
USER_AGENT = f"vocab-bloom-hub-python/{__version__}"
