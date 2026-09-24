# Agent memory backend

`tools/agent_memory.py` provides a shared local coordination service for concurrent
agents. It uses SQLite transactions, WAL mode, and a busy timeout, so separate agent
processes can safely read and write at the same time. Runtime data is stored in
`.agent-memory/runtime/memory.sqlite3` and excluded from Git.

The service tracks:

- active agents, tasks, states, and heartbeats;
- atomic, expiring claims on files or directories;
- append-only progress, warning, handoff, and completion events;
- durable keyed decisions with reasons and authors.

## Quick reference

```sh
python3 tools/agent_memory.py init
python3 tools/agent_memory.py start --agent claude-a --task "Build section A"
python3 tools/agent_memory.py claim --agent claude-a index.html assets/css/styles.css
python3 tools/agent_memory.py log --agent claude-a --kind progress --summary "Added markup"
python3 tools/agent_memory.py heartbeat --agent claude-a
python3 tools/agent_memory.py decide --agent claude-a --key css-layout --value grid --reason "Responsive"
python3 tools/agent_memory.py handoff --agent claude-a --to claude-b --summary "Markup done" --next "Add styles"
python3 tools/agent_memory.py release --agent claude-a index.html
python3 tools/agent_memory.py finish --agent claude-a --summary "Implemented and checked"
python3 tools/agent_memory.py status
python3 tools/agent_memory.py context --limit 30
```

Set `AGENT_MEMORY_DB` to use another database, or pass `--db PATH` before the command.
All timestamps are UTC. Claims default to 30 minutes and are extended by `heartbeat`.
Overlapping parent/child paths conflict, so a claim on `assets/` blocks a claim on
`assets/js/enhance.js` and vice versa.

This system coordinates agents that follow the repository instructions. It cannot
force an already-running external process to reload instructions; those sessions need
to read `CLAUDE.md` or run the `context` command once before they participate.
