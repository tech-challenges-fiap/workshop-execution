# Change: Execution RabbitMQ events

## Why

The OS distributed flow will require asynchronous coordination with the Execution Service. Before implementing end-to-end saga orchestration, Execution needs a service-owned RabbitMQ event foundation that can parse validated envelopes, apply inbound execution commands/events through Execution-owned contracts and repositories, publish execution status events, and handle message retries idempotently without coupling to other services' databases.

## What Changes

- Add RabbitMQ environment configuration for local/runtime queue, exchange, routing-key, and consumer toggles.
- Define a versioned event envelope with `eventId`, `correlationId`, `schemaVersion`, `producer`, `type`, `occurredAt`, and JSON `payload` parsing/serialization.
- Add inbound message handling for execution task creation and status-update messages using the Execution repository boundary.
- Add outbound execution status event publication through an injectable publisher boundary.
- Add idempotency behavior for duplicate create and status messages.
- Add unit tests and developer documentation for messaging contracts without requiring a live RabbitMQ broker.

## Non-Goals

- Do not implement OS distributed flow or saga orchestration across services.
- Do not access OS, Billing, or other services' databases.
- Do not require a live RabbitMQ broker in tests.
- Do not add or document new HTTP endpoints.
