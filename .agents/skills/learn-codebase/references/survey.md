# Survey

How to map a repository before teaching it. The goal is a **system model** complete enough to build a curriculum from, gathered from the code itself rather than guessed.

## Size it first

Run `git ls-files | wc -l` and look at the top-level layout. Small repo (under ~300 files): survey file by file. Large repo or monorepo: survey at package or service level first, then go file-level only for the learner's goal area and the tracer path.

## What to find

Work through every item. Note `path:line` for anything you'll teach from.

1. **Purpose and docs**: README, `docs/`, ADRs, CONTRIBUTING, architecture notes, wikis linked from the README. Mark where docs disagree with code; that disagreement is worth teaching.
2. **Stack**: manifests and lockfiles (`package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `pom.xml`, `build.gradle`, `Gemfile`, `composer.json`, `*.csproj`), runtime versions (`.nvmrc`, `.tool-versions`, `Dockerfile` base images).
3. **Run, build, test**: package scripts, `Makefile`, `justfile`, `Taskfile`, `docker-compose`, devcontainers. Find the exact commands to install, run locally, and run tests.
4. **Entry points**: `main`, server bootstrap, route tables, CLI commands, serverless handlers, workers, cron jobs, queue consumers, frontend root and router.
5. **Architecture**: layers and module boundaries, dependency direction (who imports whom), dependency injection or wiring, the shared kernel or `common` packages.
6. **Data**: schemas, migrations, ORM models, the core entities and their relationships, caches, file or blob storage.
7. **Integrations**: outbound HTTP clients, SDKs, queues, webhooks, third-party auth, feature-flag services.
8. **Config and secrets**: `.env.example`, config loaders, per-environment files, feature flags. Record which settings are needed to run locally.
9. **Cross-cutting**: auth and permissions, error handling, logging and observability, validation, i18n.
10. **Tests**: layout, kinds (unit, integration, e2e), fixtures and factories, how to run one test.
11. **Delivery**: CI workflows, deploy scripts, infrastructure as code, release process.
12. **History signals**: `git log --since="6 months ago" --name-only --format="" | sort | uniq -c | sort -rn | head -20` for hot files; `git shortlog -sn --since="1 year ago" | head` for who to ask. Hot files usually deserve a lesson.
13. **Out of scope**: generated code, vendored dependencies, build output, fixtures. List them with the reason, so the learner knows they can ignore them.

## System model

Return (or record) this, concise and with `path:line` references:

```markdown
## Purpose
One paragraph: what it does, for whom.

## Stack
Languages, frameworks, datastores, infra — with versions where pinned.

## Commands
install / run / test / test-one / lint / build

## Entry points
- <kind>: <path:line> — <what starts here>

## Modules
- <module/path>: responsibility, depends on <...>, key files <...>

## Core flows
- <user action>: <entry> → <layer> → <layer> → <side effect>

## Domain glossary
- <term>: meaning, where it lives in code

## Cross-cutting
auth, errors, logging, config — one line each with location

## Out of scope
- <path>: reason

## Unknowns
Things the code doesn't answer; questions for the team.
```

Pick the tracer flow from **Core flows**: the most representative user action that crosses the most layers.
