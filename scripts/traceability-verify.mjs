#!/usr/bin/env node
/* ==========================================================================
   traceability-verify.mjs -- LIP-v1 Traceability Gate
   --------------------------------------------------------------------------
   Reads the runtime-matrix-traceabilite-LIPv1.json produced by the Architect
   Reader and verifies that every source file in src/ is accounted for.
   Exit 0 = 100% coverage, exit 1 = gaps found.
   ========================================================================== */

import { readFileSync, existsSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "src");

// ---------------------------------------------------------------------------
// Artifact output dir
// ---------------------------------------------------------------------------
var ARTIFACTS = join(ROOT, "artifacts", "traceability");
if (!existsSync(ARTIFACTS)) mkdirSync(ARTIFACTS, { recursive: true });

// ---------------------------------------------------------------------------
// Read the traceability matrix
// ---------------------------------------------------------------------------

var MATRIX_PATH = join(ROOT, "runtime-matrix-traceabilite-LIPv1.json");

var matrix;
try {
  var raw = readFileSync(MATRIX_PATH, "utf-8");
  matrix = JSON.parse(raw);
} catch (err) {
  var report = buildReport([], [], null, 0);
  writeFileSync(join(ARTIFACTS, "traceability-report.json"), JSON.stringify(report, null, 2));
  console.error("ERROR: Cannot find traceability matrix at " + MATRIX_PATH);
  console.error("Generate it first with the Architect Reader workflow.");
  process.exit(1);
}

// Collect all files referenced in the matrix
var matrixFiles = new Set();

function walkMatrix(obj) {
  if (typeof obj === "string") return;
  if (Array.isArray(obj)) {
    for (var i = 0; i < obj.length; i++) walkMatrix(obj[i]);
    return;
  }
  if (obj && typeof obj === "object") {
    var vals = Object.values(obj);
    for (var vi = 0; vi < vals.length; vi++) {
      var val = vals[vi];
      if (typeof val === "string" && /\.(ts|tsx)$/.test(val)) {
        matrixFiles.add(val);
      } else {
        walkMatrix(val);
      }
    }
  }
}

walkMatrix(matrix);

// Also look for explicit "files" or "sources" arrays
function extractFileArrays(obj, results) {
  if (!obj || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    for (var ai = 0; ai < obj.length; ai++) {
      if (typeof obj[ai] === "string" && /\.(ts|tsx)$/.test(obj[ai])) results.push(obj[ai]);
      else extractFileArrays(obj[ai], results);
    }
    return;
  }
  var keys = ["files", "sources", "artifacts", "trackedFiles", "sourceFiles"];
  for (var ki = 0; ki < keys.length; ki++) {
    var val = obj[keys[ki]];
    if (Array.isArray(val)) {
      for (var xi = 0; xi < val.length; xi++) {
        if (typeof val[xi] === "string" && /\.(ts|tsx)$/.test(val[xi])) results.push(val[xi]);
      }
    }
  }
}

var explicitFiles = [];
extractFileArrays(matrix, explicitFiles);
for (var ef = 0; ef < explicitFiles.length; ef++) matrixFiles.add(explicitFiles[ef]);

// ---------------------------------------------------------------------------
// Discover all source files under src/
// ---------------------------------------------------------------------------

function collectSourceFiles(dir) {
  var files = [];
  try {
    var entries = readdirSync(dir, { withFileTypes: true });
    for (var ei = 0; ei < entries.length; ei++) {
      var entry = entries[ei];
      var full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === "dist") continue;
        files = files.concat(collectSourceFiles(full));
      } else if (/\.(ts|tsx)$/.test(entry.name)) {
        files.push(full);
      }
    }
  } catch (_) {
    // directory missing
  }
  return files;
}

var allSourceFiles = collectSourceFiles(SRC);
var allSourcePaths = new Set(allSourceFiles);

// ---------------------------------------------------------------------------
// Compute coverage
// ---------------------------------------------------------------------------

var coverageEntries = [];
var uncoveredFiles = [];
var coveredFilesList = [];

for (var sp of allSourcePaths) {
  var relPath = sp.replace(/\\/g, "/").replace(new RegExp("^" + ROOT.replace(/\\/g, "/") + "/"), "");

  if (matrixFiles.has(sp) || matrixFiles.has(relPath)) {
    coverageEntries.push({ file: sp, covered: true });
    coveredFilesList.push(relPath);
  } else {
    coverageEntries.push({ file: sp, covered: false });
    uncoveredFiles.push(relPath);
  }
}

// ---------------------------------------------------------------------------
// Build report
// ---------------------------------------------------------------------------

function buildReport(coverageEntries, uncoveredFiles, matrixValid, totalSources) {
  var coveredCount = 0;
  for (var ci = 0; ci < coverageEntries.length; ci++) {
    if (coverageEntries[ci].covered) coveredCount++;
  }
  var pct = totalSources > 0 ? Math.round((coveredCount / totalSources) * 10000) / 100 : 0;

  return {
    schema: "LIP-v1-traceability-verify",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    summary: {
      totalSourceFiles: totalSources,
      coveredFiles: coveredCount,
      uncoveredFiles: uncoveredFiles.length,
      coveragePercentage: pct,
      status: pct >= 100 && matrixValid ? "PASS" : "FAIL",
      blocksPipeline: pct < 100,
    },
    matrixValid: matrixValid,
    coveredFiles: [],
    uncoveredFiles: uncoveredFiles,
  };
}

var matrixExists = existsSync(MATRIX_PATH);
var report = buildReport(coverageEntries, uncoveredFiles, matrixExists, allSourcePaths.size);
var reportFile = join(ARTIFACTS, "traceability-report.json");

writeFileSync(reportFile, JSON.stringify(report, null, 2), "utf-8");
console.log(JSON.stringify(report, null, 2));

if (report.summary.coveragePercentage < 100) {
  console.error("");
  console.error("TRACEABILITY FAILED: " + uncoveredFiles.length + "/" + report.summary.totalSourceFiles + " files uncovered (" + report.summary.coveragePercentage + "%).");
  console.error("Uncovered files written to: " + reportFile);
  process.exit(1);
} else {
  console.error("");
  console.error("Traceability verification PASSED: " + report.summary.coveragePercentage + "% coverage (" + report.summary.coveredFiles + "/" + report.summary.totalSourceFiles + ").");
  process.exit(0);
}
