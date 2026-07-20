# Tasks

- [x] 1. Validate OpenSpec change with `npx --yes @fission-ai/openspec validate f4-execution-rabbitmq-events --strict` before implementation.
- [x] 2. Add RabbitMQ runtime configuration and local documentation.
- [x] 3. Implement versioned event envelope parsing and serialization.
- [x] 4. Implement inbound execution message handler using Execution-owned repository contracts.
- [x] 5. Implement outbound execution status publisher boundary.
- [x] 6. Add idempotency handling for duplicate inbound messages.
- [x] 7. Add tests for config, envelope validation, inbound handling, outbound publication, and idempotency without a live broker.
- [x] 8. Run OpenSpec strict validation, lint, tests, build, coverage, and check.
- [x] 9. Record evidence and archive the OpenSpec change only if validation passes.
