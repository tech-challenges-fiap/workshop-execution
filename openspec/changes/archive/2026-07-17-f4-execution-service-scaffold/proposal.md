# f4-execution-service-scaffold — Proposal

## Status

`draft`

## Summary

Establish the Execution Service repository scaffold for Tech Challenge FIAP Phase 4.
This change sets the foundational structure from which all subsequent execution-domain
work will grow. It does **not** introduce MongoDB, domain logic, or business endpoints.

## Motivation

Phase 4 requires a dedicated service to receive, queue, and track workflow executions.
Before any domain logic can be built, the team needs an agreed-upon repository layout,
health/readiness contract, Dockerfile shape, and CI baseline that every follow-on change
can depend on.

## Scope

**In scope:**
- Repository file layout (`src/`, `openapi/`, `openspec/`, `docs/`)
- Bun + Hono + TypeScript toolchain configuration
- Health (`GET /health`) and readiness (`GET /ready`) HTTP endpoints
- Dockerfile (multi-stage, `oven/bun` base)
- Lint, test, build, and coverage scripts
- OpenAPI placeholder (`openapi/openapi.yaml`)
- CI workflow skeleton (`.github/workflows/`)
- This OpenSpec change itself

**Out of scope:**
- MongoDB/database integration
- Execution domain models and endpoints
- Authentication / authorisation middleware
- Message queue integration

## Decision Drivers

- Consistency with other workshop Phase 4 services (Bun/Hono/TypeScript).
- Minimal surface area — no speculative abstractions.
- All scaffolding must pass `bun test` and `bun run lint` from day one.

## Alternatives Considered

| Option | Reason rejected |
|--------|----------------|
| Node + Express | Workshop standard is Bun/Hono; switching adds friction. |
| Deno | No precedent in existing repos. |
| Skeleton without tests | Would leave CI baseline undefined and invite drift. |

## Stakeholders

- Phase 4 engineering team
