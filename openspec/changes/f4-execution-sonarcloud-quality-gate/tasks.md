# Tasks

- [x] 1. Validate OpenSpec change with `npx --yes @fission-ai/openspec validate f4-execution-sonarcloud-quality-gate --strict` before implementation.
- [x] 2. Add `bunfig.toml` with `[test]` `coverage = true`, `coverageReporter = ["text", "lcov"]`, `coverageDir = "coverage"`.
- [x] 3. Confirm `bun run test:coverage` produces a non-empty `coverage/lcov.info`.
- [x] 4. Add `sonar-project.properties` at repo root (`sonar.projectKey=tech-challenges-fiap_workshop-execution`, `sonar.sources=src`, `sonar.tests=src`, `sonar.test.inclusions=**/*.test.ts`, `sonar.exclusions=**/*.test.ts`, `sonar.javascript.lcov.reportPaths=coverage/lcov.info`).
- [x] 5. Update the `Test` step in the `ci` job of `.github/workflows/pr-validation.yml` to run `bun run test:coverage`.
- [x] 6. Add a `Sonar` step as the last step of the `ci` job using `SonarSource/sonarqube-scan-action@v8.2.1` with `SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}` and `continue-on-error: true`.
- [x] 7. Run `bun install`, `bun run lint`, `bun test`, `bun run test:coverage`, `bun run build` and confirm results.
- [x] 8. Sanity-check `.github/workflows/pr-validation.yml` parses as valid YAML.
- [x] 9. Run OpenSpec strict validation again after implementation. PASSED.
- [x] 10. Open a PR into `stag` referencing this change id, noting `SONAR_TOKEN` is not yet configured for `tech-challenges-fiap/workshop-execution` and the Sonar step is expected to fail until a human runs `gh secret set SONAR_TOKEN --repo tech-challenges-fiap/workshop-execution`.

## 11. Post-review fixes (Codex automated review on PR #2)

- [x] 11.1 Discovered `ci` is this repo's sole required branch-protection status check; a Sonar step failure (guaranteed until `SONAR_TOKEN` exists), even placed last, would still fail the whole required `ci` job. Added `continue-on-error: true` to the `Sonar` step with an explanatory comment.
- [x] 11.2 Discovered `SonarSource/sonarcloud-github-action` is archived/deprecated. Switched to `SonarSource/sonarqube-scan-action@v8.2.1` (latest release per `gh release list --repo SonarSource/sonarqube-scan-action`); confirmed input names are unchanged.
- [x] 11.3 Applied the same test-file classification fix as workshop-app/workshop-billing (`sonar.tests=src`, `sonar.test.inclusions=**/*.test.ts`, `sonar.exclusions=**/*.test.ts`) for consistency, since this repo also co-locates `*.test.ts` files under `src/`.
- [x] 11.4 Re-ran full verification (`bun install`, `bun run lint`, `bun test`, `bun run test:coverage`, `bun run build`, `openspec validate --strict`, YAML sanity check) after the fixes.
