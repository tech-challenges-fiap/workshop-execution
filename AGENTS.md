# AGENTS.md — Execution Service

Guidance for AI coding agents working in this repository.

## Repository Purpose

This is the **Execution Service** for Tech Challenge FIAP Phase 4. Its responsibility
is to receive, queue, track, and report on workflow executions. It is a standalone
HTTP service; do not couple it to other services at the code level.

## Technology Stack

- **Runtime:** Bun 1.x
- **Framework:** Hono 4.x
- **Language:** TypeScript (strict mode)
- **Testing:** Bun's built-in test runner (`bun:test`)

## Key Conventions

1. **TypeScript strict mode** — all files under `src/` must pass `bun run lint`
   (`tsc --noEmit`) with zero errors.
2. **Test every route** — every Hono router file should have a co-located `*.test.ts`.
3. **No speculative code** — do not add abstractions, helpers, or features not
   required by the current OpenSpec change.
4. **English everywhere** — comments, docs, commit messages, and variable names in
   English only.
5. **OpenSpec governance** — any change that adds or modifies an API endpoint must
   include or reference an OpenSpec change under `openspec/changes/`.

## Development Workflow

```bash
bun install          # install dependencies
bun run dev          # start dev server with hot-reload
bun test             # run tests
bun run lint         # type-check
bun run check        # full pre-commit gate (lint + test)
```

## Directory Map

```
src/
  index.ts          — app entrypoint, server export
  routes/           — Hono routers (one file per domain area)
openapi/
  openapi.yaml      — authoritative OpenAPI 3.1 spec
openspec/
  changes/          — OpenSpec governance proposals
docs/               — developer documentation
```

## What NOT to Do

- Do not push directly to `main`; open a PR.
- Do not add `console.log` to production code paths.
- Do not introduce MongoDB or any database until the relevant OpenSpec change is merged.
- Do not skip `bun run check` before committing.
