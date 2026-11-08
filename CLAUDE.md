# Vanguard

A Claude Code mod: a live pane for the subagent squad, orchestrator rules, five agents, four skills, bundled MCP servers and a guard for destructive commands. Everything ships from `plugins/vanguard/`; the repo root is the marketplace.

## Layout
- `plugins/vanguard/hooks/register.tsx`: the engine hooks and the pane.
- `plugins/vanguard/hooks/lib.ts`: pure logic, covered by `plugins/vanguard/tests/`.
- `plugins/vanguard/hooks/i18n.ts`: every string in 10 languages. A new key goes into all of them.
- `plugins/vanguard/agents/`, `plugins/vanguard/skills/`: Markdown with YAML front matter.
- `.claude-plugin/marketplace.json` and `plugins/vanguard/.claude-plugin/plugin.json` carry the same version.

## Check before a pull request
```bash
claude plugin validate .
claude plugin validate plugins/vanguard
claude plugin test plugins/vanguard
```
Run Prettier only on the files you changed.

## Rules
- Never delete files or folders with `rm -rf`, `git clean` or `find -delete`; remove a file you created by name and ask before anything wider.
- Never read, print or commit secrets: `.env*`, keys, `~/.ssh`, `~/.aws`, tokens. Do not put them in tests, logs or fixtures.
- Never force-push, `git reset --hard` or rewrite published history. Work on a branch; `main` changes only through a reviewed pull request.
- Never deploy to production, publish a release, tag a version or merge a pull request without the maintainer's approval.
- Always bump the version in both manifests and add a CHANGELOG entry when behaviour changes.
- `.claude/settings.json` and `.claude/hooks/guard.sh` enforce the first three rules here; do not weaken them to get a command through.
