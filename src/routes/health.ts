import { Hono } from "hono";
import {
  mongoDbConnection,
  type DependencyStatus,
} from "../persistence/mongodb-client.js";

interface HealthRouterOptions {
  readonly checkDependencies?: () => Promise<DependencyStatus[]>;
}

async function checkMongoDependency(): Promise<DependencyStatus[]> {
  return [await mongoDbConnection.ping()];
}

export function createHealthRouter(options: HealthRouterOptions = {}): Hono {
  const router = new Hono();
  const checkDependencies = options.checkDependencies ?? checkMongoDependency;

  router.get("/health", (c) =>
    c.json({ status: "ok", service: "execution-service" })
  );

  router.get("/ready", async (c) => {
    const dependencies = await checkDependencies();
    const isReady = dependencies.every(
      (dependency) => dependency.status === "ready" || dependency.status === "skipped"
    );

    return c.json(
      {
        status: isReady ? "ready" : "not_ready",
        service: "execution-service",
        dependencies,
      },
      isReady ? 200 : 503
    );
  });

  return router;
}

export const healthRouter = createHealthRouter();
