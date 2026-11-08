# Changelog

All notable changes to Vanguard are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [1.4.1] - 2026-11-09

### Removed
- The bundled Sequential Thinking MCP server and the orchestrator rule that sent hard plans through it. Current models reason step by step on their own, so the tool mostly added tokens to every planning turn. The pane still shows a `sequentialthinking` tool as planning if you add such a server yourself.

### Changed
- Vanguard needs Claude Code 2.1.307 or newer, and CI tests on that version. Before 2.1.307 the guard's "ask" did not reach a permission decision: the force-push test let the command run on 2.1.306 and older.

## [1.4.0] - 2026-10-24

### Added
- The limiter switch, at the top of every tab of the pane and as `/limiter` (`/limiter on`, `/limiter off`). Off, nothing asks for permission: every verdict that would open a permission prompt (settings rules, the mode, hooks, the guard, the auto-mode classifier) lets the call run, in the main agent and in every subagent, and a section in the system prompt tells Claude not to stop for "should I proceed?". Refusals stay refusals: settings deny rules, an organization's limits and the guard's catastrophic list (`rm -rf /`, `mkfs`, `dd` onto a disk) still stop a call, and questions that are Claude's to put to you (AskUserQuestion, a plan) still show. While it is off, the band above the prompt says so in red. The choice is kept in your profile across sessions; each flip goes to the Journal.

## [1.3.0] - 2026-10-20

### Added
- Command guard: before any tool call, from the main agent or a subagent, Vanguard asks you first about destructive shell commands (`rm -rf`, `find -delete`, `git push --force`, `git reset --hard`, `git clean -f`, `git branch -D`, `sudo`, `chmod -R 777`, `curl | sh`, `terraform destroy`, `kubectl delete`, `npm publish`, SQL `DROP`/`TRUNCATE`) and about reading or editing secret files (`.env`, keys, `~/.ssh`, `~/.aws`, `.npmrc`, `credentials`). It refuses the catastrophic ones outright (`rm -rf /`, `mkfs`, `dd` onto a disk, a fork bomb) and tells the agent to ask you instead. It sees through chains, pipes, `sudo`, `env`, full paths and `bash -c`. Each stop goes to the Journal. The new `guard` setting, on by default, turns it off.
- Smart orchestration: a one-line `Vanguard budget:` note (`plenty`, `tight` or `critical`) reaches the model when your plan or the band of your remaining five-hour and seven-day limits changes, and tells it how many agents and which models it can afford. Pro counts as tight sooner, a window about to reset counts one band lower, and API billing is named with the session cost. On a tight budget each new subagent is told to read excerpts and keep its report short.
- A `plan` setting (`auto`, `pro`, `max`, `team`, `enterprise`, `api`); `auto` tells a subscription from API billing by itself.

### Changed
- The orchestrator rules size the task first: small tasks are done directly, medium ones with one or two agents, large ones with the full squad. They pick a model per agent (Haiku for search, Sonnet for mechanical edits and checks, the session's model for design and review) and ask for short briefs and reports. The rules stay static so the system prompt keeps its cache.
- `/vanguard:orchestrate` starts with a "Size it" step and runs a smaller squad on a tight budget.
- The `recon`, `docs` and `ship-check` skills are sized to the task and to the `Vanguard budget:` note: a small change is checked directly without agents, recon sends one scout to a small repo or on a tight budget, and docs skip lookups for stable APIs and reuse docs already fetched.
- The `verifier` agent runs on Sonnet. The architect, builder, reviewer and verifier keep their reports under 250 words.
- The bundled MCP servers are pinned to fixed versions (`@playwright/mcp@0.0.83`, `server-sequential-thinking@2026.8.31`) instead of `@latest`, so a new release cannot change them unannounced.

## [1.2.2] - 2026-10-14

### Fixed
- Limits line up on the desktop: labels, bars and percentages sit in fixed columns instead of space padding, which a proportional face ignores, so a label no longer wraps onto two lines. A note that does not fit beside its bar goes under it.

### Changed
- An agent's name ends with `›`, so it reads as the button that opens the agent's page.

## [1.2.1] - 2026-10-14

### Fixed
- The pane drew nothing on Claude Code before 2.1.295: an agent's name is now a plain button label, which every engine accepts.

## [1.2.0] - 2026-10-14

### Added
- The squad comes alive: the main agent and each subagent are drawn as characters, one per role (scout, architect, builder, reviewer, verifier, guide, fighter, commander), animated by what they are doing right now: reading, searching, editing, running a command, on the web, delegating, planning or thinking. A finished agent takes a bow on the stage before it moves to the list.
- Agent pages: click an agent's name to see its task, its last tool calls, the tools it used most and the report it handed back. The main agent has a page too.

### Changed
- A calmer, steadier pane. It redraws only when something on screen changes (running times now tick by the minute), and portraits animate in their own frames, so nothing jumps.
- One spacing scale and fluid columns, so the layout keeps its shape at any width and while the pane is resized. Frames are kept for the agent cards only.
- The overview's five tiles became one line of figures; the main agent, the limits and the context guard moved into the squad and the limits section.
- The language switcher moved to the Achievements tab, next to your level.

### Removed
- The running stripe on working agents, the spinners and pulses, the sparklines and the fold buttons on sections.

## [1.1.0] - 2026-10-09

### Added
- The pane in 10 languages: English, Russian, Chinese, Hindi, Spanish, Portuguese, Japanese, Korean, German and French.
- A language switcher in the tab row: a native list on the desktop, a cycling button on the terminal. The choice is kept in the profile.
- A `language` setting (default `auto`, which follows `LC_ALL`, `LC_MESSAGES` or `LANG`).

### Changed
- Journal lines and banners store message keys, so earlier events switch language along with the pane.
- The default interface language is now the system's, with English as the fallback (it was Russian).

## [1.0.0] - 2026-10-09

### Added
- Live pane with five tabs: Overview, Context, Arsenal, Achievements and Journal. It works in the terminal and the desktop app, and adapts its layout to the pane's width.
- Orchestrator rules in the system prompt, which can be turned off in settings.
- Five agents: `scout`, `architect`, `builder`, `reviewer` and `verifier`.
- Four skills: `orchestrate`, `recon`, `docs` and `ship-check`.
- Bundled MCP servers: Context7, Sequential Thinking and Playwright.
- Context guard: every compaction keeps the plan and writes a snapshot to `~/.claude/handoffs/`. Adds `/handoff`.
- Lifetime profile with levels, XP and eleven achievements, shared across sessions and projects.
- Settings for the orchestrator, opening at start, animations, sound, context thresholds and visible tabs.

[1.3.0]: https://github.com/XXX1694/Vanguard/releases/tag/v1.3.0
[1.2.2]: https://github.com/XXX1694/Vanguard/releases/tag/v1.2.2
[1.2.1]: https://github.com/XXX1694/Vanguard/releases/tag/v1.2.1
[1.2.0]: https://github.com/XXX1694/Vanguard/releases/tag/v1.2.0
[1.1.0]: https://github.com/XXX1694/Vanguard/releases/tag/v1.1.0
[1.0.0]: https://github.com/XXX1694/Vanguard/releases/tag/v1.0.0
