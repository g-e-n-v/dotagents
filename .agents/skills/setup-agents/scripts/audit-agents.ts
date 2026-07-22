#!/usr/bin/env bun
/**
 * audit-agents.ts
 *
 * Scans AGENTS.md and docs/*.md for bloat, broken links, stale file-path
 * references, vague rules, forcing tone, orphans, and contradictions.
 *
 * Usage:
 *   bun audit-agents.ts [repo-root]
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

const ROOT_SOFT = 50;
const ROOT_HARD = 100;
const DOC_SOFT = 150;
const DOC_HARD = 300;

const VAGUE_PATTERNS = [
  /\bclean code\b/i,
  /\bbe consistent\b/i,
  /\bbest practices?\b/i,
  /\bgood code\b/i,
  /\bwrite well\b/i,
];

const FORCING_PATTERN = /\b(ALWAYS|NEVER|MUST)\b/;

const PATH_PATTERN =
  /\b(src|lib|app|packages|cmd|internal|pkg|api)\/[A-Za-z0-9_\-./]+\.[A-Za-z]{1,5}\b/;

const SAFETY_KEYWORDS =
  /\b(secret|password|credential|api key|token|auth|security|vulnerab|injection|xss|csrf)\b/i;

function findIssues(root: string): Issue[] {
  const issues: Issue[] = [];
  const agentsPath = path.join(root, "AGENTS.md");
  const docsDir = path.join(root, "docs");

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

  const agentsContent = fs.readFileSync(agentsPath, "utf-8");
  const agentsLines = agentsContent.split("\n");

  if (agentsLines.length > ROOT_HARD) {
    issues.push({
      severity: "critical",
      check: "root-size",
      file: "AGENTS.md",
      line: agentsLines.length,
      message: `AGENTS.md is ${agentsLines.length} lines (hard limit ${ROOT_HARD}). Split into docs/.`,
    });
  } else if (agentsLines.length > ROOT_SOFT) {
    issues.push({
      severity: "warning",
      check: "root-size",
      file: "AGENTS.md",
      line: agentsLines.length,
      message: `AGENTS.md is ${agentsLines.length} lines (soft limit ${ROOT_SOFT}). Consider trimming.`,
    });
  }

  issues.push(...scanFile(agentsPath, agentsLines, true));
  issues.push(...checkLinks(root, agentsLines, "AGENTS.md"));

  const docsFiles: string[] = [];
  if (fs.existsSync(docsDir)) {
    for (const entry of fs.readdirSync(docsDir)) {
      if (entry.endsWith(".md")) docsFiles.push(path.join(docsDir, entry));
    }
  }

  for (const docPath of docsFiles) {
    const content = fs.readFileSync(docPath, "utf-8");
    const lines = content.split("\n");
    const rel = path.relative(root, docPath);
    if (lines.length > DOC_HARD) {
      issues.push({
        severity: "critical",
        check: "doc-size",
        file: rel,
        line: lines.length,
        message: `${rel} is ${lines.length} lines (hard limit ${DOC_HARD}). Split by sub-domain.`,
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
    issues.push(...scanFile(docPath, lines, false));
    issues.push(...checkLinks(root, lines, rel));
  }

  issues.push(...checkOrphans(root, docsFiles));
  issues.push(...checkNestedLinks(agentsLines));

  return issues;
}

function scanFile(filePath: string, lines: string[], isRoot: boolean): Issue[] {
  const issues: Issue[] = [];
  const rel = path.relative(path.dirname(path.dirname(filePath)), filePath);
  const fileLabel = isRoot ? "AGENTS.md" : rel;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;

    if (PATH_PATTERN.test(line) && !line.startsWith("<!--")) {
      const match = line.match(PATH_PATTERN);
      const token = match ? match[0] : "";
      const root = path.dirname(path.dirname(filePath));
      const candidate = path.join(root, token);
      if (!fs.existsSync(candidate)) {
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
        message: `Non-safety rule uses forcing tone (ALWAYS/NEVER/MUST). Soften to conversational phrasing unless safety-critical.`,
      });
    }
  }

  issues.push(...findContradictions(lines, fileLabel));
  return issues;
}

function findContradictions(lines: string[], fileLabel: string): Issue[] {
  const issues: Issue[] = [];
  const rules: Array<{ text: string; line: number; negated: boolean; key: string }> = [];
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t || t.startsWith("#") || t.startsWith("<!--")) continue;
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
  // Match both markdown link syntax `(docs/foo.md)` and plain text `docs/foo.md`.
  const linkRe = /\(([^)]+\.md)\)|\b(docs\/[A-Za-z0-9_\-./]+\.md)\b/g;
  for (let i = 0; i < lines.length; i++) {
    let match: RegExpExecArray | null;
    linkRe.lastIndex = 0;
    while ((match = linkRe.exec(lines[i])) !== null) {
      const target = match[1] || match[2];
      if (target.startsWith("http")) continue;
      const resolved = path.resolve(path.dirname(path.join(root, fileLabel)), target);
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

function checkOrphans(root: string, docsFiles: string[]): Issue[] {
  const issues: Issue[] = [];
  const agentsPath = path.join(root, "AGENTS.md");
  const agentsContent = fs.existsSync(agentsPath) ? fs.readFileSync(agentsPath, "utf-8") : "";
  for (const docPath of docsFiles) {
    const rel = path.relative(root, docPath);
    const filename = path.basename(rel);
    if (!agentsContent.includes(filename)) {
      issues.push({
        severity: "warning",
        check: "orphan-doc",
        file: rel,
        line: 0,
        message: `${rel} is not referenced from AGENTS.md. Add a link or delete the file.`,
      });
    }
  }
  return issues;
}

function checkNestedLinks(lines: string[]): Issue[] {
  const issues: Issue[] = [];
  // Match both markdown link syntax `(docs/sub/foo.md)` and plain text `docs/sub/foo.md`.
  const nestedRe = /\(docs\/[^)]+\/[^)]+\.md\)|\bdocs\/[A-Za-z0-9_\-./]+\/[A-Za-z0-9_\-./]+\.md\b/;
  for (let i = 0; i < lines.length; i++) {
    if (nestedRe.test(lines[i])) {
      issues.push({
        severity: "critical",
        check: "nested-too-deep",
        file: "AGENTS.md",
        line: i + 1,
        message: `Link targets a nested docs path. Keep references one level deep from AGENTS.md.`,
      });
    }
  }
  return issues;
}

function printReport(issues: Issue[]): number {
  const critical = issues.filter((i) => i.severity === "critical");
  const warnings = issues.filter((i) => i.severity === "warning");

  if (issues.length === 0) {
    console.log("✅ No issues found. AGENTS.md and docs/ look clean.");
    return 0;
  }

  const grouped = new Map<string, Issue[]>();
  for (const issue of issues) {
    const key = issue.file;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(issue);
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
