# Refactoring a Bloated AGENTS.md

Read this file when the user has an existing `AGENTS.md` that has grown too large and wants to split it into a minimal root plus `docs/` files.

## Table of Contents

- [Refactor Workflow](#refactor-workflow)
- [Classification Rules](#classification-rules)
- [Handling Contradictions](#handling-contradictions)
- [Handling Stale Content](#handling-stale-content)
- [The Refactor Prompt](#the-refactor-prompt)

## Refactor Workflow

1. **Back up.** Copy the existing `AGENTS.md` to `AGENTS.md.bak` before changes. The `--refactor` flag does this automatically.
2. **Run the scaffold script with `--refactor`.** It reads the existing `AGENTS.md`, splits it into the `docs/` stubs by keyword classification, and rewrites the root with the essentials plus links.
3. **Review the split.** Open each generated `docs/*.md` and verify the classification. Move misplaced lines manually.
4. **Resolve contradictions.** See below.
5. **Prune.** Delete stubs that ended up empty or irrelevant. Remove their link lines from `AGENTS.md`.
6. **Audit.** Run `scripts/audit-agents.ts` and address flagged issues.

## Classification Rules

The `--refactor` flag classifies each line/block of the existing file by keyword and routes it to a `docs/` stub:

| Keyword signals                                                              | Target file            |
| ---------------------------------------------------------------------------- | ---------------------- |
| `typescript`, `ts`, `const`, `let`, `interface`, `type`, `null`, `undefined` | `docs/typescript.md`   |
| `test`, `vitest`, `jest`, `mock`, `fixture`, `spec`                          | `docs/testing.md`      |
| `commit`, `branch`, `pr`, `pull request`, `merge`, `conventional`            | `docs/git.md`          |
| `api`, `endpoint`, `rest`, `graphql`, `route`, `request`, `response`         | `docs/api.md`          |
| `architecture`, `layer`, `boundary`, `module`, `service`, `data flow`        | `docs/architecture.md` |

Lines that don't match any signal stay in the root only if they are one of the essentials (package manager, build/typecheck commands). Everything else gets dropped with a comment in `AGENTS.md.bak` so nothing is lost silently.

## Handling Contradictions

If the existing `AGENTS.md` contains two rules that conflict (e.g., "use tabs" and "use 2-space indentation"), do not silently pick one. Instead:

1. Surface the contradiction to the user with both rules quoted.
2. Ask which to keep.
3. Drop the loser entirely; do not leave it commented out in a `docs/` file.

The audit script also flags suspected contradictions (heuristic: negation of another rule within the same domain file).

## Handling Stale Content

Stale content is anything that references reality that may have drifted:

- **File paths** (`src/auth/handlers.ts`) - likely stale. Replace with capability hints ("auth handling lives near the entry middleware") or delete.
- **Specific line numbers or function names** - almost always stale. Delete.
- **Domain terms** (`organization` vs `group` vs `workspace`) - more stable but can still drift. Keep, but flag for the user to verify.
- **Generated/boilerplate rules** added by init scripts - delete unless the user confirms each one is still wanted.

When in doubt, prefer deletion over keeping a stale line. Stale docs poison the agent's context on every request.

## The Refactor Prompt

For users who want to drive the refactor conversationally with their agent instead of running the script, paste this prompt:

```text
I want you to refactor my AGENTS.md file to follow progressive disclosure principles.

Follow these steps:

1. **Find contradictions**: Identify any instructions that conflict with each other. For each contradiction, ask me which version I want to keep.

2. **Identify the essentials**: Extract only what belongs in the root AGENTS.md:
   - Package manager (if not npm)
   - Non-standard build/typecheck commands
   - Anything truly relevant to every single task

3. **Group the rest**: Organize remaining instructions into logical categories (e.g., TypeScript conventions, testing patterns, API design, Git workflow). For each group, create a separate markdown file under docs/.

4. **Create the file structure**: Output:
   - A minimal root AGENTS.md with markdown links to the separate files
   - Each separate file under docs/ with its relevant instructions
   - A suggested docs/ folder structure

5. **Flag for deletion**: Identify any instructions that are:
   - Redundant (the agent already knows this)
   - Too vague to be actionable
   - Overly obvious (like "write clean code")
   - Stale (specific file paths, line numbers, or function names)

Replace file-path references with capability hints where possible. Keep links one level deep from AGENTS.md.
```
