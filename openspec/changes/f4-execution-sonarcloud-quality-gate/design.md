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
- **Required-check isolation (corrected after review)**: placing Sonar last is not, by itself, sufficient — a job's overall/required-check status fails if *any* step in it fails, regardless of position. `ci` is this repo's only required branch-protection status check on `stag`/`prod` (`gh api repos/tech-challenges-fiap/workshop-execution/branches/stag/protection` lists only `ci`), so an un-mitigated Sonar failure would still block every PR. The fix is `continue-on-error: true` on the `Sonar` step: its own result is still visible (as a non-blocking warning), but it no longer counts toward the job's/required check's pass/fail outcome.
- **Action version**: pin `SonarSource/sonarqube-scan-action@v8.2.1`. `SonarSource/sonarcloud-github-action` (previously pinned at `v3.1.0`) is archived — its GitHub repo reports `archived: true` and its description reads "Deprecated. Use https://github.com/SonarSource/sonarqube-scan-action instead." The two actions expose the same inputs (`args`, `projectBaseDir`, `scannerVersion`, `scannerBinariesUrl`) and both read `SONAR_TOKEN`/`GITHUB_TOKEN` from the environment, so switching is a drop-in replacement.
- **Test file classification**: `workshop-execution` also keeps `*.test.ts` files co-located with source under `src/` (e.g. `src/config/rabbitmq.test.ts`). `sonar.tests=src` plus `sonar.test.inclusions=**/*.test.ts` classifies matching files as tests, and `sonar.exclusions=**/*.test.ts` removes them from the production-source scan so they are not double-counted — applied here for consistency with the same fix in `workshop-app` and `workshop-billing`, even though this repo's review comment focused on the action version.

## Risks / Trade-offs

- Until `SONAR_TOKEN` exists, the `Sonar` step will show as failed (non-blocking, via `continue-on-error: true`) in the `ci` job's step list, while the job's overall/required status stays green as long as Lint/Test/Build/Docker build pass. Reviewers should still check individual step status to see the Sonar step's real outcome.
- Bun's coverage instrumentation adds minor overhead to `bun run test:coverage`; plain `bun test` also now prints a coverage table (from `bunfig.toml`'s `coverage = true` default) but this is cosmetic and does not fail the run.
