# f4-execution-service-scaffold — Design

## Repository Layout

```
workshop-execution/
├── .env.example
├── .gitignore
├── .github/
│   └── workflows/
│       └── ci.yml
├── Dockerfile
├── README.md
├── AGENTS.md
├── package.json
├── tsconfig.json
├── openapi/
│   └── openapi.yaml          # OpenAPI 3.1 spec (placeholder)
├── openspec/
│   └── changes/
│       └── f4-execution-service-scaffold/
│           ├── proposal.md
│           ├── tasks.md
│           └── design.md     # this file
├── docs/
│   ├── README.md
│   └── development.md
└── src/
    ├── index.ts              # Hono app + Bun server export
    └── routes/
        ├── health.ts         # /health and /ready
        └── health.test.ts
```

## HTTP Contract

### `GET /health`

Liveness probe. Kubernetes (or any orchestrator) uses this to know if the process
should be restarted. Returns `200` as long as the process is running.

```
200 OK
{ "status": "ok", "service": "execution-service" }
```

### `GET /ready`

Readiness probe. Kubernetes uses this to decide whether to route traffic here.
Future iterations will check downstream dependencies (DB, queue) before returning
`200`; for now it mirrors `/health`.

```
200 OK
{ "status": "ready", "service": "execution-service" }
```

503 is reserved for when the service is initialising or a dependency is unavailable.

## Technology Choices

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Runtime | Bun 1.x | Workshop standard; faster install/test cycle than Node |
| Framework | Hono 4.x | Lightweight, TypeScript-first, good Bun compatibility |
| Language | TypeScript (strict) | Type safety, consistency with other services |
| Containerisation | oven/bun:1.2-alpine | Minimal image size; matches runtime |

## Toolchain Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `bun run --watch src/index.ts` | Hot-reload development server |
| `start` | `bun run src/index.ts` | Production start (pre-build) |
| `build` | `bun build … --outdir dist` | Bundle for container |
| `test` | `bun test` | Run all `*.test.ts` files |
| `test:coverage` | `bun test --coverage` | Coverage report |
| `lint` | `bunx tsc --noEmit` | Type-check without emitting |
| `check` | `lint && test` | Full pre-commit gate |

## CI Pipeline

Single workflow (`.github/workflows/ci.yml`) triggered on `push` and `pull_request`
targeting `main`. Steps: install → lint → test → build.

Coverage enforcement and Docker image push are deferred to a future OpenSpec change
once an image registry is agreed.

## Future Extension Points

The following are **not** part of this change but the scaffold is shaped to accommodate them:

- `src/routes/` — add new domain routers here, registered in `src/index.ts`
- `src/lib/` — shared utilities (db client, logger, config)
- `src/domain/` — business logic, models
- `openapi/openapi.yaml` — extend with new paths as endpoints are added
