# Change: Execution SonarCloud quality gate

## Why

Phase 4 closure requires static-analysis and quality-gate scanning in CI for `workshop-app`, `workshop-billing`, and `workshop-execution`. None of the six repositories in the platform currently run SonarQube/SonarCloud, and `workshop-execution` does not persist test coverage anywhere today. This change closes that gap for the Execution Service by producing lcov coverage in the existing `ci` job and scanning it with SonarCloud, without making the `ci` job's existing Lint/Test/Build/Docker steps depend on the scan result.

`ci` is the sole **required status check** for both `stag` and `prod` branch protection on this repo (confirmed via `gh api repos/tech-challenges-fiap/workshop-execution/branches/stag/protection`). Because this repo has only one job, any step failure fails that whole required check — so the `Sonar` step must be explicitly non-blocking (`continue-on-error: true`) until `SONAR_TOKEN` exists, or it would block every PR into `stag`/`prod`.

## What Changes

- Confirm `package.json` already has `test:coverage` (`bun test --coverage`) and make it actually emit `coverage/lcov.info` by adding a `bunfig.toml` with `[test]` `coverageReporter = ["text", "lcov"]` and `coverageDir = "coverage"`.
- Change the `Test` step in the single `ci` job of `.github/workflows/pr-validation.yml` to run `bun run test:coverage` instead of `bun test`.
- Add a `Sonar` step as the last step of the `ci` job — after `Test`, `Build`, and `Docker build` — using `SonarSource/sonarqube-scan-action@v8.2.1` (the current, non-deprecated action; `SonarSource/sonarcloud-github-action` is archived and redirects to this action), reading `SONAR_TOKEN` from repository secrets, with `continue-on-error: true` so it cannot fail the required `ci` status check. Placing it last ensures Lint/Test/Build/Docker build always run and report their own real status first.
- Add a `sonar-project.properties` file at the repo root: `sonar.projectKey=tech-challenges-fiap_workshop-execution`, `sonar.sources=src`, `sonar.tests=src` with `sonar.test.inclusions=**/*.test.ts` and `sonar.exclusions=**/*.test.ts` (so co-located `*.test.ts` files are classified as tests, not double-counted as production source), and `sonar.javascript.lcov.reportPaths=coverage/lcov.info`.

## Non-Goals

- Do not provision the actual SonarCloud organization/project or the `SONAR_TOKEN` GitHub secret — a human must create the SonarCloud org and run `gh secret set SONAR_TOKEN --repo tech-challenges-fiap/workshop-execution`. Until then the `Sonar` step is expected to fail, but `continue-on-error: true` keeps that failure from blocking the required `ci` check; Lint/Test/Build/Docker build are earlier steps in the same job and already report their own pass/fail status by the time Sonar runs.
- Do not enforce a hard Sonar Quality Gate wait/fail in this first pass.
- Do not change execution domain logic, messaging, HTTP endpoints, or persistence behavior.
