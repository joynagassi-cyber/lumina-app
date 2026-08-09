# Phase C — Backend Finance (B1–B6) — COMPLÈTE

**Statut :** ✅ Terminée — périmètre finance/reporting/vocab/Prisma/app.module : `tsc` 0 erreur, tests 199/199 (shared + finance).

## Bilan des étapes

| Étape | Livrable | Vérification |
|---|---|---|
| **C-0** | Exclusion de la copie imbriquée `src/safe-boot/backend/src/safe-boot/**` (double racine tsconfig) | −101 erreurs |
| **C-1 (B1)** | Réparation des fichiers corrompus : `@Inject()` en paramètre de fonctions fléchées (invite/delegation), `L\\'` double-échappé (DTO identity), `async @Param` + guards inexistants (template.controller), `throw;` sans expression (hierarchy-policy), accolades manquantes (org-unit, organization) | 274 → 3 → (cache invalidé : état réel 957) |
| **C-2 (B2)** | Endpoints finance complets : `GET /finance/balance`, `GET /finance/:id`, `POST /finance/:id/transition`, `GET /finance/search`, `GET /finance/export`, `GET /finance/categories` — routes statiques avant `:id`, transitions mono-acteur, export CSV | finance 30 → 0 erreurs |
| **C-3 (B3)** | `POST /reports/generate` (reports.controller) + réparation des services reporting (balance-calculator, report-generator, entités) | reporting 0 erreur |
| **C-4 (B4)** | Catégories via VocabModule : `GET /categories?namespace=finance` (vocab.controller) + corrections de chemins vocab (20 → 0) | vocab 0 erreur |
| **C-5 (B5)** | Migration ADR-018 : `PrismaService`/`PrismaModule` globaux, app.module migré TypeORM → Prisma, ports non câblés explicites (`not-wired-ports.ts`) ; seed `prisma/seed.ts` (org, admin bcrypt, groupes, catégories finance) ; schéma Prisma réparé (bloc `model WikiPage {` manquant + accolade fermante finale + relations opposées Organization) | `prisma validate` OK, client généré, seed compile exit 0 |
| **C-6 (B6)** | Tests finance : conversion testdouble → jest (2 specs, 44 `when()`), UUID v4 valides dans les mocks, imports `TransactionType`/`ResourceScopeType`, assertions `ValidationError.code`, corrigé `toDecimalString` (÷100, primaire) | **81/81 finance**, shared+finance **199/199**, tsc périmètre 0 |

## Corrections notables découvertes par les tests

- **`AmountInCents.toDecimalString(decimals)`** : divisait par `10^decimals` au lieu de convertir cents → unité primaire (÷100) — `123` cents, 4 déc. donnait `0.0123` au lieu de `1.2300`. Corrigé + test `toDecimalString(0)` aligné (`'1'`).
- **Verrou optimiste** : le service transmet au port la **version courante lue** (re-validation TOCTOU-safe à l'écriture par le port), pas la version suivante — attentes des tests alignées.
- **`ValidationError`** porte un `code` machine + message humain : les tests assertent maintenant `expect.objectContaining({ code })`.
- **Ids fantômes `'non-existent'`** dans les tests : remplacés par des UUID v4 (le VO `ResourceId` valide le format).
- **Schéma Prisma** : fichier tronqué (bloc `WikiPage` sans accolade fermante, déclaration `model` manquante) — 13 erreurs de validation résolues.

## Hors périmètre (pré-existant, documenté)

- `src/core/**` (moteur flexible query-builder) : exclu du tsconfig — dépendance `src/core` en 110 erreurs, hors MVP-JOUR1-SPEC §4.
- `src/reporting/**` : ancienne copie parallèle (exporters, sync, templates) orpheline après app.module Prisma — exclue.
- 691 erreurs restantes : domaines **hors périmètre finance** (identity/organization TypeORM, invite, form, event, sync, wiki…) — cassés avant la Phase C, à traiter en Phase D.
- `@react-native-community/netinfo` : hoisté à la racine, déclaré nulle part — à régulariser (Phase D).

## Prochaine étape de la séquence

**Phase D — Assainissement global backend** : domaines hors périmètre (identity TypeORM → Prisma ADR-018, invite, delegation, form, event, sync, wiki), déclaration des deps fantômes, retrait des copies orphelines, objectif `tsc backend` 0 erreur global.

Rien n'est commité.
