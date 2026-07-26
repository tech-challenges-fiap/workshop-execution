# f4-execution-kubernetes-deploy — Design

## Manifest shape

`k8s/base/` follows the same five-manifest Kustomize shape `workshop-app`
uses (`deployment.yaml`, `service.yaml`, `configmap.yaml`, `hpa.yaml`,
`ingress.yaml`, `kustomization.yaml`). Resource names, labels, and the
container port are taken from `workshop-platform`'s
`kubernetes/base/services/execution-service/` manifests rather than copied
from `workshop-app`, because those manifests are the contract other
in-cluster services already depend on:

- Deployment/Service name: `execution-service` (matches
  `order-service-config`'s `EXECUTION_SERVICE_URL:
  http://execution-service.stag.svc.cluster.local`).
- Labels: `app.kubernetes.io/name: execution-service`,
  `app.kubernetes.io/component: worker`,
  `app.kubernetes.io/part-of: workshop-phase-4`.
- Container port: `8080` (named `http`), Service `port: 80 -> targetPort:
  http`, matching `workshop-platform`'s `HTTP_PORT: "8080"` convention so
  `http://execution-service...` (no port) resolves correctly.
- ConfigMap name: `execution-service-config`, carrying `SERVICE_NAME`,
  `HTTP_PORT`, `MONGODB_READINESS_ENABLED`, `RABBITMQ_URL`,
  `RABBITMQ_CONSUMER_ENABLED` (singular, matching this service's own
  `src/config/rabbitmq.ts` variable name — billing's equivalent variable is
  plural, so the two are intentionally not identical).

Overlays (`stag`, `prod`) patch `APP_ENV` and `MONGODB_READINESS_ENABLED`
(enabled once a real overlay deploy would have a real Mongo instance behind
it) and the ingress host; `stag` additionally scales the base replica count
down from 2 to 1, mirroring `workshop-app`'s cost-conscious `stag` pattern.

Secrets (`MONGODB_URI`, optionally `RABBITMQ_URL` with credentials) are never
committed; the deploy workflow creates/updates an `execution-service-secret`
Kubernetes Secret from GitHub Actions secrets immediately before applying
the overlay, the same pattern `workshop-app`'s deploy workflow uses for its
Postgres/JWT secret.

## Port-resolution fix

Before this change, `src/index.ts` read only `process.env.PORT`, defaulting
to `3000`, and the Dockerfile declared `EXPOSE 3000`. `workshop-platform`'s
shared ConfigMap for this service sets `HTTP_PORT: "8080"` and never sets
`PORT`, so a pod deployed against that ConfigMap would keep listening on
`3000` while the container port / readiness probes expect `8080` — the
liveness and readiness probes would never succeed.

The fix extracts a small, unit-testable `resolveHttpPort(env)` helper in
`src/config/http.ts`, following the existing pattern of one config module
per concern (`config/mongodb.ts`, `config/rabbitmq.ts`). Precedence is
`HTTP_PORT` (the platform-provided variable) → `PORT` (the override this
service's README documents for local development) → `3000` (unchanged
default). Invalid or non-positive values are treated as unset rather than
throwing, keeping the service's existing lenient-parsing style. The
Dockerfile's `EXPOSE` is updated to `8080` to match the new effective
default once the ConfigMap's `HTTP_PORT` is in play; `EXPOSE` remains purely
documentary and does not constrain the actual bound port.

## Deploy workflow — dormant by design

`.github/workflows/deploy.yml` is structurally identical in shape to
`workshop-app`'s: build the app, build+push a container image to ECR via
OIDC (`id-token: write`, no static AWS credentials), configure `kubectl`
against the shared EKS cluster, apply an Kubernetes Secret built from
GitHub Actions secrets, render+apply the target overlay, wait for rollout,
and smoke-test `GET /health` through a port-forward. It triggers on push to
`stag`/`prod` and `workflow_dispatch`, exactly like `workshop-app`'s, but is
disabled immediately after creation via `gh workflow disable Deploy` so no
real AWS spend happens as a side effect of this change landing.

## PR validation

The new `k8s` job in `pr-validation.yml` only runs `kubectl kustomize` against
both overlays — no cluster, no AWS credentials, no network calls — so every
PR gets a structural guarantee that the manifests are valid Kustomize
without any deploy-time cost or risk.
