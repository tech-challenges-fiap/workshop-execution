import { Hono } from "hono";
import {
  MongoExecutionTaskRepository,
  type ExecutionTaskRecord,
  type ExecutionTaskStatus,
  type ExecutionTaskStatusPatch,
  type JsonValue,
} from "../repositories/execution-task-repository.js";

interface ExecutionTaskRepository {
  ensureIndexes(): Promise<void>;
  create(record: {
    readonly taskId: string;
    readonly workflowId: string;
    readonly input: JsonValue;
    readonly correlationId?: string;
    readonly idempotencyKey?: string;
  }): Promise<ExecutionTaskRecord>;
  findByTaskId(taskId: string): Promise<ExecutionTaskRecord | null>;
  findByIdempotencyKey(idempotencyKey: string): Promise<ExecutionTaskRecord | null>;
  updateStatus(
    taskId: string,
    status: ExecutionTaskStatus,
    patch?: ExecutionTaskStatusPatch
  ): Promise<boolean>;
}

interface ExecutionTasksRouterOptions {
  readonly repositoryFactory?: () => Promise<ExecutionTaskRepository>;
  readonly generateTaskId?: () => string;
}

type CreateTaskBody = {
  readonly workflowId: string;
  readonly input: JsonValue;
  readonly correlationId?: string;
};

type StatusBody = {
  readonly status: ExecutionTaskStatus;
  readonly result?: JsonValue;
  readonly errorMessage?: string;
};

const statuses = ["queued", "running", "completed", "failed"] as const;

const allowedTransitions: Record<ExecutionTaskStatus, readonly ExecutionTaskStatus[]> = {
  queued: ["running", "failed"],
  running: ["completed", "failed"],
  completed: [],
  failed: [],
};

async function defaultRepositoryFactory(): Promise<ExecutionTaskRepository> {
  const repository = await MongoExecutionTaskRepository.create();
  await repository.ensureIndexes();
  return repository;
}

function defaultTaskId(): string {
  return crypto.randomUUID();
}

function errorBody(code: string, message: string) {
  return { error: { code, message } };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return typeof value !== "number" || Number.isFinite(value);
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  if (isObject(value)) {
    return Object.values(value).every(isJsonValue);
  }

  return false;
}

async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return isObject(body) ? body : null;
  } catch {
    return null;
  }
}

function optionalHeader(value: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function validateBoundedString(
  value: unknown,
  field: string,
  maxLength: number
): string | { readonly message: string } {
  if (typeof value !== "string" || value.trim().length === 0) {
    return { message: `${field} must be a non-empty string` };
  }

  if (value.length > maxLength) {
    return { message: `${field} must be at most ${maxLength} characters` };
  }

  return value;
}

function parseCreateTaskBody(
  body: Record<string, unknown>,
  headerCorrelationId: string | undefined
): CreateTaskBody | { readonly message: string } {
  const workflowId = validateBoundedString(body.workflowId, "workflowId", 128);
  if (typeof workflowId !== "string") {
    return workflowId;
  }

  if (!("input" in body) || !isJsonValue(body.input)) {
    return { message: "input must be a valid JSON value" };
  }

  const bodyCorrelationId = body.correlationId;
  let correlationId = headerCorrelationId;
  if (bodyCorrelationId !== undefined) {
    const parsed = validateBoundedString(bodyCorrelationId, "correlationId", 128);
    if (typeof parsed !== "string") {
      return parsed;
    }
    correlationId = parsed;
  }

  return {
    workflowId,
    input: body.input,
    correlationId,
  };
}

function parseStatusBody(body: Record<string, unknown>): StatusBody | { readonly message: string } {
  if (!statuses.includes(body.status as ExecutionTaskStatus)) {
    return { message: "status must be one of queued, running, completed, failed" };
  }

  const status = body.status as ExecutionTaskStatus;
  if (status === "queued") {
    return { message: "status cannot be changed to queued" };
  }

  if ("result" in body && !isJsonValue(body.result)) {
    return { message: "result must be a valid JSON value" };
  }

  if (body.errorMessage !== undefined) {
    const errorMessage = validateBoundedString(body.errorMessage, "errorMessage", 1024);
    if (typeof errorMessage !== "string") {
      return errorMessage;
    }

    return { status, result: body.result as JsonValue | undefined, errorMessage };
  }

  return { status, result: body.result as JsonValue | undefined };
}

function toResponse(record: ExecutionTaskRecord) {
  return {
    taskId: record.taskId,
    workflowId: record.workflowId,
    status: record.status,
    input: record.input,
    result: record.result,
    errorMessage: record.errorMessage,
    correlationId: record.correlationId,
    idempotencyKey: record.idempotencyKey,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function createExecutionTasksRouter(
  options: ExecutionTasksRouterOptions = {}
): Hono {
  const router = new Hono();
  const repositoryFactory = options.repositoryFactory ?? defaultRepositoryFactory;
  const generateTaskId = options.generateTaskId ?? defaultTaskId;

  router.post("/execution-tasks", async (c) => {
    const body = await readJsonObject(c.req.raw);
    if (!body) {
      return c.json(errorBody("validation_error", "request body must be a JSON object"), 400);
    }

    const correlationId = optionalHeader(c.req.header("X-Correlation-Id") ?? null);
    const idempotencyKey = optionalHeader(c.req.header("Idempotency-Key") ?? null);
    if (idempotencyKey && idempotencyKey.length > 128) {
      return c.json(errorBody("validation_error", "Idempotency-Key must be at most 128 characters"), 400);
    }

    const parsed = parseCreateTaskBody(body, correlationId);
    if ("message" in parsed) {
      return c.json(errorBody("validation_error", parsed.message), 400);
    }

    const repository = await repositoryFactory();
    if (idempotencyKey) {
      const existing = await repository.findByIdempotencyKey(idempotencyKey);
      if (existing) {
        return c.json(toResponse(existing), 200);
      }
    }

    const created = await repository.create({
      taskId: generateTaskId(),
      workflowId: parsed.workflowId,
      input: parsed.input,
      correlationId: parsed.correlationId,
      idempotencyKey,
    });

    return c.json(toResponse(created), 201);
  });

  router.get("/execution-tasks/:taskId", async (c) => {
    const taskId = c.req.param("taskId");
    const repository = await repositoryFactory();
    const task = await repository.findByTaskId(taskId);

    if (!task) {
      return c.json(errorBody("not_found", "execution task was not found"), 404);
    }

    return c.json(toResponse(task), 200);
  });

  router.patch("/execution-tasks/:taskId/status", async (c) => {
    const body = await readJsonObject(c.req.raw);
    if (!body) {
      return c.json(errorBody("validation_error", "request body must be a JSON object"), 400);
    }

    const parsed = parseStatusBody(body);
    if ("message" in parsed) {
      return c.json(errorBody("validation_error", parsed.message), 400);
    }

    const taskId = c.req.param("taskId");
    const repository = await repositoryFactory();
    const task = await repository.findByTaskId(taskId);

    if (!task) {
      return c.json(errorBody("not_found", "execution task was not found"), 404);
    }

    if (!allowedTransitions[task.status].includes(parsed.status)) {
      return c.json(
        errorBody("invalid_status_transition", `cannot transition from ${task.status} to ${parsed.status}`),
        409
      );
    }

    await repository.updateStatus(taskId, parsed.status, {
      result: parsed.result,
      errorMessage: parsed.errorMessage,
    });

    const updated = await repository.findByTaskId(taskId);
    if (!updated) {
      return c.json(errorBody("not_found", "execution task was not found"), 404);
    }

    return c.json(toResponse(updated), 200);
  });

  return router;
}

export const executionTasksRouter = createExecutionTasksRouter();
