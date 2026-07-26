# Tasks

- [x] 1. Validate OpenSpec change with `npx --yes @fission-ai/openspec validate f4-execution-sonarcloud-quality-gate --strict` before implementation.
- [x] 2. Add `bunfig.toml` with `[test]` `coverage = true`, `coverageReporter = ["text", "lcov"]`, `coverageDir = "coverage"`.
- [x] 3. Confirm `bun run test:coverage` produces a non-empty `coverage/lcov.info`.
- [x] 4. Add `sonar-project.properties` at repo root (`sonar.projectKey=tech-challenges-fiap_workshop-execution`, `sonar.sources=src`, `sonar.javascript.lcov.reportPaths=coverage/lcov.info`).
- [x] 5. Update the `Test` step in the `ci` job of `.github/workflows/pr-validation.yml` to run `bun run test:coverage`.
- [x] 6. Add a `Sonar` step as the last step of the `ci` job using `SonarSource/sonarcloud-github-action@v3.1.0` with `SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}`.
- [x] 7. Run `bun install`, `bun run lint`, `bun test`, `bun run test:coverage`, `bun run build` and confirm results.
- [x] 8. Sanity-check `.github/workflows/pr-validation.yml` parses as valid YAML.
- [x] 9. Run OpenSpec strict validation again after implementation. PASSED.
- [ ] 10. Open a PR into `stag` referencing this change id, noting `SONAR_TOKEN` is not yet configured for `tech-challenges-fiap/workshop-execution` and the Sonar step (and overall `ci` job status) is expected to fail until a human runs `gh secret set SONAR_TOKEN --repo tech-challenges-fiap/workshop-execution`.
