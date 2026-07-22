# Structure and Technical Docs

## Table of Contents

- [Target File Tree](#target-file-tree)
- [Root AGENTS.md Manifest](#root-agentsmd-manifest)
- [docs/technical/ Files](#docstechnical-files)
- [Adding or Removing Topics](#adding-or-removing-topics)
- [Linking Rules](#linking-rules)
- [Size Budgets](#size-budgets)

## Target File Tree

```
repo-root/
├── AGENTS.md                    # concise tech-stack manifest
└── docs/
    └── technical/
        ├── conventions.md       # style, naming, formatting, error handling
        ├── architecture.md      # shape, boundaries, data flow (NOT a file map)
        ├── rules.md             # hard constraints and gotchas
        ├── testing.md           # framework, how to run, conventions
        └── tooling.md           # build, lint, format, CI
```

Keep every technical doc one level under `docs/technical/`. Do not nest deeper (e.g. `docs/technical/conventions/style.md`) unless a single file outgrows its size budget; if it does, split it and add an index file in its place.

The skill is language- and stack-agnostic. These five topics fit most repos, but they are defaults — add, rename, or remove topics to match the project.

## Root AGENTS.md Manifest

`AGENTS.md` loads on every request, so it stays a concise **tech-stack manifest**: what the project is built with, plus a table pointing into `docs/technical/`. It is technical only — no business, product, or roadmap context.

Sections:

1. **Stack** — languages, runtimes, and frameworks with versions.
2. **Key libraries & packages** — notable direct dependencies with versions and a one-word purpose.
3. **Commands** — only the non-obvious install/build/test/lint commands.
4. **Technical docs** — a table linking each topic to its `docs/technical/*.md` file.

`scripts/init-agents.ts` detects the stack from manifest files (package.json, Cargo.toml, go.mod, pyproject.toml/requirements.txt, pom.xml/build.gradle, Gemfile, composer.json, *.csproj, pubspec.yaml) and pre-fills the manifest. Verify the detected values and fill in anything marked `—`.

Notes:

- Do not duplicate `docs/technical/` content in the root. Pointers only.
- List direct dependencies, not the full transitive tree. Keep to the ones an agent must know about.
- No forcing tone (ALWAYS/NEVER/MUST) in the manifest.

## docs/technical/ Files

Each `docs/technical/*.md` is a progressive-disclosure target. The agent reads it only when working in that area. Keep each focused and under the size budget.

| Topic        | File                            | Typical contents                                                |
| ------------ | ------------------------------- | --------------------------------------------------------------- |
| Conventions  | `docs/technical/conventions.md` | Style, naming, formatting, imports, error handling              |
| Architecture | `docs/technical/architecture.md`| System shape, components, boundaries, data flow, where to look  |
| Rules        | `docs/technical/rules.md`       | Hard constraints, security/data rules, generated files, gotchas |
| Testing      | `docs/technical/testing.md`     | Framework, commands, structure, fixtures/mocks                  |
| Tooling      | `docs/technical/tooling.md`     | Build, lint, format, CI, pre-commit                             |

When filling a file in, describe capabilities and patterns, not frozen file paths. Paths drift; capabilities don't.

## Adding or Removing Topics

Add a topic when a distinct technical area has its own conventions that don't fit the five defaults — for example `database.md` (schema/migrations), `deploy.md` (release steps), `observability.md` (logging/metrics/tracing), or `security.md` (secrets handling, threat model).

To add one:

1. Create `docs/technical/<topic>.md` with a focused heading and real content.
2. Add a row to the Technical docs table in `AGENTS.md`.
3. Run the audit script to confirm the link resolves and there are no orphans.

To remove a default topic that doesn't apply, delete the file and its table row. The audit flags orphaned files and broken links.

## Linking Rules

- Every `docs/technical/*.md` file is linked from `AGENTS.md`.
- Every link in `AGENTS.md` points to a file that exists after pruning unused stubs.
- Use relative paths: `docs/technical/testing.md`, not absolute URLs.
- Keep links one level deep under `docs/technical/`. Avoid `docs/technical/a/b.md`.

## Size Budgets

| File                       | Soft limit | Hard limit |
| -------------------------- | ---------- | ---------- |
| `AGENTS.md`                | 60 lines   | 120 lines  |
| Each `docs/technical/*.md` | 150 lines  | 300 lines  |

If a file approaches the hard limit, split it by sub-topic and add an index file in its place. The audit script flags files over the soft limit.
