# Changelog

All notable changes to Vanguard are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

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

[1.2.2]: https://github.com/XXX1694/Vanguard/releases/tag/v1.2.2
[1.2.1]: https://github.com/XXX1694/Vanguard/releases/tag/v1.2.1
[1.2.0]: https://github.com/XXX1694/Vanguard/releases/tag/v1.2.0
[1.1.0]: https://github.com/XXX1694/Vanguard/releases/tag/v1.1.0
[1.0.0]: https://github.com/XXX1694/Vanguard/releases/tag/v1.0.0
