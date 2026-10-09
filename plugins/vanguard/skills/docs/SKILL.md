---
name: docs
description: Fetch current, version-accurate documentation for a library, framework, SDK or CLI through the Context7 MCP server instead of relying on memory. Use when writing code against an external API, when an API may have changed, or when the user asks for the docs of something.
---

# Current docs

1. Work out the library and, when the project pins one, its version (lockfile or manifest).
2. Resolve it with the context7 `resolve-library-id` tool, then fetch the topic you need with `get-library-docs` (or the tools the server lists under those names). Keep the topic narrow: one API or one guide.
3. Answer from what you fetched and name the version. If Context7 does not know the library, say so and fall back to the official site with WebFetch.
4. When a builder needs the API, put the relevant excerpt in its brief so it does not have to look it up again.
