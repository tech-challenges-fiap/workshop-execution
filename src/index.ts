import { Hono } from "hono";
import { resolveHttpPort } from "./config/http.js";
import { executionTasksRouter } from "./routes/execution-tasks.js";
import { healthRouter } from "./routes/health.js";

const app = new Hono();

app.route("/", healthRouter);
app.route("/", executionTasksRouter);

const port = resolveHttpPort();

export default {
  port,
  fetch: app.fetch,
};
