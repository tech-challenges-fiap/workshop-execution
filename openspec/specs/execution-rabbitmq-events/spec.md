# execution-rabbitmq-events Specification

## Purpose
Defines the Execution Service RabbitMQ messaging foundation for future saga integration, including runtime configuration, versioned event envelopes, inbound execution task handling through Execution-owned repositories, outbound status event publication, and idempotent duplicate handling without requiring a live broker in tests.
## Requirements
### Requirement: RabbitMQ runtime configuration

The Execution Service SHALL provide environment-based RabbitMQ configuration for event-driven integration without requiring a live broker during automated tests.

#### Scenario: Defaults are available for local development

- **GIVEN** no RabbitMQ environment variables are set
- **WHEN** messaging configuration is loaded
- **THEN** the service uses a local RabbitMQ URL
- **AND** it uses Execution-owned exchange, command queue, and status routing key names
- **AND** live consumption is disabled by default

#### Scenario: Environment values override defaults

- **GIVEN** RabbitMQ environment variables are set
- **WHEN** messaging configuration is loaded
- **THEN** those values are used by the messaging boundary

### Requirement: Versioned event envelope

The Execution Service SHALL parse and serialize RabbitMQ messages using a versioned JSON envelope containing `eventId`, `correlationId`, `schemaVersion`, `producer`, `type`, `occurredAt`, and `payload`.

#### Scenario: Valid envelope is parsed

- **GIVEN** a RabbitMQ message body contains a supported envelope and valid payload
- **WHEN** the message parser runs
- **THEN** it returns a typed message for the requested execution action

#### Scenario: Invalid envelope is rejected

- **GIVEN** a message is malformed, has missing envelope metadata, an unsupported schema version, an unknown type, or an invalid payload
- **WHEN** the message parser runs
- **THEN** it rejects the message with a validation error

### Requirement: Inbound execution task messages

The Execution Service SHALL handle inbound execution messages by creating or updating execution task records through the Execution-owned repository boundary only.

#### Scenario: Create message creates a queued task

- **GIVEN** an `execution.task.create.requested` message has a workflow identifier and JSON input
- **WHEN** the inbound handler processes it
- **THEN** a queued task is created through the Execution repository
- **AND** the envelope `eventId` is used as the idempotency key
- **AND** the envelope `correlationId` is stored on the task
- **AND** no OS or Billing database is accessed

#### Scenario: Duplicate create message is idempotent

- **GIVEN** a task already exists for the inbound message `eventId`
- **WHEN** the same create message is processed again
- **THEN** the existing task is returned without creating a duplicate record

#### Scenario: Status update message updates a task

- **GIVEN** an `execution.task.status.update.requested` message targets an existing task
- **WHEN** the requested transition is valid
- **THEN** the Execution repository persists the new status and optional terminal details

#### Scenario: Repeated status message is idempotent

- **GIVEN** a task already has the requested status
- **WHEN** the same status update message is processed again
- **THEN** the handler treats it as already applied and does not fail the message

### Requirement: Outbound execution status events

The Execution Service SHALL publish execution-owned status events through an injectable RabbitMQ publisher boundary after inbound task creation or status update handling succeeds.

#### Scenario: Status event is published after create

- **GIVEN** an inbound create message creates or returns a queued task
- **WHEN** handling succeeds
- **THEN** an `execution.task.status.changed` event is serialized with the same correlation identifier
- **AND** it includes the task identifier, workflow identifier, status, timestamps, and optional status details

#### Scenario: Status event is published after update

- **GIVEN** an inbound status update message is applied or already applied
- **WHEN** handling succeeds
- **THEN** an `execution.task.status.changed` event is published for the current task state

