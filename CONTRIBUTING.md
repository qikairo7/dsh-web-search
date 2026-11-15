# Contributing

English | [中文](CONTRIBUTING.zh.md)

This repository is a DSH plugin maintained as an open-source product. Issues and pull requests are welcome. Behavior changes are recorded in [CHANGELOG.md](CHANGELOG.md).

Before you start, read these in order:

1. [AGENTS.md](AGENTS.md): standing rules and entry points.
2. [CODING_STANDARDS.md](CODING_STANDARDS.md): implementation and review standards.
3. [docs/AGENTS.md](docs/AGENTS.md): documentation hierarchy, ownership of facts, and writing rules.
4. [docs/architecture.md](docs/architecture.md): composition, modules, and request flow.

## Development workflow

- Environment, commands, and troubleshooting: [docs/development.md](docs/development.md).
- Test strategy: [docs/testing.md](docs/testing.md).
- Adding a provider: [docs/cookbook/adding-a-provider.md](docs/cookbook/adding-a-provider.md).

## Commits and pull requests

- Branch from `origin/main`. Target pull requests at `main`.
- Use a branch name of two or three short words joined by hyphens, such as `fix-router-fallback`.
- Use `type(scope): summary` for commit messages and pull request titles. `type` is one of `feat`, `fix`, `docs`, `chore`, `refactor`, `test`.
- Run `pnpm docs:check` and `pnpm check` before you commit. See [AGENTS.md](AGENTS.md) for the `spawn EPERM` workaround in the DSH sandbox.

## Review

Review the artifact-level rules in [docs/defensive-patterns.md](docs/defensive-patterns.md), then confirm every item in the review gate of [CODING_STANDARDS.md](CODING_STANDARDS.md). A failure of any item blocks the merge.
