# Design: Execution RabbitMQ events

## Messaging boundary

Execution owns a RabbitMQ boundary for asynchronous saga integration. The boundary is intentionally internal and does not add HTTP endpoints. Message handlers depend only on Execution-owned contracts and the Execution task repository, so they never read or write OS/Billing databases.

## Runtime configuration

Configuration is environment-based with local defaults:

- `RABBITMQ_URL` for the broker URL.
- `RABBITMQ_EXCHANGE` for the topic exchange.
- `RABBITMQ_EXECUTION_COMMAND_QUEUE` for inbound execution commands.
- `RABBITMQ_EXECUTION_STATUS_ROUTING_KEY` for outbound status events.
- `RABBITMQ_CONSUMER_ENABLED` to opt into live consumption.

Tests exercise parsing and handler behavior through fakes; a live broker is not required.

## Event envelope

All messages use a versioned envelope:

- `eventId`: stable unique event identifier for idempotency.
- `correlationId`: distributed trace/correlation identifier.
- `schemaVersion`: supported version, initially `1`.
- `producer`: service or component that produced the message.
- `type`: event/command type.
- `occurredAt`: ISO-8601 timestamp.
- `payload`: JSON object validated per message type.

Envelope parsing rejects malformed JSON, missing required fields, unsupported schema versions, invalid timestamps, unknown message types, and invalid payloads.

## Inbound messages

The initial inbound types are:

- `execution.task.create.requested`: create a queued execution task for `workflowId` and `input`.
- `execution.task.status.update.requested`: update a task status with optional `result` or `errorMessage`.

Create messages use `eventId` as the repository idempotency key and propagate `correlationId`. Duplicate create messages return the existing task. Status update messages are idempotent when the requested status already exists; otherwise they reuse the same transition rules as the HTTP contract.

## Outbound messages

The publisher emits `execution.task.status.changed` messages through an injectable transport after a message handler creates or updates a task. Payloads include task identifiers, workflow identifier, status, optional terminal details, and timestamps.

## Deferred work

This change does not connect Execution into the full OS distributed saga. Live broker startup can be enabled by configuration, but tests do not require RabbitMQ and no cross-service database coupling is introduced.
