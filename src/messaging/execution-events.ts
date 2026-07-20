import type {
  ExecutionTaskRecord,
  ExecutionTaskStatus,
  ExecutionTaskStatusPatch,
  JsonValue,
} from "../repositories/execution-task-repository.js";
import {
  serializeEventEnvelope,
  supportedSchemaVersion,
  type ExecutionInboundMessage,
  type ExecutionTaskStatusChangedMessage,
} from "./event-envelope.js";
import { loadRabbitMqConfig, type RabbitMqConfig } from "../config/rabbitmq.js";

export interface ExecutionTaskRepositoryPort {
  create(record: {
    readonly taskId: string;
    readonly workflowId: string;
    readonly input: JsonValue;
    readonly status?: ExecutionTaskStatus;
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

export interface ExecutionEventTransport {
  publish(exchange: string, routingKey: string, body: string): Promise<void>;
}

export interface ExecutionEventPublisherOptions {
  readonly transport: ExecutionEventTransport;
  readonly config?: RabbitMqConfig;
  readonly producer?: string;
  readonly now?: () => Date;
  readonly generateEventId?: () => string;
}

export interface ExecutionMessageHandlerOptions {
  readonly repository: ExecutionTaskRepositoryPort;
  readonly publisher: ExecutionStatusEventPublisher;
  readonly generateTaskId?: () => string;
}

export type MessageHandleResult =
  | { readonly action: "created"; readonly task: ExecutionTaskRecord }
  | { readonly action: "already_created"; readonly task: ExecutionTaskRecord }
  | { readonly action: "updated"; readonly task: ExecutionTaskRecord }
  | { readonly action: "already_updated"; readonly task: ExecutionTaskRecord };

const allowedTransitions: Record<ExecutionTaskStatus, readonly ExecutionTaskStatus[]> = {
  queued: ["running", "failed"],
  running: ["completed", "failed"],
  completed: [],
  failed: [],
};

function defaultEventId(): string {
  return crypto.randomUUID();
}

function defaultTaskId(): string {
  return crypto.randomUUID();
}

function toStatusChangedPayload(record: ExecutionTaskRecord) {
  return {
    taskId: record.taskId,
    workflowId: record.workflowId,
    status: record.status,
    result: record.result,
    errorMessage: record.errorMessage,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export class ExecutionMessageHandlingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExecutionMessageHandlingError";
  }
}

export class ExecutionStatusEventPublisher {
  private readonly config: RabbitMqConfig;
  private readonly producer: string;
  private readonly now: () => Date;
  private readonly generateEventId: () => string;

  constructor(private readonly options: ExecutionEventPublisherOptions) {
    this.config = options.config ?? loadRabbitMqConfig();
    this.producer = options.producer ?? "workshop-execution";
    this.now = options.now ?? (() => new Date());
    this.generateEventId = options.generateEventId ?? defaultEventId;
  }

  async publishStatusChanged(
    record: ExecutionTaskRecord,
    correlationId: string
  ): Promise<ExecutionTaskStatusChangedMessage> {
    const message: ExecutionTaskStatusChangedMessage = {
      eventId: this.generateEventId(),
      correlationId,
      schemaVersion: supportedSchemaVersion,
      producer: this.producer,
      type: "execution.task.status.changed",
      occurredAt: this.now().toISOString(),
      payload: toStatusChangedPayload(record),
    };

    await this.options.transport.publish(
      this.config.exchange,
      this.config.executionStatusRoutingKey,
      serializeEventEnvelope(message)
    );

    return message;
  }
}

export class ExecutionInboundMessageHandler {
  private readonly generateTaskId: () => string;

  constructor(private readonly options: ExecutionMessageHandlerOptions) {
    this.generateTaskId = options.generateTaskId ?? defaultTaskId;
  }

  async handle(message: ExecutionInboundMessage): Promise<MessageHandleResult> {
    if (message.type === "execution.task.create.requested") {
      return this.handleCreate(message);
    }

    return this.handleStatusUpdate(message);
  }

  private async handleCreate(
    message: Extract<ExecutionInboundMessage, { readonly type: "execution.task.create.requested" }>
  ): Promise<MessageHandleResult> {
    const existing = await this.options.repository.findByIdempotencyKey(message.eventId);
    if (existing) {
      await this.options.publisher.publishStatusChanged(existing, message.correlationId);
      return { action: "already_created", task: existing };
    }

    const created = await this.options.repository.create({
      taskId: this.generateTaskId(),
      workflowId: message.payload.workflowId,
      input: message.payload.input,
      correlationId: message.correlationId,
      idempotencyKey: message.eventId,
    });

    await this.options.publisher.publishStatusChanged(created, message.correlationId);
    return { action: "created", task: created };
  }

  private async handleStatusUpdate(
    message: Extract<
      ExecutionInboundMessage,
      { readonly type: "execution.task.status.update.requested" }
    >
  ): Promise<MessageHandleResult> {
    const task = await this.options.repository.findByTaskId(message.payload.taskId);
    if (!task) {
      throw new ExecutionMessageHandlingError("execution task was not found");
    }

    if (task.status === message.payload.status) {
      await this.options.publisher.publishStatusChanged(task, message.correlationId);
      return { action: "already_updated", task };
    }

    if (!allowedTransitions[task.status].includes(message.payload.status)) {
      throw new ExecutionMessageHandlingError(
        `cannot transition from ${task.status} to ${message.payload.status}`
      );
    }

    await this.options.repository.updateStatus(task.taskId, message.payload.status, {
      result: message.payload.result,
      errorMessage: message.payload.errorMessage,
    });

    const updated = await this.options.repository.findByTaskId(task.taskId);
    if (!updated) {
      throw new ExecutionMessageHandlingError("execution task was not found after status update");
    }

    await this.options.publisher.publishStatusChanged(updated, message.correlationId);
    return { action: "updated", task: updated };
  }
}
