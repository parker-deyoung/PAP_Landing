#!/usr/bin/env python3
"""Concurrent local memory and file-claim service for coding agents."""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path, PurePosixPath


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DB = ROOT / ".agent-memory" / "runtime" / "memory.sqlite3"
DEFAULT_TTL_MINUTES = 30


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def timestamp(value: datetime | None = None) -> str:
    return (value or utc_now()).isoformat(timespec="seconds").replace("+00:00", "Z")


def connect(db_path: Path) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(db_path, timeout=10, isolation_level=None)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA busy_timeout = 10000")
    connection.execute("PRAGMA journal_mode = WAL")
    connection.execute("PRAGMA foreign_keys = ON")
    connection.executescript(
        """
        CREATE TABLE IF NOT EXISTS agents (
            agent_id TEXT PRIMARY KEY,
            role TEXT NOT NULL DEFAULT 'agent',
            task TEXT NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('active', 'idle', 'finished')),
            started_at TEXT NOT NULL,
            heartbeat_at TEXT NOT NULL,
            finished_at TEXT
        );

        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT NOT NULL,
            agent_id TEXT NOT NULL,
            kind TEXT NOT NULL,
            summary TEXT NOT NULL,
            details TEXT NOT NULL DEFAULT '',
            target_agent TEXT
        );

        CREATE INDEX IF NOT EXISTS events_created_idx
            ON events(created_at DESC, id DESC);

        CREATE TABLE IF NOT EXISTS claims (
            path TEXT PRIMARY KEY,
            agent_id TEXT NOT NULL,
            task TEXT NOT NULL,
            acquired_at TEXT NOT NULL,
            expires_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS claims_agent_idx ON claims(agent_id);
        CREATE INDEX IF NOT EXISTS claims_expiry_idx ON claims(expires_at);

        CREATE TABLE IF NOT EXISTS decisions (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            reason TEXT NOT NULL DEFAULT '',
            updated_by TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        """
    )
    return connection


def add_event(
    db: sqlite3.Connection,
    agent: str,
    kind: str,
    summary: str,
    details: str = "",
    target: str | None = None,
) -> None:
    db.execute(
        "INSERT INTO events(created_at, agent_id, kind, summary, details, target_agent) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (timestamp(), agent, kind, summary.strip(), details.strip(), target),
    )


def require_agent(db: sqlite3.Connection, agent: str) -> sqlite3.Row:
    row = db.execute("SELECT * FROM agents WHERE agent_id = ?", (agent,)).fetchone()
    if row is None:
        raise ValueError(f"unknown agent {agent!r}; run 'start' first")
    if row["status"] == "finished":
        raise ValueError(f"agent {agent!r} is finished; run 'start' to reactivate it")
    return row


def normalize_claim(raw_path: str) -> str:
    candidate = Path(raw_path)
    absolute = candidate.resolve() if candidate.is_absolute() else (ROOT / candidate).resolve()
    try:
        relative = absolute.relative_to(ROOT)
    except ValueError as exc:
        raise ValueError(f"claim is outside the repository: {raw_path}") from exc
    result = relative.as_posix().rstrip("/")
    return result or "."


def paths_overlap(left: str, right: str) -> bool:
    left_path = PurePosixPath(left)
    right_path = PurePosixPath(right)
    return left_path == right_path or left_path in right_path.parents or right_path in left_path.parents


def begin_immediate(db: sqlite3.Connection) -> None:
    db.execute("BEGIN IMMEDIATE")


def cmd_init(db: sqlite3.Connection, _args: argparse.Namespace) -> None:
    print(f"Agent memory ready: {db.execute('PRAGMA database_list').fetchone()['file']}")


def cmd_start(db: sqlite3.Connection, args: argparse.Namespace) -> None:
    now = timestamp()
    begin_immediate(db)
    try:
        previous = db.execute(
            "SELECT started_at FROM agents WHERE agent_id = ?", (args.agent,)
        ).fetchone()
        started_at = previous["started_at"] if previous else now
        db.execute(
            """
            INSERT INTO agents(agent_id, role, task, status, started_at, heartbeat_at, finished_at)
            VALUES (?, ?, ?, 'active', ?, ?, NULL)
            ON CONFLICT(agent_id) DO UPDATE SET
                role = excluded.role,
                task = excluded.task,
                status = 'active',
                heartbeat_at = excluded.heartbeat_at,
                finished_at = NULL
            """,
            (args.agent, args.role, args.task.strip(), started_at, now),
        )
        add_event(db, args.agent, "start", args.task, f"role={args.role}")
        db.commit()
    except Exception:
        db.rollback()
        raise
    print(f"Started {args.agent}: {args.task}")


def cmd_heartbeat(db: sqlite3.Connection, args: argparse.Namespace) -> None:
    require_agent(db, args.agent)
    now = utc_now()
    expiry = timestamp(now + timedelta(minutes=args.ttl))
    begin_immediate(db)
    try:
        db.execute(
            "UPDATE agents SET heartbeat_at = ?, status = 'active' WHERE agent_id = ?",
            (timestamp(now), args.agent),
        )
        db.execute("UPDATE claims SET expires_at = ? WHERE agent_id = ?", (expiry, args.agent))
        db.commit()
    except Exception:
        db.rollback()
        raise
    print(f"Heartbeat refreshed for {args.agent}; claims expire {expiry}")


def cmd_claim(db: sqlite3.Connection, args: argparse.Namespace) -> None:
    agent_row = require_agent(db, args.agent)
    requested = list(dict.fromkeys(normalize_claim(path) for path in args.paths))
    now = utc_now()
    expires_at = timestamp(now + timedelta(minutes=args.ttl))
    begin_immediate(db)
    try:
        db.execute("DELETE FROM claims WHERE expires_at <= ?", (timestamp(now),))
        existing = db.execute("SELECT * FROM claims WHERE agent_id != ?", (args.agent,)).fetchall()
        conflicts = [
            (path, row["path"], row["agent_id"], row["expires_at"])
            for path in requested
            for row in existing
            if paths_overlap(path, row["path"])
        ]
        if conflicts:
            lines = [
                f"{wanted} overlaps {held} (held by {owner} until {expiry})"
                for wanted, held, owner, expiry in conflicts
            ]
            raise ValueError("claim conflict:\n  " + "\n  ".join(lines))
        acquired_at = timestamp(now)
        for path in requested:
            db.execute(
                """
                INSERT INTO claims(path, agent_id, task, acquired_at, expires_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(path) DO UPDATE SET
                    agent_id = excluded.agent_id,
                    task = excluded.task,
                    acquired_at = excluded.acquired_at,
                    expires_at = excluded.expires_at
                """,
                (path, args.agent, agent_row["task"], acquired_at, expires_at),
            )
        add_event(db, args.agent, "claim", ", ".join(requested), f"expires={expires_at}")
        db.commit()
    except Exception:
        db.rollback()
        raise
    print(f"Claimed for {args.agent} until {expires_at}: {', '.join(requested)}")


def cmd_release(db: sqlite3.Connection, args: argparse.Namespace) -> None:
    require_agent(db, args.agent)
    if args.paths:
        paths = [normalize_claim(path) for path in args.paths]
        placeholders = ",".join("?" for _ in paths)
        query = f"DELETE FROM claims WHERE agent_id = ? AND path IN ({placeholders})"
        parameters = [args.agent, *paths]
    else:
        paths = []
        query = "DELETE FROM claims WHERE agent_id = ?"
        parameters = [args.agent]
    begin_immediate(db)
    try:
        cursor = db.execute(query, parameters)
        summary = ", ".join(paths) if paths else "all claims"
        add_event(db, args.agent, "release", summary)
        db.commit()
    except Exception:
        db.rollback()
        raise
    print(f"Released {cursor.rowcount} claim(s) for {args.agent}")


def cmd_log(db: sqlite3.Connection, args: argparse.Namespace) -> None:
    require_agent(db, args.agent)
    add_event(db, args.agent, args.kind, args.summary, args.details)
    db.execute("UPDATE agents SET heartbeat_at = ? WHERE agent_id = ?", (timestamp(), args.agent))
    print(f"Logged {args.kind} for {args.agent}")


def cmd_decide(db: sqlite3.Connection, args: argparse.Namespace) -> None:
    require_agent(db, args.agent)
    now = timestamp()
    begin_immediate(db)
    try:
        db.execute(
            """
            INSERT INTO decisions(key, value, reason, updated_by, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                reason = excluded.reason,
                updated_by = excluded.updated_by,
                updated_at = excluded.updated_at
            """,
            (args.key, args.value, args.reason, args.agent, now),
        )
        add_event(db, args.agent, "decision", f"{args.key}: {args.value}", args.reason)
        db.commit()
    except Exception:
        db.rollback()
        raise
    print(f"Recorded decision {args.key}")


def cmd_handoff(db: sqlite3.Connection, args: argparse.Namespace) -> None:
    require_agent(db, args.agent)
    add_event(db, args.agent, "handoff", args.summary, args.next, args.to)
    db.execute("UPDATE agents SET status = 'idle', heartbeat_at = ? WHERE agent_id = ?", (timestamp(), args.agent))
    print(f"Handoff recorded from {args.agent} to {args.to}")


def cmd_finish(db: sqlite3.Connection, args: argparse.Namespace) -> None:
    require_agent(db, args.agent)
    now = timestamp()
    begin_immediate(db)
    try:
        add_event(db, args.agent, "finish", args.summary, args.details)
        released = db.execute("DELETE FROM claims WHERE agent_id = ?", (args.agent,)).rowcount
        db.execute(
            "UPDATE agents SET status = 'finished', heartbeat_at = ?, finished_at = ? "
            "WHERE agent_id = ?",
            (now, now, args.agent),
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    print(f"Finished {args.agent}; released {released} claim(s)")


def snapshot(db: sqlite3.Connection, limit: int) -> dict[str, list[dict[str, object]]]:
    now = timestamp()
    agents = db.execute(
        "SELECT agent_id, role, task, status, heartbeat_at FROM agents "
        "WHERE status != 'finished' ORDER BY heartbeat_at DESC"
    ).fetchall()
    claims = db.execute(
        "SELECT path, agent_id, task, expires_at FROM claims WHERE expires_at > ? "
        "ORDER BY path",
        (now,),
    ).fetchall()
    decisions = db.execute(
        "SELECT key, value, reason, updated_by, updated_at FROM decisions ORDER BY updated_at DESC"
    ).fetchall()
    events = db.execute(
        "SELECT created_at, agent_id, kind, summary, details, target_agent FROM events "
        "ORDER BY id DESC LIMIT ?",
        (limit,),
    ).fetchall()
    return {
        "agents": [dict(row) for row in agents],
        "claims": [dict(row) for row in claims],
        "decisions": [dict(row) for row in decisions],
        "events": [dict(row) for row in events],
    }


def print_snapshot(data: dict[str, list[dict[str, object]]], context_only: bool = False) -> None:
    def section(title: str, rows: list[dict[str, object]], formatter) -> None:
        print(f"\n{title}")
        print("-" * len(title))
        if not rows:
            print("(none)")
            return
        for row in rows:
            print(formatter(row))

    section(
        "Active agents",
        data["agents"],
        lambda r: f"{r['agent_id']} [{r['status']}] — {r['task']} (heartbeat {r['heartbeat_at']})",
    )
    section(
        "Live claims",
        data["claims"],
        lambda r: f"{r['path']} — {r['agent_id']} (expires {r['expires_at']})",
    )
    section(
        "Decisions",
        data["decisions"],
        lambda r: f"{r['key']} = {r['value']} — {r['reason']} [{r['updated_by']}, {r['updated_at']}]",
    )
    section(
        "Recent activity" if not context_only else "Shared context",
        data["events"],
        lambda r: (
            f"{r['created_at']} {r['agent_id']} {r['kind']}"
            + (f" -> {r['target_agent']}" if r["target_agent"] else "")
            + f": {r['summary']}"
            + (f" | {r['details']}" if r["details"] else "")
        ),
    )


def cmd_status(db: sqlite3.Connection, args: argparse.Namespace) -> None:
    data = snapshot(db, args.limit)
    if args.json:
        print(json.dumps(data, indent=2))
    else:
        print_snapshot(data)


def cmd_context(db: sqlite3.Connection, args: argparse.Namespace) -> None:
    data = snapshot(db, args.limit)
    if args.json:
        print(json.dumps(data, indent=2))
    else:
        print_snapshot(data, context_only=True)
        print("\nReminder: inspect git status/diff and claim paths before editing.")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--db",
        type=Path,
        default=Path(os.environ.get("AGENT_MEMORY_DB", DEFAULT_DB)),
        help="SQLite database path (default: .agent-memory/runtime/memory.sqlite3)",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    init = subparsers.add_parser("init", help="initialize the database")
    init.set_defaults(func=cmd_init)

    start = subparsers.add_parser("start", help="register or reactivate an agent")
    start.add_argument("--agent", required=True)
    start.add_argument("--task", required=True)
    start.add_argument("--role", default="agent")
    start.set_defaults(func=cmd_start)

    heartbeat = subparsers.add_parser("heartbeat", help="refresh an agent and its claims")
    heartbeat.add_argument("--agent", required=True)
    heartbeat.add_argument("--ttl", type=int, default=DEFAULT_TTL_MINUTES)
    heartbeat.set_defaults(func=cmd_heartbeat)

    claim = subparsers.add_parser("claim", help="atomically claim files or directories")
    claim.add_argument("--agent", required=True)
    claim.add_argument("--ttl", type=int, default=DEFAULT_TTL_MINUTES)
    claim.add_argument("paths", nargs="+")
    claim.set_defaults(func=cmd_claim)

    release = subparsers.add_parser("release", help="release selected or all claims")
    release.add_argument("--agent", required=True)
    release.add_argument("paths", nargs="*")
    release.set_defaults(func=cmd_release)

    log = subparsers.add_parser("log", help="append a shared activity event")
    log.add_argument("--agent", required=True)
    log.add_argument("--kind", default="progress", choices=("progress", "warning", "note", "blocked"))
    log.add_argument("--summary", required=True)
    log.add_argument("--details", default="")
    log.set_defaults(func=cmd_log)

    decide = subparsers.add_parser("decide", help="create or update a durable decision")
    decide.add_argument("--agent", required=True)
    decide.add_argument("--key", required=True)
    decide.add_argument("--value", required=True)
    decide.add_argument("--reason", default="")
    decide.set_defaults(func=cmd_decide)

    handoff = subparsers.add_parser("handoff", help="record work for another agent")
    handoff.add_argument("--agent", required=True)
    handoff.add_argument("--to", required=True)
    handoff.add_argument("--summary", required=True)
    handoff.add_argument("--next", required=True)
    handoff.set_defaults(func=cmd_handoff)

    finish = subparsers.add_parser("finish", help="finish an agent and release its claims")
    finish.add_argument("--agent", required=True)
    finish.add_argument("--summary", required=True)
    finish.add_argument("--details", default="")
    finish.set_defaults(func=cmd_finish)

    for command, handler in (("status", cmd_status), ("context", cmd_context)):
        view = subparsers.add_parser(command, help=f"show shared {command}")
        view.add_argument("--limit", type=int, default=20)
        view.add_argument("--json", action="store_true")
        view.set_defaults(func=handler)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    if hasattr(args, "ttl") and args.ttl <= 0:
        parser.error("--ttl must be greater than zero")
    try:
        with connect(args.db.resolve()) as db:
            args.func(db, args)
    except (ValueError, sqlite3.Error) as exc:
        print(f"agent-memory: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
