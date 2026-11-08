# Vanguard plugin

This folder is the plugin. The full documentation and install steps are in the [repository README](../../README.md).

| Path | What it holds |
| --- | --- |
| `.claude-plugin/plugin.json` | Manifest and settings (`userConfig`) |
| `hooks/register.tsx` | The live pane, the orchestrator rules, the context guard, the command guard and the profile |
| `hooks/lib.ts` | Pure helpers, covered by tests, including `guardVerdict` (the command guard's rules) and `budgetBand` / `budgetNote` (smart orchestration) |
| `hooks/icons.ts` | Icons, logo and animated SVGs |
| `hooks/i18n.ts` | Interface strings in 10 languages |
| `types/index.d.ts` | The plugin's state contract |
| `agents/` | `scout`, `architect`, `builder`, `reviewer`, `verifier` |
| `skills/` | `orchestrate`, `recon`, `docs`, `ship-check` |
| `.mcp.json` | Context7, Playwright |
| `sounds/` | The achievement chime |
| `tests/` | Run with `claude plugin test plugins/vanguard` |

## Smart orchestration

`orchestratorRules` is static text in a `session` section of `prompt.compose`, so the cached system prompt never changes mid-session. It tells the model to size the task (small: no agents; medium: one or two; large: the squad), pick a model per agent and keep briefs and reports short.

The live part rides `classic.UserPromptSubmit`: from the latest `session.measure` reading, `resolvePlan` (the `plan` setting, or `auto`: rate limits mean a subscription, cost without limits means API billing) and `budgetBand` (`plenty` / `tight` / `critical` from the five-hour and seven-day windows, Pro 10 points stricter, a window resetting within 15 minutes one band lower) give a one-line `Vanguard budget:` note. It is added only when the plan or the band changes, and not on a first prompt where all is well. On `tight` or `critical`, `classic.SubagentStart` tells each new subagent to read excerpts and report briefly. Tests: `tests/budget.test.ts`.

## Command guard

A `classic.PreToolUse` hook screens every tool call, from the main agent and from subagents:

- **Ask**: `rm -rf`, `find -delete`, `git push --force`, `git reset --hard`, `git clean -f`, `git branch -D`, `sudo`, `chmod -R 777`, `curl ... | sh`, `terraform destroy`, `kubectl delete`, `npm publish`, SQL `DROP`/`TRUNCATE`, and reading or editing secrets (`.env*` but not `.env.example`, keys, `~/.ssh`, `~/.aws`, `.npmrc`, `credentials`).
- **Deny**: `rm -rf /` or `~`, `mkfs`, `dd` onto a disk device, a fork bomb, `chmod -R 777 /`.

The rules are `guardVerdict` in `hooks/lib.ts`, tested in `tests/guard.test.ts`. A guard error never blocks a call. Turn it off with the `guard` setting.

## Limiter

The `limiter` atom (true by default; `false` is kept in the profile) is flipped by the pane's `limiter` button and `/limiter`. Off, a `tool.check` hook turns every `ask` verdict into `allow` unless the organization set a ceiling, the guard keeps only its `deny` rules, and `prompt.compose` adds the `vanguard:limiter` section (`limiterOffRules` in `hooks/lib.ts`). A failing hook leaves the verdict beneath, so a broken limiter asks. Tests: `tests/limiter.test.ts`.
