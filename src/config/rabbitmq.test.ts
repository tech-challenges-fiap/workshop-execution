import { describe, expect, it } from "bun:test";
import { loadRabbitMqConfig } from "./rabbitmq.js";

describe("loadRabbitMqConfig", () => {
  it("loads local defaults with live consumption disabled", () => {
    expect(loadRabbitMqConfig({})).toEqual({
      url: "amqp://localhost:5672",
      exchange: "execution.events",
      executionCommandQueue: "execution.commands",
      executionStatusRoutingKey: "execution.task.status.changed",
      consumerEnabled: false,
    });
  });

  it("uses environment overrides", () => {
    expect(
      loadRabbitMqConfig({
        RABBITMQ_URL: "amqp://broker:5672",
        RABBITMQ_EXCHANGE: "fiap.events",
        RABBITMQ_EXECUTION_COMMAND_QUEUE: "fiap.execution.commands",
        RABBITMQ_EXECUTION_STATUS_ROUTING_KEY: "fiap.execution.status",
        RABBITMQ_CONSUMER_ENABLED: "true",
      })
    ).toEqual({
      url: "amqp://broker:5672",
      exchange: "fiap.events",
      executionCommandQueue: "fiap.execution.commands",
      executionStatusRoutingKey: "fiap.execution.status",
      consumerEnabled: true,
    });
  });
});
