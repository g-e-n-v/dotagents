# Structure and Per-Domain Guidance

## Table of Contents

- [Target File Tree](#target-file-tree)
- [Root AGENTS.md Template](#root-agentsmd-template)
- [Per-Domain docs/ Guidance](#per-domain-docs-guidance)
- [Adding Custom Domains](#adding-custom-domains)
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

The root file should stay under ~50 lines. It contains only the essentials plus a domain-guidance table pointing to `docs/`.

```markdown
# AGENTS.md

## Essentials

- Package manager: <pnpm|yarn|bun|npm> (or: "uses corepack")
- Build: `<command>`
- Typecheck: `<command>`
- Test: `<command>`

## Domain Guidance

| Domain | Docs |
| --- | --- |
| TypeScript conventions | see docs/typescript.md |
| Testing patterns | see docs/testing.md |
| Git workflow | see docs/git.md |
| API design | see docs/api.md |
| Architecture | see docs/architecture.md |
```

Notes:

- Add or remove rows to match the `docs/` files in the repo.
- Do not duplicate content from `docs/` in the root. Pointers only.
- No "always" / all-caps forcing. Conversational references.

## Per-Domain docs/ Guidance

Each `docs/*.md` file is a progressive-disclosure target. The agent reads it only when working in that domain. Keep each file focused and under the size budget.

The scaffold script does not create domain stubs — create them manually for the domains that apply to the repo. Common domains:

| Domain | Filename | Typical contents |
| --- | --- | --- |
| TypeScript/JS conventions | `docs/typescript.md` | Style preferences, patterns, anti-patterns |
| Testing patterns | `docs/testing.md` | Framework, commands, conventions, fixtures |
| Git workflow | `docs/git.md` | Commit format, branching, PR rules |
| API design | `docs/api.md` | Conventions, validation, auth |
| Architecture | `docs/architecture.md` | Shape, domains, boundaries, where to look |

When creating a domain file, give it a focused heading and fill in real conventions. Describe capabilities, not file paths. Paths drift; capabilities don't.

## Adding Custom Domains

The five default domains cover most projects, but add more when a distinct area of the codebase has its own conventions. Common additions:

| Domain             | Filename           | When to add                                             |
| ------------------ | ------------------ | ------------------------------------------------------- |
| Database/schema    | `docs/database.md` | ORM conventions, migration steps, schema patterns       |
| Deployment         | `docs/deploy.md`   | Non-obvious deploy steps, environment requirements      |
| Frontend UI        | `docs/frontend.md` | Component patterns, state management, styling approach  |
| Linting/formatting | `docs/linting.md`  | Non-standard linter config, custom rules                |
| Security           | `docs/security.md` | Security-critical rules, secrets handling, auth gotchas |

When adding a custom domain:

1. Create `docs/<domain>.md` with a focused heading and real conventions.
2. Add a row to the Domain Guidance table in `AGENTS.md`.
3. Run the audit script to verify the link resolves and no orphans exist.

## Linking Rules

- Every `docs/*.md` file MUST be linked from `AGENTS.md` (or from another `docs` file that is itself linked).
- Every link in `AGENTS.md` MUST point to an existing file after the user prunes stubs.
- Use relative paths: `docs/typescript.md`, not absolute URLs.
- Keep links one level deep from the root. Avoid `docs/a/b.md`.

## Size Budgets

| File             | Soft limit | Hard limit |
| ---------------- | ---------- | ---------- |
| `AGENTS.md`      | 50 lines   | 100 lines  |
| Each `docs/*.md` | 150 lines  | 300 lines  |

If a file approaches the hard limit, split by sub-domain and add an index file in its place. The audit script flags files over the soft limit.
