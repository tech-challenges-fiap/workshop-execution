# execution-contracts Specification

## ADDED Requirements

### Requirement: Execution task creation contract

The Execution Service SHALL expose an HTTP contract for creating execution-owned task records without publishing or consuming RabbitMQ events.

#### Scenario: Task is created with correlation metadata

- **GIVEN** a client has a workflow identifier and JSON input payload
- **AND** the client optionally sends `X-Correlation-Id` and `Idempotency-Key` headers
- **WHEN** it calls `POST /execution-tasks`
- **THEN** the service returns HTTP 201 for a newly created task
- **AND** the response includes a service-generated `taskId`, the provided `workflowId`, the provided `input`, status `queued`, timestamps, and any accepted correlation/idempotency metadata
- **AND** the task is stored through the Execution Service MongoDB repository boundary

#### Scenario: Create request is idempotent

- **GIVEN** a task was previously created with an `Idempotency-Key`
- **WHEN** a client retries `POST /execution-tasks` with the same `Idempotency-Key`
- **THEN** the service returns the existing task instead of creating a duplicate
- **AND** the response status is HTTP 200

#### Scenario: Invalid create request is rejected

- **GIVEN** a create request is missing `workflowId` or contains a non-JSON-object body
- **WHEN** it calls `POST /execution-tasks`
- **THEN** the service returns HTTP 400 with a structured validation error

### Requirement: Execution task read contract

The Execution Service SHALL expose an HTTP contract for reading execution-owned task records by task identifier.

#### Scenario: Existing task is returned

- **GIVEN** an execution task exists in the Execution Service repository
- **WHEN** a client calls `GET /execution-tasks/{taskId}`
- **THEN** the service returns HTTP 200
- **AND** the response maps the persisted task record to the public task representation

#### Scenario: Missing task returns not found

- **GIVEN** no execution task exists for the requested identifier
- **WHEN** a client calls `GET /execution-tasks/{taskId}`
- **THEN** the service returns HTTP 404 with a structured not-found error

### Requirement: Execution task status update contract

The Execution Service SHALL expose an HTTP contract for advancing execution-owned task status while enforcing service-owned transition rules.

#### Scenario: Valid status transition is persisted

- **GIVEN** an execution task is `queued`
- **WHEN** a client calls `PATCH /execution-tasks/{taskId}/status` with status `running`
- **THEN** the service returns HTTP 200
- **AND** the repository persists the new status and refreshed `updatedAt` timestamp

#### Scenario: Terminal status details are persisted

- **GIVEN** an execution task is `running`
- **WHEN** a client updates it to `completed` with a result or to `failed` with an error message
- **THEN** the service persists the terminal status details
- **AND** the response includes those details

#### Scenario: Invalid status transition is rejected

- **GIVEN** an execution task is already `completed`
- **WHEN** a client attempts to update it to another status
- **THEN** the service returns HTTP 409
- **AND** the persisted task is not modified

### Requirement: Execution contracts documentation

The Execution Service SHALL document execution task HTTP contracts in OpenAPI while preserving existing health and readiness probe behavior.

#### Scenario: OpenAPI includes execution task endpoints

- **GIVEN** a developer opens `openapi/openapi.yaml`
- **WHEN** they inspect the paths and schemas
- **THEN** it documents create, read, and status update execution task endpoints
- **AND** it documents validation, not-found, and conflict errors
- **AND** it does not document RabbitMQ event publication or consumption as part of this change

#### Scenario: Readiness remains compatible

- **GIVEN** MongoDB readiness checks are disabled by default
- **WHEN** a client calls `GET /ready`
- **THEN** the service continues to return ready with the MongoDB dependency marked as skipped
