import { describe, expect, it } from "bun:test";
import type { UpdateFilter } from "mongodb";
import {
  MongoExecutionTaskRepository,
  type ExecutionTaskRecord,
} from "./execution-task-repository.js";

type ExecutionTaskDocument = ExecutionTaskRecord;

class FakeExecutionTaskCollection {
  readonly records = new Map<string, ExecutionTaskDocument>();
  readonly createdIndexes: Array<Record<string, 1 | -1>> = [];

  async createIndex(keys: Record<string, 1 | -1>): Promise<string> {
    this.createdIndexes.push(keys);
    return "taskId_1";
  }

  async insertOne(document: ExecutionTaskDocument): Promise<void> {
    this.records.set(document.taskId, document);
  }

  async findOne(
    filter: { taskId: string } | { idempotencyKey: string }
  ): Promise<ExecutionTaskDocument | null> {
    if ("taskId" in filter) {
      return this.records.get(filter.taskId) ?? null;
    }

    return (
      [...this.records.values()].find(
        (record) => record.idempotencyKey === filter.idempotencyKey
      ) ?? null
    );
  }

  async updateOne(
    filter: { taskId: string },
    update: UpdateFilter<ExecutionTaskDocument>
  ): Promise<{ matchedCount: number }> {
    const current = this.records.get(filter.taskId);
    if (!current) {
      return { matchedCount: 0 };
    }

    const next = { ...current, ...update.$set } as ExecutionTaskDocument;
    this.records.set(filter.taskId, next);
    return { matchedCount: 1 };
  }
}

describe("MongoExecutionTaskRepository", () => {
  it("creates a unique taskId index", async () => {
    const collection = new FakeExecutionTaskCollection();
    const repository = new MongoExecutionTaskRepository(collection);

    await repository.ensureIndexes();

    expect(collection.createdIndexes).toEqual([{ taskId: 1 }, { idempotencyKey: 1 }]);
  });

  it("creates and reads an execution task record", async () => {
    const repository = new MongoExecutionTaskRepository(new FakeExecutionTaskCollection());

    const created = await repository.create({
      taskId: "task-1",
      workflowId: "workflow-1",
      input: { workflowId: "workflow-1" },
      correlationId: "correlation-1",
      idempotencyKey: "idempotency-1",
    });
    const found = await repository.findByTaskId("task-1");
    const idempotentFound = await repository.findByIdempotencyKey("idempotency-1");

    expect(created.taskId).toBe("task-1");
    expect(created.workflowId).toBe("workflow-1");
    expect(created.status).toBe("queued");
    expect(created.correlationId).toBe("correlation-1");
    expect(created.idempotencyKey).toBe("idempotency-1");
    expect(created.createdAt).toBeInstanceOf(Date);
    expect(created.updatedAt).toBeInstanceOf(Date);
    expect(found).toEqual(created);
    expect(idempotentFound).toEqual(created);
  });

  it("updates task status details", async () => {
    const repository = new MongoExecutionTaskRepository(new FakeExecutionTaskCollection());
    await repository.create({ taskId: "task-2", workflowId: "workflow-2", input: null });

    const updated = await repository.updateStatus("task-2", "completed", {
      result: { value: "done" },
    });
    const found = await repository.findByTaskId("task-2");

    expect(updated).toBe(true);
    expect(found?.status).toBe("completed");
    expect(found?.result).toEqual({ value: "done" });
  });

  it("returns false when updating an unknown task", async () => {
    const repository = new MongoExecutionTaskRepository(new FakeExecutionTaskCollection());

    await expect(repository.updateStatus("missing", "failed")).resolves.toBe(false);
  });
});
