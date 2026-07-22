---
name: setup-agents
description: Create or refactor an AGENTS.md file using progressive disclosure so AI coding agents understand the project and produce good output. Scaffolds a concise root AGENTS.md with a domain-guidance table linking to per-domain docs under docs/, which agents read only when relevant. Use when bootstrapping AGENTS.md in a new repo, splitting a bloated AGENTS.md into a lean root plus linked docs, or auditing an existing setup to trim bloat and fix stale references. Not for monorepos with nested per-package AGENTS.md files.
---

# Setup Agents

Create or refactor a repository's AI agent instructions using **progressive disclosure**: a minimal root `AGENTS.md` that loads on every request, with everything else pushed into `docs/*.md` files the agent reads only when needed.

## Why This Approach

`AGENTS.md` goes into every agent session. A bloated root file wastes tokens on every request and degrades instruction-following as instruction count grows. The fix is to keep the root to the absolute essentials and split the rest by domain so each chunk loads only when its domain is touched.

## Core Principles

1. **Root `AGENTS.md` = minimum viable.** Only what is relevant to every single task in the repo: package manager and non-standard build/typecheck/test commands.
2. **`docs/*.md` = per-domain detail.** Each file covers one domain (TypeScript, testing, Git workflow, API design, architecture) and is referenced from the root via a domain-guidance table.
3. **Describe capabilities, not file paths.** Paths drift; capabilities don't. Give shape and pointers, not a frozen map.
4. **No auto-generated bloat.** Scaffolds produce structure, not content. The user fills in real conventions.
5. **Single root, no nesting.** This skill is for flat repos. Monorepos with per-package `AGENTS.md` are out of scope.

## Workflow

1. **Assess the repo.** Determine if this is a fresh setup or a refactor of an existing bloated `AGENTS.md`.
2. **Run the scaffold script.** Execute `scripts/init-agents.ts` from the repo root. In default mode it creates a minimal `AGENTS.md` with TODO placeholders plus a `docs/` folder with stub files for the five common domains. With `--refactor` it reads an existing `AGENTS.md`, classifies lines by keyword into `docs/` stubs, backs up the original to `AGENTS.md.bak`, and rewrites the root with essentials plus links.
3. **Fill in the root essentials.** Edit `AGENTS.md` to provide:
   - Package manager (only if not npm; or note `corepack`)
   - Non-standard build/typecheck/test commands
4. **Populate only the relevant `docs/` files.** Delete the stubs that don't apply and fill in the ones that do. Each `docs/*.md` is a progressive-disclosure target.
5. **Audit the result.** Run `scripts/audit-agents.ts` to flag bloat, broken links, stale paths, contradictions, and oversized files.

## What Belongs Where

Use this decision table when filling in files:

| Content                                                 | Location               |
| ------------------------------------------------------- | ---------------------- |
| Package manager (non-npm)                               | Root `AGENTS.md`       |
| Non-standard build/typecheck/test commands              | Root `AGENTS.md`       |
| TypeScript/JS conventions                               | `docs/typescript.md`   |
| Testing patterns                                        | `docs/testing.md`      |
| Git/commit conventions                                  | `docs/git.md`          |
| API design patterns                                     | `docs/api.md`          |
| Architecture overview                                   | `docs/architecture.md` |
| Anything "useful for most scenarios" but not every task | `docs/<domain>.md`     |

## Reference Files

Read these only when working on that aspect of the setup:

- **Detailed structure, per-domain templates, and custom domains**: See `references/structure.md`
- **Refactoring an existing bloated AGENTS.md (classification rules, contradictions, stale content)**: See `references/refactor.md`
- **Audit checklist, severity levels, and fix recipes**: See `references/audit.md`

## Scripts

- **`scripts/init-agents.ts`** - Scaffold a minimal `AGENTS.md` and `docs/` stubs. Run from the repo root. Flags: `--refactor` to import content from an existing `AGENTS.md` instead of starting fresh.
- **`scripts/audit-agents.ts`** - Scan `AGENTS.md` and `docs/` for bloat, contradictions, stale file-path references, broken links, orphans, and oversized files. Prints a report; non-zero exit on critical issues.

Run with: `npx tsx <script-path>` from the repo root.
