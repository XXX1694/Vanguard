---
name: orchestrate
description: Plan and run a squad of Vanguard agents for a large task - recon with scouts, a plan from the architect, parallel builders, then reviewer and verifier. Use when a task spans several files or areas, or the user asks to "orchestrate", "fan out", "split the work" or "use the squad".
---

# Orchestrate a squad

Run a large task as a Vanguard squad. You lead; agents do the bulk work.

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
- Prefer three well-briefed agents to ten vague ones.
- The user's instructions and the project's CLAUDE.md win over this playbook.
