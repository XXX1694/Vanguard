# Changelog

All notable changes to Vanguard are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [1.2.0] - 2026-10-10

### Added
- A finished subagent stays in the squad for a few seconds with its outcome (done, failed, stopped), then moves to the Journal.
- The context guard raises one toast when the context first turns critical. It re-arms once the context drops below the warning.
- A `/handoff` button in the band while the context is past the warning, and the `h` hotkey on it and on the pane's compact button.
- Handoff snapshots record the trigger, the fill in percent, each running agent's last action and the most recently finished agents.

### Changed
- Several achievements unlocked together share one toast, and chimes are at least 15 seconds apart.
- Achievements earned by past sessions are recorded quietly at session start, without a toast or a sound.
- Below 110 columns the overview's tiles go three to a row. The band shows at most five model icons, then `+N`.

### Fixed
- A subagent whose loop ended without a `turn.complete` no longer stays "running" forever. It is marked stopped once the engine's agent list drops it.
- Early actions of a subagent are no longer lost when the agent list reports it before its spawn resolves.
- The squad no longer grows without bound: old finished agents become counters, and totals, streaks and the profile stay right.
- The 5-hour forecast survives a window reset. A passed reset shows a fresh window instead of a stale reading, and a spend limit past 100% no longer shows a negative "left".
- Inverted or non-numeric context thresholds are corrected instead of leaving the guard stuck on one colour.
- Two compactions within one minute no longer overwrite each other's snapshot.
- The observer hooks (`agent.spawn`, `tool.call`, `session.compact`) carry an explicit fail-open `.catch`, and `/vanguard` no longer fails when the pane cannot open.

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

[1.2.0]: https://github.com/XXX1694/Vanguard/releases/tag/v1.2.0
[1.1.0]: https://github.com/XXX1694/Vanguard/releases/tag/v1.1.0
[1.0.0]: https://github.com/XXX1694/Vanguard/releases/tag/v1.0.0
