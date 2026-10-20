---
name: ship-check
description: The gate before calling work done - review the diff, run the checks, verify the behaviour (in a browser for UI) and report what is proven. Use when the user says "is it ready", "ship it", "проверь перед мержем", or before any commit, PR or release you were asked to make.
---

# Ship check

Do not report work as done on belief. Prove it.

1. **Scope.** List what changed (`git status`, `git diff --stat`).
2. **Size the check to the change.**
   - **Small** (a few lines, docs, config, one file, no risky area): run the relevant test, lint or type check yourself and read the diff once. No agents.
   - **Normal**: `vanguard:verifier` for tests, type checks and lint, and for a web UI change the changed flow in a browser through the playwright MCP tools. Add `vanguard:reviewer` when the diff touches security, data, money, concurrency, migrations or a public API, or is over ~200 lines. Launch them in one message.
   - When a `Vanguard budget:` note says `tight` or `critical`, run the checks yourself and review only the riskiest file.
3. **Fix** each real finding: small fixes yourself, larger ones with a focused `vanguard:builder`. Then re-run only the checks that failed.
4. **Report**, with three lists:
   - **Verified**: the command or step, and the result.
   - **Not verified**: and why.
   - **Known issues**: anything left.

Never claim a check passed that was not run.
