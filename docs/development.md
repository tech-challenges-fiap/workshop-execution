# Development Guide

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Bun | ≥ 1.2 | `curl -fsSL https://bun.sh/install \| bash` |
| Docker | ≥ 24 | platform-specific |

## Setup

```bash
git clone <repo-url>
cd workshop-execution
cp .env.example .env
bun install
```

## Running Locally

```bash
bun run dev
# → Server listening on http://localhost:3000
```

Test the probes:

```bash
curl http://localhost:3000/health
# {"status":"ok","service":"execution-service"}

curl http://localhost:3000/ready
# {"status":"ready","service":"execution-service","dependencies":[{"name":"mongodb","status":"skipped"}]}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP listen port |
| `NODE_ENV` | `development` | Runtime environment |
| `MONGODB_URI` | `mongodb://localhost:27017` | Execution Service MongoDB URI |
| `MONGODB_DB_NAME` | `execution_service` | Execution-owned MongoDB database |
| `MONGODB_TASKS_COLLECTION` | `execution_tasks` | Execution-owned task records collection |
| `MONGODB_CONNECT_TIMEOUT_MS` | `5000` | MongoDB connect and server-selection timeout |
| `MONGODB_READINESS_ENABLED` | `false` | Require MongoDB `ping` for `/ready` when `true` |
| `RABBITMQ_URL` | `amqp://localhost:5672` | RabbitMQ broker URL for event integration |
| `RABBITMQ_EXCHANGE` | `execution.events` | Execution-owned topic exchange name |
| `RABBITMQ_EXECUTION_COMMAND_QUEUE` | `execution.commands` | Queue for inbound execution task messages |
| `RABBITMQ_EXECUTION_STATUS_ROUTING_KEY` | `execution.task.status.changed` | Routing key for outbound execution status events |
| `RABBITMQ_CONSUMER_ENABLED` | `false` | Opt in to live RabbitMQ consumption when supported by runtime wiring |

## Local MongoDB

Start a service-owned MongoDB instance with Docker:

```bash
docker run --rm --name execution-mongodb -p 27017:27017 -d mongo:7
```

Enable dependency-backed readiness against that instance:

```bash
MONGODB_READINESS_ENABLED=true bun run dev
curl http://localhost:3000/ready
# {"status":"ready","service":"execution-service","dependencies":[{"name":"mongodb","status":"ready"}]}
```

If MongoDB is unavailable while `MONGODB_READINESS_ENABLED=true`, `/ready` returns HTTP 503 and reports the MongoDB dependency as `not_ready`.

## Execution task API

Create a queued task with optional correlation and idempotency headers:

```bash
curl -X POST http://localhost:3000/execution-tasks \
  -H 'Content-Type: application/json' \
  -H 'X-Correlation-Id: correlation-123' \
  -H 'Idempotency-Key: create-order-123' \
  -d '{"workflowId":"workflow-123","input":{"orderId":"order-123"}}'
```

Read and advance task state:

```bash
curl http://localhost:3000/execution-tasks/<taskId>
curl -X PATCH http://localhost:3000/execution-tasks/<taskId>/status \
  -H 'Content-Type: application/json' \
  -d '{"status":"running"}'
```

Allowed status transitions are `queued -> running`, `queued -> failed`, `running -> completed`, and `running -> failed`.

## RabbitMQ event foundation

The service includes an internal RabbitMQ event boundary for saga integration. Automated tests use fake transports and do not require a live broker. Messages use a JSON envelope with `eventId`, `correlationId`, `schemaVersion`, `producer`, `type`, `occurredAt`, and a message-specific `payload`.

Initial inbound message types:

- `execution.task.create.requested` with `workflowId` and `input`. The handler creates a queued task through the Execution-owned repository and uses `eventId` as the idempotency key.
- `execution.task.status.update.requested` with `taskId`, `status`, optional `result`, and optional `errorMessage`. The handler applies the same status transition rules as the HTTP contract.

Successful inbound handling publishes an `execution.task.status.changed` envelope through the injectable publisher boundary. The implementation does not access OS, Billing, or other services' databases.

## Testing

```bash
bun test                # run all tests
bun run test:coverage   # with coverage report
```

Tests live alongside source files as `*.test.ts`.

## Type Checking

```bash
bun run lint            # tsc --noEmit
```

## Building

```bash
bun run build
# → dist/index.js
```

## Docker

Build:

```bash
docker build -t execution-service:local .
```

Run:

```bash
docker run --rm -p 3000:3000 execution-service:local
```

## Pre-commit Gate

Run this before every commit:

```bash
bun run check   # lint + test
```

## Project Conventions

See [AGENTS.md](../AGENTS.md) for full conventions enforced in this repository.
