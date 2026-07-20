import { describe, expect, it } from "bun:test";
import type { MongoClient, MongoClientOptions } from "mongodb";
import { MongoDbConnection } from "./mongodb-client.js";

function createFakeClient(options: { pingFails?: boolean } = {}): MongoClient {
  const fakeClient = {
    connect: async () => fakeClient,
    db: () => ({
      admin: () => ({
        ping: async () => {
          if (options.pingFails) {
            throw new Error("database unavailable");
          }
        },
      }),
    }),
    close: async () => undefined,
  };

  return fakeClient as unknown as MongoClient;
}

describe("MongoDbConnection", () => {
  it("skips ping when readiness checks are disabled", async () => {
    let createdClient = false;
    const connection = new MongoDbConnection(
      {
        uri: "mongodb://localhost:27017",
        dbName: "execution_service",
        tasksCollection: "execution_tasks",
        connectTimeoutMs: 100,
        readinessEnabled: false,
      },
      (_uri: string, _options: MongoClientOptions) => {
        createdClient = true;
        return createFakeClient();
      }
    );

    await expect(connection.ping()).resolves.toEqual({
      name: "mongodb",
      status: "skipped",
    });
    expect(createdClient).toBe(false);
  });

  it("reports ready when MongoDB ping succeeds", async () => {
    const connection = new MongoDbConnection(
      {
        uri: "mongodb://localhost:27017",
        dbName: "execution_service",
        tasksCollection: "execution_tasks",
        connectTimeoutMs: 100,
        readinessEnabled: true,
      },
      () => createFakeClient()
    );

    await expect(connection.ping()).resolves.toEqual({
      name: "mongodb",
      status: "ready",
    });
  });

  it("reports not_ready when MongoDB ping fails", async () => {
    const connection = new MongoDbConnection(
      {
        uri: "mongodb://localhost:27017",
        dbName: "execution_service",
        tasksCollection: "execution_tasks",
        connectTimeoutMs: 100,
        readinessEnabled: true,
      },
      () => createFakeClient({ pingFails: true })
    );

    const status = await connection.ping();

    expect(status.name).toBe("mongodb");
    expect(status.status).toBe("not_ready");
    expect(status.error).toBe("database unavailable");
  });
});
