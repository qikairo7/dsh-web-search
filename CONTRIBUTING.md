# Contributing

This repository is a free web plugin for DSH: free search and fetch backends for `web_search` and `web_fetch`. Issues and pull requests are welcome. Behavior changes go in [CHANGELOG.md](CHANGELOG.md). Taking part means you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

Read [AGENTS.md](AGENTS.md), [CODING_STANDARDS.md](CODING_STANDARDS.md), [docs/AGENTS.md](docs/AGENTS.md), and [docs/architecture.md](docs/architecture.md) first.

## What we value

- One pull request solves one cohesive problem, with no unrelated cleanup.
- No speculative fallbacks or premature abstraction. Extract only reused logic with a real boundary.
- Delete replaced code. Leave no dead branches or compatibility shells.
- [CODING_STANDARDS.md](CODING_STANDARDS.md) is the source of truth for these rules.

## Before you start

- Search existing issues and pull requests to avoid duplicate work.
- Reproduce a bug through the real entry point and record the actual output before you report it.
- If a change breaks configuration or contract semantics, open an issue or write an ADR ([docs/adr/](docs/adr/)) first.

## Development docs

- Workflow and environment: [docs/development.md](docs/development.md)
- Tests: [docs/testing.md](docs/testing.md)
- New provider: [docs/cookbook/adding-a-provider.md](docs/cookbook/adding-a-provider.md)
- Review gate: [CODING_STANDARDS.md](CODING_STANDARDS.md#9-review-门禁) section 9

## Security boundary

Read [SAFETY.md](SAFETY.md) first. It defines untrusted input, credential boundaries, and the risk model. A successful normal request does not prove isolation works.

## Commits and pull requests

- Commit messages and pull request titles use a Conventional Commits subject: `type(scope): summary`, where `type` is `feat`, `fix`, `docs`, `chore`, `refactor`, or `test`.
- End the commit body with `Verified-by: <method>`, such as `Verified-by: pnpm-check`; write `Verified-by: none <reason>` when unverified.
- In the pull request description, state what changed, the related issue (`Fixes #N` for fixes), and how you verified it (paste command output; mark anything you did not run as not-run).
- Branch from `origin/main`, target `main`, and pass CI and `pnpm check` before merge.

## Validation

- Run `pnpm check` before you commit. It covers syntax, architecture, order-doc sync, doc code blocks, translation pairing, docs:check, doc reference liveness, and unit tests.
- For settings or fetch behavior changes, install into DSH and verify once on a real machine, then put the raw output or screenshot in the pull request.
