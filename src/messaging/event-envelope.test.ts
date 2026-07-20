import { describe, expect, it } from "bun:test";
import {
  EventEnvelopeValidationError,
  parseExecutionInboundMessage,
  serializeEventEnvelope,
  supportedSchemaVersion,
  type CreateExecutionTaskMessage,
} from "./event-envelope.js";

describe("event envelope", () => {
  it("parses a valid create message", () => {
    const message = parseExecutionInboundMessage(
      JSON.stringify({
        eventId: "event-1",
        correlationId: "correlation-1",
        schemaVersion: "1",
        producer: "os-service",
        type: "execution.task.create.requested",
        occurredAt: "2026-07-19T00:00:00.000Z",
        payload: { workflowId: "workflow-1", input: { orderId: "order-1" } },
      })
    );

    expect(message.type).toBe("execution.task.create.requested");
    if (message.type === "execution.task.create.requested") {
      expect(message.payload.workflowId).toBe("workflow-1");
      expect(message.payload.input).toEqual({ orderId: "order-1" });
    }
  });

  it("parses a valid status update message", () => {
    const message = parseExecutionInboundMessage(
      JSON.stringify({
        eventId: "event-2",
        correlationId: "correlation-1",
        schemaVersion: "1",
        producer: "worker",
        type: "execution.task.status.update.requested",
        occurredAt: "2026-07-19T00:01:00.000Z",
        payload: { taskId: "task-1", status: "completed", result: { ok: true } },
      })
    );

    expect(message.type).toBe("execution.task.status.update.requested");
    if (message.type === "execution.task.status.update.requested") {
      expect(message.payload.taskId).toBe("task-1");
      expect(message.payload.status).toBe("completed");
    }
  });

  it("rejects malformed and unsupported messages", () => {
    expect(() => parseExecutionInboundMessage("not-json")).toThrow(
      EventEnvelopeValidationError
    );
    expect(() =>
      parseExecutionInboundMessage(
        JSON.stringify({
          eventId: "event-3",
          correlationId: "correlation-1",
          schemaVersion: "2",
          producer: "os-service",
          type: "execution.task.create.requested",
          occurredAt: "2026-07-19T00:00:00.000Z",
          payload: { workflowId: "workflow-1", input: null },
        })
      )
    ).toThrow("schemaVersion 2 is not supported");
    expect(() =>
      parseExecutionInboundMessage(
        JSON.stringify({
          eventId: "event-4",
          correlationId: "correlation-1",
          schemaVersion: "1",
          producer: "os-service",
          type: "unknown",
          occurredAt: "2026-07-19T00:00:00.000Z",
          payload: {},
        })
      )
    ).toThrow("message type unknown is not supported");
  });

  it("serializes an envelope", () => {
    const envelope: CreateExecutionTaskMessage = {
      eventId: "event-1",
      correlationId: "correlation-1",
      schemaVersion: supportedSchemaVersion,
      producer: "os-service",
      type: "execution.task.create.requested",
      occurredAt: "2026-07-19T00:00:00.000Z",
      payload: { workflowId: "workflow-1", input: null },
    };

    expect(JSON.parse(serializeEventEnvelope(envelope))).toEqual(envelope);
  });
});
