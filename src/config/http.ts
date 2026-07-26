const DEFAULT_HTTP_PORT = 3000;

function parsePort(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

/**
 * Resolves the HTTP port the server should bind to.
 *
 * `HTTP_PORT` takes precedence because it is the variable the platform's
 * shared Kubernetes ConfigMap sets for this service. `PORT` is kept as a
 * fallback because it is the override documented in this service's README
 * for local development. When neither is set, the server defaults to 3000.
 */
export function resolveHttpPort(env: NodeJS.ProcessEnv = process.env): number {
  return parsePort(env.HTTP_PORT) ?? parsePort(env.PORT) ?? DEFAULT_HTTP_PORT;
}
