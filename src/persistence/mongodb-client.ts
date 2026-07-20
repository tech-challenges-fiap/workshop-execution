import { MongoClient, type Db, type MongoClientOptions } from "mongodb";
import { loadMongoDbConfig, type MongoDbConfig } from "../config/mongodb.js";

export interface DependencyStatus {
  readonly name: string;
  readonly status: "ready" | "not_ready" | "skipped";
  readonly error?: string;
}

type MongoClientFactory = (uri: string, options: MongoClientOptions) => MongoClient;

export class MongoDbConnection {
  private client: MongoClient | undefined;

  constructor(
    private readonly config: MongoDbConfig = loadMongoDbConfig(),
    private readonly clientFactory: MongoClientFactory = (uri, options) =>
      new MongoClient(uri, options)
  ) {}

  async getClient(): Promise<MongoClient> {
    if (this.client) {
      return this.client;
    }

    const client = this.clientFactory(this.config.uri, {
      connectTimeoutMS: this.config.connectTimeoutMs,
      serverSelectionTimeoutMS: this.config.connectTimeoutMs,
    });

    this.client = await client.connect();
    return this.client;
  }

  async getDb(): Promise<Db> {
    const client = await this.getClient();
    return client.db(this.config.dbName);
  }

  async ping(): Promise<DependencyStatus> {
    if (!this.config.readinessEnabled) {
      return { name: "mongodb", status: "skipped" };
    }

    try {
      const db = await this.getDb();
      await db.admin().ping();
      return { name: "mongodb", status: "ready" };
    } catch (error) {
      return {
        name: "mongodb",
        status: "not_ready",
        error: error instanceof Error ? error.message : "Unknown MongoDB readiness error",
      };
    }
  }

  async close(): Promise<void> {
    if (!this.client) {
      return;
    }

    await this.client.close();
    this.client = undefined;
  }
}

export const mongoDbConnection = new MongoDbConnection();
