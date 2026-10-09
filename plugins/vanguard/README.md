# Vanguard plugin

This folder is the plugin. The full documentation and install steps are in the [repository README](../../README.md).

| Path | What it holds |
| --- | --- |
| `.claude-plugin/plugin.json` | Manifest and settings (`userConfig`) |
| `hooks/register.tsx` | The live pane, the orchestrator rules, the context guard and the profile |
| `hooks/lib.ts` | Pure helpers, covered by tests |
| `hooks/icons.ts` | Icons, logo and animated SVGs |
| `hooks/i18n.ts` | Interface strings in 10 languages |
| `types/index.d.ts` | The plugin's state contract |
| `agents/` | `scout`, `architect`, `builder`, `reviewer`, `verifier` |
| `skills/` | `orchestrate`, `recon`, `docs`, `ship-check` |
| `.mcp.json` | Context7, Sequential Thinking, Playwright |
| `sounds/` | The achievement chime |
| `tests/` | Run with `claude plugin test plugins/vanguard` |
