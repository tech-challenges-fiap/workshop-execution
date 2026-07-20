export interface RabbitMqConfig {
  readonly url: string;
  readonly exchange: string;
  readonly executionCommandQueue: string;
  readonly executionStatusRoutingKey: string;
  readonly consumerEnabled: boolean;
}

function readBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) {
    return defaultValue;
  }

  return value.trim().toLowerCase() === "true";
}

function readString(value: string | undefined, defaultValue: string): string {
  const normalized = value?.trim();
  return normalized ? normalized : defaultValue;
}

export function loadRabbitMqConfig(
  env: Record<string, string | undefined> = process.env
): RabbitMqConfig {
  return {
    url: readString(env.RABBITMQ_URL, "amqp://localhost:5672"),
    exchange: readString(env.RABBITMQ_EXCHANGE, "execution.events"),
    executionCommandQueue: readString(
      env.RABBITMQ_EXECUTION_COMMAND_QUEUE,
      "execution.commands"
    ),
    executionStatusRoutingKey: readString(
      env.RABBITMQ_EXECUTION_STATUS_ROUTING_KEY,
      "execution.task.status.changed"
    ),
    consumerEnabled: readBoolean(env.RABBITMQ_CONSUMER_ENABLED, false),
  };
}
