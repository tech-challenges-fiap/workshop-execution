import { describe, expect, it } from "bun:test";
import type {
  ExecutionTaskRecord,
  ExecutionTaskStatus,
  ExecutionTaskStatusPatch,
  JsonValue,
} from "../repositories/execution-task-repository.js";
import type { ExecutionInboundMessage } from "./event-envelope.js";
import {
  ExecutionInboundMessageHandler,
  ExecutionMessageHandlingError,
  ExecutionStatusEventPublisher,
  type ExecutionEventTransport,
} from "./execution-events.js";

class FakeExecutionTaskRepository {
  readonly records = new Map<string, ExecutionTaskRecord>();
  createCalls = 0;

  async create(record: {
    readonly taskId: string;
    readonly workflowId: string;
    readonly input: JsonValue;
    readonly status?: ExecutionTaskStatus;
    readonly correlationId?: string;
    readonly idempotencyKey?: string;
  }): Promise<ExecutionTaskRecord> {
    this.createCalls += 1;
    const now = new Date("2026-07-19T00:00:00.000Z");
    const created: ExecutionTaskRecord = {
      taskId: record.taskId,
      workflowId: record.workflowId,
      status: record.status ?? "queued",
      input: record.input,
      correlationId: record.correlationId,
      idempotencyKey: record.idempotencyKey,
      createdAt: now,
      updatedAt: now,
    };
    this.records.set(created.taskId, created);
    return created;
  }

  async findByTaskId(taskId: string): Promise<ExecutionTaskRecord | null> {
    return this.records.get(taskId) ?? null;
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<ExecutionTaskRecord | null> {
    return (
      [...this.records.values()].find(
        (record) => record.idempotencyKey === idempotencyKey
      ) ?? null
    );
  }

  async updateStatus(
    taskId: string,
    status: ExecutionTaskStatus,
    patch: ExecutionTaskStatusPatch = {}
  ): Promise<boolean> {
    const current = this.records.get(taskId);
    if (!current) {
      return false;
    }

    this.records.set(taskId, {
      ...current,
      status,
      result: patch.result,
      errorMessage: patch.errorMessage,
      updatedAt: new Date("2026-07-19T00:01:00.000Z"),
    });
    return true;
  }
}

class FakeTransport implements ExecutionEventTransport {
  readonly published: Array<{ exchange: string; routingKey: string; body: string }> = [];

  async publish(exchange: string, routingKey: string, body: string): Promise<void> {
    this.published.push({ exchange, routingKey, body });
  }
}

function createPublisher(transport: FakeTransport): ExecutionStatusEventPublisher {
  return new ExecutionStatusEventPublisher({
    transport,
    config: {
      url: "amqp://broker",
      exchange: "execution.events",
      executionCommandQueue: "execution.commands",
      executionStatusRoutingKey: "execution.task.status.changed",
      consumerEnabled: false,
    },
    producer: "workshop-execution",
    now: () => new Date("2026-07-19T00:02:00.000Z"),
    generateEventId: () => "status-event-1",
  });
}

const createMessage: ExecutionInboundMessage = {
  eventId: "create-event-1",
  correlationId: "correlation-1",
  schemaVersion: "1",
  producer: "os-service",
  type: "execution.task.create.requested",
  occurredAt: "2026-07-19T00:00:00.000Z",
  payload: { workflowId: "workflow-1", input: { orderId: "order-1" } },
};

function statusMessage(status: "running" | "completed" | "failed"): ExecutionInboundMessage {
  return {
    eventId: `status-event-${status}`,
    correlationId: "correlation-1",
    schemaVersion: "1",
    producer: "worker",
    type: "execution.task.status.update.requested",
    occurredAt: "2026-07-19T00:01:00.000Z",
    payload: { taskId: "task-1", status, result: status === "completed" ? { ok: true } : undefined },
  };
}

describe("ExecutionInboundMessageHandler", () => {
  it("creates a queued task and publishes status", async () => {
    const repository = new FakeExecutionTaskRepository();
    const transport = new FakeTransport();
    const handler = new ExecutionInboundMessageHandler({
      repository,
      publisher: createPublisher(transport),
      generateTaskId: () => "task-1",
    });

    const result = await handler.handle(createMessage);

    expect(result.action).toBe("created");
    expect(result.task).toMatchObject({
      taskId: "task-1",
      workflowId: "workflow-1",
      status: "queued",
      correlationId: "correlation-1",
      idempotencyKey: "create-event-1",
    });
    expect(transport.published).toHaveLength(1);
    expect(JSON.parse(transport.published[0]!.body)).toMatchObject({
      eventId: "status-event-1",
      correlationId: "correlation-1",
      type: "execution.task.status.changed",
      payload: { taskId: "task-1", workflowId: "workflow-1", status: "queued" },
    });
  });

  it("deduplicates create messages by event id", async () => {
    const repository = new FakeExecutionTaskRepository();
    const transport = new FakeTransport();
    const handler = new ExecutionInboundMessageHandler({
      repository,
      publisher: createPublisher(transport),
      generateTaskId: () => "task-1",
    });

    await handler.handle(createMessage);
    const retry = await handler.handle(createMessage);

    expect(retry.action).toBe("already_created");
    expect(repository.createCalls).toBe(1);
    expect(transport.published).toHaveLength(2);
  });

  it("updates task status and publishes current state", async () => {
    const repository = new FakeExecutionTaskRepository();
    const transport = new FakeTransport();
    const handler = new ExecutionInboundMessageHandler({
      repository,
      publisher: createPublisher(transport),
      generateTaskId: () => "task-1",
    });
    await handler.handle(createMessage);

    const result = await handler.handle(statusMessage("running"));

    expect(result.action).toBe("updated");
    expect(result.task.status).toBe("running");
    expect(JSON.parse(transport.published.at(-1)!.body).payload.status).toBe("running");
  });

  it("treats repeated status update messages as already applied", async () => {
    const repository = new FakeExecutionTaskRepository();
    const transport = new FakeTransport();
    const handler = new ExecutionInboundMessageHandler({
      repository,
      publisher: createPublisher(transport),
      generateTaskId: () => "task-1",
    });
    await handler.handle(createMessage);
    await handler.handle(statusMessage("running"));

    const retry = await handler.handle(statusMessage("running"));

    expect(retry.action).toBe("already_updated");
    expect(retry.task.status).toBe("running");
  });

  it("rejects missing tasks and invalid transitions", async () => {
    const repository = new FakeExecutionTaskRepository();
    const transport = new FakeTransport();
    const handler = new ExecutionInboundMessageHandler({
      repository,
      publisher: createPublisher(transport),
      generateTaskId: () => "task-1",
    });

    await expect(handler.handle(statusMessage("running"))).rejects.toThrow(
      ExecutionMessageHandlingError
    );
    await handler.handle(createMessage);
    await handler.handle(statusMessage("running"));
    await handler.handle(statusMessage("completed"));
    await expect(handler.handle(statusMessage("failed"))).rejects.toThrow(
      "cannot transition from completed to failed"
    );
  });
});
