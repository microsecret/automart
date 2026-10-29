<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Graph-first workflow

Before broad repository work, read `docs/PROJECT_GRAPH.md` and start from the
smallest relevant node. Use targeted `rg` queries only after selecting that
node. Update the graph whenever a source pipeline, API route, scheduled job or
major UI ownership boundary changes.

## User preference: review before release

The user explicitly requires code review for every completed change before
push and deployment. Review the final scoped diff for correctness, security,
error states, data exposure and likely regressions; fix material findings and
run checks appropriate to the change. Report findings honestly and distinguish
self-review from an independent review. Do not claim a review tool was used if
it was unavailable. Preserve this preference across future project tasks.
