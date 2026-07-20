import { describe, it, expect } from "bun:test";
import { createHealthRouter, healthRouter } from "./health.js";

describe("GET /health", () => {
  it("returns 200 with status ok", async () => {
    const res = await healthRouter.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.service).toBe("execution-service");
  });
});

describe("GET /ready", () => {
  it("returns 200 with status ready when MongoDB readiness is skipped by default", async () => {
    const res = await healthRouter.request("/ready");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ready");
    expect(body.service).toBe("execution-service");
    expect(body.dependencies).toEqual([{ name: "mongodb", status: "skipped" }]);
  });

  it("returns 200 when dependencies are ready", async () => {
    const router = createHealthRouter({
      checkDependencies: async () => [{ name: "mongodb", status: "ready" }],
    });

    const res = await router.request("/ready");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("ready");
    expect(body.dependencies).toEqual([{ name: "mongodb", status: "ready" }]);
  });

  it("returns 503 when a dependency is not ready", async () => {
    const router = createHealthRouter({
      checkDependencies: async () => [
        { name: "mongodb", status: "not_ready", error: "database unavailable" },
      ],
    });

    const res = await router.request("/ready");
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.status).toBe("not_ready");
    expect(body.dependencies).toEqual([
      { name: "mongodb", status: "not_ready", error: "database unavailable" },
    ]);
  });
});
