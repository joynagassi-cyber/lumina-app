# 📁 Repository Manifest — Lumina Codebase Structure

Date : 2026-08-09  
Version : 1.1 (post-cleanup legacy)  
Statut : Structure finale validée — `src/safe-boot/` = source de vérité active

---

## Structure Finale du Dépôt

```
lumina-app/
├── package.json                         : Monorepo workspaces (turbo)
├── .git/                                : Repository Git
├── .github/                             : GitHub Actions CI/CD
├── .husky/                              : Git hooks
├── artifacts/                           : Rapports d'analyse (généré automatiquement)
├── backup-structure/                    : CODE PRINCIPAL (source de vérité)
│   └── safe-boot/
│       ├── backend/                     : NestJS backend (480 fichiers)
│       │   ├── src/                     : Code source
│       │   │   ├── app.module.ts        : Module racine
│       │   │   ├── main.ts              : Point d'entrée
│       │   │   ├── config/              : Configuration
│       │   │   ├── common/              : Utils NestJS
│       │   │   ├── core/                : Core reporting (QueryBuilder, Aggregation, Data Sources)│   │   │   ├── domains/             : 18 domaines DDD (auth, configuration, delegation, event, finance, form, group, invite, lifecycle, member, notification, org-unit, organization, reporting, sync, user, vocab, workflow)
│       │   │   ├── infrastructure/      : Infrastructure commune
│       │   │   ├── reporting/           : Reporting spécifique (PDF, Excel, Templates, Sync)
│       │   │   ├── shared/              : Erreurs, Événements, Types
│       │   │   └── test/                : Tests (e2e, integration, unit)
│       │   ├── package.json             : Dépendances
│       │   ├── tsconfig.json            : Config TypeScript
│       │   ├── jest.config.ts           : Config Jest
│       │   └── nest-cli.json            : Config NestJS
│       └── frontend/                    : React Native frontend (146 fichiers)
│           ├── src/                     : Code source
│           │   ├── app/                 : Routes SvelteKit
│           │   ├── components/          : Composants UI (shared, ui)
│           │   │   ├── shared/          : LanguageSwitcher, NavigationHeader, OfflineBanner, OrganizationPicker
│           │   │   └── ui/              : Button, Card, Input, Modal, SelectField, Toast, Badge, Skeleton, Icon (renommés en kebab)
│           │   ├── domains/             : Domaines frontend (mirror backend DDD)
│           │   │   └── reporting/       : ChartRenderer, ReportTableRenderer, QueryBuilderVisualEditor, ReportPage (renommés en kebab)
│           │   ├── hooks/               : useAuth, useOfflineStore, useSync (hooks React conservés)
│           │   ├── i18n/                : Internationalisation
│           │   ├── services/            : API services
│           │   ├── store/               : State management
│           │   └── utils/               : Utilitaires
│           ├── package.json             : Dépendances
│           ├── tsconfig.json            : Config TypeScript
│           ├── tailwind.config.js       : Config Tailwind
│           ├── app.json                 : Config Expo
│           └── nativewind-env.d.ts      : Types nativwind
├── docs/                                : Documentation
│   ├── 00-canonical/                  : Documents canoniques (186 .md)
│   │   ├── ARCHITECTURE-DECISION-CONSTITUTION.md
│   │   ├── CANONICAL-DOMAIN-MODEL.md  (13 agrégats, 58 invariants)
│   │   ├── DOC-021-PHYSICAL-DATA-MODEL.md (32 tables)
│   │   ├── DOC-023-CANONICAL-RELATIONAL-RULES.md (27 NeverBreak)
│   │   ├── QUERY-BUILDER-SPEC-V1.md
│   │   ├── AGGREGATION-ENGINE-SPEC.md
│   │   ├── DATASOURCE-PORTS-SPEC.md
│   │   ├── TEMPLATE-MANAGEMENT-SPEC.md
│   │   └── ... (260+ documents)
│   ├── project-master-audit.md        : Rapport d'audit maître (source de vérité)
│   ├── rename-map.md                  : Mapping des changements de noms
│   └── ...                            
├── frontend/                            : Frontend actif (React Native/Expo)
│   ├── src/                             : Code source (structure similar à backup-structure/frontend)
│   └── package.json
├── src/                                 : Code runtime et features
│   ├── features/                        : En développement
│   ├── safe-boot/                       : SOURCE DE VÉRITÉ active (backend NestJS + frontend)
│   │   ├── backend/                     : Backend actif (tsc 0, prisma, 760 specs)
│   │   └── frontend/                    : Frontend actif
│   ├── server/                          : Serveur (responsabilité à clarifier)
│   └── shared/                          : Moteurs Phase B (manifest, vocabulary, capability, forms, workflow, runtime) + code partagé
├── tests/                               : Tests (core, reporting)
├── design-system/                       : Design system
├── navigation/                          : Composant navigation
├── schemas/                             : Schémas de données
├── scripts/                             : Scripts d'opération
├── node_modules/                        : Dependances (généré automatiquement)
└── README.md                            : Introduction du projet
```

---

## Responsabilités par Dossier Clé

| Dossier | Responsable | Domaine | Niveau |
|---------|------------|---------|--------|
| `src/safe-boot/backend/src/domains/` | Domain Teams | Domain | 18 domaines DDD |
| `src/safe-boot/backend/src/infrastructure/` | Core Team | Infrastructure | Prisma, adapters |
| `src/shared/` (racine) | Core Team | Moteurs | Manifest, Vocabulary, Capability, Forms, Workflow, Runtime |
| `src/safe-boot/frontend/src/domains/` | Frontend Team | Presentation | Components, Pages |
| `src/safe-boot/frontend/src/components/` | UI Team | Presentation | Composants réutilisables |
| `docs/00-canonical/` | Documentation Team | Documentation | Spécifications canoniques |
| `src/runtime/` | Core Team | Infrastructure | Runtime system |
| `tests/` | QA Team | Testing | Unit, Integration, E2E |

---

## Noms de Fichiers et Dossiers (Convention kebab-appliquée)

### Backend (déjà en kebab par convention)
- Tous les fichiers de domaine : `organization-service.ts`, `auth-token.vo.ts`, `hierarchy-policy.ts`, etc. ✅
- Les modules NestJS : `auth.module.ts`, `reporting.module.ts` ✅
- Les entities : `organization-unit.entity.ts` (renommé de `org-unit.entity.ts`) ✅
- Les value objects : `organization-name.vo.ts` ✅
- Les policies : `visibility-policy.ts` ✅

### Frontend (conversion kebab complétée)
- Composants UI : `button.tsx`, `card.tsx`, `input.tsx`, `modal.tsx`, `select-field.tsx`, `toast.tsx`, `badge.tsx`, `skeleton.tsx`, `icon.tsx` ✅
- Composants shared : `language-switcher.tsx`, `navigation-header.tsx`, `offline-banner.tsx`, `organization-picker.tsx` ✅
- Reporting components : `chart-renderer.tsx`, `chart-renderer-mobile.tsx`, `query-builder-visual-editor.tsx`, `report-table-renderer.tsx` ✅
- Page : `report-page.tsx` ✅
- Service : `export-service.ts` ✅
- Hooks : `use-auth.ts`, `use-offline-store.ts`, `use-sync.ts` (pattern React conservé) ⚠️

---

## Barrel Files (index.ts/tsx) — Points d'export unifiés

### Backend
- `src/domains/organization/index.ts` — Export unifié pour l'aggregate Organization
- `src/domains/member/index.ts` — Export unifié pour le aggregate Member
- D'autres barrel files existent selon l'architecture DDD

### Frontend
- `src/components/ui/index.tsx` — Export UI components
- `src/components/shared/index.tsx` — Export shared components
- `src/domains/reporting/components/index.ts` — Export reporting components
- `src/domains/reporting/pages/index.ts` ? (à vérifier)

---

## Dossier(s) Vides à Traiter — OBSOLÈTE (2026-08-09)

Les dossiers `src/core/*` (capacity, json-generation, network, sync, theme, vocabulary) cités en v1.0 n'existent plus : `src/core` racine a disparu. **Résolu** — plus rien à traiter.

---

## Clarification : src/ vs backup-structure/ — RÉSOLU (2026-08-09)

**Décision finale :** `src/safe-boot/` est la **source de vérité active** (backend NestJS + frontend). Tout le travail validé y vit : tsc 0 erreur, schéma Prisma, suite jest 760/760, CI verte.

`backup-structure/` était une **archive obsolète** : entièrement untracked (jamais commitée), non référencée par l'arbre commité (workspaces = `src/safe-boot`), et dont le backend était en retard (444 vs 506 .ts, schema.prisma divergent). **Elle a été supprimée du disque le 2026-08-09** (aucun fichier tracké, aucune référence — suppression sans impact git).

---

## Migration Log (Résumé des Changements)

| Date | Type | Description | Auteur |
|------|------|-------------|--------|
| 2026-07-28 | Refactor | Corriger workspaces dans package.json (src → backup-structure) | Repository Architect |
| 2026-07-28 | Fix | Corriger syntaxe invite.module.ts (arrow functions with @Inject) | Repository Architect |
| 2026-07-28 | Fix | Corriger syntaxe template.controller.ts (@Req → @Request) | Repository Architect |
| 2026-07-28 | Fix | Corriger syntaxe hierarchy-policy.ts (throw; → throw err;) | Repository Architect |
| 2026-07-28 | Fix | Corrier syntaxe delegation.module.ts (arrows with @Inject) | Repository Architect |
| 2026-07-28 | Rename | org-* → organization-* (9 fichiers backend) | Repository Architect |
| 2026-07-28 | Update | Mise à jour de 20+ imports après les renommages | Repository Architect |
| 2026-07-28 | Rename | PascalCase → kebab (20+ composants frontend) | Repository Architect |
| 2026-07-28 | Update | Barrel files frontend mis à jour | Repository Architect |
| 2026-07-28 | Cleanup | Suppression du dossier backend/ racine (structure emboîtée) | Repository Architect |
| 2026-07-28 | Document | Création du Rename Map et Repository Manifest | Repository Architect |

---

## Règles de Nomenclature Appliquées (Résumé)

**Dossiers :** kebab-case (minuscules, tirets) — Tous les dossiers respectent cette convention  
**Fichiers (nom principal) :** kebab-case (minuscules, tirets) — `.ts`, `.tsx`, `.md`, `.json` conservés comme extensions  
**Interdits :** camelCase, PascalCase, snake_case, majuscules (sauf dans les extensions), espaces, accents  
**Exceptions :**  
- Hooks React : `useXxx` (camelCase) conservé par convention framework  
- SvelteKit routes : `(auth)` conservé pour la routing framework  
- Extensions de fichiers : `.ts`, `.tsx`, `.module.ts`, `.entity.ts`, etc. conservées  

**Principe :** Le nom doit décrire précisément la responsabilité sans abréviations ambiguës (`organization` au lieu de `org`).

---

*Document généré par Repository Discovery & Audit Program (RDA-v1) / Repository Restructuring Program (RRP)*  
*Source de vérité pour l'organisation du codebase Lumina*
