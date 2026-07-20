import type { JsonValue } from "../repositories/execution-task-repository.js";

export const supportedSchemaVersion = "1" as const;

export type ExecutionInboundEventType =
  | "execution.task.create.requested"
  | "execution.task.status.update.requested";

export type ExecutionOutboundEventType = "execution.task.status.changed";

export type ExecutionEventType = ExecutionInboundEventType | ExecutionOutboundEventType;

export interface EventEnvelope<TType extends ExecutionEventType, TPayload> {
  readonly eventId: string;
  readonly correlationId: string;
  readonly schemaVersion: typeof supportedSchemaVersion;
  readonly producer: string;
  readonly type: TType;
  readonly occurredAt: string;
  readonly payload: TPayload;
}

export interface CreateExecutionTaskPayload {
  readonly workflowId: string;
  readonly input: JsonValue;
}

export interface UpdateExecutionTaskStatusPayload {
  readonly taskId: string;
  readonly status: "running" | "completed" | "failed";
  readonly result?: JsonValue;
  readonly errorMessage?: string;
}

export interface ExecutionTaskStatusChangedPayload {
  readonly taskId: string;
  readonly workflowId: string;
  readonly status: "queued" | "running" | "completed" | "failed";
  readonly result?: JsonValue;
  readonly errorMessage?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type CreateExecutionTaskMessage = EventEnvelope<
  "execution.task.create.requested",
  CreateExecutionTaskPayload
>;

export type UpdateExecutionTaskStatusMessage = EventEnvelope<
  "execution.task.status.update.requested",
  UpdateExecutionTaskStatusPayload
>;

export type ExecutionInboundMessage = CreateExecutionTaskMessage | UpdateExecutionTaskStatusMessage;

export type ExecutionTaskStatusChangedMessage = EventEnvelope<
  "execution.task.status.changed",
  ExecutionTaskStatusChangedPayload
>;

export class EventEnvelopeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EventEnvelopeValidationError";
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isJsonValue(value: unknown): value is JsonValue {
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

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new EventEnvelopeValidationError(`${field} must be a non-empty string`);
  }

  return value;
}

function requireIsoDate(value: unknown, field: string): string {
  const parsed = requireNonEmptyString(value, field);
  if (Number.isNaN(Date.parse(parsed))) {
    throw new EventEnvelopeValidationError(`${field} must be an ISO-8601 timestamp`);
  }

  return parsed;
}

function parseCreatePayload(payload: unknown): CreateExecutionTaskPayload {
  if (!isObject(payload)) {
    throw new EventEnvelopeValidationError("payload must be an object");
  }

  const workflowId = requireNonEmptyString(payload.workflowId, "payload.workflowId");
  if (!("input" in payload) || !isJsonValue(payload.input)) {
    throw new EventEnvelopeValidationError("payload.input must be a JSON value");
  }

  return { workflowId, input: payload.input };
}

function parseUpdatePayload(payload: unknown): UpdateExecutionTaskStatusPayload {
  if (!isObject(payload)) {
    throw new EventEnvelopeValidationError("payload must be an object");
  }

  const taskId = requireNonEmptyString(payload.taskId, "payload.taskId");
  if (!["running", "completed", "failed"].includes(String(payload.status))) {
    throw new EventEnvelopeValidationError(
      "payload.status must be one of running, completed, failed"
    );
  }

  if ("result" in payload && !isJsonValue(payload.result)) {
    throw new EventEnvelopeValidationError("payload.result must be a JSON value");
  }

  if (payload.errorMessage !== undefined && typeof payload.errorMessage !== "string") {
    throw new EventEnvelopeValidationError("payload.errorMessage must be a string");
  }

  return {
    taskId,
    status: payload.status as UpdateExecutionTaskStatusPayload["status"],
    result: payload.result as JsonValue | undefined,
    errorMessage: payload.errorMessage,
  };
}

function baseEnvelopeFields(body: Record<string, unknown>): Omit<
  EventEnvelope<ExecutionEventType, unknown>,
  "type" | "payload"
> {
  const eventId = requireNonEmptyString(body.eventId, "eventId");
  const correlationId = requireNonEmptyString(body.correlationId, "correlationId");
  const schemaVersion = requireNonEmptyString(body.schemaVersion, "schemaVersion");
  if (schemaVersion !== supportedSchemaVersion) {
    throw new EventEnvelopeValidationError(`schemaVersion ${schemaVersion} is not supported`);
  }

  return {
    eventId,
    correlationId,
    schemaVersion: supportedSchemaVersion,
    producer: requireNonEmptyString(body.producer, "producer"),
    occurredAt: requireIsoDate(body.occurredAt, "occurredAt"),
  };
}

export function parseExecutionInboundMessage(rawBody: string | Uint8Array): ExecutionInboundMessage {
  let parsed: unknown;
  try {
    parsed = JSON.parse(typeof rawBody === "string" ? rawBody : new TextDecoder().decode(rawBody));
  } catch {
    throw new EventEnvelopeValidationError("message body must be valid JSON");
  }

  if (!isObject(parsed)) {
    throw new EventEnvelopeValidationError("message body must be a JSON object");
  }

  const base = baseEnvelopeFields(parsed);
  const type = requireNonEmptyString(parsed.type, "type");

  if (type === "execution.task.create.requested") {
    return { ...base, type, payload: parseCreatePayload(parsed.payload) };
  }

  if (type === "execution.task.status.update.requested") {
    return { ...base, type, payload: parseUpdatePayload(parsed.payload) };
  }

  throw new EventEnvelopeValidationError(`message type ${type} is not supported`);
}

export function serializeEventEnvelope<TType extends ExecutionEventType, TPayload>(
  envelope: EventEnvelope<TType, TPayload>
): string {
  return JSON.stringify(envelope);
}
