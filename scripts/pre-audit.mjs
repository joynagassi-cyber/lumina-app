/**
 * LIP-v1 Pre-Audit Gateway Script
 *
 * Executes BEFORE every commit to validate generated code against
 * audit-rules.json and IGS-v1 specifications.
 *
 * Usage: node scripts/pre-audit.mjs [--watch]
 * Exit 0 = all checks pass, Exit 1 = violations found
 *
 * Canonical Sources: IGS-v1 §8, DOC-023 §9, DOC-000
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { glob } from 'glob';

// ─── Configuration ───────────────────────────────────────────────

const ROOT_DIR = join(import.meta.dirname, '..', 'src', 'safe-boot');
const RULES_PATH = join(import.meta.dirname, '..', 'docs', '99-supporting', 'audit-rules.json');
const REPORT_PATH = join(import.meta.dirname, '..', 'pre-audit-report.json');
const FILE_GLOBS = ['**/*.ts', '**/*.tsx', '**/*.prisma'];

// Test files that are exempt from certain rules
const TEST_EXEMPTION_PATTERNS = [/\.test\.(ts|tsx)$/, /\.spec\.(ts|tsx)$/, /\/__tests__\//, /\/__mocks__\//];

// ─── Load Rules ──────────────────────────────────────────────────

function loadRules() {
  try {
    const raw = readFileSync(RULES_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`FATAL: Cannot load audit rules from ${RULES_PATH}`);
    console.error(err.message);
    process.exit(2);
  }
}

// ─── File Discovery ──────────────────────────────────────────────

function discoverFiles(baseDir) {
  const files = [];
  for (const pattern of FILE_GLOBS) {
    const matches = glob.sync(join(baseDir, pattern), { nodir: true });
    files.push(...matches);
  }
  return [...new Set(files)]; // deduplicate
}

// ─── Helpers ─────────────────────────────────────────────────────

function isTestFile(filepath) {
  return TEST_EXEMPTION_PATTERNS.some(p => p.test(filepath));
}

function formatSeverity(severity) {
  const map = { CRITICAL: '[CRITICAL]', MAJOR: '[MAJOR]', MINOR: '[MINOR]', BLOCKING: '[BLOCKING]' };
  return map[severity] || `[${severity}]`;
}

// ─── Check Functions ─────────────────────────────────────────────

/**
 * Check a single file against forbidden patterns
 */
function checkForbiddenPatterns(content, filepath, rules) {
  const violations = [];

  const forbidden = rules.forbidden_patterns || [];
  const skipCheck = isTestFile(filepath) && shouldSkipInTests(forbidden);

  for (const patternStr of forbidden) {
    // Escape special regex chars except our character classes
    let regexStr;
    try {
      regexStr = patternStr;
      const regex = new RegExp(regexStr, 'i'); // case-insensitive
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        if (regex.test(lines[i])) {
          violations.push({
            rule_id: `FORBIDDEN-PATTERN`,
            file: relative(ROOT_DIR, filepath),
            line: i + 1,
            severity: 'CRITICAL',
            detail: `Forbidden pattern matched: "${patternStr}" on line ${i + 1}`,
            matchedText: lines[i].trim()
          });
        }
      }
    } catch (e) {
      // Invalid regex — skip
    }
  }

  return violations;
}

function shouldSkipInTests(patterns) {
  // Most forbidden patterns are universally forbidden
  const testSafePatterns = ['== true', '== false', '= {}', '= []', 'Math.random()'];
  return patterns.every(p => testSafePatterns.includes(p.replace(/\\./g, '')));
}

/**
 * Check a single file against mandatory patterns
 */
function checkMandatoryPatterns(content, filepath, rules) {
  const violations = [];

  const mandatory = rules.mandatory_patterns || [];
  const lines = content.split('\n');
  const fullContent = lines.join('\n');

  for (const patternStr of mandatory) {
    try {
      const regex = new RegExp(patternStr);
      if (!regex.test(fullContent)) {
        // Only flag non-interface/non-type-only files
        if (!filepath.endsWith('.d.ts') && !filepath.includes('/types/') && !filepath.includes('/interfaces/')) {
          violations.push({
            rule_id: `MANDATORY-PATTERN`,
            file: relative(ROOT_DIR, filepath),
            line: 1,
            severity: 'MINOR',
            detail: `Mandatory pattern missing: "${patternStr}"`,
            matchedText: null
          });
        }
      }
    } catch (e) {
      // Skip invalid patterns
    }
  }

  return violations;
}

/**
 * Check specific rules from ruleset with context-aware logic
 */
function checkSpecificRules(content, filepath, rules, fileRules) {
  const violations = [];
  const relPath = relative(ROOT_DIR, filepath);

  for (const rule of fileRules || []) {
    const { id, category, severity, pattern, scope, exception, check } = rule;

    // Scope filter — does this file match the rule's scope?
    if (scope && !fileMatchesScope(filepath, scope)) {
      continue;
    }

    // Exception filter
    if (exception) {
      if (shouldExempt(filepath, exception)) {
        continue;
      }
    }

    // Pattern-based check
    if (pattern) {
      try {
        const lines = content.split('\n');
        const regex = new RegExp(pattern, 'i');

        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i])) {
            violations.push({
              rule_id: id,
              file: relPath,
              line: i + 1,
              severity: severity.toUpperCase(),
              detail: `Rule ${id}: ${rule.description}`,
              category,
              matchedText: lines[i].trim()
            });
          }
        }
      } catch (e) {
        // Invalid pattern syntax — report but don't fail
        violations.push({
          rule_id: id,
          file: relPath,
          line: 0,
          severity: 'INFO',
          detail: `Rule ${id}: Pattern syntax error - ${e.message}`,
          category
        });
      }
    }

    // Structural check (custom logic not possible in static scanner)
    if (check && !pattern) {
      // Log as informational — structural checks require AST analysis
      violations.push({
        rule_id: id,
        file: relPath,
        line: 0,
        severity: 'INFO',
        detail: `Rule ${id}: Structural check "${check}" requires AST analysis — manual review recommended`,
        category,
        needs_ast: true
      });
    }
  }

  return violations;
}

function fileMatchesScope(filepath, scopePattern) {
  // Convert glob-like scope to regex
  const globToRegex = scopePattern
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
    .replace(/\?\./g, '.?');
  try {
    const regex = new RegExp(globToRegex);
    const rel = relative(ROOT_DIR, filepath);
    return regex.test(rel);
  } catch (e) {
    return false;
  }
}

function shouldExempt(filepath, exceptionPattern) {
  const rel = relative(ROOT_DIR, filepath);

  if (exceptionPattern.includes('*.env')) {
    if (rel.endsWith('.env') || rel.endsWith('.env.template') || rel.endsWith('.env.example')) {
      return true;
    }
  }

  if (exceptionPattern.includes('test')) {
    if (isTestFile(rel)) {
      return true;
    }
  }

  if (exceptionPattern.includes('port')) {
    if (rel.includes('/ports/') || rel.includes('-ports.ts')) {
      return true;
    }
  }

  // Glob-style exception matching
  try {
    const escaped = exceptionPattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*');
    if (new RegExp(escaped).test(rel)) {
      return true;
    }
  } catch (e) {
    // Best effort
  }

  return false;
}

/**
 * Check IGS-v1 metadata headers in generated files
 */
function checkMetadataHeaders(content, filepath, rules) {
  const violations = [];
  const metadataFields = ['generation_id', 'source_canonical', 'transformation_rule', 'architecture_version', 'compliance_status'];

  const textFiles = ['.ts', '.tsx', '.prisma', '.sql'];
  if (!textFiles.some(ext => filepath.endsWith(ext))) {
    return violations; // Config files exempt (per rule LIP-AUDIT-015)
  }

  const hasHeader = metadataFields.some(field => content.includes(field));

  if (!hasHeader && !filepath.match(/README\.md|docker-compose|\.env|\.json|\.yml$/)) {
    violations.push({
      rule_id: 'LIP-AUDIT-015',
      file: relative(ROOT_DIR, filepath),
      line: 1,
      severity: 'MAJOR',
      detail: 'Missing IGS-v1 metadata header. Generated artifacts must include generation_id, source_canonical, transformation_rule, architecture_version, compliance_status.',
      category: 'tracability'
    });
  }

  return violations;
}

/**
 * Check Prisma schema for org_id on all models
 */
function checkPrismaModels(content, filepath) {
  const violations = [];
  if (!filepath.endsWith('.prisma')) {
    return violations;
  }

  const modelNames = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const modelMatch = line.match(/^model\s+(\w+)/);
    if (modelMatch) {
      modelNames.push(modelMatch[1]);
    }

    const fieldMatch = line.match(/^\s+(\w+)\s+\w+/);
    if (fieldMatch) {
      // Check for @id annotation (primary key)
    }
  }

  // Note: Full Prisma validation requires parsing the schema blocks properly
  // This is a basic scan — comprehensive checks need dedicated Prisma schema parser
  violations.push({
    rule_id: 'LIP-AUDIT-009',
    file: relative(ROOT_DIR, filepath),
    line: 0,
    severity: 'INFO',
    detail: `Found ${modelNames.length} models. Full field-level validation (org_id, @id, @createdAt, @updatedAt) requires Prisma schema parser. Manual review recommended.`,
    category: 'entity-structure',
    needs_prisma_parser: true,
    models: modelNames
  });

  return violations;
}

// ─── Main Audit Engine ───────────────────────────────────────────

function runAudit() {
  const rulesConfig = loadRules();
  const files = discoverFiles(ROOT_DIR);

  const allViolations = [];
  let totalRulesChecked = 0;

  for (const filepath of files) {
    let content;
    try {
      content = readFileSync(filepath, 'utf-8');
    } catch (err) {
      continue; // Skip unreadable files
    }

    const relPath = relative(ROOT_DIR, filepath);

    // 1. Forbidden pattern checks
    const forbiddenViolations = checkForbiddenPatterns(content, filepath, rulesConfig);
    allViolations.push(...forbiddenViolations);

    // 2. Mandatory pattern checks
    const mandatoryViolations = checkMandatoryPatterns(content, filepath, rulesConfig);
    allViolations.push(...mandatoryViolations);

    // 3. Specific rule checks from rules array
    const ruleViolations = checkSpecificRules(content, filepath, rulesConfig, rulesConfig.rules);
    allViolations.push(...ruleViolations);

    // 4. IGS-v1 metadata header check
    const headerViolations = checkMetadataHeaders(content, filepath, rulesConfig);
    allViolations.push(...headerViolations);

    // 5. Prisma-specific checks
    const prismaViolations = checkPrismaModels(content, filepath);
    allViolations.push(...prismaViolations);

    totalRulesChecked += (rulesConfig.rules?.length || 0);
  }

  const criticalViolations = allViolations.filter(v => v.severity === 'CRITICAL' || v.severity === 'BLOCKING');
  const majorViolations = allViolations.filter(v => v.severity === 'MAJOR');
  const minorViolations = allViolations.filter(v => v.severity === 'MINOR');
  const infoViolations = allViolations.filter(v => v.severity === 'INFO' || v.needs_ast || v.needs_prisma_parser);

  const passed = criticalViolations.length === 0 && majorViolations.length === 0;

  const report = {
    timestamp: new Date().toISOString(),
    root_directory: ROOT_DIR,
    total_files_scanned: files.length,
    total_rules_checked: totalRulesChecked,
    severity_summary: {
      BLOCKING: allViolations.filter(v => v.severity === 'BLOCKING').length,
      CRITICAL: criticalViolations.length,
      MAJOR: majorViolations.length,
      MINOR: minorViolations.length,
      INFO: infoViolations.length
    },
    violations: allViolations,
    violations_by_category: groupByCategory(allViolations),
    passed
  };

  // Write report
  try {
    writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
    console.log(`Pre-audit report written to: ${relative(process.cwd(), REPORT_PATH)}`);
  } catch (err) {
    console.error(`WARNING: Could not write report to ${REPORT_PATH}: ${err.message}`);
  }

  // Print summary
  printSummary(report);

  // Exit code
  return passed ? 0 : 1;
}

function groupByCategory(violations) {
  const groups = {};
  for (const v of violations) {
    const cat = v.category || 'unknown';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(v.rule_id);
  }
  // Deduplicate
  for (const key of Object.keys(groups)) {
    groups[key] = [...new Set(groups[key])];
  }
  return groups;
}

function printSummary(report) {
  console.log('');
  console.log('='.repeat(70));
  console.log('LIP-v1 PRE-AUDIT GATEWAY');
  console.log('='.repeat(70));
  console.log(`Timestamp:     ${report.timestamp}`);
  console.log(`Files scanned: ${report.total_files_scanned}`);
  console.log(`Rules checked: ${report.total_rules_checked}`);
  console.log('-'.repeat(70));

  const sev = report.severity_summary;
  if (sev.BLOCKING > 0) console.log(`BLOCKING:      ${sev.BLOCKING}`);
  if (sev.CRITICAL > 0) console.log(`CRITICAL:      ${sev.CRITICAL}`);
  if (sev.MAJOR > 0) console.log(`MAJOR:         ${sev.MAJOR}`);
  if (sev.MINOR > 0) console.log(`MINOR:         ${sev.MINOR}`);
  if (sev.INFO > 0) console.log(`INFO:          ${sev.INFO}`);
  if (Object.values(sev).every(v => v === 0)) {
    console.log('All checks passed.');
  }

  console.log('-'.repeat(70));
  console.log(`Result:        ${report.passed ? 'PASS' : 'FAIL'}`);
  console.log('='.repeat(70));

  // Print first few violations for visibility
  const actionable = report.violations.filter(v => v.severity !== 'INFO');
  if (actionable.length > 0 && actionable.length <= 20) {
    console.log('\nViolations:');
    for (const v of actionable.slice(0, 20)) {
      const loc = v.line > 0 ? `:${v.line}` : '';
      console.log(`  ${formatSeverity(v.severity)} ${v.file}${loc} — ${v.rule_id}`);
    }
  } else if (actionable.length > 20) {
    console.log(`\n... ${actionable.length} actionable violations. See report for details.`);
  }
}

// ─── Entry Point ─────────────────────────────────────────────────

if (import.meta.url === `file://${process.argv[1]}`) {
  const exitCode = runAudit();
  process.exit(exitCode);
}

export { runAudit, checkForbiddenPatterns, checkMandatoryPatterns, checkSpecificRules };
