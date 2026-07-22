#!/usr/bin/env bun
/**
 * audit-agents.ts
 *
 * Scans AGENTS.md (a tech-stack manifest) and docs/technical/*.md for bloat,
 * broken links, stale file-path references, vague rules, forcing tone, orphans,
 * contradictions, and a missing docs table.
 *
 * Language-agnostic: no assumptions about the project's stack.
 *
 * Usage:
 *   npx tsx audit-agents.ts [repo-root]   (or: bun audit-agents.ts [repo-root])
 *
 * Exit codes:
 *   0 - no critical issues (warnings may be present)
 *   1 - one or more critical issues found
 *
 * See references/audit.md for the full checklist and fix recipes.
 */

import * as fs from "fs";
import * as path from "path";

interface Issue {
  severity: "critical" | "warning";
  check: string;
  file: string;
  line: number;
  message: string;
}

const DOCS_SUBDIR = path.join("docs", "technical");

const ROOT_SOFT = 60;
const ROOT_HARD = 120;
const DOC_SOFT = 150;
const DOC_HARD = 300;

const VAGUE_PATTERNS = [
  /\bclean code\b/i,
  /\bbe consistent\b/i,
  /\bbest practices?\b/i,
  /\bgood code\b/i,
  /\bwrite well\b/i,
  /\breadable code\b/i,
];

const FORCING_PATTERN = /\b(ALWAYS|NEVER|MUST)\b/;

// Broad, language-agnostic set of common source directory prefixes.
const PATH_PATTERN =
  /\b(src|lib|app|apps|packages|cmd|internal|pkg|api|source|test|tests|spec)\/[A-Za-z0-9_\-./]+\.[A-Za-z]{1,6}\b/;

const SAFETY_KEYWORDS =
  /\b(secret|password|credential|api key|token|auth|security|vulnerab|injection|xss|csrf|sql)\b/i;

function read(p: string): string {
  return fs.readFileSync(p, "utf-8");
}

function findIssues(root: string): Issue[] {
  const issues: Issue[] = [];
  const agentsPath = path.join(root, "AGENTS.md");
  const docsDir = path.join(root, DOCS_SUBDIR);

  if (!fs.existsSync(agentsPath)) {
    issues.push({
      severity: "critical",
      check: "missing-root",
      file: "AGENTS.md",
      line: 0,
      message: "AGENTS.md not found at repo root.",
    });
    return issues;
  }

  const agentsContent = read(agentsPath);
  const agentsLines = agentsContent.split("\n");

  if (agentsLines.length > ROOT_HARD) {
    issues.push({
      severity: "critical",
      check: "root-size",
      file: "AGENTS.md",
      line: agentsLines.length,
      message: `AGENTS.md is ${agentsLines.length} lines (hard limit ${ROOT_HARD}). Move prose into docs/technical/.`,
    });
  } else if (agentsLines.length > ROOT_SOFT) {
    issues.push({
      severity: "warning",
      check: "root-size",
      file: "AGENTS.md",
      line: agentsLines.length,
      message: `AGENTS.md is ${agentsLines.length} lines (soft limit ${ROOT_SOFT}). Keep it a concise manifest.`,
    });
  }

  // The manifest should link to docs/technical/ (progressive disclosure).
  if (!/docs\/technical\//.test(agentsContent)) {
    issues.push({
      severity: "warning",
      check: "missing-docs-table",
      file: "AGENTS.md",
      line: 0,
      message: "AGENTS.md has no links into docs/technical/. Add a technical-docs table for progressive disclosure.",
    });
  }

  issues.push(...scanFile(agentsPath, agentsLines, root, "AGENTS.md"));
  issues.push(...checkLinks(root, agentsLines, "AGENTS.md"));

  const docsFiles: string[] = [];
  if (fs.existsSync(docsDir)) {
    for (const entry of fs.readdirSync(docsDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(".md")) {
        docsFiles.push(path.join(docsDir, entry.name));
      } else if (entry.isDirectory()) {
        issues.push({
          severity: "critical",
          check: "nested-too-deep",
          file: path.join(DOCS_SUBDIR, entry.name),
          line: 0,
          message: `docs/technical/${entry.name}/ nests deeper than one level. Flatten or add an index and keep links one level deep.`,
        });
      }
    }
  }

  for (const docPath of docsFiles) {
    const content = read(docPath);
    const lines = content.split("\n");
    const rel = path.relative(root, docPath);
    if (lines.length > DOC_HARD) {
      issues.push({
        severity: "critical",
        check: "doc-size",
        file: rel,
        line: lines.length,
        message: `${rel} is ${lines.length} lines (hard limit ${DOC_HARD}). Split by sub-topic.`,
      });
    } else if (lines.length > DOC_SOFT) {
      issues.push({
        severity: "warning",
        check: "doc-size",
        file: rel,
        line: lines.length,
        message: `${rel} is ${lines.length} lines (soft limit ${DOC_SOFT}).`,
      });
    }
    issues.push(...scanFile(docPath, lines, root, rel));
    issues.push(...checkLinks(root, lines, rel));
  }

  issues.push(...checkOrphans(root, docsFiles, agentsContent));

  return issues;
}

/** Mark each line that lies within (or opens) an HTML comment block. */
function commentMask(lines: string[]): boolean[] {
  const mask: boolean[] = [];
  let inComment = false;
  for (const line of lines) {
    if (inComment) {
      mask.push(true);
      if (line.includes("-->")) inComment = false;
      continue;
    }
    const opens = line.includes("<!--");
    const closes = line.includes("-->");
    if (opens && !closes) {
      mask.push(true);
      inComment = true;
    } else if (opens && closes) {
      mask.push(true); // inline comment — treat the whole line as commented
    } else {
      mask.push(false);
    }
  }
  return mask;
}

function scanFile(filePath: string, lines: string[], root: string, fileLabel: string): Issue[] {
  const issues: Issue[] = [];
  const masked = commentMask(lines);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;
    if (masked[i]) continue;

    if (PATH_PATTERN.test(line) && !line.trim().startsWith("<!--")) {
      const match = line.match(PATH_PATTERN);
      const token = match ? match[0] : "";
      const candidate = path.join(root, token);
      if (token && !fs.existsSync(candidate)) {
        issues.push({
          severity: "critical",
          check: "stale-path",
          file: fileLabel,
          line: lineNo,
          message: `Stale file-path reference "${token}" no longer exists. Replace with a capability hint or delete.`,
        });
      }
    }

    if (VAGUE_PATTERNS.some((re) => re.test(line))) {
      issues.push({
        severity: "warning",
        check: "vague-rule",
        file: fileLabel,
        line: lineNo,
        message: `Vague rule detected. Replace with a specific, actionable rule or delete.`,
      });
    }

    if (FORCING_PATTERN.test(line) && !SAFETY_KEYWORDS.test(line)) {
      issues.push({
        severity: "warning",
        check: "forced-tone",
        file: fileLabel,
        line: lineNo,
        message: `Non-safety rule uses forcing tone (ALWAYS/NEVER/MUST). Soften unless safety-critical.`,
      });
    }
  }

  issues.push(...findContradictions(lines, fileLabel));
  return issues;
}

function findContradictions(lines: string[], fileLabel: string): Issue[] {
  const issues: Issue[] = [];
  const masked = commentMask(lines);
  const rules: Array<{ text: string; line: number; negated: boolean; key: string }> = [];
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (masked[i]) continue;
    if (!t || t.startsWith("#") || t.startsWith("<!--") || t.startsWith("|")) continue;
    const negated = /\b(not|never|don't|do not|avoid)\b/i.test(t);
    const key = t
      .toLowerCase()
      .replace(/\b(not|never|don't|do not|avoid|always|use|prefer|- |^\s*\*?\s*)\b/gi, "")
      .replace(/[^a-z0-9 ]/g, "")
      .trim();
    if (key.length < 4) continue;
    rules.push({ text: t, line: i + 1, negated, key });
  }
  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      const a = rules[i];
      const b = rules[j];
      if (a.key === b.key && a.negated !== b.negated) {
        issues.push({
          severity: "warning",
          check: "contradiction",
          file: fileLabel,
          line: a.line,
          message: `Possible contradiction with line ${b.line}: "${a.text}" vs "${b.text}".`,
        });
      }
    }
  }
  return issues;
}

function checkLinks(root: string, lines: string[], fileLabel: string): Issue[] {
  const issues: Issue[] = [];
  // Match markdown link syntax `(path.md)` and plain `docs/technical/foo.md`.
  const linkRe = /\(([^)]+\.md)\)|\b(docs\/technical\/[A-Za-z0-9_\-./]+\.md)\b/g;
  const baseDir = path.dirname(path.join(root, fileLabel));
  for (let i = 0; i < lines.length; i++) {
    let match: RegExpExecArray | null;
    linkRe.lastIndex = 0;
    while ((match = linkRe.exec(lines[i])) !== null) {
      const target = match[1] || match[2];
      if (target.startsWith("http")) continue;
      const resolved = target.startsWith("docs/")
        ? path.resolve(root, target)
        : path.resolve(baseDir, target);
      if (!fs.existsSync(resolved)) {
        issues.push({
          severity: "critical",
          check: "broken-link",
          file: fileLabel,
          line: i + 1,
          message: `Link to "${target}" points to a missing file.`,
        });
      }
    }
  }
  return issues;
}

function checkOrphans(root: string, docsFiles: string[], agentsContent: string): Issue[] {
  const issues: Issue[] = [];
  for (const docPath of docsFiles) {
    const rel = path.relative(root, docPath);
    const filename = path.basename(rel);
    if (!agentsContent.includes(filename)) {
      issues.push({
        severity: "warning",
        check: "orphan-doc",
        file: rel,
        line: 0,
        message: `${rel} is not referenced from AGENTS.md. Add a row to the technical-docs table or delete the file.`,
      });
    }
  }
  return issues;
}

function printReport(issues: Issue[]): number {
  const critical = issues.filter((i) => i.severity === "critical");
  const warnings = issues.filter((i) => i.severity === "warning");

  if (issues.length === 0) {
    console.log("✅ No issues found. AGENTS.md and docs/technical/ look clean.");
    return 0;
  }

  const grouped = new Map<string, Issue[]>();
  for (const issue of issues) {
    if (!grouped.has(issue.file)) grouped.set(issue.file, []);
    grouped.get(issue.file)!.push(issue);
  }

  for (const [file, fileIssues] of grouped) {
    console.log(`\n=== ${file} ===`);
    for (const issue of fileIssues) {
      const tag = issue.severity === "critical" ? "[CRITICAL]" : "[WARNING] ";
      console.log(`  ${tag} ${issue.check} (line ${issue.line}): ${issue.message}`);
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`Critical: ${critical.length}`);
  console.log(`Warnings: ${warnings.length}`);

  return critical.length > 0 ? 1 : 0;
}

function main(): void {
  const args = process.argv.slice(2);
  const root = args[0] ? path.resolve(args[0]) : process.cwd();
  console.log(`🔍 Auditing AGENTS.md setup at ${root}\n`);
  const issues = findIssues(root);
  process.exit(printReport(issues));
}

main();
