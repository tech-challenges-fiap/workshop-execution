# mongodb-persistence Specification

## Purpose
Defines the Execution Service-owned MongoDB persistence foundation, including configuration, client lifecycle/readiness checks, internal task-record repository behavior, and local development documentation expectations.
## Requirements
### Requirement: MongoDB configuration

The Execution Service SHALL provide environment-based configuration for its own MongoDB database and task-record collection without requiring other services' persistence settings.

#### Scenario: Defaults are available for local development

- **GIVEN** no MongoDB environment variables are set
- **WHEN** the service loads persistence configuration
- **THEN** it uses a local MongoDB URI
- **AND** it uses an execution-owned database name
- **AND** it uses an execution-owned task-record collection name
- **AND** readiness dependency checks are disabled by default for local scaffold compatibility

#### Scenario: Environment values override defaults

- **GIVEN** MongoDB environment variables are set for URI, database, collection, timeout, and readiness
- **WHEN** the service loads persistence configuration
- **THEN** those values are used by the MongoDB client and repository

### Requirement: MongoDB client lifecycle

The Execution Service SHALL own a MongoDB client lifecycle that connects lazily, reuses the active client, checks database availability, and closes the client cleanly.

#### Scenario: Readiness ping succeeds

- **GIVEN** MongoDB readiness checks are enabled
- **AND** the MongoDB client can run the admin `ping` command
- **WHEN** readiness is evaluated
- **THEN** the MongoDB dependency is reported as ready

#### Scenario: Readiness ping fails

- **GIVEN** MongoDB readiness checks are enabled
- **AND** the MongoDB client cannot connect or ping the database
- **WHEN** readiness is evaluated
- **THEN** the MongoDB dependency is reported as not ready
- **AND** the HTTP readiness endpoint returns 503

### Requirement: Execution-owned task repository

The Execution Service SHALL provide a repository for execution-owned task records stored in MongoDB without exposing new public execution APIs in this change.

#### Scenario: Task record is created

- **GIVEN** a future execution flow has a service-owned task identifier and input payload
- **WHEN** it creates an execution task record through the repository
- **THEN** the record is inserted into the execution-owned MongoDB collection
- **AND** `createdAt` and `updatedAt` timestamps are assigned
- **AND** the task identifier is indexed uniquely

#### Scenario: Task record is read and updated

- **GIVEN** an execution task record exists in the execution-owned MongoDB collection
- **WHEN** the repository reads by task identifier and updates status details
- **THEN** it returns the matching task record
- **AND** it persists the new status, optional result, optional error message, and refreshed `updatedAt` timestamp

### Requirement: Persistence documentation

The Execution Service SHALL document MongoDB local development settings and Docker usage for this service's own database.

#### Scenario: Developer starts the service with MongoDB

- **GIVEN** a developer reads the local development documentation
- **WHEN** they need MongoDB-backed readiness
- **THEN** the documentation lists required MongoDB environment variables
- **AND** it includes a local Docker command for the service-owned MongoDB instance

