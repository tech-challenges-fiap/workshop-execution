# Execution Service — Documentation

| Document | Description |
|----------|-------------|
| [development.md](development.md) | Local setup, environment variables, tooling |

## Architecture Overview

The Execution Service is a stateless HTTP API (Hono on Bun) that will eventually:

1. Accept execution requests from upstream orchestrators.
2. Persist execution state to MongoDB (future phase).
3. Emit status events (future phase).
4. Expose a REST API conforming to `openapi/openapi.yaml`.

For the current scaffold phase only `/health` and `/ready` are implemented.

## OpenSpec Changes

All API and architecture decisions are governed via OpenSpec.
See [`openspec/changes/`](../openspec/changes/) for the full history.
