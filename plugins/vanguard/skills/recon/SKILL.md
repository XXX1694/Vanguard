---
name: recon
description: Map an unfamiliar codebase fast with parallel scouts - stack, entry points, structure, how it is built and tested, and where a given feature lives. Use when starting in a new repository or when the user asks "how is this project organised" or "where is X".
---

# Recon

Map the codebase without flooding the main thread.

1. Read the top level yourself: README, manifest files (package.json, pubspec.yaml, go.mod, Cargo.toml, pyproject.toml), CLAUDE.md, CI config.
2. Launch three to five `scout` agents in one message, each owning one question:
   - entry points and request or app flow,
   - data layer and external services,
   - build, test and deploy commands,
   - the specific feature the user asked about, if any.
3. Merge their reports into one map:
   - **Stack**, **Layout** (the top folders and what each holds), **Run and test** commands, **Key flows** with `path:line` anchors, and **Gotchas**.
4. Offer to save the map to the project's CLAUDE.md. Do it only if the user agrees.
