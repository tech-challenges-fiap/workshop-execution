import { describe, expect, it } from "bun:test";
import { loadMongoDbConfig } from "./mongodb.js";

describe("loadMongoDbConfig", () => {
  it("returns local defaults when environment variables are absent", () => {
    const config = loadMongoDbConfig({});

    expect(config.uri).toBe("mongodb://localhost:27017");
    expect(config.dbName).toBe("execution_service");
    expect(config.tasksCollection).toBe("execution_tasks");
    expect(config.connectTimeoutMs).toBe(5000);
    expect(config.readinessEnabled).toBe(false);
  });

  it("uses environment overrides", () => {
    const config = loadMongoDbConfig({
      MONGODB_URI: "mongodb://mongo:27017",
      MONGODB_DB_NAME: "execution_prod",
      MONGODB_TASKS_COLLECTION: "tasks",
      MONGODB_CONNECT_TIMEOUT_MS: "2500",
      MONGODB_READINESS_ENABLED: "true",
    });

    expect(config.uri).toBe("mongodb://mongo:27017");
    expect(config.dbName).toBe("execution_prod");
    expect(config.tasksCollection).toBe("tasks");
    expect(config.connectTimeoutMs).toBe(2500);
    expect(config.readinessEnabled).toBe(true);
  });
});
