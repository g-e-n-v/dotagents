#!/usr/bin/env bun
/**
 * init-agents.ts
 *
 * Scaffolds a minimal, progressive-disclosure AGENTS.md at the repo root
 * and a set of per-domain stub files under docs/.
 *
 * Usage:
 *   bun init-agents.ts [--refactor]
 *
 * Run from the repository root.
 *
 * Modes:
 *   default   - create AGENTS.md and docs/ stubs from templates.
 *   --refactor - read an existing AGENTS.md, classify its lines into
 *                docs/*.md by keyword, then rewrite AGENTS.md as a
 *                minimal root with links. The original is backed up to
 *                AGENTS.md.bak.
 *
 * Out of scope: monorepos with nested per-package AGENTS.md files.
 * This tool assumes a single-root setup.
 */

import * as fs from "fs";
import * as path from "path";

const ASSETS_DIR = path.resolve(__dirname, "..", "assets", "docs");

const DOC_DOMAINS = ["typescript", "testing", "git", "api", "architecture"] as const;

const DOMAIN_LABELS: Record<string, string> = {
  typescript: "TypeScript conventions",
  testing: "Testing patterns",
  git: "Git workflow",
  api: "API design",
  architecture: "Architecture",
};

// Order matters: more specific domains first so they win ties.
// Signals are deliberately narrow to avoid greedy mismatches like
// `\bts\b` matching `*.test.ts` or `\btype\b` matching `type(scope):`.
const KEYWORD_SIGNALS: Array<{ domain: string; signals: RegExp[] }> = [
  {
    domain: "git",
    signals: [
      /\bcommit\b|\bcommits\b/i,
      /\bbranch\b|\bbranches\b/i,
      /\bpull request\b|\bpr\b/i,
      /\bmerge\b|\bconventional commit/i,
      /\bchangelog\b/i,
    ],
  },
  {
    domain: "testing",
    signals: [
      /\bvitest\b|\bjest\b|\bmocha\b|\bjasmine\b|\bplaywright\b|\bctest\b/i,
      /\bunit test|\bintegration test|\be2e test/i,
      /\bmock\b|\bstub\b|\bfixture\b|\bspy\b/i,
      /\btest runner\b|\bcoverage\b/i,
      /\bco-locate tests\b|\btests?\.ts\b/i,
      /\bname tests?\b/i,
    ],
  },
  {
    domain: "api",
    signals: [
      /\bapi\b/i,
      /\bendpoint\b|\broutes?\b/i,
      /\brest\b|\bgraphql\b|\bgRPC\b/i,
      /\brequest body\b|\bresponse body\b/i,
      /\bstatus code\b|\bhttp\b/i,
      /\bversioning\b.*\b(v1|url)\b/i,
    ],
  },
  {
    domain: "architecture",
    signals: [
      /\barchitecture\b/i,
      /\blayer\b|\bboundary\b|\bboundaries\b/i,
      /\bdata flow\b/i,
      /\bn-tier\b|\bclean architecture\b/i,
    ],
  },
  {
    domain: "typescript",
    signals: [
      /\btypescript\b/i,
      /\bstrict null checks\b/i,
      /\bnoimplicit/i,
      /\binterface\b[^a-z]/i,
      /\bconst\b.*\blet\b|\blet\b.*\bconst\b/i,
      /\bvar\b/i,
      /\bnullish\b|\boptional chaining\b/i,
      /\bgeneric\b|\bgenerics\b/i,
    ],
  },
];

interface Finding {
  kind: "create" | "backup" | "classify" | "skip";
  message: string;
}

function logFinding(f: Finding): void {
  const icon =
    f.kind === "create" ? "✅" : f.kind === "backup" ? "💾" : f.kind === "classify" ? "🔀" : "⏭️";
  console.log(`${icon} ${f.message}`);
}

function classifyLine(line: string): string | null {
  const text = line.trim();
  if (!text) return null;
  if (text.startsWith("#")) return null;
  if (text.startsWith("<!--")) return null;
  if (text.startsWith("-")) {
    const bullet = text.slice(1).trim();
    for (const { domain, signals } of KEYWORD_SIGNALS) {
      if (signals.some((re) => re.test(bullet))) return domain;
    }
    return null;
  }
  for (const { domain, signals } of KEYWORD_SIGNALS) {
    if (signals.some((re) => re.test(text))) return domain;
  }
  return null;
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyTemplate(dest: string, filename: string): void {
  const src = path.join(ASSETS_DIR, filename);
  if (!fs.existsSync(src)) {
    throw new Error(`Template not found: ${src}`);
  }
  fs.writeFileSync(dest, fs.readFileSync(src, "utf-8"));
}

function scaffoldFresh(root: string): void {
  const agentsPath = path.join(root, "AGENTS.md");
  if (fs.existsSync(agentsPath)) {
    logFinding({
      kind: "skip",
      message: `AGENTS.md already exists at ${agentsPath}. Use --refactor to split it, or delete it first.`,
    });
    process.exit(1);
  }
  copyTemplate(agentsPath, "AGENTS.md");
  logFinding({ kind: "create", message: `Created minimal AGENTS.md at ${agentsPath}` });

  const docsDir = path.join(root, "docs");
  ensureDir(docsDir);
  for (const domain of DOC_DOMAINS) {
    const dest = path.join(docsDir, `${domain}.md`);
    if (fs.existsSync(dest)) {
      logFinding({ kind: "skip", message: `docs/${domain}.md already exists, skipping` });
      continue;
    }
    copyTemplate(dest, `${domain}.md`);
    logFinding({ kind: "create", message: `Created docs/${domain}.md stub` });
  }

  console.log("\nNext steps:");
  console.log("1. Edit AGENTS.md: fill in the one-sentence project description and essentials.");
  console.log("2. Edit each docs/*.md stub with real conventions. Delete stubs that do not apply.");
  console.log("3. Remove the matching link line from AGENTS.md for any deleted stub.");
  console.log("4. Run audit-agents.ts to verify the result.");
}

function scaffoldRefactor(root: string): void {
  const agentsPath = path.join(root, "AGENTS.md");
  if (!fs.existsSync(agentsPath)) {
    logFinding({
      kind: "skip",
      message: `No existing AGENTS.md at ${agentsPath}. Run without --refactor to scaffold fresh.`,
    });
    process.exit(1);
  }

  const original = fs.readFileSync(agentsPath, "utf-8");
  const backupPath = path.join(root, "AGENTS.md.bak");
  fs.writeFileSync(backupPath, original);
  logFinding({ kind: "backup", message: `Backed up original to ${backupPath}` });

  const buckets: Record<string, string[]> = {};
  for (const domain of DOC_DOMAINS) buckets[domain] = [];

  const essentials: string[] = [];
  const unclassified: string[] = [];
  let sawFirstHeading = false;
  let descriptionCaptured = false;

  for (const rawLine of original.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("<!--")) continue;

    if (line.startsWith("# ") && !line.startsWith("## ")) {
      sawFirstHeading = true;
      essentials.push(rawLine);
      continue;
    }

    if (sawFirstHeading && !descriptionCaptured && !line.startsWith("#") && !line.startsWith("-")) {
      essentials.push(rawLine);
      descriptionCaptured = true;
      continue;
    }

    const domain = classifyLine(line);
    if (domain) {
      buckets[domain].push(line);
      logFinding({
        kind: "classify",
        message: `docs/${domain}.md <= "${line.slice(0, 60)}${line.length > 60 ? "..." : ""}"`,
      });
      continue;
    }

    const lower = line.toLowerCase();
    const isEssential =
      lower.includes("package manager") ||
      (/\bbuild\b/.test(lower) &&
        /\b(pnpm|yarn|npm|bun|corepack|make|cargo|go|gradle|mvn)\b/.test(lower)) ||
      (/\btypecheck\b/.test(lower) && /\b(pnpm|yarn|npm|bun|tsc|go|cargo)\b/.test(lower)) ||
      (/\btest\b/.test(lower) && /\b(pnpm|yarn|npm|bun|go|cargo|pytest)\b/.test(lower)) ||
      /\buses (pnpm|yarn|npm|bun|corepack)\b/.test(lower) ||
      /\b(pnpm|yarn|npm|bun) (build|typecheck|test|lint|dev|start)\b/.test(lower);
    if (isEssential) {
      essentials.push(rawLine);
    } else {
      unclassified.push(rawLine);
    }
  }

  const docsDir = path.join(root, "docs");
  ensureDir(docsDir);
  for (const domain of DOC_DOMAINS) {
    const dest = path.join(docsDir, `${domain}.md`);
    let content = "";
    if (fs.existsSync(dest)) {
      content = fs.readFileSync(dest, "utf-8");
      if (!content.endsWith("\n")) content += "\n";
      content += `\n<!-- Imported from previous AGENTS.md via --refactor -->\n\n`;
    } else {
      content = `# ${DOMAIN_LABELS[domain]}\n\n<!-- Imported from previous AGENTS.md via --refactor -->\n\n`;
    }
    for (const l of buckets[domain]) content += `- ${l.replace(/^[-*]\s*/, "")}\n`;
    fs.writeFileSync(dest, content);
    logFinding({
      kind: "create",
      message: `Wrote docs/${domain}.md (${buckets[domain].length} imported lines)`,
    });
  }

  const rootContent = buildRefactoredRoot(essentials, unclassified);
  fs.writeFileSync(agentsPath, rootContent);
  logFinding({ kind: "create", message: `Rewrote AGENTS.md as minimal root with links` });

  if (unclassified.length > 0) {
    console.log(
      `\n⚠️  ${unclassified.length} line(s) could not be auto-classified and were left in AGENTS.md.bak. Review them manually.`,
    );
  }
  console.log("\nNext steps:");
  console.log("1. Review each docs/*.md for misclassified lines and move them as needed.");
  console.log(
    "2. Resolve any contradictions surfaced by the refactor (see references/refactor.md).",
  );
  console.log("3. Delete empty docs stubs and remove their link lines from AGENTS.md.");
  console.log("4. Run audit-agents.ts to verify.");
}

function buildRefactoredRoot(essentials: string[], unclassified: string[]): string {
  const lines: string[] = [];
  lines.push("# AGENTS.md");
  lines.push("");

  const headingIdx = essentials.findIndex((l) => l.startsWith("# ") && !l.startsWith("# AGENTS"));
  const headingText = headingIdx >= 0 ? essentials[headingIdx].replace(/^#\s+/, "").trim() : "";
  const descriptionIdx = essentials.findIndex((l, i) => i !== headingIdx && !l.startsWith("#"));
  if (descriptionIdx >= 0) {
    lines.push(essentials[descriptionIdx].trim());
  } else if (headingText) {
    lines.push(headingText);
  } else {
    lines.push("<!-- TODO: one-sentence project description -->");
  }
  lines.push("");

  lines.push("## Essentials");
  const essentialsBody = essentials.filter(
    (l, i) => i !== headingIdx && i !== descriptionIdx && !l.startsWith("#"),
  );
  if (essentialsBody.length === 0) {
    lines.push("- Package manager: <!-- pnpm | yarn | bun | npm | corepack -->");
    lines.push("- Build: <!-- command -->");
    lines.push("- Typecheck: <!-- command -->");
    lines.push("- Test: <!-- command -->");
  } else {
    for (const l of essentialsBody) {
      const t = l.trim();
      lines.push(t.startsWith("-") ? t : `- ${t}`);
    }
  }
  lines.push("");

  lines.push("## Domain Guidance");
  for (const domain of DOC_DOMAINS) {
    lines.push(`- ${DOMAIN_LABELS[domain]}: see docs/${domain}.md`);
  }

  if (unclassified.length > 0) {
    lines.push("");
    lines.push(
      "<!-- TODO: The following lines could not be auto-classified. Move to a docs/ file or delete. -->",
    );
    for (const l of unclassified) lines.push(`<!-- ${l} -->`);
  }
  lines.push("");
  return lines.join("\n");
}

function main(): void {
  const args = process.argv.slice(2);
  const refactor = args.includes("--refactor");
  const root = process.cwd();
  console.log(`🚀 ${refactor ? "Refactoring" : "Scaffolding"} AGENTS.md at ${root}\n`);
  if (refactor) {
    scaffoldRefactor(root);
  } else {
    scaffoldFresh(root);
  }
}

main();
