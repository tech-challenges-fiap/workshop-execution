import { describe, expect, it } from "bun:test";
import { resolveHttpPort } from "./http.js";

describe("resolveHttpPort", () => {
  it("defaults to 3000 when neither HTTP_PORT nor PORT is set", () => {
    expect(resolveHttpPort({})).toBe(3000);
  });

  it("uses PORT when HTTP_PORT is absent", () => {
    expect(resolveHttpPort({ PORT: "4000" })).toBe(4000);
  });

  it("prefers HTTP_PORT over PORT", () => {
    expect(resolveHttpPort({ HTTP_PORT: "8080", PORT: "4000" })).toBe(8080);
  });

  it("falls back to PORT when HTTP_PORT is invalid", () => {
    expect(resolveHttpPort({ HTTP_PORT: "not-a-number", PORT: "5000" })).toBe(5000);
  });

  it("falls back to the default when both values are invalid", () => {
    expect(resolveHttpPort({ HTTP_PORT: "0", PORT: "-5" })).toBe(3000);
  });
});
