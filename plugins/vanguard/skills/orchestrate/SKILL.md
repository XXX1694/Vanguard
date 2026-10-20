---
name: orchestrate
description: Plan and run a squad of Vanguard agents for a large task - recon with scouts, a plan from the architect, parallel builders, then reviewer and verifier. Use when a task spans several files or areas, or the user asks to "orchestrate", "fan out", "split the work" or "use the squad".
---

# Orchestrate a squad

Run a large task as a Vanguard squad. You lead; agents do the bulk work.

## 0. Size it
- Small or medium task (per the orchestration rules): do not run the full squad. Do it yourself, or with one or two agents where they save context.
- Pick the model per step: scouts `haiku`, builders `sonnet` unless the piece is design-heavy, architect and reviewer the main model.
- On a `tight` `Vanguard budget:` note: one agent for recon and one for prove, and skip the architect when the plan is obvious. On `critical`: no squad; finish the current step.

## 1. Recon (parallel)
Launch `vanguard:scout` agents in one message, one per area the task touches. Brief each with the exact question and the shape of the answer you want.

## 2. Plan
Give the scouts' findings to `vanguard:architect` and ask for workstreams with clear file ownership. Read the plan critically. If it is unclear or risky, settle it with the user before building.

## 3. Build (parallel)
Launch one `vanguard:builder` per independent workstream in a single message. Each brief carries the goal, the files it owns, the conventions to follow and how to verify. Hold dependent workstreams until the ones they need are done.

## 4. Prove
Run `vanguard:reviewer` on the combined diff and `vanguard:verifier` on the result, in parallel. Fix what they find with a focused builder, then check again.

## 5. Report
Tell the user what changed, what was verified and how, and what is left. Keep it short. The Vanguard pane shows the squad live, so do not narrate every launch.

## Guardrails
- Two builders never own the same file.
- Launch the fewest agents that do the job: three well-briefed agents beat ten vague ones, and none beats one for a job you can do in a few tool calls.
- The user's instructions and the project's CLAUDE.md win over this playbook.
