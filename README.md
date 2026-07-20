# Execution Service

Execution Service for Tech Challenge FIAP Phase 4.

Built with [Bun](https://bun.sh), [Hono](https://hono.dev), and TypeScript.

## Quick Start

```bash
bun install
bun run dev
```

The server starts on `http://localhost:3000` by default (override with `PORT` env var).
MongoDB readiness checks are disabled by default for local scaffold compatibility; set `MONGODB_READINESS_ENABLED=true` when running with a local or deployed MongoDB instance.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness probe |
| `GET` | `/ready` | Readiness probe |
| `POST` | `/execution-tasks` | Create an execution task (supports `X-Correlation-Id` and `Idempotency-Key`) |
| `GET` | `/execution-tasks/:taskId` | Read an execution task |
| `PATCH` | `/execution-tasks/:taskId/status` | Advance execution task status |

## Scripts

```bash
bun run dev           # hot-reload dev server
bun test              # run tests
bun run test:coverage # run tests with coverage
bun run lint          # type-check
bun run check         # lint + test
bun run build         # bundle to dist/
```

## Docker

```bash
docker build -t execution-service .
docker run -p 3000:3000 execution-service
```

Run a local MongoDB instance for dependency-backed readiness:

```bash
docker run --rm --name execution-mongodb -p 27017:27017 -d mongo:7
MONGODB_READINESS_ENABLED=true bun run dev
```

## Documentation

- [docs/development.md](docs/development.md) — local development guide
- [openapi/openapi.yaml](openapi/openapi.yaml) — API specification
- [openspec/changes/](openspec/changes/) — OpenSpec governance changes

## OpenSpec

Active changes are tracked under `openspec/changes/`; archived specifications live under `openspec/specs/`.
