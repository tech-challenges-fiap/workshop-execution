export interface MongoDbConfig {
  readonly uri: string;
  readonly dbName: string;
  readonly tasksCollection: string;
  readonly connectTimeoutMs: number;
  readonly readinessEnabled: boolean;
}

const DEFAULT_MONGODB_URI = "mongodb://localhost:27017";
const DEFAULT_DB_NAME = "execution_service";
const DEFAULT_TASKS_COLLECTION = "execution_tasks";
const DEFAULT_CONNECT_TIMEOUT_MS = 5000;

function readBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value.trim() === "") {
    return defaultValue;
  }

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function readPositiveInteger(value: string | undefined, defaultValue: number): number {
  if (value === undefined || value.trim() === "") {
    return defaultValue;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

export function loadMongoDbConfig(env: NodeJS.ProcessEnv = process.env): MongoDbConfig {
  return {
    uri: env.MONGODB_URI?.trim() || DEFAULT_MONGODB_URI,
    dbName: env.MONGODB_DB_NAME?.trim() || DEFAULT_DB_NAME,
    tasksCollection: env.MONGODB_TASKS_COLLECTION?.trim() || DEFAULT_TASKS_COLLECTION,
    connectTimeoutMs: readPositiveInteger(
      env.MONGODB_CONNECT_TIMEOUT_MS,
      DEFAULT_CONNECT_TIMEOUT_MS
    ),
    readinessEnabled: readBoolean(env.MONGODB_READINESS_ENABLED, false),
  };
}
