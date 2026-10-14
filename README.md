<p align="center">
  <img src="assets/banner.svg" alt="Vanguard — command center for Claude Code" width="100%">
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-8B5CF6"></a>
  <img alt="Claude Code plugin" src="https://img.shields.io/badge/Claude%20Code-plugin-D97757">
  <img alt="Version" src="https://img.shields.io/badge/version-1.2.2-3B82F6">
  <a href="https://github.com/XXX1694/Vanguard/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/XXX1694/Vanguard/actions/workflows/ci.yml/badge.svg"></a>
</p>

<p align="center">
  <b>English</b> · <a href="README.ru.md">Русский</a>
</p>

**Vanguard** turns Claude Code into a command center. A live pane shows your squad of subagents, rate limits and what fills the context window. An orchestrator layer teaches Claude to split big tasks across specialist agents, look up current docs and prove its work before calling it done. A lifetime profile with levels and achievements follows you across every session and project.

It installs in two commands and opens by itself in every session.

## Install

In Claude Code:

```text
/plugin marketplace add XXX1694/Vanguard
/plugin install vanguard@vanguard
```

Start a new session, or run `/vanguard` to open the pane now.

**Requirements:** Claude Code 2.1.290 or newer (the live pane uses Claude Code's plugin hooks, which are in early access). Node.js 18+ for the bundled `sequential-thinking` and `playwright` MCP servers.

## What you get

### Live pane

Opens beside the conversation at the start of every session (`/vanguard` opens it any time).

The pane speaks **10 languages**: English, Русский, 中文, हिन्दी, Español, Português, 日本語, 한국어, Deutsch and Français. It follows your system locale, and the switcher at the end of the tab row changes it on the spot. A native list appears on the desktop, and on the terminal a button cycles through the languages. Your choice is remembered in your profile.

Five tabs:

| Tab | What it shows |
| --- | --- |
| **Overview** | One line of figures: session time, subagents, calls, agent tokens and spend. The squad: the main agent and every running subagent as a living character that shows its role and what it is doing right now. Click a name to open that agent's page with its task, its last tool calls, the tools it leaned on and the report it handed back. Rate limits with reset times and a forecast of when the 5-hour limit runs out, and a one-click compact and handoff. |
| **Context** | What fills the context window, as `/context` counts it: system prompt, tools, skills, memory files, messages, the compaction reserve. Which MCP servers and CLAUDE.md files weigh the most. |
| **Arsenal** | Your MCP servers, plugins and skills. Whatever you used this session lights up with a counter. |
| **Achievements** | Your level and XP, eleven achievements from *First sortie* to *Shell master* with progress toward the next one, and the language switcher. |
| **Journal** | Finished agents and the session's events. |

It works in the terminal and in the desktop app. The desktop draws animated characters, vector icons and smooth progress bars. The terminal gets a compact glyph layout tuned for a narrow side column.

### Orchestrator

Vanguard adds a short set of orchestration rules to the system prompt (turn it off in settings):

- fan independent work out to agents in parallel, and keep the main thread lean;
- brief every agent with a self-contained prompt;
- fetch current library docs through Context7 instead of relying on memory;
- verify before calling work done: tests, review, and a browser check for UI;
- suggest `/handoff` when the context window is nearly full.

### Agents

| Agent | Role | Model |
| --- | --- | --- |
| `scout` | Fast read-only recon: where things live, with `file:line` evidence | Haiku |
| `architect` | One decisive plan, split into parallel workstreams with file ownership | inherits |
| `builder` | Implements one scoped workstream and runs its checks | inherits |
| `reviewer` | Finds real defects in a diff, ranked by severity | inherits |
| `verifier` | Runs tests, reproduces fixes, checks web UI in a real browser | inherits |

### Skills

| Command | What it does |
| --- | --- |
| `/vanguard:orchestrate` | Runs a squad for a large task: recon, plan, parallel build, review and verify |
| `/vanguard:recon` | Maps an unfamiliar codebase with parallel scouts |
| `/vanguard:docs` | Fetches current, version-accurate docs through Context7 |
| `/vanguard:ship-check` | The gate before calling work done |

### Commands

| Command | What it does |
| --- | --- |
| `/vanguard` | Opens the pane |
| `/handoff` | Compacts the context and keeps the plan, then writes a snapshot to `~/.claude/handoffs/` to resume from in a new session |

### Bundled MCP servers

| Server | Why | Runs as |
| --- | --- | --- |
| [Context7](https://context7.com) | Current docs for libraries and frameworks | Remote HTTP, nothing to install |
| [Sequential Thinking](https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking) | Step-by-step reasoning for hard plans | `npx` |
| [Playwright](https://github.com/microsoft/playwright-mcp) | A real browser for checking web UI | `npx` (downloads a browser on first use) |

### Context guard and handoff

Every compaction of the main conversation keeps your goals, decisions, work state, running agents, blockers and next steps. It also writes a Markdown snapshot to `~/.claude/handoffs/`. The pane can copy a ready-made prompt to resume in a fresh session.

### Lifetime profile

Levels, XP and achievements are kept in `~/.claude/vanguard/profile.json` and shared by every session in every project. XP comes from finished agents, tool calls, skills, MCP calls and achievements. A banner and a short chime mark each unlock and each new level.

## Settings

Open `/plugin`, choose **vanguard**, then **Configure**:

| Setting | Default | |
| --- | --- | --- |
| Language | auto | `auto` follows the system locale. The switcher in the pane overrides it. |
| Orchestrator rules | on | Add the orchestration rules to the system prompt |
| Open at start | on | Open the pane in every new session |
| Animations | on | Living squad characters (desktop) |
| Achievement sound | on | A short chime on each unlock |
| Context warning, % | 70 | When the context guard turns yellow |
| Context critical, % | 85 | When it turns red and suggests a handoff |
| Arsenal / Achievements / Journal | on | Show these tabs |

## Privacy

Vanguard has no telemetry and makes no network calls of its own. It writes only these files:

- `~/.claude/vanguard/profile.json`, your profile;
- `~/.claude/handoffs/`, compaction snapshots.

The bundled MCP servers follow their own policies. Context7 receives the library names and topics you ask about. Playwright opens the pages your agents visit.

## Update and remove

```text
/plugin marketplace update vanguard
/plugin uninstall vanguard@vanguard
```

## Repository layout

```text
.claude-plugin/marketplace.json   the marketplace this repo serves
plugins/vanguard/
  .claude-plugin/plugin.json      manifest and settings
  hooks/                          the live pane, orchestrator rules and profile (TypeScript)
  agents/                         scout, architect, builder, reviewer, verifier
  skills/                         orchestrate, recon, docs, ship-check
  .mcp.json                       bundled MCP servers
  tests/                          `claude plugin test` suite
```

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md). Report security problems privately as described in [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © Abzal Serikbay
