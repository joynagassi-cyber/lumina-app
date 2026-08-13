#!/usr/bin/env node
/* ==========================================================================
   export-wiki.mjs -- docs/ -> GitHub Wiki publisher
   --------------------------------------------------------------------------
   Flattens the hierarchical docs/ tree into the flat page namespace used by
   GitHub Wikis, rewrites internal links, generates Home.md + _Sidebar.md,
   then commits and pushes the result to <repo>.wiki.git.

   Usage:
     GITHUB_TOKEN=xxx node scripts/export-wiki.mjs        # build + push
     node scripts/export-wiki.mjs --dry-run               # build only
     node scripts/export-wiki.mjs --out ./wiki-preview    # build to a folder

   Env:
     GITHUB_TOKEN     token with write access to the wiki repository
     WIKI_REPO        override wiki remote (default: joynagassi-cyber/lumina-app.wiki.git)
     GIT_AUTHOR_NAME  / GIT_AUTHOR_EMAIL  commit identity (defaults provided)
   ========================================================================== */

import {
  readFileSync,
  readdirSync,
  existsSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  mkdtempSync,
} from "node:fs";
import { join, dirname, relative, posix } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

// ---------------------------------------------------------------------------
// Paths & configuration
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DOCS = join(ROOT, "docs");
const INDEX_REL = "INDEX.md";

const WIKI_SLUG = process.env.WIKI_REPO || "joynagassi-cyber/lumina-app.wiki.git";
const TOKEN = process.env.GITHUB_TOKEN || "";
const AUTHOR_NAME = process.env.GIT_AUTHOR_NAME || "lumina-wiki-bot";
const AUTHOR_EMAIL = process.env.GIT_AUTHOR_EMAIL || "lumina-wiki-bot@users.noreply.github.com";

const argv = process.argv.slice(2);
const DRY_RUN = argv.indexOf("--dry-run") !== -1;
const OUT_INDEX = argv.indexOf("--out");
const OUT_DIR = OUT_INDEX !== -1 && argv[OUT_INDEX + 1] ? join(ROOT, argv[OUT_INDEX + 1]) : null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Collect every .md file under `dir`; returns POSIX paths relative to docs/. */
function collectMarkdown(dir, base) {
  if (base === undefined) base = DOCS;
  var files = [];
  var entries = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (_) {
    return files;
  }
  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i];
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    var full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(collectMarkdown(full, base));
    } else if (/\.md$/i.test(entry.name)) {
      files.push(relative(base, full).split("\\").join("/"));
    }
  }
  return files.sort();
}

/** docs-relative path -> flat wiki page name (without extension). */
function toPageName(relPath) {
  return relPath.replace(/\.md$/i, "").split("/").join("-");
}

/** docs-relative path -> flat wiki file name. */
function toPageFile(relPath) {
  return toPageName(relPath) + ".md";
}

/** Normalise a possibly "./" / "../" prefixed path against a base directory. */
function resolveDocsPath(fromRel, target) {
  var baseDir = posix.dirname(fromRel);
  if (baseDir === ".") baseDir = "";
  var joined = target.charAt(0) === "/" ? target.slice(1) : posix.join(baseDir, target);
  return posix.normalize(joined).replace(/^\.\//, "");
}

/** True when the target is external / not a docs-relative link. */
function isExternal(target) {
  return (
    target === "" ||
    /^[a-z][a-z0-9+.-]*:/i.test(target) ||
    target.charAt(0) === "#" ||
    target.slice(0, 2) === "//"
  );
}

/**
 * Resolve a link target to a wiki page name.
 * Returns null when the target is not a known docs page.
 */
function resolveTarget(fromRel, rawTarget, pageByPath, pageByName) {
  var target = rawTarget.trim();
  if (isExternal(target)) return null;

  var anchor = "";
  var hashIdx = target.indexOf("#");
  if (hashIdx !== -1) {
    anchor = target.slice(hashIdx);
    target = target.slice(0, hashIdx);
  }
  if (target === "") return null;

  target = decodeURI(target).replace(/^<|>$/g, "");

  var candidates = [];
  var resolved = resolveDocsPath(fromRel, target);
  candidates.push(resolved);
  if (!/\.md$/i.test(resolved)) {
    candidates.push(resolved + ".md");
    candidates.push(posix.join(resolved, "index.md"));
    candidates.push(posix.join(resolved, "README.md"));
  }
  // Also accept links written from the repository root (e.g. "docs/x/y.md").
  var rootRelative = posix.normalize(target).replace(/^\.\//, "");
  if (rootRelative.slice(0, 5) === "docs/") candidates.push(rootRelative.slice(5));

  for (var i = 0; i < candidates.length; i++) {
    var page = pageByPath.get(candidates[i]);
    if (page) return page + anchor;
  }

  // Last resort: match on the flattened / bare page name.
  var bare = posix.basename(target).replace(/\.md$/i, "");
  var byName = pageByName.get(bare.toLowerCase());
  if (byName) return byName + anchor;

  return null;
}

/**
 * Rewrite inline markdown links and [[wiki-links]] of a single document.
 * Fenced code blocks are left untouched.
 */
function rewriteLinks(content, fromRel, pageByPath, pageByName, stats) {
  var lines = content.split("\n");
  var inFence = false;

  for (var i = 0; i < lines.length; i++) {
    if (/^\s*(```|~~~)/.test(lines[i])) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    // [text](target)
    lines[i] = lines[i].replace(/(\[[^\]\n]*\])\(([^)\n]+)\)/g, function (match, label, target) {
      var title = "";
      var titleMatch = target.match(/^(\S+)(\s+["'(].*)$/);
      if (titleMatch) {
        target = titleMatch[1];
        title = titleMatch[2];
      }
      var page = resolveTarget(fromRel, target, pageByPath, pageByName);
      if (page === null) {
        if (!isExternal(target) && /\.md(#|$)/i.test(target)) stats.unresolved.push(fromRel + " -> " + target);
        return match;
      }
      stats.rewritten++;
      return label + "(" + page + title + ")";
    });

    // [[target]] or [[label|target]]
    lines[i] = lines[i].replace(/\[\[([^\]\n]+)\]\]/g, function (match, inner) {
      var parts = inner.split("|");
      var label = parts.length > 1 ? parts[0] : null;
      var target = parts.length > 1 ? parts.slice(1).join("|") : parts[0];
      var page = resolveTarget(fromRel, target, pageByPath, pageByName);
      if (page === null) {
        stats.unresolved.push(fromRel + " -> [[" + inner + "]]");
        return match;
      }
      stats.rewritten++;
      return label ? "[[" + label + "|" + page + "]]" : "[[" + page + "]]";
    });
  }

  return lines.join("\n");
}

/** Human-readable title for a page or folder segment. */
function humanize(segment) {
  return segment.replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
}

/** Build _Sidebar.md from the numbered folder structure. */
function buildSidebar(pages) {
  var groups = new Map();
  var rootPages = [];

  for (var i = 0; i < pages.length; i++) {
    var relPath = pages[i].relPath;
    if (relPath === INDEX_REL) continue;
    var segments = relPath.split("/");
    if (segments.length === 1) {
      rootPages.push(pages[i]);
      continue;
    }
    var group = segments[0];
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(pages[i]);
  }

  var out = ["# Lumina Wiki", "", "- [[Home]]", ""];

  var groupNames = Array.from(groups.keys()).sort();
  for (var g = 0; g < groupNames.length; g++) {
    var name = groupNames[g];
    out.push("### " + humanize(name));
    var entries = groups.get(name);
    for (var e = 0; e < entries.length; e++) {
      var sub = entries[e].relPath.split("/").slice(1);
      var indent = "  ".repeat(sub.length - 1);
      var label = sub.join(" / ").replace(/\.md$/i, "");
      out.push(indent + "- [[" + label + "|" + entries[e].page + "]]");
    }
    out.push("");
  }

  if (rootPages.length > 0) {
    out.push("### Documents");
    for (var r = 0; r < rootPages.length; r++) {
      out.push("- [[" + humanize(rootPages[r].page) + "|" + rootPages[r].page + "]]");
    }
    out.push("");
  }

  return out.join("\n");
}

/** Run a git command inside `cwd`, returning stdout. */
function git(cwd, args) {
  return execFileSync("git", args, { cwd: cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
}

// ---------------------------------------------------------------------------
// 1. Collect & convert
// ---------------------------------------------------------------------------
if (!existsSync(DOCS)) {
  console.error("EXPORT FAILED: docs/ directory not found at " + DOCS);
  process.exit(1);
}

var docPaths = collectMarkdown(DOCS);
if (docPaths.length === 0) {
  console.error("EXPORT FAILED: no markdown files found under docs/.");
  process.exit(1);
}

var pageByPath = new Map();
var pageByName = new Map();
var pages = [];

for (var i = 0; i < docPaths.length; i++) {
  var relPath = docPaths[i];
  var page = toPageName(relPath);
  pageByPath.set(relPath, page);
  pages.push({ relPath: relPath, page: page, file: toPageFile(relPath) });
  var bare = posix.basename(relPath).replace(/\.md$/i, "").toLowerCase();
  if (!pageByName.has(bare)) pageByName.set(bare, page);
  if (!pageByName.has(page.toLowerCase())) pageByName.set(page.toLowerCase(), page);
}

var stats = { rewritten: 0, unresolved: [] };
var outputs = new Map();

for (var p = 0; p < pages.length; p++) {
  var source = readFileSync(join(DOCS, pages[p].relPath), "utf-8");
  var converted = rewriteLinks(source, pages[p].relPath, pageByPath, pageByName, stats);
  var header =
    "<!-- Generated by scripts/export-wiki.mjs from docs/" +
    pages[p].relPath +
    " -- do not edit in the wiki. -->\n\n";
  outputs.set(pages[p].file, header + converted);
}

// Home.md from docs/INDEX.md
if (pageByPath.has(INDEX_REL)) {
  outputs.set("Home.md", outputs.get(toPageFile(INDEX_REL)));
} else {
  console.error("WARNING: docs/INDEX.md not found -- Home.md will not be generated.");
}

outputs.set("_Sidebar.md", buildSidebar(pages));

console.error("Collected " + pages.length + " docs page(s); rewrote " + stats.rewritten + " internal link(s).");
if (stats.unresolved.length > 0) {
  console.error("Unresolved links (left untouched): " + stats.unresolved.length);
  for (var u = 0; u < Math.min(stats.unresolved.length, 20); u++) {
    console.error("  - " + stats.unresolved[u]);
  }
}

// ---------------------------------------------------------------------------
// 2. Write output (local folder, or cloned wiki repository)
// ---------------------------------------------------------------------------

/** Write every generated page into `dir`, removing stale generated pages. */
function writePages(dir, prune) {
  if (prune) {
    var existing = readdirSync(dir, { withFileTypes: true });
    for (var i = 0; i < existing.length; i++) {
      if (existing[i].name === ".git") continue;
      if (existing[i].isFile() && /\.md$/i.test(existing[i].name) && !outputs.has(existing[i].name)) {
        rmSync(join(dir, existing[i].name));
      }
    }
  }
  var names = Array.from(outputs.keys());
  for (var n = 0; n < names.length; n++) {
    writeFileSync(join(dir, names[n]), outputs.get(names[n]), "utf-8");
  }
}

if (OUT_DIR) {
  mkdirSync(OUT_DIR, { recursive: true });
  writePages(OUT_DIR, false);
  console.error("Wrote " + outputs.size + " page(s) to " + OUT_DIR);
}

if (DRY_RUN) {
  console.error("Dry run -- nothing pushed.");
  process.exit(0);
}

if (OUT_DIR) {
  // --out is a preview mode; pushing is only done from a clean clone.
  process.exit(0);
}

if (!TOKEN) {
  console.error("EXPORT FAILED: GITHUB_TOKEN is not set. Use --dry-run to build without pushing.");
  process.exit(1);
}

var remote = "https://x-access-token:" + TOKEN + "@github.com/" + WIKI_SLUG;
var workdir = mkdtempSync(join(tmpdir(), "lumina-wiki-"));
var clone = join(workdir, "wiki");
var exitCode = 0;

try {
  try {
    execFileSync("git", ["clone", "--depth", "1", remote, clone], { stdio: ["ignore", "pipe", "pipe"] });
  } catch (err) {
    console.error("EXPORT FAILED: unable to clone " + WIKI_SLUG + ".");
    console.error("Enable the wiki (Settings -> Features -> Wikis) and create a first page, then retry.");
    throw err;
  }

  writePages(clone, true);

  git(clone, ["config", "user.name", AUTHOR_NAME]);
  git(clone, ["config", "user.email", AUTHOR_EMAIL]);
  git(clone, ["add", "--all"]);

  var status = git(clone, ["status", "--porcelain"]).trim();
  if (status === "") {
    console.error("Wiki already up to date -- nothing to commit.");
  } else {
    var sha = "";
    try {
      sha = git(ROOT, ["rev-parse", "--short", "HEAD"]).trim();
    } catch (_) {
      sha = "unknown";
    }
    git(clone, ["commit", "-m", "docs: sync wiki from docs/ (" + sha + ")"]);
    git(clone, ["push", "origin", "HEAD"]);
    console.error("Pushed " + outputs.size + " page(s) to " + WIKI_SLUG + ".");
  }
} catch (err) {
  var message = err && err.stderr ? String(err.stderr) : String(err && err.message ? err.message : err);
  console.error(message.split(TOKEN || "\u0000").join("***"));
  exitCode = 1;
} finally {
  rmSync(workdir, { recursive: true, force: true });
}

process.exit(exitCode);
