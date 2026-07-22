# SPRINT 11 — Production Ready

## Sprint Title
Lumina v2 — Expo Production Build, CI/CD Pipeline, EAS Configuration, Release Delivery

## Sprint Objective
Produce a production-ready build: configure EAS Build for iOS/Android, complete CI/CD pipeline, generate `.env.example`, write release notes, verify all screens navigable, prepare final merge PR.

## Commands to Execute

```bash
cd C:\Users\joyda\ZCodeProject\lumina-app

# Configure EAS Build
npx eas-cli build:configure

# Prebuild for native platforms
npx expo prebuild --clean

# Run final quality gate
npm run lint && npx tsc --noEmit && npm run format:check && npm test -- --ci

# Verify all sprint plans exist
ls docs/superpowers/plans/SPRINT-{0..11}*.plan.md | wc -l

# Verify doc sizes (NB-RULE-01)
find docs/ -name '*.md' | xargs wc -l | grep total
```

## Files to Create (with COMPLETE content)

### 1. `.github/workflows/ci-full.yml`
```yaml
name: Lumina CI/CD Pipeline
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
jobs:
  quality-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx tsc --noEmit          # Q03
      - run: npm run lint               # Q02
      - run: npm run format:check       # Q01
      - run: bash scripts/neverbreak-check.sh   # C03
  test-unit:
    runs-on: ubuntu-latest
    needs: quality-gate
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run test:coverage -- --ci
    # NB-RULE-09: finance coverage >= 90% enforced here
  test-integration:
    runs-on: ubuntu-latest
    needs: test-unit
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run test -- tests/integration/ --runInBand
      - run: npm run test -- tests/flows/
  build-preview:
    runs-on: ubuntu-latest
    needs: test-integration
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx expo export --platform web
```

### 2. `eas.json`
```json
{
  "cli": { "version": ">= 12.0.0", "appVersionSource": "remote" },
  "build": {
    "development": { "developmentClient": true, "distribution": "internal" },
    "preview": { "distribution": "internal", "android": { "buildType": "apk" } },
    "production": { "autoIncrement": true, "android": { "buildType": "app-bundle" } }
  }
}
```

### 3. `.env.local.example`
```bash
EXPO_PUBLIC_INSFORGE_URL=https://your-project.us-east.insforge.app
EXPO_PUBLIC_INSFORGE_ANON_KEY=your-anon-key-here
EXPO_PUBLIC_APP_VERSION=2.0.0
EXPO_PUBLIC_DEBUG_MODE=false
EXPO_PUBLIC_API_TIMEOUT_MS=10000
EXPO_PUBLIC_SYNC_INTERVAL_MS=300000
```

### 4. `scripts/final-verify.sh`
```bash
#!/bin/bash
set -e
echo "=== Pre-Release Verification ==="
echo "[1/6] TypeScript..."; npx tsc --noEmit
echo "[2/6] Linting..."; npm run lint
echo "[3/6] Formatting..."; npm run format:check
echo "[4/6] Tests..."; npm test -- --ci
echo "[5/6] NeverBreak..."; bash scripts/neverbreak-check.sh
echo "[6/6] Sprint plans...";
for i in $(seq -w 0 11); do
  [ -f "docs/superpowers/plans/SPRINT-$i.plan.md" ] || { echo "MISSING SPRINT-$i"; exit 1; }
done
echo "=== ALL CHECKS PASSED ==="
```

### 5. `RELEASE-NOTES-v2.0.0.md`
```markdown
# Lumina v2.0.0 Release Notes

## Overview
Universal Organization Platform built with React Native + Expo + TypeScript.
Replaces legacy Flutter/Dart codebase. First implementation targets MFE-JC church management.

## MVP Features (10)
K1 (Critical): Auth Admin, Org Config, Grand Livre, Bilan Financier, Rapports PDF/CSV
K2 (Important): Gestion Membres, Calendrier Evenements, Gestion Roles/Permissions
K3 (Desirable): Dashboard Analytics, Settings & Preferences

## Architecture
- 5 Platform Core engines: Manifest, Vocabulary, Forms, Workflow, Capability
- Offline-first via WatermelonDB + InsForge PostgreSQL sync
- Multi-tenant org_id isolation at every layer
- Dark Canvas design system (#121212 base, configurable accent)
- Zero hardcoded business logic — all behavior through manifest configuration

## Quality
- Finance module >= 90% test coverage
- Zero `any` types in production code
- 10 Invariants enforced via automated tests
- 10 NeverBreak Rules validated in CI
- All documentation <= 400 lines per file
```

## Tests to Write
No new feature tests — this sprint validates all previous sprints.

## Documentation to Update
- RELEASE-NOTES-v2.0.0.md (created above)
- Update PRD status from `draft` to `published`
- Traceability Matrix: finalize all links

## DoD Checklist — Sprint 11 Specific

| # | Criterion | Status |
|---|-----------|--------|
| C01 | CI pipeline passes all stages | |
| C02 | Finance coverage > 90% in CI | |
| C03 | EAS build produces valid APK | |
| Q01 | Full quality gate documented | |
| Q02 | CI blocks on any failure | |
| Q03 | Production build tested | |
| T01 | All 12 sprint plans present and consistent | |
| D01 | Release notes published | |
