---
name: init-agents
description: Scaffold a minimal, progressive-disclosure AGENTS.md in a repository and split the rest into per-domain files under /docs. Use when bootstrapping a new repo for AI agents, refactoring a bloated AGENTS.md into a lean root file plus linked docs, or auditing an existing setup to trim it. Do NOT use for monorepos with nested per-package AGENTS.md files; this skill assumes a single-root setup.
---

# Init Agents

Bootstrap or refactor a repository's AI agent instructions using **progressive disclosure**: a minimal root `AGENTS.md` that loads on every request, with everything else pushed into `/docs/*.md` files the agent reads only when needed.

## Why This Approach

A bloated root `AGENTS.md` wastes tokens on every request and confuses the agent with stale, irrelevant instructions. The fix is to keep the root file to the absolute essentials and split the rest by domain so each chunk loads only when its domain is touched.

## Core Principles

1. **Root `AGENTS.md` = minimum viable.** Only what is relevant to every single task in the repo.
2. **`/docs/*.md` = per-domain detail.** Each file covers one domain (TypeScript, testing, Git workflow, API design, etc.) and is referenced from the root.
3. **Describe capabilities, not file paths.** Paths drift; capabilities don't. Give shape and pointers, not a frozen map.
4. **No auto-generated bloat.** Scaffolds produce structure, not content. The user fills in real conventions.
5. **Single root, no nesting.** This skill is for flat repos. Monorepos with per-package `AGENTS.md` are out of scope.

## Workflow

1. **Assess the repo.** Determine if this is a fresh setup or a refactor of an existing bloated `AGENTS.md`.
2. **Run the scaffold script.** Execute `scripts/init-agents.ts` from the repo root. It creates:
   - A minimal `AGENTS.md` with TODO placeholders for the three essentials
   - A `/docs` folder with stub files for the most common domains
3. **Fill in the root essentials.** Edit `AGENTS.md` to provide:
   - One-sentence project description (role-prompt anchor)
   - Package manager (only if not npm; or note `corepack`)
   - Non-standard build/typecheck commands
4. **Populate only the relevant `/docs` files.** Delete the stubs that don't apply and fill in the ones that do. Each `/docs/*.md` is a progressive-disclosure target.
5. **Audit the result.** Run `scripts/audit-agents.ts` to flag bloat, contradictions, and stale content.

## What Belongs Where

Use this decision table when filling in files:

| Content | Location |
|---|---|
| One-sentence project purpose | Root `AGENTS.md` |
| Package manager (non-npm) | Root `AGENTS.md` |
| Non-standard build/typecheck commands | Root `AGENTS.md` |
| TypeScript/JS conventions | `/docs/typescript.md` |
| Testing patterns | `/docs/testing.md` |
| Git/commit conventions | `/docs/git.md` |
| API design patterns | `/docs/api.md` |
| Architecture overview | `/docs/architecture.md` |
| Anything "useful for most scenarios" but not every task | `/docs/<domain>.md` |

Full guidance per domain lives in the reference files below. Read them only when working on that domain.

## Reference Files

- **Detailed structure and per-domain templates**: See `references/structure.md`
- **Refactoring an existing bloated AGENTS.md**: See `references/refactor.md`
- **Audit checklist for trimming and staleness**: See `references/audit.md`

## Scripts

- **`scripts/init-agents.ts`** - Scaffold a minimal `AGENTS.md` and `/docs` stubs. Run from the repo root. Flags: `--refactor` to import content from an existing `AGENTS.md` instead of starting fresh.
- **`scripts/audit-agents.ts`** - Scan `AGENTS.md` and `/docs` for bloat, contradictions, stale file-path references, and oversized files. Prints a report; non-zero exit on critical issues.

Run with: `npx tsx <script-path>` from the repo root.
