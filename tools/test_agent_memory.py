#!/usr/bin/env python3
"""Small integration test for the agent-memory CLI."""

from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
CLI = ROOT / "tools" / "agent_memory.py"


def run(db: Path, *args: str, expected: int = 0) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        [sys.executable, str(CLI), "--db", str(db), *args],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode != expected:
        raise AssertionError(
            f"expected {expected}, got {result.returncode}: {' '.join(args)}\n"
            f"stdout: {result.stdout}\nstderr: {result.stderr}"
        )
    return result


def main() -> int:
    with tempfile.TemporaryDirectory(prefix="agent-memory-test-") as directory:
        db = Path(directory) / "memory.sqlite3"
        run(db, "init")
        run(db, "start", "--agent", "claude-a", "--task", "Edit JavaScript")
        run(db, "start", "--agent", "codex-b", "--task", "Edit styles")
        run(db, "claim", "--agent", "claude-a", "assets/js")
        conflict = run(
            db,
            "claim",
            "--agent",
            "codex-b",
            "assets/js/enhance.js",
            expected=2,
        )
        assert "claim conflict" in conflict.stderr
        run(db, "claim", "--agent", "codex-b", "assets/css/styles.css")
        run(
            db,
            "decide",
            "--agent",
            "codex-b",
            "--key",
            "layout",
            "--value",
            "grid",
            "--reason",
            "responsive",
        )
        status = run(db, "status", "--json")
        assert '"claude-a"' in status.stdout
        assert '"assets/css/styles.css"' in status.stdout
        assert '"layout"' in status.stdout
        run(db, "finish", "--agent", "claude-a", "--summary", "Done")
        run(db, "claim", "--agent", "codex-b", "assets/js/enhance.js")
    print("agent-memory integration test passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
