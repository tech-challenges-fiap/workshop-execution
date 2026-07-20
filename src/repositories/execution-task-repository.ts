import type { Collection, Document, UpdateFilter } from "mongodb";
import { mongoDbConnection, type MongoDbConnection } from "../persistence/mongodb-client.js";
import { loadMongoDbConfig } from "../config/mongodb.js";

export type ExecutionTaskStatus = "queued" | "running" | "completed" | "failed";
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface ExecutionTaskRecord {
  readonly taskId: string;
  readonly workflowId: string;
  readonly status: ExecutionTaskStatus;
  readonly input: JsonValue;
  readonly result?: JsonValue;
  readonly errorMessage?: string;
  readonly correlationId?: string;
  readonly idempotencyKey?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewExecutionTaskRecord {
  readonly taskId: string;
  readonly workflowId: string;
  readonly input: JsonValue;
  readonly status?: ExecutionTaskStatus;
  readonly correlationId?: string;
  readonly idempotencyKey?: string;
}

export interface ExecutionTaskStatusPatch {
  readonly result?: JsonValue;
  readonly errorMessage?: string;
}

type ExecutionTaskDocument = ExecutionTaskRecord & Document;

interface ExecutionTaskCollection {
  createIndex(keys: Record<string, 1 | -1>, options: { unique: boolean; sparse?: boolean }): Promise<string>;
  insertOne(document: ExecutionTaskDocument): Promise<unknown>;
  findOne(filter: { taskId: string } | { idempotencyKey: string }): Promise<ExecutionTaskDocument | null>;
  updateOne(
    filter: { taskId: string },
    update: UpdateFilter<ExecutionTaskDocument>
  ): Promise<{ matchedCount: number }>;
}

export class MongoExecutionTaskRepository {
  constructor(private readonly collection: ExecutionTaskCollection) {}

  static async create(
    connection: MongoDbConnection = mongoDbConnection
  ): Promise<MongoExecutionTaskRepository> {
    const config = loadMongoDbConfig();
    const db = await connection.getDb();
    return new MongoExecutionTaskRepository(
      db.collection<ExecutionTaskDocument>(config.tasksCollection) as Collection<ExecutionTaskDocument>
    );
  }

  async ensureIndexes(): Promise<void> {
    await this.collection.createIndex({ taskId: 1 }, { unique: true });
    await this.collection.createIndex({ idempotencyKey: 1 }, { unique: true, sparse: true });
  }

  async create(record: NewExecutionTaskRecord): Promise<ExecutionTaskRecord> {
    const now = new Date();
    const document: ExecutionTaskRecord = {
      taskId: record.taskId,
      workflowId: record.workflowId,
      status: record.status ?? "queued",
      input: record.input,
      correlationId: record.correlationId,
      idempotencyKey: record.idempotencyKey,
      createdAt: now,
      updatedAt: now,
    };

    await this.collection.insertOne(document as ExecutionTaskDocument);
    return document;
  }

  async findByTaskId(taskId: string): Promise<ExecutionTaskRecord | null> {
    const document = await this.collection.findOne({ taskId });
    return document ? this.toRecord(document) : null;
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<ExecutionTaskRecord | null> {
    const document = await this.collection.findOne({ idempotencyKey });
    return document ? this.toRecord(document) : null;
  }

  async updateStatus(
    taskId: string,
    status: ExecutionTaskStatus,
    patch: ExecutionTaskStatusPatch = {}
  ): Promise<boolean> {
    const $set: {
      status: ExecutionTaskStatus;
      updatedAt: Date;
      result?: JsonValue;
      errorMessage?: string;
    } = {
      status,
      updatedAt: new Date(),
    };

    if (patch.result !== undefined) {
      $set.result = patch.result;
    }

    if (patch.errorMessage !== undefined) {
      $set.errorMessage = patch.errorMessage;
    }

    const result = await this.collection.updateOne({ taskId }, { $set });
    return result.matchedCount === 1;
  }

  private toRecord(document: ExecutionTaskDocument): ExecutionTaskRecord {
    return {
      taskId: document.taskId,
      workflowId: document.workflowId,
      status: document.status,
      input: document.input,
      result: document.result,
      errorMessage: document.errorMessage,
      correlationId: document.correlationId,
      idempotencyKey: document.idempotencyKey,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    };
  }
}
