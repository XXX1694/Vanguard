# Contributing to Vanguard

Thanks for helping. Bug reports, ideas and pull requests are all welcome.

## Reporting a bug
Open an [issue](https://github.com/XXX1694/Vanguard/issues/new/choose) using the bug template. Include:
- your Claude Code version (`claude --version`);
- whether it happened in the terminal or the desktop app;
- what you did, what you expected and what happened, with a screenshot of the pane if it is visual.

## Proposing a change
1. Fork the repository and create a branch from `main`.
2. Make your change in `plugins/vanguard/`.
3. Check it:
   ```bash
   claude plugin validate .
   claude plugin validate plugins/vanguard
   claude plugin test plugins/vanguard
   ```
4. Try it live: `claude --plugin-dir plugins/vanguard`, then run `/vanguard`.
5. Open a pull request against `main` and describe what changed and how you checked it.

`main` is protected. Changes land only through pull requests reviewed by the maintainer.

## Style
- TypeScript in `hooks/` is formatted with Prettier defaults.
- Keep pure logic in `hooks/lib.ts` and cover it with a test in `tests/`.
- UI changes should work on both the `terminal` and the `desktop` surface. Tests mount the pane on both.
- Agents and skills are Markdown with YAML front matter. Keep each focused on one job.
