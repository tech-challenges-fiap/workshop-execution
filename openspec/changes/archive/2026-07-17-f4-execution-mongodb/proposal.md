# Change: Execution-owned MongoDB persistence foundation

## Why

The Execution Service needs its own NoSQL persistence boundary before execution contracts, orchestration, or RabbitMQ event flows are added. The service must be able to connect to a MongoDB database it owns, expose readiness that reflects database availability, and provide a repository abstraction for execution-owned task records without coupling to other services.

## What Changes

- Add configuration for the Execution Service MongoDB connection, database, collection, connection timeout, and optional readiness bypass for local development/tests.
- Add a MongoDB client lifecycle module that connects lazily, verifies connectivity with `ping`, and can close the client cleanly.
- Add an execution-owned task record model and repository with basic create/read/update operations needed by future execution-domain changes.
- Update readiness semantics so `GET /ready` reports MongoDB dependency state when readiness checks are enabled.
- Document local Docker/MongoDB usage and environment variables.
- Add tests for configuration parsing, MongoDB client readiness behavior, repository behavior, and readiness responses.

## Non-Goals

- Do not define or implement public execution API contracts.
- Do not publish or consume RabbitMQ events.
- Do not integrate with authentication, workflow service models, or external service persistence.
- Do not add migration tooling beyond MongoDB collection/index initialization required by the repository foundation.
