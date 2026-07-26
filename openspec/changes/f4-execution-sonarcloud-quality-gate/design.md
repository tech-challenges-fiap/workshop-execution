# Design: Execution SonarCloud quality gate

## Context

`workshop-execution`'s installed Bun (1.3.11 in this workspace) exposes `--coverage`, `--coverage-reporter=<val>` (`text` and/or `lcov`, default `text`), and `--coverage-dir=<val>` (default `coverage`) per `bun test --help`. The repo's `.github/workflows/pr-validation.yml` has a single `ci` job: Checkout, Setup Bun, Install dependencies, Lint (`bun x tsc --noEmit`), Test (`bun test`), Build, Docker build.

## Goals / Non-Goals

**Goals:**
- Make `bun run test:coverage` deterministically emit `coverage/lcov.info` via a version-controlled `bunfig.toml` `[test]` block (`coverage = true`, `coverageReporter = ["text", "lcov"]`, `coverageDir = "coverage"`), not just an undocumented CLI flag.
- Run a SonarCloud scan against that lcov file as the last step of the `ci` job, so Lint/Test/Build/Docker build always execute and report their real status before a possible Sonar failure.

**Non-Goals:**
- Configuring the actual SonarCloud org/project or `SONAR_TOKEN` secret.
- Enforcing `sonar.qualitygate.wait=true` in this first pass.
- Changing execution task/queue business logic or tests.

## Decisions

- **Coverage mechanism**: `bunfig.toml` `[test]` coverage settings, identical mechanism to `workshop-app` and `workshop-billing` for consistency across the platform's three Bun/TypeScript services.
- **CI step placement**: the `Sonar` step is added as the *last* step in the single `ci` job — after `Test`, `Build`, and `Docker build` — because GitHub Actions steps within a job run sequentially and a failing step skips subsequent steps by default. Placing Sonar last guarantees Lint/Test/Build/Docker build are never skipped due to a Sonar failure (e.g. missing `SONAR_TOKEN`).
- **Action version**: pin `SonarSource/sonarcloud-github-action@v3.1.0`. `v4.0.0` and `v5.0.0` are deprecated wrappers redirecting to `SonarSource/sonarqube-scan-action` with a warning; `v3.1.0` is the latest non-deprecated release of the action named in the closure plan.

## Risks / Trade-offs

- Until `SONAR_TOKEN` exists, the `Sonar` step fails and the `ci` job's overall status shows failed, even though Lint/Test/Build/Docker build completed successfully as earlier steps. Reviewers should check individual step status, not just overall job status, until the secret is configured.
- Bun's coverage instrumentation adds minor overhead to `bun run test:coverage`; plain `bun test` also now prints a coverage table (from `bunfig.toml`'s `coverage = true` default) but this is cosmetic and does not fail the run.
