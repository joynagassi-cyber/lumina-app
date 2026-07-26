#!/usr/bin/env node
/* ==========================================================================
   detect-blockers.mjs -- LIP-v1 Blocker Detection
   --------------------------------------------------------------------------
   Scans all .ts/.tsx files under src/ for prohibited patterns.
   Produces IMPLEMENTATION-BLOCKER.md + blockers-report.json.
   Exit 0 = clean, exit 1 = violations found.
   ========================================================================== */

import { readFileSync, existsSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "src");
var SAFE_BOOT = join(SRC, "safe-boot"); // prefer if it exists; fall back to entire src

// Use safe-boot if present, otherwise scan all of src
var SCAN_DIR = existsSync(SAFE_BOOT) ? SAFE_BOOT : SRC;

// ROOT is where src/ lives (project root)
// When scanning safe-boot which contains nested src/, strip accordingly
var BASE_STRIP = SRC; // default strip prefix
if (existsSync(SAFE_BOOT)) {
  // src/safe-boot already includes 'src/' -- just strip ROOT/src/
  BASE_STRIP = ROOT;
} else {
  BASE_STRIP = ROOT;
}

var ARTIFACTS = join(ROOT, "artifacts", "blockers");
if (!existsSync(ARTIFACTS)) mkdirSync(ARTIFACTS, { recursive: true });

// ---------------------------------------------------------------------------
// Pattern definitions (what is NOT allowed per NB rules)
// ---------------------------------------------------------------------------

var PATTERNS = [
  {
    name: "TS Ignore",
    rule: "NB-TECH-002 strict mode",
    re: /\/\/\s*@ts-ignore/g,
    severity: "ERROR",
    suggestion: "Fix the underlying type issue instead of suppressing the compiler.",
  },
  {
    name: "any Type",
    rule: "NB-TECH-002 strict typing",
    // Match 'any' that is not part of 'interface X extends any' or type annotations
    re: /\bany\b(?!\s*:)/g,
    severity: "ERROR",
    suggestion: 'Use "unknown" or a properly typed interface instead of "any".',
  },
  {
    name: "Console Log",
    rule: "NB-TECH-004 logging discipline",
    re: /console\.(log|debug|warn|error)\s*\(/g,
    severity: "WARNING",
    suggestion: 'Use NestJS Logger service: "private readonly logger = new Logger(ClassName)"',
  },
  {
    name: "Hardcoded Config",
    rule: "NB-TECH-006 configuration discipline",
    re: /(process\.env\.)?[A-Z_]+(?:[A-Z]*[a-z]|[a-z])+\s*=\s*["'][^'"]+["']/g,
    severity: "WARNING",
    suggestion: "Move configuration to ConfigService / environment variables with validation schemas.",
  },
  {
    name: "eval()",
    rule: "NB-SEC-001 input validation",
    re: /\beval\s*\(/g,
    severity: "ERROR",
    suggestion: "Replace eval() with safe JSON.parse or a proper parser.",
  },
  {
    name: "innerHTML Assignment",
    rule: "NB-SEC-002 XSS prevention",
    re: /\.innerHTML\s*=/g,
    severity: "ERROR",
    suggestion: "Use React's built-in JSX rendering -- never assign innerHTML directly.",
  },
];

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------

function collectFiles(dir) {
  var files = [];
  try {
    var entries = readdirSync(dir, { withFileTypes: true });
    for (var ei = 0; ei < entries.length; ei++) {
      var entry = entries[ei];
      var full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === "dist") continue;
        files = files.concat(collectFiles(full));
      } else if (/\.(ts|tsx)$/.test(entry.name)) {
        files.push(full);
      }
    }
  } catch (_) {
    // dir missing
  }
  return files;
}

var sourceFiles = collectFiles(SCAN_DIR);

// ---------------------------------------------------------------------------
// Scan
// ---------------------------------------------------------------------------

var violations = [];

for (var si = 0; si < sourceFiles.length; si++) {
  var filePath = sourceFiles[si];
  var content = readFileSync(filePath, "utf-8");
  var lines = content.split("\n");
  var relFile = filePath.replace(new RegExp("^" + BASE_STRIP.replace(/\\/g, "/") + "/"), "");

  for (var pi = 0; pi < PATTERNS.length; pi++) {
    var pat = PATTERNS[pi];
    pat.re.lastIndex = 0;
    var m;
    while ((m = pat.re.exec(content)) !== null) {
      var prefix = content.substring(0, m.index);
      var lineNum = (prefix.match(/\n/g) || []).length + 1;
      var lineText = lines[lineNum - 1] ? lines[lineNum - 1].trim() : m[0];

      violations.push({
        file: relFile,
        line: lineNum,
        pattern: lineText.substring(0, 120),
        severity: pat.severity,
        rule: pat.rule,
        suggestion: pat.suggestion,
      });
      pat.re.lastIndex = m.index + m[0].length;
      if (pat.re.lastIndex >= content.length) break;
    }
  }
}

// ---------------------------------------------------------------------------
// Deduplicate: group by file + line
// ---------------------------------------------------------------------------

var grouped = {};
for (var vi = 0; vi < violations.length; vi++) {
  var v = violations[vi];
  var key = v.file + (v.line ? ":" + v.line : ":global");
  if (!grouped[key]) grouped[key] = [];
  grouped[key].push(v);
}

var deduplicated = [];
var keys = Object.keys(grouped);
for (var ki = 0; ki < keys.length; ki++) {
  deduplicated = deduplicated.concat(grouped[keys[ki]]);
}

// ---------------------------------------------------------------------------
// Build MD report
// ---------------------------------------------------------------------------

var errorCount = 0;
var warningCount = 0;
for (var di = 0; di < deduplicated.length; di++) {
  if (deduplicated[di].severity === "ERROR") errorCount++;
  else warningCount++;
}
var totalScanned = sourceFiles.length;

var md = "# Implementation Blockers Report\n\n";
md += "**Generated:** " + new Date().toISOString() + "  \n";
md += "**Scan directory:** " + SCAN_DIR.replace(/\\/g, "/") + "  \n";
md += "**Files scanned:** " + totalScanned + "\n\n";
md += "---\n\n";
md += "## Summary\n\n";
md += "- **Errors:** " + errorCount + "\n";
md += "- **Warnings:** " + warningCount + "\n";
md += "- **Status:** " + (errorCount > 0 ? "BLOCKED" : warningCount > 0 ? "WARNING" : "CLEAN") + "\n\n";
md += "---\n\n";

if (deduplicated.length === 0) {
  md += "No blockers detected.\n\n";
} else {
  var errorsList = [];
  var warningsList = [];
  for (var wi = 0; wi < deduplicated.length; wi++) {
    if (deduplicated[wi].severity === "ERROR") errorsList.push(deduplicated[wi]);
    else warningsList.push(deduplicated[wi]);
  }

  if (errorsList.length > 0) {
    md += "## Errors\n\n";
    for (var eli = 0; eli < errorsList.length; eli++) {
      var e = errorsList[eli];
      md += "### `" + e.file + (e.line ? ":" + e.line : "") + "`\n\n";
      md += "- **Rule:** " + e.rule + "\n";
      md += '- **Pattern:** `' + e.pattern + '`\n';
      md += "- **Fix:** " + e.suggestion + "\n\n";
    }
  }

  if (warningsList.length > 0) {
    md += "## Warnings\n\n";
    for (var wli = 0; wli < warningsList.length; wli++) {
      var w = warningsList[wli];
      md += "### `" + w.file + (w.line ? ":" + w.line : "") + "`\n\n";
      md += "- **Rule:** " + w.rule + "\n";
      md += '- **Pattern:** `' + w.pattern + '`\n';
      md += "- **Suggestion:** " + w.suggestion + "\n\n";
    }
  }
}

// Write MD report at project root
var mdPath = join(ROOT, "IMPLEMENTATION-BLOCKER.md");
writeFileSync(mdPath, md, "utf-8");

// Also write JSON report
var jsonReport = {
  schema: "LIP-v1-detect-blockers",
  version: "1.0.0",
  timestamp: new Date().toISOString(),
  summary: {
    totalFilesScanned: totalScanned,
    errorCount: errorCount,
    warningCount: warningCount,
    totalViolations: deduplicated.length,
    status: errorCount > 0 ? "BLOCKED" : "CLEAN",
  },
  violations: deduplicated,
};

var jsonPath = join(ARTIFACTS, "blockers-report.json");
writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2), "utf-8");

console.log(JSON.stringify(jsonReport, null, 2));
console.error("\nReport written to: " + mdPath);

if (errorCount > 0) {
  console.error("\nBLOCKERS FOUND: " + errorCount + " error(s) must be resolved before merging.");
  process.exit(1);
} else {
  console.error("\nBlocker detection PASSED (" + warningCount + " warning(s) only).");
  process.exit(0);
}
