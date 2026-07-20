# f4-execution-service-scaffold — Tasks

## Status Legend

`[ ]` not started · `[x]` complete · `[-]` skipped/deferred

---

## Scaffold Tasks

- [x] Create `.gitignore`
- [x] Create `package.json` with Bun/Hono/TypeScript and scripts: `dev`, `start`, `build`, `test`, `test:coverage`, `lint`, `check`
- [x] Create `tsconfig.json` (strict, ESNext, bundler module resolution)
- [x] Create `src/index.ts` — Hono app entry point, configurable `PORT`
- [x] Create `src/routes/health.ts` — `GET /health` and `GET /ready`
- [x] Create `src/routes/health.test.ts` — unit tests for both endpoints
- [x] Create `Dockerfile` — multi-stage build with `oven/bun:1.2-alpine`
- [x] Create `.env.example`
- [x] Create `openapi/openapi.yaml` — OpenAPI 3.1 placeholder for health endpoints

## Documentation Tasks

- [x] Create `README.md`
- [x] Create `AGENTS.md`
- [x] Create `docs/README.md`
- [x] Create `docs/development.md`

## OpenSpec Tasks

- [x] Create `openspec/changes/f4-execution-service-scaffold/proposal.md`
- [x] Create `openspec/changes/f4-execution-service-scaffold/tasks.md` (this file)
- [x] Create `openspec/changes/f4-execution-service-scaffold/design.md`
- [x] Create `openspec/changes/f4-execution-service-scaffold/specs/service-scaffold/spec.md`

## CI Tasks

- [x] Create `.github/workflows/ci.yml` — lint, test, build on push/PR

## Validation

- [x] `bun install` succeeds — passes with Bun v1.3.14
- [x] `npm install` succeeds as a dependency-resolution fallback
- [x] `npx tsc --noEmit` passes as the local TypeScript validation proxy
- [x] `bun run lint` passes — passes with Bun v1.3.14
- [x] `bun test` passes — passes with Bun v1.3.14: 2 pass, 0 fail
- [x] `bun run build` produces `dist/` — passes with Bun v1.3.14
- [x] `npx --yes @fission-ai/openspec validate f4-execution-service-scaffold --strict` passes
