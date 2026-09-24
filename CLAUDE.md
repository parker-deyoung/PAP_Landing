# Claude workspace instructions

Read and follow `AGENTS.md` before modifying this repository. It defines the shared
memory and file-claim protocol used by every Claude, Codex, and human-assisted agent
working in this directory.

At the start of each task, run:

```sh
python3 tools/agent_memory.py context
git status --short
```

Register with a unique `claude-*` agent ID, claim paths before editing, log meaningful
progress, and call `finish` when done. A conflicting claim means another agent owns
that path; do not edit it or undo its changes.
