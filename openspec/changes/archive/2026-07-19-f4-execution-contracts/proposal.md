# Change: Execution HTTP/domain contracts

## Why

Later saga integration needs a stable Execution Service-owned contract for creating, reading, and advancing execution tasks before RabbitMQ event flows are introduced. The service must validate requests, persist task state through the MongoDB repository boundary, expose correlation and idempotency metadata, and document the API in OpenAPI.

## What Changes

- Add REST endpoints for execution task creation, lookup, and status updates.
- Define execution task request/response validation, status transition rules, correlation identifiers, and idempotency-key behavior.
- Extend the MongoDB repository boundary with fields and lookups needed by the HTTP contract.
- Update OpenAPI with the execution task contract schemas and error responses.
- Add tests for route contract behavior, validation failures, idempotent creation, status transitions, repository mapping, and readiness compatibility.

## Non-Goals

- Do not publish or consume RabbitMQ events.
- Do not implement saga orchestration across services.
- Do not add authentication or authorization middleware.
- Do not couple to another service's database or domain models.
