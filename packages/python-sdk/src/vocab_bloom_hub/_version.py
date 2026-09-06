"""The version of the installed distribution and the User-Agent built from it (issues #401, #408)."""

from importlib import metadata as _metadata

# pyproject.toml is the single source, bumped by scripts/bump-version.mjs;
# PyPI's normalized form ("0.1.0a3" for "0.1.0-alpha.3"). A source checkout
# that is not installed has no metadata and answers "0.0.0"
try:
    __version__ = _metadata.version("vocab-bloom-hub")
except _metadata.PackageNotFoundError:  # pragma: no cover - not installed
    __version__ = "0.0.0"

# Sent as User-Agent unless the caller overrides the header, so an operator
# can tell SDK traffic apart in the request log
USER_AGENT = f"vocab-bloom-hub-python/{__version__}"
