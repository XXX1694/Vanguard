---
name: ship-check
description: The gate before calling work done - review the diff, run the checks, verify the behaviour (in a browser for UI) and report what is proven. Use when the user says "is it ready", "ship it", "проверь перед мержем", or before any commit, PR or release you were asked to make.
---

# Ship check

Do not report work as done on belief. Prove it.

1. **Scope.** List what changed (`git status`, `git diff --stat`).
2. **In parallel**, in one message:
   - `vanguard:reviewer` on the diff, for defects.
   - `vanguard:verifier` for tests, type checks and lint, and for a web UI change the changed flow in a browser through the playwright MCP tools.
3. **Fix** each real finding with a focused `vanguard:builder`, then re-run only the checks that failed.
4. **Report**, with three lists:
   - **Verified**: the command or step, and the result.
   - **Not verified**: and why.
   - **Known issues**: anything left.

Never claim a check passed that was not run.
