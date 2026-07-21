# Audit Checklist

Read this file to interpret the output of `scripts/audit-agents.ts` or to perform a manual audit of an existing `AGENTS.md` + `/docs` setup.

## Table of Contents

- [What the Audit Checks](#what-the-audit-checks)
- [Severity Levels](#severity-levels)
- [Manual Audit Steps](#manual-audit-steps)
- [Fix Recipes](#fix-recipes)

## What the Audit Checks

| Check | Description |
|---|---|
| `root-size` | `AGENTS.md` exceeds the 50-line soft limit or 100-line hard limit. |
| `doc-size` | A `docs/*.md` file exceeds the 150-line soft limit or 300-line hard limit. |
| `broken-link` | `AGENTS.md` or a `docs/*.md` references a file that does not exist. |
| `orphan-doc` | A `docs/*.md` file is not referenced from `AGENTS.md` or any other `docs` file. |
| `stale-path` | A line contains a file-path-like token (`src/...`, `*.ts`, `*.py`) that no longer exists in the repo. |
| `contradiction` | Two rules in the same file appear to negate each other (heuristic: one contains "not"/"never" + key phrase from the other). |
| `vague-rule` | A line matches vague-rule signals ("write clean code", "be consistent", "use best practices") with no specifics. |
| `forced-tone` | A line uses ALL CAPS forcing ("ALWAYS", "NEVER", "MUST") for a non-safety rule. Safety-critical rules are exempt. |
| `nested-too-deep` | A link targets `docs/a/b.md` (more than one level deep). |

## Severity Levels

- **critical** (exit code 1): `broken-link`, `stale-path` (if file truly gone), `nested-too-deep`.
- **warning** (exit code 0): size limits, `orphan-doc`, `contradiction`, `vague-rule`, `forced-tone`.

The script exits non-zero only on critical issues so it can be wired into CI without failing on soft warnings.

## Manual Audit Steps

If running the script is not possible, perform these steps by hand:

1. **Count root lines.** `wc -l AGENTS.md`. If over 50, look for content that belongs in a `/docs` file.
2. **List docs and verify links.** `ls docs/` then grep `AGENTS.md` for each filename. Any doc not linked is an orphan.
3. **Verify every linked path exists.** For each `docs/foo.md` reference in `AGENTS.md`, confirm the file is present.
4. **Scan for path-like tokens.** `grep -nE '\b(src|lib|app|packages)/[^ )]+' AGENTS.md docs/*.md`. For each hit, confirm the path still exists; if not, replace with a capability hint or delete.
5. **Scan for forcing language.** `grep -nE '\b(ALWAYS|NEVER|MUST)\b' AGENTS.md docs/*.md`. Keep only safety-critical instances; soften the rest to conversational phrasing.
6. **Scan for vague rules.** Look for lines that say "clean code", "be consistent", "best practices" without specifics. Delete them.
7. **Spot contradictions.** For each rule with "not" / "never", check whether the opposite is also stated in the same file.

## Fix Recipes

### File is too large

Split by sub-domain. Create a subfolder with an index file that lists the splits, and replace the original file's content with the index. Example: `docs/typescript.md` over 300 lines becomes `docs/typescript/README.md` + `docs/typescript/style.md` + `docs/typescript/patterns.md`.

### Stale path

Replace `src/auth/handlers.ts handles auth` with `auth handling lives near the entry middleware`. If the capability itself is gone, delete the line.

### Broken link

Either create the missing file or remove the link from `AGENTS.md`. Do not leave dangling links; they waste the agent's turns.

### Orphan doc

Add a one-line link from `AGENTS.md` under "Domain Guidance", or delete the doc if it is no longer relevant.

### Contradiction

Surface both rules to the user, pick one, and delete the other. Do not leave the loser commented out.

### Vague rule

Delete it. If the underlying intent matters, replace with a specific, actionable rule (e.g., "functions under 40 lines" instead of "write clean code").
