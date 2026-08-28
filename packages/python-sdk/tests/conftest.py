"""Shared fixtures: a running Vocab Bloom Hub instance for the live tests.

`apps/server/test/harness/public-api-fixture.ts` boots the server on an
in-memory SQLite database, seeds three entries and prints ``LISTENING <url>``;
the fixture spawns it through yarn and stops it after the session.
"""

from __future__ import annotations

import os
import shutil
import signal
import subprocess
import time
from collections.abc import Iterator
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]


@pytest.fixture(scope="session")
def server_url() -> Iterator[str]:
    if shutil.which("yarn") is None:
        pytest.skip("yarn is not installed: the live tests need the server workspace")
    process = subprocess.Popen(
        ["yarn", "workspace", "server", "fixture:public-api"],
        cwd=REPO_ROOT,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        start_new_session=True,
    )
    assert process.stdout is not None
    url: str | None = None
    lines: list[str] = []
    deadline = time.monotonic() + 120
    while time.monotonic() < deadline:
        line = process.stdout.readline()
        if not line:
            if process.poll() is not None:
                break
            continue
        lines.append(line)
        if line.startswith("LISTENING "):
            url = line.split(" ", 1)[1].strip()
            break
    if url is None:
        os.killpg(process.pid, signal.SIGTERM)
        raise RuntimeError("the fixture server did not start:\n" + "".join(lines[-40:]))
    try:
        yield url
    finally:
        os.killpg(process.pid, signal.SIGTERM)
        try:
            process.wait(timeout=15)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
