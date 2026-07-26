# f4-execution-kubernetes-deploy — Proposal

**Status:** Done
**Author:** Phase 4 Team
**Date:** 2026-07-26

## Why

Fase 4 closure requires every Phase 4 service to reach the same Kubernetes
deploy-manifest parity that `workshop-app` already has. `workshop-execution`
currently has no Kubernetes manifests and no deploy workflow, so it cannot be
rolled out to the shared EKS cluster the way `workshop-app` can. It also has a
latent runtime bug: the HTTP server hardcodes port `3000` and ignores
`HTTP_PORT`, the variable `workshop-platform`'s shared ConfigMap already sets
for this service (`HTTP_PORT: "8080"`), so a real deployment using that
ConfigMap would fail its readiness/liveness probes.

## What Changes

- Add `k8s/base/` (deployment, service, configmap, hpa, ingress) and
  `k8s/overlays/{stag,prod}/` Kustomize manifests for `execution-service`,
  mirroring the shape and naming already used by `workshop-platform`'s
  `kubernetes/base/services/execution-service/` manifests (service name,
  ConfigMap keys, container port 8080).
- Add `.github/workflows/deploy.yml`, built and pushed to ECR via OIDC,
  applied to the cluster via `kubectl kustomize` + `kubectl apply`, with a
  rollout status check and an HTTP smoke test — structurally identical to
  `workshop-app`'s deploy workflow, but **created disabled** for cost
  reasons: real AWS deploys stay off until a human explicitly turns it on.
- Add a `k8s` job to `.github/workflows/pr-validation.yml` that renders both
  overlays with `kubectl kustomize` (no cluster, no AWS calls) as a
  structural PR gate.
- Fix `src/index.ts` to resolve the HTTP port through a new
  `src/config/http.ts#resolveHttpPort`, preferring `HTTP_PORT`, falling back
  to `PORT` (the override this service's README already documents), and
  defaulting to `3000` when neither is set. Update the Dockerfile's `EXPOSE`
  from `3000` to `8080` to match the new default wired through the
  ConfigMap.

## Scope

**In scope:**
- Kubernetes base + overlay manifests for `execution-service`.
- Deploy and PR-validation workflow additions.
- The `HTTP_PORT`/`PORT` port-resolution fix and its unit tests.

**Out of scope:**
- Actually deploying to AWS (the deploy workflow is disabled on merge).
- Provisioning the EKS cluster, RDS/Mongo instances, or RabbitMQ broker
  (owned by `workshop-platform`).
- A full local `kind` cluster run of all three services (reserved as a
  separate, human-run validation step).
- Wiring real RabbitMQ credentials or a managed MongoDB URI (the ConfigMap
  ships safe, non-secret placeholder defaults; real values are injected at
  deploy time via `kubectl create secret`).

## Decision

Replicate `workshop-app`'s Kustomize base/overlay shape exactly, but name and
wire resources (`execution-service`, `execution-service-config`, container
port `8080`) to match `workshop-platform`'s existing shared ConfigMap and
Service definitions for this service, since that repository is the source of
truth for how `execution-service` is expected to be addressed inside the
cluster (e.g. `order-service`'s ConfigMap already resolves it at
`http://execution-service.stag.svc.cluster.local`). The deploy workflow is
added but immediately disabled (`gh workflow disable`) so no real AWS
resources are touched by this change.

## Risks

- The deploy workflow has never been run for real, so its correctness beyond
  structural review and `kubectl kustomize` rendering is unverified until a
  human runs it (or a local `kind` cluster) after merge.
- `RABBITMQ_URL`/`MONGODB_URI` in the ConfigMap are non-secret placeholders;
  real credentials must be supplied as repository/environment secrets before
  the workflow is ever enabled.
