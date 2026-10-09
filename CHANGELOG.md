# Changelog

All notable changes to Vanguard are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

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

[1.0.0]: https://github.com/XXX1694/Vanguard/releases/tag/v1.0.0
