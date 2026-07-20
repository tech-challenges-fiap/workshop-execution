import { describe, expect, it } from "bun:test";
import { createExecutionTasksRouter } from "./execution-tasks.js";
import type {
  ExecutionTaskRecord,
  ExecutionTaskStatus,
  ExecutionTaskStatusPatch,
  JsonValue,
} from "../repositories/execution-task-repository.js";

class FakeExecutionTaskRepository {
  readonly records = new Map<string, ExecutionTaskRecord>();
  ensureIndexesCalls = 0;

  async ensureIndexes(): Promise<void> {
    this.ensureIndexesCalls += 1;
  }

  async create(record: {
    readonly taskId: string;
    readonly workflowId: string;
    readonly input: JsonValue;
    readonly correlationId?: string;
    readonly idempotencyKey?: string;
  }): Promise<ExecutionTaskRecord> {
    const now = new Date("2026-07-19T00:00:00.000Z");
    const created: ExecutionTaskRecord = {
      taskId: record.taskId,
      workflowId: record.workflowId,
      status: "queued",
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

function createRouter(repository: FakeExecutionTaskRepository) {
  return createExecutionTasksRouter({
    repositoryFactory: async () => repository,
    generateTaskId: () => "task-1",
  });
}

describe("execution task routes", () => {
  it("creates a queued task with correlation and idempotency metadata", async () => {
    const repository = new FakeExecutionTaskRepository();
    const router = createRouter(repository);

    const res = await router.request("/execution-tasks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Correlation-Id": "correlation-1",
        "Idempotency-Key": "idempotency-1",
      },
      body: JSON.stringify({ workflowId: "workflow-1", input: { orderId: "order-1" } }),
    });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(repository.records.size).toBe(1);
    expect(body).toEqual({
      taskId: "task-1",
      workflowId: "workflow-1",
      status: "queued",
      input: { orderId: "order-1" },
      correlationId: "correlation-1",
      idempotencyKey: "idempotency-1",
      createdAt: "2026-07-19T00:00:00.000Z",
      updatedAt: "2026-07-19T00:00:00.000Z",
    });
  });

  it("returns an existing task for an idempotent create retry", async () => {
    const repository = new FakeExecutionTaskRepository();
    const router = createRouter(repository);
    await repository.create({
      taskId: "task-existing",
      workflowId: "workflow-1",
      input: { orderId: "order-1" },
      idempotencyKey: "idempotency-1",
    });

    const res = await router.request("/execution-tasks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "idempotency-1",
      },
      body: JSON.stringify({ workflowId: "workflow-1", input: { orderId: "order-1" } }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.taskId).toBe("task-existing");
    expect(repository.records.size).toBe(1);
  });

  it("rejects invalid create requests", async () => {
    const router = createRouter(new FakeExecutionTaskRepository());

    const res = await router.request("/execution-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: {} }),
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("validation_error");
  });

  it("reads an existing task", async () => {
    const repository = new FakeExecutionTaskRepository();
    const router = createRouter(repository);
    await repository.create({ taskId: "task-1", workflowId: "workflow-1", input: null });

    const res = await router.request("/execution-tasks/task-1");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.taskId).toBe("task-1");
    expect(body.workflowId).toBe("workflow-1");
  });

  it("returns 404 when a task does not exist", async () => {
    const router = createRouter(new FakeExecutionTaskRepository());

    const res = await router.request("/execution-tasks/missing");
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.code).toBe("not_found");
  });

  it("updates a valid status transition", async () => {
    const repository = new FakeExecutionTaskRepository();
    const router = createRouter(repository);
    await repository.create({ taskId: "task-1", workflowId: "workflow-1", input: null });

    const res = await router.request("/execution-tasks/task-1/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "running" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("running");
    expect(body.updatedAt).toBe("2026-07-19T00:01:00.000Z");
  });

  it("persists terminal status details", async () => {
    const repository = new FakeExecutionTaskRepository();
    const router = createRouter(repository);
    await repository.create({ taskId: "task-1", workflowId: "workflow-1", input: null });
    await repository.updateStatus("task-1", "running");

    const res = await router.request("/execution-tasks/task-1/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed", result: { receiptId: "receipt-1" } }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("completed");
    expect(body.result).toEqual({ receiptId: "receipt-1" });
  });

  it("rejects invalid status transitions without modifying the task", async () => {
    const repository = new FakeExecutionTaskRepository();
    const router = createRouter(repository);
    await repository.create({ taskId: "task-1", workflowId: "workflow-1", input: null });
    await repository.updateStatus("task-1", "running");
    await repository.updateStatus("task-1", "completed");

    const res = await router.request("/execution-tasks/task-1/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "failed", errorMessage: "late failure" }),
    });
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error.code).toBe("invalid_status_transition");
    expect((await repository.findByTaskId("task-1"))?.status).toBe("completed");
  });
});
