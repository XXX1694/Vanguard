---
name: docs
description: Fetch current, version-accurate documentation for a library, framework, SDK or CLI through the Context7 MCP server instead of relying on memory. Use when writing code against an external API, when an API may have changed, or when the user asks for the docs of something.
---

# Current docs

1. Work out the library and, when the project pins one, its version (lockfile or manifest).
2. Use the context7 MCP tools: first resolve the library to its Context7 id, then fetch the docs for the topic you need (the docs tool is `query-docs` in current Context7 builds, `get-library-docs` in older ones). Keep the topic narrow: one API or one guide.
3. Answer from what you fetched and name the version. If Context7 does not know the library, say so and fall back to the official site with WebFetch.
4. When a builder needs the API, put the relevant excerpt in its brief so it does not have to look it up again.
