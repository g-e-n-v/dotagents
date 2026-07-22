#!/usr/bin/env bun
/**
 * init-agents.ts
 *
 * Scaffolds a concise, language-agnostic AGENTS.md "tech-stack manifest" at the
 * repo root plus a set of technical docs under docs/technical/.
 *
 * The root AGENTS.md lists the stack, key libraries/packages, and their versions,
 * then links to docs/technical/*.md via a table (progressive disclosure). It carries
 * technical context only — no business/product detail.
 *
 * Usage:
 *   npx tsx init-agents.ts [--refactor]   (or: bun init-agents.ts [--refactor])
 *
 * Run from the repository root.
 *
 * Modes:
 *   default    - detect the stack, generate AGENTS.md, and copy docs/technical/ stubs.
 *   --refactor - read an existing AGENTS.md, classify its prose into docs/technical/*.md
 *                by keyword, regenerate AGENTS.md as a manifest + docs table, and back up
 *                the original to AGENTS.md.bak.
 *
 * Language-agnostic: detects Node/JS/TS, Rust, Go, Python, Java/Kotlin, Ruby, PHP,
 * .NET, and Dart/Flutter from their manifest files. Unknown stacks fall back to the
 * blank template so the user can fill it in by hand.
 *
 * Out of scope: monorepos with nested per-package AGENTS.md files (single-root only).
 */

import * as fs from "fs";
import * as path from "path";

const ASSETS_DIR = path.resolve(__dirname, "..", "assets");
const TECH_DOCS = ["conventions", "architecture", "rules", "testing", "tooling"] as const;
const TECH_DOC_LABELS: Record<string, string> = {
  conventions: "Conventions",
  architecture: "Architecture",
  rules: "Rules",
  testing: "Testing",
  tooling: "Tooling",
};

const MAX_DEPS = 25;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StackEntry {
  layer: string;
  tech: string;
  version: string;
}
interface DepEntry {
  name: string;
  version: string;
}
type Commands = Partial<Record<"install" | "build" | "test" | "lint", string>>;
interface Detected {
  ecosystem: string;
  stack: StackEntry[];
  deps: DepEntry[];
  commands: Commands;
}

interface Finding {
  kind: "create" | "backup" | "classify" | "detect" | "skip";
  message: string;
}

function logFinding(f: Finding): void {
  const icon =
    f.kind === "create"
      ? "✅"
      : f.kind === "backup"
        ? "💾"
        : f.kind === "classify"
          ? "🔀"
          : f.kind === "detect"
            ? "🔎"
            : "⏭️";
  console.log(`${icon} ${f.message}`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function read(p: string): string {
  return fs.readFileSync(p, "utf-8");
}
function exists(p: string): boolean {
  return fs.existsSync(p);
}
function ensureDir(dir: string): void {
  if (!exists(dir)) fs.mkdirSync(dir, { recursive: true });
}

/** Strip range operators / whitespace from a version string. */
function cleanVer(v: unknown): string {
  if (typeof v !== "string") return "—";
  const cleaned = v
    .replace(/^[\s\^~><=v]+/i, "")
    .split(/[\s,|]+/)[0]
    .trim();
  return cleaned || "—";
}

/** Read the first regex capture group across a multiline string. */
function firstMatch(text: string, re: RegExp): string | null {
  const m = text.match(re);
  return m ? m[1] : null;
}

// ---------------------------------------------------------------------------
// Ecosystem detectors — each returns Detected or null.
// ---------------------------------------------------------------------------

function detectNode(root: string): Detected | null {
  const p = path.join(root, "package.json");
  if (!exists(p)) return null;
  let pkg: any;
  try {
    pkg = JSON.parse(read(p));
  } catch {
    return null;
  }
  const prod: Record<string, string> = pkg.dependencies ?? {};
  const all: Record<string, string> = { ...pkg.dependencies, ...pkg.devDependencies };
  const stack: StackEntry[] = [];

  const hasTs = "typescript" in all || exists(path.join(root, "tsconfig.json"));
  if (hasTs) {
    stack.push({ layer: "Language", tech: "TypeScript", version: cleanVer(all.typescript) });
  } else {
    stack.push({ layer: "Language", tech: "JavaScript", version: "—" });
  }
  stack.push({ layer: "Runtime", tech: "Node.js", version: cleanVer(pkg.engines?.node) });

  const frameworks: Record<string, string> = {
    next: "Next.js",
    nuxt: "Nuxt",
    "@angular/core": "Angular",
    "@nestjs/core": "NestJS",
    astro: "Astro",
    remix: "Remix",
    "solid-js": "SolidJS",
    svelte: "Svelte",
    vue: "Vue",
    react: "React",
    express: "Express",
    fastify: "Fastify",
    koa: "Koa",
  };
  for (const [dep, label] of Object.entries(frameworks)) {
    if (dep in prod) stack.push({ layer: "Framework", tech: label, version: cleanVer(prod[dep]) });
  }

  const deps: DepEntry[] = Object.entries(prod).map(([name, v]) => ({ name, version: cleanVer(v) }));

  const pm = detectNodePm(pkg, root);
  const scripts: Record<string, string> = pkg.scripts ?? {};
  const runner = pm === "npm" ? "npm run" : `${pm} run`;
  const commands: Commands = { install: `${pm} install` };
  if (scripts.build) commands.build = `${runner} build`;
  if (scripts.test) commands.test = pm === "npm" ? "npm test" : `${pm} test`;
  if (scripts.lint) commands.lint = `${runner} lint`;

  return { ecosystem: "node", stack, deps, commands };
}

function detectNodePm(pkg: any, root: string): string {
  if (typeof pkg.packageManager === "string") {
    const name = pkg.packageManager.split("@")[0];
    if (["pnpm", "yarn", "bun", "npm"].includes(name)) return name;
  }
  if (exists(path.join(root, "pnpm-lock.yaml"))) return "pnpm";
  if (exists(path.join(root, "yarn.lock"))) return "yarn";
  if (exists(path.join(root, "bun.lockb")) || exists(path.join(root, "bun.lock"))) return "bun";
  return "npm";
}

function detectRust(root: string): Detected | null {
  const p = path.join(root, "Cargo.toml");
  if (!exists(p)) return null;
  const text = read(p);
  const stack: StackEntry[] = [
    { layer: "Language", tech: "Rust", version: cleanVer(firstMatch(text, /rust-version\s*=\s*"([^"]+)"/) ?? "—") },
  ];
  const deps: DepEntry[] = [];
  const section = text.match(/\[dependencies\]([\s\S]*?)(?:\n\[|$)/);
  if (section) {
    for (const line of section[1].split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const simple = t.match(/^([A-Za-z0-9_\-]+)\s*=\s*"([^"]+)"/);
      const table = t.match(/^([A-Za-z0-9_\-]+)\s*=\s*\{.*version\s*=\s*"([^"]+)"/);
      if (simple) deps.push({ name: simple[1], version: cleanVer(simple[2]) });
      else if (table) deps.push({ name: table[1], version: cleanVer(table[2]) });
    }
  }
  return { ecosystem: "rust", stack, deps, commands: { build: "cargo build", test: "cargo test", lint: "cargo clippy" } };
}

function detectGo(root: string): Detected | null {
  const p = path.join(root, "go.mod");
  if (!exists(p)) return null;
  const text = read(p);
  const stack: StackEntry[] = [
    { layer: "Language", tech: "Go", version: cleanVer(firstMatch(text, /^go\s+([0-9.]+)/m) ?? "—") },
  ];
  const deps: DepEntry[] = [];
  const reqLine = /^\s*(?:require\s+)?([\w./\-]+)\s+v([\w.\-+]+)/;
  let inBlock = false;
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (t.startsWith("require (")) {
      inBlock = true;
      continue;
    }
    if (inBlock && t === ")") {
      inBlock = false;
      continue;
    }
    if (t.startsWith("//")) continue;
    if (inBlock || t.startsWith("require ")) {
      const m = t.replace(/^require\s+/, "").match(/^([\w./\-]+)\s+v([\w.\-+]+)/);
      if (m) {
        const short = m[1].split("/").slice(-1)[0];
        deps.push({ name: short, version: m[2] });
      }
    }
  }
  return { ecosystem: "go", stack, deps, commands: { build: "go build ./...", test: "go test ./...", lint: "go vet ./..." } };
}

function detectPython(root: string): Detected | null {
  const pyproject = path.join(root, "pyproject.toml");
  const reqs = path.join(root, "requirements.txt");
  if (!exists(pyproject) && !exists(reqs)) return null;

  const stack: StackEntry[] = [{ layer: "Language", tech: "Python", version: "—" }];
  const deps: DepEntry[] = [];

  if (exists(pyproject)) {
    const text = read(pyproject);
    const py = firstMatch(text, /requires-python\s*=\s*"([^"]+)"/);
    if (py) stack[0].version = cleanVer(py);
    // PEP 621 dependencies = ["pkg>=1.0", ...]
    const arr = text.match(/dependencies\s*=\s*\[([\s\S]*?)\]/);
    if (arr) {
      for (const raw of arr[1].split(",")) {
        const m = raw.trim().replace(/^["']|["']$/g, "").match(/^([A-Za-z0-9_.\-]+)\s*([<>=!~]{1,2}\s*[\w.]+)?/);
        if (m && m[1]) deps.push({ name: m[1], version: m[2] ? cleanVer(m[2]) : "—" });
      }
    }
    // Poetry [tool.poetry.dependencies]
    const poetry = text.match(/\[tool\.poetry\.dependencies\]([\s\S]*?)(?:\n\[|$)/);
    if (poetry) {
      for (const line of poetry[1].split("\n")) {
        const m = line.trim().match(/^([A-Za-z0-9_.\-]+)\s*=\s*"?\^?([\w.]+)?/);
        if (m && m[1] && m[1].toLowerCase() !== "python") deps.push({ name: m[1], version: m[2] ? cleanVer(m[2]) : "—" });
      }
    }
  } else if (exists(reqs)) {
    for (const line of read(reqs).split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const m = t.match(/^([A-Za-z0-9_.\-]+)\s*(?:[<>=!~]{1,2}\s*([\w.]+))?/);
      if (m && m[1]) deps.push({ name: m[1], version: m[2] ? cleanVer(m[2]) : "—" });
    }
  }
  return { ecosystem: "python", stack, deps, commands: {} };
}

function detectJava(root: string): Detected | null {
  const pom = path.join(root, "pom.xml");
  const gradle = ["build.gradle", "build.gradle.kts"].map((f) => path.join(root, f)).find(exists);
  if (!exists(pom) && !gradle) return null;

  const deps: DepEntry[] = [];
  let language = "Java";
  const stack: StackEntry[] = [];

  if (exists(pom)) {
    const text = read(pom);
    const target =
      firstMatch(text, /<maven\.compiler\.release>([^<]+)</) ??
      firstMatch(text, /<java\.version>([^<]+)</) ??
      firstMatch(text, /<maven\.compiler\.source>([^<]+)</);
    stack.push({ layer: "Language", tech: "Java", version: target ? cleanVer(target) : "—" });
    const depRe = /<dependency>[\s\S]*?<artifactId>([^<]+)<\/artifactId>[\s\S]*?(?:<version>([^<]+)<\/version>)?[\s\S]*?<\/dependency>/g;
    let m: RegExpExecArray | null;
    while ((m = depRe.exec(text)) !== null) {
      deps.push({ name: m[1], version: m[2] ? cleanVer(m[2]) : "—" });
    }
    return { ecosystem: "java", stack, deps, commands: { build: "mvn package", test: "mvn test" } };
  }

  if (gradle) {
    const text = read(gradle);
    if (/kotlin/i.test(text)) language = "Kotlin";
    const jv = firstMatch(text, /(?:sourceCompatibility|languageVersion)\D*([0-9.]+)/);
    stack.push({ layer: "Language", tech: language, version: jv ? cleanVer(jv) : "—" });
    const depRe = /(?:implementation|api|compileOnly|runtimeOnly|testImplementation)\s*[('"]+([\w.\-]+):([\w.\-]+):([\w.\-]+)/g;
    let m: RegExpExecArray | null;
    while ((m = depRe.exec(text)) !== null) {
      deps.push({ name: m[2], version: m[3] });
    }
    return { ecosystem: "gradle", stack, deps, commands: { build: "./gradlew build", test: "./gradlew test" } };
  }
  return null;
}

function detectRuby(root: string): Detected | null {
  const gemfile = path.join(root, "Gemfile");
  if (!exists(gemfile)) return null;
  const text = read(gemfile);
  const stack: StackEntry[] = [
    { layer: "Language", tech: "Ruby", version: cleanVer(firstMatch(text, /ruby\s+["']([\w.]+)["']/) ?? "—") },
  ];
  const deps: DepEntry[] = [];
  const gemRe = /^\s*gem\s+["']([\w\-]+)["'](?:\s*,\s*["'][~><=\s]*([\w.]+)["'])?/gm;
  let m: RegExpExecArray | null;
  while ((m = gemRe.exec(text)) !== null) {
    deps.push({ name: m[1], version: m[2] ? cleanVer(m[2]) : "—" });
  }
  return { ecosystem: "ruby", stack, deps, commands: { install: "bundle install", test: "bundle exec rake test" } };
}

function detectPhp(root: string): Detected | null {
  const p = path.join(root, "composer.json");
  if (!exists(p)) return null;
  let json: any;
  try {
    json = JSON.parse(read(p));
  } catch {
    return null;
  }
  const require: Record<string, string> = json.require ?? {};
  const stack: StackEntry[] = [{ layer: "Language", tech: "PHP", version: cleanVer(require.php ?? "—") }];
  const deps: DepEntry[] = Object.entries(require)
    .filter(([n]) => n !== "php" && !n.startsWith("ext-"))
    .map(([name, v]) => ({ name, version: cleanVer(v) }));
  return { ecosystem: "php", stack, deps, commands: { install: "composer install", test: "composer test" } };
}

function detectDotnet(root: string): Detected | null {
  const csproj = fs.readdirSync(root).find((f) => f.endsWith(".csproj"));
  if (!csproj) return null;
  const text = read(path.join(root, csproj));
  const tfm = firstMatch(text, /<TargetFramework>([^<]+)</);
  const stack: StackEntry[] = [{ layer: "Framework", tech: ".NET", version: tfm ? cleanVer(tfm) : "—" }];
  const deps: DepEntry[] = [];
  const depRe = /<PackageReference\s+Include="([^"]+)"\s+Version="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = depRe.exec(text)) !== null) {
    deps.push({ name: m[1], version: cleanVer(m[2]) });
  }
  return { ecosystem: "dotnet", stack, deps, commands: { build: "dotnet build", test: "dotnet test" } };
}

function detectDart(root: string): Detected | null {
  const p = path.join(root, "pubspec.yaml");
  if (!exists(p)) return null;
  const text = read(p);
  const sdk = firstMatch(text, /sdk:\s*["']?[><=^\s]*([\w.]+)/);
  const isFlutter = /flutter:/.test(text) || /sdk:\s*flutter/.test(text);
  const stack: StackEntry[] = [
    { layer: "Language", tech: "Dart", version: sdk ? cleanVer(sdk) : "—" },
  ];
  if (isFlutter) stack.push({ layer: "Framework", tech: "Flutter", version: "—" });
  const deps: DepEntry[] = [];
  const block = text.match(/\ndependencies:\s*\n([\s\S]*?)(?:\n\w|$)/);
  if (block) {
    for (const line of block[1].split("\n")) {
      const m = line.match(/^\s{2}([A-Za-z0-9_]+):\s*["']?[><=^\s]*([\w.]+)?/);
      if (m && m[1] && m[1] !== "flutter") deps.push({ name: m[1], version: m[2] ? cleanVer(m[2]) : "—" });
    }
  }
  return { ecosystem: "dart", stack, deps, commands: { install: isFlutter ? "flutter pub get" : "dart pub get", test: isFlutter ? "flutter test" : "dart test" } };
}

const DETECTORS = [
  detectNode,
  detectRust,
  detectGo,
  detectPython,
  detectJava,
  detectRuby,
  detectPhp,
  detectDotnet,
  detectDart,
];

function detectStack(root: string): Detected {
  const stack: StackEntry[] = [];
  const deps: DepEntry[] = [];
  const commands: Commands = {};
  const ecosystems: string[] = [];
  for (const detector of DETECTORS) {
    let result: Detected | null = null;
    try {
      result = detector(root);
    } catch {
      result = null;
    }
    if (!result) continue;
    ecosystems.push(result.ecosystem);
    stack.push(...result.stack);
    deps.push(...result.deps);
    for (const [k, v] of Object.entries(result.commands)) {
      if (v && !(k in commands)) (commands as Record<string, string>)[k] = v;
    }
  }
  // Dedupe deps by name.
  const seen = new Set<string>();
  const dedupedDeps = deps.filter((d) => (seen.has(d.name) ? false : (seen.add(d.name), true)));
  return { ecosystem: ecosystems.join("+"), stack, deps: dedupedDeps, commands };
}

// ---------------------------------------------------------------------------
// Manifest generation
// ---------------------------------------------------------------------------

function mdTable(header: string[], rows: string[][]): string[] {
  const lines = [`| ${header.join(" | ")} |`, `| ${header.map(() => "---").join(" | ")} |`];
  for (const r of rows) lines.push(`| ${r.join(" | ")} |`);
  return lines;
}

function techDocsTable(): string[] {
  const rows = TECH_DOCS.map((d) => [TECH_DOC_LABELS[d], `docs/technical/${d}.md`]);
  return mdTable(["Topic", "Docs"], rows);
}

/** Build a populated manifest from detected data. */
function buildManifest(detected: Detected): string {
  const lines: string[] = [];
  lines.push("# AGENTS.md", "");
  lines.push(
    "<!-- Tech-stack manifest for AI coding agents. Keep concise; it loads on every request.",
    "     Detected values below — verify and edit. Push all prose into docs/technical/. -->",
    "",
  );

  lines.push("## Stack", "");
  const stackRows = detected.stack.map((s) => [s.layer, s.tech, s.version]);
  lines.push(...mdTable(["Layer", "Technology", "Version"], stackRows), "");

  lines.push("## Key libraries & packages", "");
  const shown = detected.deps.slice(0, MAX_DEPS);
  if (shown.length === 0) {
    lines.push("<!-- No direct dependencies detected. Add the ones an agent must know about. -->", "");
  } else {
    const depRows = shown.map((d) => [d.name, d.version, "<!-- ? -->"]);
    lines.push(...mdTable(["Package", "Version", "Purpose"], depRows));
    if (detected.deps.length > shown.length) {
      lines.push(`| <!-- +${detected.deps.length - shown.length} more; keep only the notable ones --> | | |`);
    }
    lines.push("");
  }

  lines.push("## Commands", "");
  const c = detected.commands;
  lines.push(`- Install: ${c.install ? `\`${c.install}\`` : "<!-- command -->"}`);
  lines.push(`- Build: ${c.build ? `\`${c.build}\`` : "<!-- command -->"}`);
  lines.push(`- Test: ${c.test ? `\`${c.test}\`` : "<!-- command -->"}`);
  lines.push(`- Lint: ${c.lint ? `\`${c.lint}\`` : "<!-- command -->"}`);
  lines.push("");

  lines.push("## Technical docs", "");
  lines.push("<!-- Progressive disclosure: agents read these only when working in that area. -->");
  lines.push(...techDocsTable());
  lines.push("");
  return lines.join("\n");
}

/** Return the blank template verbatim (used when nothing was detected). */
function blankManifest(): string {
  return read(path.join(ASSETS_DIR, "AGENTS.md"));
}

function copyTechDocs(root: string): void {
  const destDir = path.join(root, "docs", "technical");
  ensureDir(destDir);
  for (const doc of TECH_DOCS) {
    const dest = path.join(destDir, `${doc}.md`);
    if (exists(dest)) {
      logFinding({ kind: "skip", message: `docs/technical/${doc}.md already exists — left as-is.` });
      continue;
    }
    fs.copyFileSync(path.join(ASSETS_DIR, "docs", "technical", `${doc}.md`), dest);
    logFinding({ kind: "create", message: `Created docs/technical/${doc}.md` });
  }
}

function reportDetection(detected: Detected): void {
  if (detected.stack.length === 0) {
    logFinding({ kind: "skip", message: "No known stack detected — using the blank template. Fill it in by hand." });
    return;
  }
  logFinding({
    kind: "detect",
    message: `Detected: ${detected.stack.map((s) => `${s.tech} ${s.version}`).join(", ")} (${detected.deps.length} deps)`,
  });
}

// ---------------------------------------------------------------------------
// Modes
// ---------------------------------------------------------------------------

function scaffoldFresh(root: string): void {
  const agentsPath = path.join(root, "AGENTS.md");
  if (exists(agentsPath)) {
    logFinding({
      kind: "skip",
      message: `AGENTS.md already exists at ${agentsPath}. Use --refactor to rebuild it, or delete it first.`,
    });
    process.exit(1);
  }

  const detected = detectStack(root);
  reportDetection(detected);

  const content = detected.stack.length > 0 ? buildManifest(detected) : blankManifest();
  fs.writeFileSync(agentsPath, content);
  logFinding({ kind: "create", message: `Created AGENTS.md manifest at ${agentsPath}` });

  copyTechDocs(root);

  console.log("\nNext steps:");
  console.log("1. Verify the detected Stack / libraries and fill in versions marked '—'.");
  console.log("2. Fill in docs/technical/*.md for the areas that apply; delete rows/files that don't.");
  console.log("3. Run audit-agents.ts to verify.");
}

// Keyword classification for refactor mode. Order matters: first match wins.
const CLASSIFIERS: Array<{ topic: string; signals: RegExp[] }> = [
  {
    topic: "testing",
    signals: [
      /\btest(s|ing)?\b|\bspec\b/i,
      /\bmock\b|\bstub\b|\bfixture\b|\bcoverage\b/i,
      /\bunit\b|\bintegration\b|\be2e\b|\bend[- ]to[- ]end\b/i,
      /\bvitest\b|\bjest\b|\bpytest\b|\bjunit\b|\brspec\b|\bgo test\b|\bcargo test\b/i,
    ],
  },
  {
    topic: "tooling",
    signals: [
      /\bbuild\b|\bcompile\b|\bbundl(e|er)\b/i,
      /\blint\b|\bformat(ter|ting)?\b|\bprettier\b|\beslint\b|\bclippy\b/i,
      /\bci\b|\bpipeline\b|\bgithub actions\b|\bpre-commit\b/i,
      /\bpackage manager\b|\bnpm\b|\bpnpm\b|\byarn\b|\bcargo\b|\bgradle\b|\bmaven\b|\bpip\b|\bpoetry\b/i,
      /\bdocker\b|\bmakefile\b|\bwebpack\b|\bvite\b|\besbuild\b/i,
    ],
  },
  {
    topic: "architecture",
    signals: [
      /\barchitecture\b|\blayer\b|\bboundary\b|\bboundaries\b/i,
      /\bdata flow\b|\bmodule\b|\bservice\b|\bcomponent\b/i,
      /\bdirectory (structure|layout)\b|\bmonorepo\b|\bpackage structure\b/i,
      /\bn-tier\b|\bclean architecture\b|\bhexagonal\b/i,
    ],
  },
  {
    topic: "rules",
    signals: [
      /\b(must|never|always|do not|don't|avoid|forbidden|required)\b/i,
      /\bconstraint\b|\bpolicy\b|\bguardrail\b/i,
      /\bsecret\b|\bcredential\b|\bsecurity\b|\bauth\b/i,
      /\bgenerated\b.*\b(file|code)\b|\bdo not edit\b/i,
    ],
  },
  {
    topic: "conventions",
    signals: [
      /\bconventions?\b|\bstyle\b|\bnaming\b|\bformat(ting)?\b/i,
      /\bindent(ation)?\b|\bimports?\b/i,
      /\bprefer\b|\buse\b.*\binstead\b|\bpatterns?\b|\bidioms?\b/i,
      /\berror handling\b|\bnullable\b|\bexceptions?\b|\brest\b|\bendpoint/i,
    ],
  },
];

function classifyLine(line: string): string | null {
  const text = line.replace(/^[-*]\s*/, "").trim();
  if (!text || text.startsWith("#") || text.startsWith("<!--") || text.startsWith("|")) return null;
  for (const { topic, signals } of CLASSIFIERS) {
    if (signals.some((re) => re.test(text))) return topic;
  }
  return null;
}

function scaffoldRefactor(root: string): void {
  const agentsPath = path.join(root, "AGENTS.md");
  if (!exists(agentsPath)) {
    logFinding({
      kind: "skip",
      message: `No existing AGENTS.md at ${agentsPath}. Run without --refactor to scaffold fresh.`,
    });
    process.exit(1);
  }

  const original = read(agentsPath);
  fs.writeFileSync(path.join(root, "AGENTS.md.bak"), original);
  logFinding({ kind: "backup", message: "Backed up original to AGENTS.md.bak" });

  const buckets: Record<string, string[]> = {};
  for (const topic of TECH_DOCS) buckets[topic] = [];
  const unclassified: string[] = [];

  for (const rawLine of original.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith("<!--") || line.startsWith("|")) continue;
    const topic = classifyLine(line);
    if (topic) {
      buckets[topic].push(line.replace(/^[-*]\s*/, ""));
      logFinding({
        kind: "classify",
        message: `docs/technical/${topic}.md <= "${line.slice(0, 56)}${line.length > 56 ? "..." : ""}"`,
      });
    } else {
      unclassified.push(rawLine);
    }
  }

  // Write docs/technical, appending imported lines onto the stub content.
  const destDir = path.join(root, "docs", "technical");
  ensureDir(destDir);
  for (const topic of TECH_DOCS) {
    const dest = path.join(destDir, `${topic}.md`);
    let content: string;
    if (exists(dest)) {
      content = read(dest);
    } else {
      content = read(path.join(ASSETS_DIR, "docs", "technical", `${topic}.md`));
    }
    if (buckets[topic].length > 0) {
      if (!content.endsWith("\n")) content += "\n";
      content += `\n<!-- Imported from previous AGENTS.md via --refactor; review and edit. -->\n`;
      for (const l of buckets[topic]) content += `- ${l}\n`;
    }
    fs.writeFileSync(dest, content);
    logFinding({
      kind: "create",
      message: `Wrote docs/technical/${topic}.md (${buckets[topic].length} imported line(s))`,
    });
  }

  // Regenerate the root as a detected manifest.
  const detected = detectStack(root);
  reportDetection(detected);
  const content = detected.stack.length > 0 ? buildManifest(detected) : blankManifest();
  fs.writeFileSync(agentsPath, content);
  logFinding({ kind: "create", message: "Rewrote AGENTS.md as a tech-stack manifest with a docs table" });

  if (unclassified.length > 0) {
    console.log(
      `\n⚠️  ${unclassified.length} line(s) could not be auto-classified. They remain only in AGENTS.md.bak — review and place them manually.`,
    );
  }
  console.log("\nNext steps:");
  console.log("1. Verify the regenerated Stack / libraries manifest against reality.");
  console.log("2. Review each docs/technical/*.md for misclassified lines and move them as needed.");
  console.log("3. Resolve any contradictions (see references/refactor.md).");
  console.log("4. Run audit-agents.ts to verify.");
}

function main(): void {
  const args = process.argv.slice(2);
  const refactor = args.includes("--refactor");
  const root = process.cwd();
  console.log(`🚀 ${refactor ? "Refactoring" : "Scaffolding"} AGENTS.md at ${root}\n`);
  if (refactor) scaffoldRefactor(root);
  else scaffoldFresh(root);
}

main();
