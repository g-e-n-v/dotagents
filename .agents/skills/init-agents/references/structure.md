# Structure and Per-Domain Templates

## Table of Contents

- [Target File Tree](#target-file-tree)
- [Root AGENTS.md Template](#root-agentsmd-template)
- [Per-Domain /docs Templates](#per-domain-docs-templates)
  - [typescript.md](#typescriptmd)
  - [testing.md](#testingmd)
  - [git.md](#gitmd)
  - [api.md](#apimd)
  - [architecture.md](#architecturemd)
- [Linking Rules](#linking-rules)
- [Size Budgets](#size-budgets)

## Target File Tree

```
repo-root/
├── AGENTS.md            # minimal root: essentials only
└── docs/
    ├── typescript.md    # TS/JS conventions
    ├── testing.md       # test framework + patterns
    ├── git.md           # commit + branch conventions
    ├── api.md           # API design patterns
    └── architecture.md  # high-level shape, NOT file paths
```

Keep references one level deep from `AGENTS.md`. Do not nest deeper (e.g., `docs/typescript/style.md`) unless a single domain file grows past the size budget; if it does, split that domain into a subfolder and add an index file.

## Root AGENTS.md Template

The root file should stay under ~50 lines. It contains only the three essentials plus pointer lines to `/docs`.

```markdown
# AGENTS.md

<one-sentence project description, e.g. "React component library for accessible data visualization.">

## Essentials

- Package manager: <pnpm|yarn|bun|npm> (or: "uses corepack")
- Build: `<command>`
- Typecheck: `<command>`
- Test: `<command>`

## Domain Guidance

- TypeScript conventions: see docs/typescript.md
- Testing patterns: see docs/testing.md
- Git workflow: see docs/git.md
- API design: see docs/api.md
- Architecture: see docs/architecture.md
```

Notes:
- Drop the "Domain Guidance" lines for stubs the user deleted.
- Do not duplicate content from `/docs` in the root. Pointers only.
- No "always" / all-caps forcing. Conversational references.

## Per-Domain /docs Templates

Each file is a progressive-disclosure target. The agent reads it only when working in that domain. Keep each file focused and under the size budget.

### typescript.md

```markdown
# TypeScript Conventions

## Style

- Prefer `const` over `let`; avoid `var`.
- Prefer `interface` over `type` for object shapes.
- Enable strict null checks.

## Patterns

<add project-specific patterns: error handling, naming, etc.>

## Avoid

<list anti-patterns observed in this repo>
```

### testing.md

```markdown
# Testing Patterns

## Framework

<e.g. "Vitest with jsdom environment">

## Commands

- Run all: `<command>`
- Run one file: `<command>`
- Watch: `<command>`

## Conventions

- Co-locate tests next to source as `*.test.ts`.
- Name tests by behavior, not implementation.
- Use real instances over mocks where feasible.

## Fixtures

<describe where shared fixtures live and how to load them>
```

### git.md

```markdown
# Git Workflow

## Commits

Conventional Commits format: `type(scope): description`

Types: feat, fix, docs, refactor, test, chore, perf

## Branching

<describe branch naming and PR flow, or delete this section>

## Rules

- Squash merges on PR close.
- Never commit generated files under <path>.
```

### api.md

```markdown
# API Design

## Conventions

- REST resources are plural nouns.
- Errors use the shape: `{ "error": { "code", "message", "details" } }`.
- Versioning via URL prefix: `/v1/...`.

## Validation

<describe where request/response schemas live and how they are validated>

## Auth

<describe at a capability level, e.g. "Bearer JWT validated in middleware"; avoid file paths>
```

### architecture.md

```markdown
# Architecture

## Shape

<2-4 sentences on the overall shape: layers, boundaries, data flow.>

## Domains

- <domain name>: <what it is responsible for, in capability terms>
- <domain name>: <what it is responsible for>

## Boundaries

<what crosses what, and what must not. e.g. "The UI never touches the DB layer directly.">

## Where to Look

Hints, not paths. e.g. "Auth logic lives near the entry middleware" rather than "src/auth/middleware.ts".
```

## Linking Rules

- Every `/docs/*.md` file MUST be linked from `AGENTS.md` (or from another `/docs` file that is itself linked).
- Every link in `AGENTS.md` MUST point to an existing file after the user prunes stubs.
- Use relative paths: `docs/typescript.md`, not absolute URLs.
- Keep links one level deep from the root. Avoid `docs/a/b.md`.

## Size Budgets

| File | Soft limit | Hard limit |
|---|---|---|
| `AGENTS.md` | 50 lines | 100 lines |
| Each `docs/*.md` | 150 lines | 300 lines |

If a file approaches the hard limit, split by sub-domain and add an index file in its place. The audit script flags files over the soft limit.
