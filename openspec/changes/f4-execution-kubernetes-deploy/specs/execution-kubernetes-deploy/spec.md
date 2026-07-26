## ADDED Requirements

### Requirement: Kubernetes deploy manifests

The Execution Service SHALL provide Kustomize base and overlay manifests
sufficient to deploy `execution-service` to the shared EKS cluster, named
and wired to match `workshop-platform`'s existing shared ConfigMap and
Service contract for this service.

#### Scenario: Base manifests render

- **GIVEN** `k8s/base/` containing `deployment.yaml`, `service.yaml`,
  `configmap.yaml`, `hpa.yaml`, `ingress.yaml`, and `kustomization.yaml`
- **WHEN** `kubectl kustomize k8s/base` is run
- **THEN** it renders a Deployment, Service, ConfigMap, HorizontalPodAutoscaler,
  and Ingress all named `execution-service`
- **AND** the Deployment's container listens on port `8080`

#### Scenario: Overlays render per environment

- **GIVEN** `k8s/overlays/stag/` and `k8s/overlays/prod/`, each referencing
  `../../base` and patching `runtime-config.yaml` and `ingress-patch.yaml`
  (`stag` additionally patches `replicas-patch.yaml`)
- **WHEN** `kubectl kustomize k8s/overlays/stag` and
  `kubectl kustomize k8s/overlays/prod` are run
- **THEN** both render without error
- **AND** each sets its namespace (`stag` or `prod`) and a distinct ingress host

### Requirement: Dormant deploy workflow

The Execution Service SHALL provide a `Deploy` GitHub Actions workflow
structurally equivalent to `workshop-app`'s (build, push to ECR via OIDC,
configure `kubectl`, apply the target overlay, wait for rollout, smoke-test
`/health`), and that workflow SHALL remain disabled after creation so no
real AWS deploy happens as a side effect of adding it.

#### Scenario: Workflow triggers match workshop-app's pattern

- **GIVEN** `.github/workflows/deploy.yml`
- **WHEN** inspecting its `on:` triggers
- **THEN** it triggers on push to `stag` and `prod` and on `workflow_dispatch`
- **AND** it requests `id-token: write` permission for AWS OIDC and no
  static AWS credentials are stored in the repository

#### Scenario: Workflow is disabled after creation

- **GIVEN** the `Deploy` workflow exists on the repository
- **WHEN** `gh workflow disable Deploy` is run against the repository
- **THEN** the workflow is marked disabled and will not run on push,
  matching `workshop-app`'s dormant deploy workflow

### Requirement: PR-validation Kubernetes render check

The Execution Service SHALL validate its Kubernetes manifests on every pull
request using only local rendering, with no cluster access and no AWS calls.

#### Scenario: k8s job renders both overlays

- **GIVEN** the `k8s` job in `.github/workflows/pr-validation.yml`
- **WHEN** a pull request targeting `stag` or `prod` is opened or updated
- **THEN** the job runs `kubectl kustomize k8s/overlays/stag` and
  `kubectl kustomize k8s/overlays/prod`
- **AND** the job fails if either overlay fails to render
- **AND** the job does not configure AWS credentials or contact a cluster

### Requirement: HTTP port resolves from platform configuration

The Execution Service SHALL bind its HTTP server to the port supplied by
`HTTP_PORT` when present, falling back to `PORT`, and defaulting to `3000`
when neither is set, so that the service works correctly against
`workshop-platform`'s shared ConfigMap (which sets `HTTP_PORT` and not
`PORT`).

#### Scenario: HTTP_PORT is set

- **GIVEN** the environment variable `HTTP_PORT` is set to a positive integer
- **WHEN** the service resolves its listen port
- **THEN** it binds to the value of `HTTP_PORT`, ignoring `PORT` if also set

#### Scenario: Only PORT is set

- **GIVEN** `HTTP_PORT` is absent or invalid and `PORT` is set to a positive
  integer
- **WHEN** the service resolves its listen port
- **THEN** it binds to the value of `PORT`

#### Scenario: Neither variable is set

- **GIVEN** neither `HTTP_PORT` nor `PORT` is set (or both are invalid)
- **WHEN** the service resolves its listen port
- **THEN** it binds to the default port `3000`

#### Scenario: Container port matches the platform default

- **GIVEN** the Dockerfile and the `k8s/base` Deployment's container port
- **WHEN** inspecting both
- **THEN** the Dockerfile's `EXPOSE` and the Deployment's `containerPort`
  both declare `8080`, matching the ConfigMap's `HTTP_PORT` value
