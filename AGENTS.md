# Shared agent coordination

This repository may be edited by several agents at the same time. Coordinate through
the local agent-memory service before changing files.

## Required workflow

1. Read the current shared context before planning:

   ```sh
   python3 tools/agent_memory.py context
   git status --short
   ```

2. Register a stable, unique agent ID for the current session. Prefix it with the
   client when possible, for example `claude-security-a` or `codex-copy-a`:

   ```sh
   python3 tools/agent_memory.py start --agent AGENT_ID --task "Short task description"
   ```

3. Before editing, claim the exact files or directories involved:

   ```sh
   python3 tools/agent_memory.py claim --agent AGENT_ID path/to/file another/path
   ```

   Claims are advisory but mandatory. If a claim conflicts, do not edit that path.
   Choose different files, coordinate through a handoff, or wait. Never delete or
   overwrite another agent's work to resolve a conflict.

4. After each meaningful work unit, record a compact update and refresh the heartbeat:

   ```sh
   python3 tools/agent_memory.py log --agent AGENT_ID --kind progress \
     --summary "What changed" --details "Files, constraints, and next step"
   python3 tools/agent_memory.py heartbeat --agent AGENT_ID
   ```

5. Record durable architectural or product decisions separately:

   ```sh
   python3 tools/agent_memory.py decide --agent AGENT_ID --key decision-name \
     --value "Decision" --reason "Why"
   ```

6. Before handing work to another agent, create a handoff. When done, finish the
   session; finishing releases all claims:

   ```sh
   python3 tools/agent_memory.py handoff --agent AGENT_ID --to TARGET_ID \
     --summary "Current state" --next "Exact next action"
   python3 tools/agent_memory.py finish --agent AGENT_ID --summary "Result and verification"
   ```

## Concurrency rules

- Treat existing uncommitted changes as another agent's work unless the memory log
  explicitly assigns them to you.
- Inspect the latest diff immediately before applying a patch. Keep patches narrow.
- Do not run repository-wide formatters while other agents are active.
- Do not amend, reset, stash, clean, or commit another agent's changes.
- A file claim defaults to 30 minutes. Use `heartbeat` during longer work; it extends
  that agent's claims. Release claims early when they are no longer needed.
- Use `python3 tools/agent_memory.py status` at any point to see active agents, claims,
  decisions, and recent activity.

The runtime database lives under `.agent-memory/runtime/` and is intentionally not
tracked. See `.agent-memory/README.md` for the command reference and design details.
