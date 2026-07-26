# RBAC pour Lumina : Architecture Minimale qui Fonctionne

> **Date:** 2026-07-23  
> **Statut:** RECOMMANDATION — Basée sur analyse complète du codebase Lumina v2  
> **Contexte:** App React Native multi-tenant, 3-5 rôles/org, backend PostgreSQL + InsForge + RLS  
> **Problème utilisateur:** Tentative précédente de RBAC = debugging infini, complexité ingérable

---

## Table des Matières

1. [Pourquoi Ton RBAC Précédent a Échoué](#1-pourquoi-ton-rbac-précédent-a-échoué)
2. [Cause Racine: Role Combinatorial Explosion](#2-cause-racine-role-combinatorial-explosion)
3. [L'Architecture Recommandée: Role Grants + Manifest](#3-larchitecture-recommandée-role-grants--manifest)
4. [Schéma SQL Minimal (1 Table)](#4-schéma-sql-minimal-1-table)
5. [Permissions via manifest.yaml (Source de Vérité)](#5-permissions-via-manifestyaml-source-de-vérité)
6. [Vérification Client: 30 Lignes TypeScript](#6-vérification-client-30-lignes-typescript)
7. [Connexion Edge Function → RLS (Zéro Duplication)](#7-connexion-edge-function--rls-zéro-duplication)
8. [Comparaison: Approches en Tableau](#8-comparaison-approches-en-tableau)
9. [Migration Depuis l'Existant](#9-migration-depuis lexistant)
10. [Règles d'Or du RBAC Lumina](#10-règles dor-du-rbac-lumina)
11. [Extensibilité V2+](#11-extensibilité-v2)

---

## 1. Pourquoi Ton RBAC Précédent a Échoué

### Le Diagnostic

Tu as probablement fait ceci:

```
❌ Table `roles` (id, name, description)
❌ Table `permissions` (id, name, module, action)
❌ Table `role_permissions` (role_id, permission_id) -- MANY-TO-MANY CHAOS
❌ Table `user_roles` (user_id, role_id, org_id) -- MORE MANY-TO-MANY
❌ RLS policies avec subqueries JOIN sur toutes ces tables
❌ Vérification côté client avec contexte complexe
```

**Résultat:** Chaque requête RBAC nécessite 4-5 JOINs. Ajouter une permission = modifier 4 lignes. Debugger "pourquoi ce user ne voit pas cette transaction" = tracer 5 tables interconnectées. C'est ingérable.

### Ce que tu n'avais PAS besoin de faire

- 5 tables au lieu de 1
- Des JOINs RBAC dans chaque RLS policy
- Une bibliothèque RBAC externe (casl, permcheck, etc.)
- Un système de permissions séparé du Manifest Engine existant

---

## 2. Cause Racine: Role Combinatorial Explosion

Quand on modélise des permissions granulaires (`finance:ledger:read`, `finance:ledger:write`, `members:directory:write`, etc.) et qu'on les assigne individuellement à chaque rôle, on crée une dette exponentielle:

- 5 modules × 3 actions = **15 permissions**
- 4 rôles → **60 combinaisons possibles** dans la matrice
- Ajouter 1 nouvelle permission → vérifier 4 lignes par rôle
- Ajouter 1 nouveau rôle → vérifier 15 permissions à assigner
- Un rôle qui hérite de 3 autres + 2 permissions propres = **un cauchemar de debugging**

**La cause racine n'est PAS le RBAC lui-même.** C'est l'attribution individuelle de permissions granulaires à des rôles statiques via des tables many-to-many.

---

## 3. L'Architecture Recommandée: Role Grants + Manifest

### Principes

1. **1 seule table** `org_members(user_id, org_id, role)` -- 3 colonnes
2. **Permissions dans `manifest.yaml`** -- configuration, pas données
3. **Permissions dans le JWT** -- zéro requête DB côté client après login
4. **Edge function InsForge** comme seul gardien serveur
5. **RLS uniquement pour isolation multi-tenant** (`org_id`) -- jamais de rôle dans les RLS

### Flux Décisionnel Unifié

```
Client → Edge Function (vérifie role + permission via manifest) → PostgREST → RLS (org_id ONLY)
```

Un seul point de décision. Pas de logique dupliquée.

### Comparaison avec l'architecture existante

| Élément | État actuel | État recommandé | Changement |
|---------|-------------|-----------------|------------|
| Rôle utilisateur | `users.role` (colonne simple) | Conservé + `org_members.role` | Ajout table org_members |
| Permissions | Non définies | `manifest.yaml` roles definition | Nouveau fichier config |
| RLS | `org_id` only | Reste `org_id` only | Aucun changement |
| Vérif client | Non implémentée | `hasPermission()` 30 lignes TS | Nouveau fichier |
| Edge function | Existent | Ajout `authorize()` | Extension existante |

---

## 4. Schéma SQL Minimal (1 Table)

```sql
-- Type enum pour les rôles -- IMMUABLE après déploiement MVP
CREATE TYPE org_role AS ENUM ('superadmin', 'admin', 'treasurer', 'pastor', 'staff');

-- Table org_members : unique table RBAC nécessaire
CREATE TABLE org_members (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role       org_role NOT NULL,
    joined_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE(user_id, org_id)
);

-- Index critiques pour performance
CREATE INDEX idx_org_members_user ON org_members(user_id);
CREATE INDEX idx_org_members_org ON org_members(org_id);
CREATE INDEX idx_org_members_org_role ON org_members(org_id, role);

-- Contrainte: chaque org doit avoir au moins 1 superadmin/admin
CREATE FUNCTION ensure_org_has_admin() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = NEW.org_id AND role IN ('superadmin', 'admin')
  ) THEN
    RAISE EXCEPTION 'Org must have at least one admin';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_org_admin
  AFTER INSERT ON org_members
  FOR EACH ROW
  WHEN (NEW.role NOT IN ('superadmin', 'admin'))
  EXECUTE FUNCTION ensure_org_has_admin();
```

**C'est 1 table. 3 colonnes opérationnelles. Zéro many-to-many.**

### Vérification RBAC instantanée

```sql
-- Trouver le rôle d'un utilisateur dans une org: O(1) avec index
SELECT role FROM org_members WHERE user_id = '<uuid>' AND org_id = '<uuid>';
-- Résultat: ~0.3ms avec idx_org_members_user
```

Pas de JOIN. Pas de sous-requête complexe. Un `SELECT` direct.

---

## 5. Permissions via manifest.yaml (Source de Vérité)

Les permissions vivent dans le manifest existant -- pas de nouveau système.

```yaml
# manifests/permissions.yaml (lu par Manifest Engine)
roles:
  superadmin:
    description: "Accès total à tout"
    permissions: ["*"]
    hierarchy_level: 5

  admin:
    description: "Administrateur organisation"
    permissions:
      - "finance:*"
      - "members:*"
      - "events:*"
      - "settings:*"
      - "reports:*"
    hierarchy_level: 4

  treasurer:
    description: "Gestion financière"
    permissions:
      - "finance:ledger:read"
      - "finance:ledger:write"
      - "finance:bilan:read"
      - "finance:rapport:read"
      - "finance:rapport:export"
    hierarchy_level: 3

  pastor:
    description: "Lecture + événements"
    permissions:
      - "finance:ledger:read"
      - "finance:bilan:read"
      - "members:directory:read"
      - "events:*"
    hierarchy_level: 2

  staff:
    description: "Lecture basique"
    permissions:
      - "finance:ledger:read"
      - "members:directory:read"
    hierarchy_level: 1
```

### Wildcard: Gagner 80% de lignes YAML

Au lieu de lister 15 permissions finance explicites pour un admin:

```yaml
# ❌ LONG
permissions:
  - finance:ledger:read
  - finance:ledger:write
  - finance:ledger:delete
  - finance:bilan:read
  - finance:bilan:write
  # ... 10 autres

# ✅ COMPACT
permissions:
  - "finance:*"
```

La fonction `hasPermission()` gère le matching wildcard côté client ET côté serveur.

### Hierarchy Level: Pour escalade future

Chaque rôle a un niveau hiérarchique. Utile pour:
- Vérifier si un rôle est "supérieur" à un autre
- Décider qui peut approver quoi
- Déterminer qui peut supprimer/modifier un membre

```typescript
const ROLE_HIERARCHY = {
  superadmin: 5, admin: 4, treasurer: 3, pastor: 2, staff: 1,
};

function hasHigherOrEqualRole(userRole: string, requiredMinRole: string): boolean {
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[requiredMinRole] ?? 0);
}
```

---

## 6. Vérification Client: 30 Lignes TypeScript

**AUCUNE bibliothèque RBAC externe.** Juste une fonction pure + un hook.

```typescript
// src/core/auth/rbac.ts

/**
 * Vérification de permission par pattern matching.
 * Format permission: "module:resource:action"
 * Wildcard: "finance:*" matche tout ce qui commence par "finance:"
 */
export function hasPermission(
  userPermissions: string[],
  requiredPermission: string
): boolean {
  // 1. Permission explicite ?
  if (userPermissions.includes(requiredPermission)) return true;

  // 2. Wildcard module:* ?
  const [module] = requiredPermission.split(':');
  if (userPermissions.includes(`${module}:*`)) return true;

  // 3. Super-admin star ?
  if (userPermissions.includes('*')) return true;

  return false;
}

/** Hook React Native pour UI gates */
import { useMemo } from 'react';
import { useAppContext } from '../../store/AppContext';

export function useCan(permission: string): boolean {
  const { permissions } = useAppContext(); // permissions from JWT/user session
  return useMemo(
    () => hasPermission(permissions ?? [], permission),
    [permissions, permission]
  );
}

/** Hook helper pour niveau hiérarchique */
export function useHasRole(minRole: string): boolean {
  const { role } = useAppContext();
  const hierarchy = { superadmin: 5, admin: 4, treasurer: 3, pastor: 2, staff: 1 };
  return (hierarchy[role] ?? 0) >= (hierarchy[minRole] ?? 0);
}
```

### Usage dans les composants

```tsx
function LedgerScreen() {
  const canWrite = useCan('finance:ledger:write');
  const canApprove = useHasRole('treasurer');
  const isAdmin = useHasRole('admin');

  return (
    <View>
      <TransactionList />
      {/* Bouton visible uniquement si permission */}
      {canWrite && <FAB icon="plus" onPress={createTransaction} />}
      {/* Bouton approuver visible uniquement trésorier+ */}
      {canApprove && <Button label="Approuver" onPress={approveFlow} />}
      {/* Bouton admin uniquement */}
      {isAdmin && <Button label="Supprimer Transaction" onPress={deleteFlow} />}
    </View>
  );
}
```

**Résultat:** Pas de bouton impossible à cliquer. Pas de 403 en production. L'UI reflète exactement les permissions.

---

## 7. Connexion Edge Function → RLS (Zéro Duplication)

### Le Pattern à 3 Couches

```
Couche 1: Client (TypeScript) → UI gates avec useCan()
Couche 2: Edge Function (InsForge) → authorize() avant mutation
Couche 3: RLS PostgreSQL → org_id isolation uniquement
```

### Edge Function authorize()

```typescript
// functions/_shared/authorize.ts

type RequiredPermission = string | string[];

/**
 * Middleware de vérification de permission.
 * Lu depuis JWT claims (org_id, user_id) + manifest.yaml.
 */
export async function authorize(
  req: InsForgeRequest,
  requiredPerms: RequiredPermission
): Promise<void> {
  const user = await req.getUser(); // JWT decoding
  const orgId = req.headers['x-org-id'];

  if (!orgId) throw new Error('MISSING_ORG_ID');

  // Lookup role dans org_members (O(1) avec index)
  const { data: member } = await req.db
    .from('org_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('org_id', orgId)
    .single();

  if (!member) throw new Error('NOT_MEMBER');

  // Charger permissions du manifest pour ce role
  const manifest = await loadManifest(orgId);
  const userPerms = manifest.roles[member.role]?.permissions ?? [];

  // Vérifier SI AU MOINS UNE permission matche
  const required = Array.isArray(requiredPerms) ? requiredPerms : [requiredPerms];
  const allowed = required.some(p => hasPermission(userPerms, p));

  if (!allowed) throw new Error('FORBIDDEN');
}
```

### RLS Policy: Simple et Universelle

```sql
-- RLS NE GÈRE QUE L'ISOLATION MULTI-TENANT
-- Les permissions sont validées PAR L'EDGE FUNCTION AVANT

CREATE POLICY org_isolation ON transactions FOR ALL
  USING (org_id = current_setting('app.current_org_id')::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id')::uuid);

-- C'est TOUT. Pas de CHECK sur le rôle.
-- Pas de sous-requête vers org_members.
-- RLS garantit juste que Org A ne voit PAS Org B.
```

### Flow Complet: Création Transaction

```typescript
// src/features/finance/transaction-service.ts
import { useCan } from '../../core/auth/rbac';

async function createTransaction(data: TransactionInput) {
  // 1. CLIENT: UI gate (immédiat, sans réseau)
  if (!useCan('finance:ledger:write')) {
    throw new PermissionError('Cannot create transactions');
  }

  // 2. SERVER: Edge function (rejecte si pas autorisé)
  const response = await api.post('/api/v1/transactions', data, {
    headers: { 'x-org-id': data.org_id },
  });

  // 3. DATABASE: RLS protège (org_id injecté depuis JWT)
  //    Même si edge function est bypassée, RLS filtre par org_id

  // 4. OFFLINE: WatermelonDB local write
  await db.write(async () => {
    await collections.transactions.create(t => {
      t.id = response.data.id;
      t.orgId = data.org_id;
      t.synced = 0;
    });
  });
}
```

---

## 8. Comparaison: Approches en Tableau

| Critère | RBAC Classique (5 tables) | ABAC | **Role Grants (recommandé)** |
|---------|--------------------------|------|---------------------------|
| Tables DB | 5+ (roles, permissions, role_permissions, user_roles, users) | 10+ (attributs, évaluators) | **1** (org_members) |
| Code client | 500+ lignes (context, providers, guards) | Impossible | **30 lignes** (1 fonction + hooks) |
| Debuggable en 5 min? | Non (JOINs, cascades, héritages) | Non (expressions dynamiques) | **Oui** (`SELECT role FROM org_members WHERE user_id = X`) |
| Extensible? | Oui mais cher | Extrêmement flexible | **Via manifest.yaml, zéro DB change** |
| Performance RLS | Requêtes complexes | Requêtes très complexes | **1 sous-requête ou session var** |
| Lié au Manifest? | Non (système séparé) | Non | **Oui (manifest = source de vérité)** |
| Overkill? | Oui pour 4-5 rôles | Absolument | **Non** |
| Temps implémentation | 3-5 jours | 1-2 semaines | **1 jour** |

---

## 9. Migration depuis l'Existant

L'architecture actuelle de Lumina a déjà les briques compatibles:

| Élément actuel | Statut | Action |
|----------------|--------|--------|
| `users.role` (ADR-009) | Existant (`'admin'\|'treasurer'\|'pastor'\|'staff'`) | Utiliser tel quel |
| `Database-Schema.md` | Contient schéma tables | Ajouter `org_members` migration |
| `Backend-Implementation-Guide.md` | RLS policies existantes | Simplifier (enlever role checking) |
| Manifest Engine | Prêt | Ajouter section `roles.permissions` au YAML |
| Capability Engine | `registerCapability()` | Utiliser pour auto-enregistrer permissions |

### Migration en 4 étapes

```sql
-- Étape 1: Créer type enum et table org_members
CREATE TYPE org_role AS ENUM ('superadmin', 'admin', 'treasurer', 'pastor', 'staff');

CREATE TABLE org_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role org_role NOT NULL,
    joined_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(user_id, org_id)
);

-- Étape 2: Migrer données existantes depuis users.role
INSERT INTO org_members (user_id, org_id, role, joined_at)
SELECT id, org_id, role::org_role, created_at
FROM users
WHERE role IS NOT NULL;

-- Étape 3: Index (si pas déjà fait)
CREATE INDEX idx_org_members_user ON org_members(user_id);
CREATE INDEX idx_org_members_org ON org_members(org_id);

-- Étape 4: Supprimer users.role (optionnel, laissé pour legacy)
-- ALTER TABLE users DROP COLUMN role;
```

**Total: 1 migration SQL. 1 nouveau fichier TypeScript (rbac.ts). 1 section YAML ajoutée au manifest.**

---

## 10. Règles d'Or du RBAC Lumina

| Règle | Description | Vérification |
|-------|-------------|-------------|
| **RBAC-01** | Jamais de table `role_permissions` many-to-many | Lint CI |
| **RBAC-02** | Permissions déclarées UNIQUEMENT dans `manifest.yaml` | Code review |
| **RBAC-03** | RLS NEVER vérifie le rôle -- seulement `org_id` | Test automatique |
| **RBAC-04** | Edge function est le SEUL gardien serveur pour permissions | Documentation |
| **RBAC-05** | UI gates basées sur JWT, pas sur réponse API | Code review |
| **RBAC-06** | `hasPermission()` est la SEULE fonction de vérification côté client | Lint CI |
| **RBAC-07** | Ajouter un rôle = modifier manifest.yaml + 1 INSERT, zéro migration DB | Processus |
| **RBAC-08** | Wildcard `module:*` préféré à listes explicites | Convention |

---

## 11. Extensibilité V2+

### Scénario: Ajouter "Auditeur Externe"

```yaml
# manifests/permissions.yaml -- 5 nouvelles lignes
roles:
  auditor:
    description: "Auditeur externe"
    permissions:
      - "finance:ledger:read"
      - "finance:bilan:read"
      - "finance:rapport:read"
      - "finance:rapport:export"
    hierarchy_level: 3
```

```sql
-- 1 INSERT dans org_members
INSERT INTO org_members (user_id, org_id, role)
VALUES ('<uuid>', '<org-id>', 'auditor');
```

**Zéro migration DB. Zéro modification TypeScript. Zéro modification RLS.**

### Scénario V2: Rôles Dynamiques Créés par les Users

Quand les organisations voudront créer leurs propres rôles:

```sql
-- Remplacer manifest.yaml par table
CREATE TABLE custom_roles (
    id uuid PRIMARY KEY,
    org_id uuid REFERENCES organizations(id),
    name text NOT NULL,
    permissions jsonb NOT NULL,  -- ["finance:*", "members:directory:read"]
    hierarchy_level integer NOT NULL DEFAULT 1
);
```

**La couche RBAC NE BOUGE PAS.** Seule la source de vérité change de YAML → DB. Le `hasPermission()` et `useCan()` restent identiques.

---

## Résumé Exécutif

### En Une Phrase

**1 table `org_members(user_id, org_id, role)` + permissions dans `manifest.yaml` + edge function guard + RLS只做 org_id isolation.**

### Ne Pas Faire

| Interdiction | Pourquoi |
|---|---|
| Table `permissions` séparée | Redondant avec manifest.yaml |
| Table `role_permissions` many-to-many | Cause racine du chaos RBAC |
| Bibliothèque RBAC externe | Casl/permcheck = 500+ lignes de boilerplate |
| ABAC | Overkill total pour 4-5 rôles statiques |
| Vérification rôle dans RLS SQL | Rend les policies injoignables |
| Requête DB côté client après login | Le JWT contient tout |

### Faire

1. **`org_members` table** -- `(user_id, org_id, role)` + CHECK constraint enum
2. **Permissions dans manifest.yaml** -- Configuration, pas données
3. **JWT injection** -- Permissions calculées à l'auth, stockées dans le token
4. **Edge function `authorize()`** -- Un seul guard serveur
5. **RLS simplifiée** -- `org_id` uniquement, jamais de rôle
6. **`hasPermission()` 30 lignes** -- Fonction pure avec wildcard matching
7. **`useCan()` hook** -- UI gates basée sur JWT

### Impact

| Métrique | Avant (RBAC classique) | Après (Role Grants) |
|----------|----------------------|---------------------|
| Tables supplémentaires | 4-5 | **1** |
| Lignes code client | 500+ | **~30** |
| Temps debugging permission | 30-60 min | **< 30 secondes** |
| Temps ajouter un rôle | 1-2h (migrations + code + tests) | **5 minutes** (YAML + INSERT) |
| Lignes RLS policies | 20-50 (avec subqueries) | **3-5** (org_id only) |

---

*RBAC Minimal pour Lumina v2 — 2026-07-23*
