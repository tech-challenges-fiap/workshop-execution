import { Hono } from "hono";
import { executionTasksRouter } from "./routes/execution-tasks.js";
import { healthRouter } from "./routes/health.js";

const app = new Hono();

app.route("/", healthRouter);
app.route("/", executionTasksRouter);

const port = Number(process.env.PORT ?? 3000);

export default {
  port,
  fetch: app.fetch,
};
