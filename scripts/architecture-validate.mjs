#!/usr/bin/env node
/* ==========================================================================
   architecture-validate.mjs -- LIP-v1 Architectural Gate
   --------------------------------------------------------------------------
   Validates that the codebase respects Lumina's architectural invariants.
   Exit 0 = clean, exit 1 = violations found.
   Output: structured JSON to stdout + artifacts/ directory.
   ========================================================================== */

import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "src");
const ARTIFACTS = join(ROOT, "artifacts", "architecture");

if (!existsSync(ARTIFACTS)) mkdirSync(ARTIFACTS, { recursive: true });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read all .ts/.tsx files under `dir` recursively; returns relative paths from src/. */
function collectSourceFiles(dir, base) {
  if (base === undefined) base = SRC;
  var files = [];
  try {
    for (var i = 0; i < readdirSync(dir, { withFileTypes: true }).length; i++) {
      var entry = readdirSync(dir, { withFileTypes: true })[i];
      var full = join(dir, entry.name);
      if (entry.isDirectory()) {
        files = files.concat(collectSourceFiles(full, base));
      } else if (/\.ts(x?)$/.test(entry.name)) {
        files.push(relative(base, full));
      }
    }
  } catch (_) {
    // dir missing
  }
  return files;
}

/** Read a source file and return its content as string. */
function readFile(rel) {
  return readFileSync(join(SRC, rel), "utf-8");
}

/** Find lines that match a pattern + the line numbers. */
function findMatches(content, re) {
  var lines = content.split("\n");
  var matches = [];
  var savedIndex = re.lastIndex;
  var m;
  while ((m = re.exec(lines.join("\n"))) !== null) {
    var charIdx = m.index;
    var lineNum = lines.slice(0).map(function (_, idx) {
      var end = idx < lines.length - 1 ? lines[idx].length + 1 : lines[idx].length;
      return end;
    }).reduce(function (acc, len, idx) {
      var prefixLen = 0;
      for (var j = 0; j < idx; j++) prefixLen += lines[j].length + 1;
      return acc + 1;
    }, 0);
    // Count newlines before match position
    var prefix = lines.slice(0).join("\n").substring(0, charIdx);
    lineNum = (prefix.match(/\n/g) || []).length + 1;
    matches.push({ line: lineNum, text: lines[lineNum - 1] ? lines[lineNum - 1].trim() : m[0] });
  }
  re.lastIndex = savedIndex;
  return matches;
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

var results = [];

// ---- CHECK 1: Reverse Dependency -------------------------------------------
results.push(checkReverseDependencies());

function checkReverseDependencies() {
  var files = collectSourceFiles(SRC);
  var violations = [];
  var domainPrefixes = ["src/core"];
  var infraPatterns = [join("server"), join("features")];

  for (var fi = 0; fi < files.length; fi++) {
    var rel = files[fi];
    var isDomain = false;
    for (var d = 0; d < domainPrefixes.length; d++) {
      if (rel.indexOf(domainPrefixes[d]) === 0) { isDomain = true; break; }
    }
    if (!isDomain) continue;

    var content = readFile(rel);
    var importLines = findMatches(content, /(?:^|\n)\s*(?:import |export .*from|from\s+['"])/g);

    for (var ii = 0; ii < importLines.length; ii++) {
      var imp = importLines[ii];
      var m = imp.text.match(/from\s+['"](\.\.?\/[^'"]+)['"]/);
      if (!m) continue;

      var resolved = resolveImportDir(rel, m[1]);
      for (var ip = 0; ip < infraPatterns.length; ip++) {
        if (resolved.toLowerCase().indexOf(infraPatterns[ip]) !== -1) {
          violations.push({
            file: rel,
            line: imp.line,
            detail: "Domain importing infrastructure: " + imp.text,
          });
          break;
        }
      }
    }
  }

  return { name: "ReverseDependency", pass: violations.length === 0, violations: violations };
}

/** Resolve an import path relative to the current source file. */
function resolveImportDir(sourceRel, importPath) {
  var sourceDir = dirname(join(SRC, sourceRel));
  var resolved = join(sourceDir, importPath);
  return resolved.replace(/\\/g, "/").toLowerCase();
}

// ---- CHECK 2: NestJS-style decorators present ---------------------------------
results.push(checkNestDecorators());

function checkNestDecorators() {
  var files = collectSourceFiles(SRC);
  var violations = [];

  for (var fi = 0; fi < files.length; fi++) {
    var rel = files[fi];
    if (/\.types\.ts$/.test(rel) || /\.d\.ts$/.test(rel)) continue;

    var content = readFile(rel);
    var lines = content.split("\n");
    var classDecRe = /^@\w+/;

    for (var li = 0; li < lines.length; li++) {
      var clsMatch = lines[li].match(/\bclass\s+(\w+)/);
      if (!clsMatch) continue;

      var looksLikeNest = /controller|service|module|provider/i.test(rel);
      if (!looksLikeNest) continue;

      // Check up to 3 lines above for a decorator
      var hasDecorator = false;
      for (var di = Math.max(0, li - 3); di < li; di++) {
        if (classDecRe.test(lines[di])) { hasDecorator = true; break; }
      }
      if (!hasDecorator) {
        violations.push({
          file: rel,
          line: li + 1,
          detail: 'Class "' + clsMatch[1] + '" in a NestJS-like module is missing a @decorator',
        });
      }
    }
  }

  return { name: "NestDecorators", pass: violations.length === 0, violations: violations };
}

// ---- CHECK 3: Business services implement interfaces (DIP) -------------------
results.push(checkDependencyInversion());

function checkDependencyInversion() {
  var files = collectSourceFiles(SRC);
  var violations = [];

  for (var fi = 0; fi < files.length; fi++) {
    var rel = files[fi];
    if (!/service/i.test(rel)) continue;
    if (/\.types\.ts$/.test(rel)) continue;

    var content = readFile(rel);
    var lines = content.split("\n");

    for (var li = 0; li < lines.length; li++) {
      var clsM = lines[li].match(/\bclass\s+(\w+)/);
      if (!clsM) continue;

      // Check same line + next 2 for "implements"
      var implementsInterface = false;
      for (var ci = li; ci <= Math.min(li + 2, lines.length - 1); ci++) {
        if (/class\s+\w+\s+implements\s+/.test(lines[ci])) { implementsInterface = true; break; }
      }

      if (!implementsInterface) {
        violations.push({
          file: rel,
          line: li + 1,
          detail: 'Service class "' + clsM[1] + '" does not implement an interface (DIP violation)',
        });
      }
    }
  }

  return { name: "DependencyInversion", pass: violations.length === 0, violations: violations };
}

// ---- CHECK 4: No hardcoded hex color values ----------------------------------
results.push(checkHardcodedColors());

function checkHardcodedColors() {
  var files = collectSourceFiles(SRC);
  var violations = [];
  var hexColorRe = /#[0-9a-fA-F]{6,8}\b/;
  var commentRe = /^\s*(\/\/|\/\*|\*)/;

  for (var fi = 0; fi < files.length; fi++) {
    var rel = files[fi];
    var content = readFile(rel);
    var lines = content.split("\n");

    for (var li = 0; li < lines.length; li++) {
      var line = lines[li];
      if (commentRe.test(line)) continue;
      if (hexColorRe.test(line)) {
        hexColorRe.lastIndex = 0;
        var m = hexColorRe.exec(line);
        if (m) {
          violations.push({
            file: rel,
            line: li + 1,
            detail: 'Hardcoded hex color "' + m[0] + '" -- use design tokens instead',
          });
        }
      }
    }
  }

  return { name: "HardcodedColors", pass: violations.length === 0, violations: violations };
}

// ---- CHECK 5: Every test file has a matching source file ----------------------
results.push(checkTestSourcePairing());

function checkTestSourcePairing() {
  var testsDir = join(ROOT, "tests");
  if (!existsSync(testsDir)) return { name: "TestSourcePairing", pass: true, violations: [] };

  var testFiles = collectSourceFiles(testsDir, testsDir);
  var violations = [];

  for (var ti = 0; ti < testFiles.length; ti++) {
    var tf = testFiles[ti];
    var base = tf.replace(/\.test\.(ts|tsx)$/, "");
    var srcBase = base.replace(/^unit\//, "");

    var candidates = [
      join("src", srcBase),
      join("src", base),
      join(testsDir, "..", "src", srcBase),
    ];

    var hasSource = false;
    for (var c = 0; c < candidates.length; c++) {
      if (existsSync(join(ROOT, candidates[c]))) { hasSource = true; break; }
    }
    if (!hasSource) {
      violations.push({
        file: tf,
        detail: 'No corresponding source file found for test "' + tf + '"',
      });
    }
  }

  return { name: "TestSourcePairing", pass: violations.length === 0, violations: violations };
}

// ---- CHECK 6: Domain events follow the DomainEvent pattern --------------------
results.push(checkDomainEventPattern());

function checkDomainEventPattern() {
  var files = collectSourceFiles(SRC);
  var violations = [];
  var eventRe = /\b(?:interface|type|class)\s+(\w*Event\w*)/;
  var timestampRe = /timestamp\s*:\s*Date/;

  for (var fi = 0; fi < files.length; fi++) {
    var rel = files[fi];
    var content = readFile(rel);
    var lines = content.split("\n");

    for (var li = 0; li < lines.length; li++) {
      var m = eventRe.exec(lines[li]);
      if (!m) continue;
      var typeName = m[1];

      // Check the next 20 lines for timestamp
      var block = lines.slice(li, Math.min(li + 20, lines.length)).join("\n");
      if (!timestampRe.test(block)) {
        violations.push({
          file: rel,
          line: li + 1,
          detail: 'Type "' + typeName + '" sounds like an event but lacks timestamp: Date',
        });
      }
    }
  }

  return { name: "DomainEventPattern", pass: violations.length === 0, violations: violations };
}

// ---------------------------------------------------------------------------
// Aggregate & Report
// ---------------------------------------------------------------------------

var totalChecks = results.length;
var passedChecks = 0;
var totalViolations = 0;

for (var ri = 0; ri < results.length; ri++) {
  if (results[ri].pass) passedChecks++;
  totalViolations += results[ri].violations.length;
}

var report = {
  schema: "LIP-v1-architecture-validate",
  version: "1.0.0",
  timestamp: new Date().toISOString(),
  summary: {
    totalChecks: totalChecks,
    passed: passedChecks,
    failed: totalChecks - passedChecks,
    totalViolations: totalViolations,
    status: totalViolations === 0 ? "PASS" : "FAIL",
  },
  checks: [],
};

for (var cj = 0; cj < results.length; cj++) {
  report.checks.push({
    name: results[cj].name,
    pass: results[cj].pass,
    violationCount: results[cj].violations.length,
    violations: results[cj].violations,
  });
}

var reportFile = join(ARTIFACTS, "architecture-report.json");
writeFileSync(reportFile, JSON.stringify(report, null, 2), "utf-8");

console.log(JSON.stringify(report, null, 2));

if (totalViolations > 0) {
  console.error("");
  console.error("ARCHITECTURE VALIDATION FAILED: " + totalViolations + " violation(s) found.");
  console.error("Report written to: " + reportFile);
  process.exit(1);
} else {
  console.error("");
  console.error("Architecture validation PASSED (" + passedChecks + "/" + totalChecks + " checks).");
  process.exit(0);
}
