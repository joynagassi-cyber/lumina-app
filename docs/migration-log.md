# 🔄 Migration Log — Repository Restructuring Lumina

Date : 2026-07-28  
Version : 1.0  
Statut : Complet (sprints 0-9)

---

## Introduction

Ce log documente tous les changements de noms, déplacements et modifications structurels effectués pendant la phase de restructuration du dépôt Lumina. Chaque entrée inclit l'ancien chemin, le nouveau chemin, la raison du changement, et la validation associée.

---

## Changements Appliqués

### Bloc 1: Corrections de Syntaxe Bloquantes (Sprint 0)

| # | Type | Fichier | Ancien | Nouveau | Validation |
|---|------|---------|--------|---------|------------|
| 1 | Fix | `src/domains/invite/invite.module.ts` | Arrow functions avec @Inject incohérentes | Functions nommées sans @Inject sur paramètres | ✅ tsc compile |
| 2 | Fix | `src/reporting/templates/template.controller.ts` | `@Req()` non importé, syntaxe méthode incorrecte | `@Request()` import correct, méthode命名正确 | ✅ tsc compile |
| 3 | Fix | `src/domains/organization/domain/policies/hierarchy-policy.ts` | `throw;` invalide en TypeScript | `throw err;` syntaxe valide | ✅ tsc compile |
| 4 | Fix | `src/domains/delegation/delegation.module.ts` | Arrow functions avec @Inject incohérentes | Functions nommées sans @Inject | ✅ tsc compile |

### Bloc 2: Renommage org→organization (Sprints 3-4)

| # | Type | Fichier (ancien) | Fichier (nouveau) | Raison | Imports mis à jour dans |
|---|------|------------------|-------------------|--------|-------------------------|
| 5 | Rename | `org-hierarchy-resolver.service.ts` | `organization-hierarchy-resolver.service.ts` | Clarifier l'abréviation org → organization | 6 fichiers (service, policy, index, tests) |
| 6 | Rename | `org-template-inheritor.service.ts` | `organization-template-inheritor.service.ts` | Clarifier l'abrévision | 2 fichiers (service, test) |
| 7 | Rename | `org-unit-hierarchy.vo.ts` | `organization-unit-hierarchy.vo.ts` | Cohérence naming | 3 fichiers (index, service, policy) |
| 8 | Rename | `org-unit.entity.ts` | `organization-unit.entity.ts` | Cohérence naming | 5 fichiers (service, policy, module, port, index) |
| 9 | Rename | `prisma-org-unit.repository.ts` | `prisma-organization-unit.repository.ts` | Cohérence naming | 2 fichiers (module, index) |
| 10 | Rename | `prisma-org.repository.ts` | `prisma-organization.repository.ts` | Cohérence naming | 1 fichier (module) |
| 11 | Rename | `org-unit-link.entity.ts` | `organization-unit-link.entity.ts` | Cohérence naming (member domain) | 8 fichiers (multiple imports dans member/) |
| 12 | Rename | `prisma-org-unit-link.repository.ts` | `prisma-organization-unit-link.repository.ts` | Cohérence naming | 3 fichiers (module, index, adapter) |
| 13 | Rename | `org-unit-link.port.ts` | `organization-unit-link.port.ts` | Cohérence naming | 2 fichiers (port, index) |

### Bloc 3: Renommage Frontend kebab (Sprints 6-8)

| # | Type | Composant (ancien) | Composant (nouveau) | Catégorie | Barrel files mis à jour |
|---|------|-------------------|--------------------|-----------|------------------------|
| 14 | Rename | `Button.tsx` | `button.tsx` | UI component | ui/index.tsx |
| 15 | Rename | `Card.tsx` | `card.tsx` | UI component | ui/index.tsx |
| 16 | Rename | `Input.tsx` | `input.tsx` | UI component | ui/index.tsx |
| 17 | Rename | `Modal.tsx` | `modal.tsx` | UI component | ui/index.tsx |
| 18 | Rename | `SelectField.tsx` | `select-field.tsx` | UI component | ui/index.tsx |
| 19 | Rename | `Toast.tsx` | `toast.tsx` | UI component | ui/index.tsx |
| 20 | Rename | `Badge.tsx` | `badge.tsx` | UI component | ui/index.tsx |
| 21 | Rename | `Skeleton.tsx` | `skeleton.tsx` | UI component | ui/index.tsx |
| 22 | Rename | `Icon.tsx` | `icon.tsx` | UI component | ui/index.tsx |
| 23 | Rename | `LanguageSwitcher.tsx` | `language-switcher.tsx` | Shared component | shared/index.tsx |
| 24 | Rename | `NavigationHeader.tsx` | `navigation-header.tsx` | Shared component | shared/index.tsx |
| 25 | Rename | `OfflineBanner.tsx` | `offline-banner.tsx` | Shared component | shared/index.tsx |
| 26 | Rename | `OrganizationPicker.tsx` | `organization-picker.tsx` | Shared component | shared/index.tsx |
| 27 | Rename | `ChartRenderer.tsx` | `chart-renderer.tsx` | Reporting component | components/index.ts |
| 28 | Rename | `ChartRendererMobile.tsx` | `chart-renderer-mobile.tsx` | Reporting component | components/index.ts |
| 29 | Rename | `QueryBuilderVisualEditor.tsx` | `query-builder-visual-editor.tsx` | Reporting component | components/index.ts |
| 30 | Rename | `ReportTableRenderer.tsx` | `report-table-renderer.tsx` | Reporting component | components/index.ts |
| 31 | Rename | `ReportPage.tsx` → pages/ReportPage.tsx | `report-page.tsx` → pages/report-page.tsx | Page | test + barrel |
| 32 | Rename | `ExportService.ts` → services/ExportService.ts | `export-service.ts` → services/export-service.ts | Service | barrel + implementation |

### Bloc 4: Cleanup Structure (Sprint 9)

| # | Type | Chemin ancien | Action | Raison |
|---|------|---------------|--------|--------|
| 33 | Delete | `backend/` (racine) | Suppression complète | Structure emboîtée inutile `backend/backend/src/...`造成 confusion |

### Bloc 5: Documentations Créées/Actualisées

| # | Type | Document | Description |
|---|------|----------|-------------|
| 34 | Create | `docs/00-canonical/rename-map.md` | Mapping des conventions de nommage kebab |
| 35 | Create | `docs/repository-manifest.md` | Structure finale du dépôt après restructuration |
| 36 | Create | `docs/migration-log.md` | Ce journal des migrations |
| 37 | Update | `package.json` | Workspaces corrigés pour pointer vers backup-structure/ |

### Bloc 6: Cleanup Legacy TypeORM (2026-08-09)

| # | Type | Élément supprimé | Raison |
|---|------|-----------------|--------|
| 43 | Delete | `src/safe-boot/backend/src/identity/` (TypeORM : identity.service, user/session/permission entity, controllers) | Remplacé par `domains/user` + `domains/auth` (Prisma, ADR-018) ; exclu du tsconfig, jamais câblé |
| 44 | Delete | `src/safe-boot/backend/src/organization/` (TypeORM : organization/org-unit controllers + service, entities) | Remplacé par `domains/organization` + `domains/org-unit` (Prisma) |
| 45 | Delete | `src/safe-boot/backend/src/reporting/` (templates legacy + excel/pdf/sync) | Remplacé par `domains/reporting` |
| 46 | Delete | `src/safe-boot/backend/src/{project,document,wiki}/` | Modèles couverts par le schéma Prisma (Project/Task/Document/WikiPage) ; code exclu du tsconfig, non câblé |
| 47 | Delete | `src/safe-boot/backend/src/core/` (aggregation/data-sources/query-builder legacy) | Code mort exclu du tsconfig |
| 48 | Delete | `src/safe-boot/backend/src/safe-boot/` (copie imbriquée avec node_modules, 19 Mo) | Structure emboîtée réapparue (cf. Bloc 4 #33) — doublon stale |
| 49 | Delete | `flexible-reporting.service.ts` + `flexible-report.controller.ts` (domains/reporting) | Exclus individuellement du tsconfig, non câblés |
| 50 | Delete | `prisma/custom.prisma` | Extension stale — modèles Project/Document/Wiki déjà mergés dans schema.prisma |
| 51 | Delete | `BACKEND_IMPLEMENTATION_SUMMARY.md` | Doc orpheline décrivant les modules supprimés |
| 52 | Cleanup | `tsconfig.json` exclude | Retrait des 10 exclusions legacy devenues obsolètes |

---

## Validation par Sprint

| Sprint | Validations exécutées | Statut |
|--------|----------------------|--------|
| Sprint 0 | tsc backend après corrections syntaxe | ✅ Pass (après installation deps) |
| Sprint 3-4 | grep pour vérifier absence d'old names | ✅ Vérifié |
| Barrel files import verification | Check imports after barrel updates | ✅ Consistent |
| Sprint 6-32 | Frontend rename check (manual verification) | ✅ Files renamed |
| Sprint 33 | Verification no references to old backend/ path | ✅ Cleaned |

---

## Changements Restants à Traiter (Sprints Futures)

| # | Triage | Description | Priorité |
|---|--------|-------------|----------|
| 38 | Refactor | Corriger les erreurs de syntaxe workflow/api.ts et workflow/components.tsx (parens excédentaires) | P1 |
| 39 | Cleanup | Supprimer les dossiers vides dans src/core/ (capability, json-generation, network, sync, theme, vocabulary) | P2 |
| 40 | ✅ RÉSOLU (2026-08-09) | **src/safe-boot/ = source de vérité active** ; backup-structure/ = archive obsolète (untracked, non référencée) — **supprimée du disque le 2026-08-09** | — |
| 41 | Update | Finaliser les imports restants dans le frontend qui pourraient référencer les anciens noms (si存在一些 direct imports through barrel not yet updated) | P3 |
| 42 | Verify | Exécuter tsc frontend après toutes les corrections pour s'assurer d'une compilation propre | P1 |

---

**Ce document est la source de vérité pour tous les changements de restructuration du dépôt Lumina.** Toute modification future au codebase doit être enregistrée dans ce Migration Log.

*Document généré par Repository Restructuring Program (RRP)*
