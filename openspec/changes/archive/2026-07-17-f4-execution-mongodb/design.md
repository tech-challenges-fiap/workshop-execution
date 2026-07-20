# Design: Execution-owned MongoDB persistence foundation

## Overview

This change introduces the persistence foundation owned by the Execution Service. MongoDB is treated as an infrastructure dependency of this service only. The design intentionally stops at internal persistence primitives and readiness semantics so later changes can add execution contracts and asynchronous event flows independently.

## Configuration

The service reads MongoDB settings from environment variables:

- `MONGODB_URI`: MongoDB connection string.
- `MONGODB_DB_NAME`: database owned by the Execution Service.
- `MONGODB_TASKS_COLLECTION`: collection for execution-owned task records.
- `MONGODB_CONNECT_TIMEOUT_MS`: connection and server selection timeout.
- `MONGODB_READINESS_ENABLED`: when `true`, readiness requires a successful MongoDB ping; when `false`, readiness remains dependency-skipped for local scaffolding/tests.

The readiness flag allows CI and local tests to run without requiring a MongoDB container while still making production-like environments fail readiness when MongoDB is unavailable.

## Client Lifecycle

A small MongoDB client module owns connection creation, reuse, ping checks, and shutdown. The client connects lazily so importing the Hono app does not open sockets during tests or builds. `ping` uses the MongoDB admin command and returns structured dependency status instead of throwing through the HTTP route.

## Data Model

The repository stores `ExecutionTaskRecord` documents in the execution-owned tasks collection. The initial model contains internal tracking fields only:

- `taskId`: stable service-owned task identifier.
- `status`: `queued`, `running`, `completed`, or `failed`.
- `input`: arbitrary JSON payload captured by future execution contracts.
- `result`: optional arbitrary JSON result.
- `errorMessage`: optional failure detail.
- `createdAt` and `updatedAt`: timestamps managed by the repository.

No public execution endpoint or message contract is introduced by this change.

## Repository

`MongoExecutionTaskRepository` exposes minimal operations needed by future execution flows:

- `create(record)` inserts a new task record and initializes timestamps.
- `findByTaskId(taskId)` reads one task record.
- `updateStatus(taskId, status, patch)` updates status, result, error detail, and `updatedAt`.
- `ensureIndexes()` creates a unique index on `taskId`.

Tests use fake collections/client factories where practical so validation does not require a running MongoDB instance.

## Readiness Semantics

`GET /health` remains liveness-only and never checks MongoDB. `GET /ready` reports `status: "ready"` with dependency details when MongoDB is reachable or checks are disabled. When checks are enabled and MongoDB ping fails, it returns HTTP 503 with `status: "not_ready"` and a MongoDB dependency status.
