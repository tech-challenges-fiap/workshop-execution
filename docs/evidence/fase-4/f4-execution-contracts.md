# Evidence: f4-execution-contracts

## Summary

Implemented Execution Service-owned HTTP/domain contracts for execution tasks without RabbitMQ publication or consumption.

## Scope completed

- Added `POST /execution-tasks` with JSON validation, generated task IDs, optional `X-Correlation-Id`, and optional `Idempotency-Key` support.
- Added idempotent creation behavior returning the existing task with HTTP 200 for repeated idempotency keys.
- Added `GET /execution-tasks/:taskId` read contract.
- Added `PATCH /execution-tasks/:taskId/status` with validation and allowed transition enforcement.
- Extended the MongoDB repository boundary with `workflowId`, correlation/idempotency metadata, a sparse unique idempotency index, and idempotency lookup.
- Updated OpenAPI and development documentation.
- Preserved health/readiness compatibility; default MongoDB readiness remains skipped unless enabled.

## Validation results

| Command | Result |
| --- | --- |
| `npx --yes @fission-ai/openspec validate f4-execution-contracts --strict` | Passed: `Change 'f4-execution-contracts' is valid` |
| `bun run lint` | Passed: `tsc --noEmit` completed with exit code 0 |
| `bun test` | Passed: 21 pass, 0 fail, 65 expectations |
| `bun run build` | Passed: bundled `src/index.ts` to `dist/index.js` |
| `bun run test:coverage` | Passed: 21 pass, 0 fail; all files coverage 91.91% funcs / 89.88% lines |
| `bun run check` | Passed: lint + tests, 21 pass, 0 fail |

## Notes

RabbitMQ event consumption/publication and saga orchestration were intentionally left out for the later `f4-execution-rabbitmq-events` work.
