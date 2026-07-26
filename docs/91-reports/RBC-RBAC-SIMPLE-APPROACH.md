# Rapport RBAC : Approche la Plus Simple pour Lumina v2

**Date :** 2026-07-23
**Statut :** RECOMMANDATION
**Contexte :** Application React Native multi-tenant, 3-4 roles par org, backend PostgreSQL + InsForge + RLS

---

## 1. LA CAUSE RACINE DU CALVAIRE RBAC

Les implémentations RBAC traditionnelles deviennent ingérables à cause d'un seul pattern destructeur :

### LE PROBLEME : Role Explosion (ou "Role Combinatorial Explosion")

Quand on modélise des permissions granulaires comme `finance:ledger:read`, `finance:ledger:write`, `members:directory:write`, etc., et qu'on les assigne individuellement à chaque rôle, on crée une dette exponentielle :

- 5 modules X 3 actions = 15 permissions
- 4 roles -> 60 combinaisons possibles dans la matrice
- Ajouter 1 nouvelle permission = vérifier 4 lignes
- Ajouter 1 nouveau role = vérifier 15 lignes
- Un role qui hérite de 3 autres + a 2 permissions propres = un cauchemar de debugging

**La cause racine n'est pas le RBAC lui-même, c'est l'attribution individuelle de permissions granulaires à des rôles statiques.** Chaque fois que quelqu'un ajoute une permission, il doit savoir quels 4 rôles doivent la recevoir. C'est une opération manuelle sujette aux erreurs humaines.

### Pourquoi ça ne marche pas pour Lumina

Lumina a 5 moteurs d'exécution (Manifest, Vocabulary, Forms, Workflow, Capability). Chacun avec son propre système de configuration YAML/JSON. Ajouter un 6ème moteur RBAC avec ses tables, sa logique de vérification client ET serveur, c'est dupliquer la puissance du Manifest Engine qui fait déjà ça.

---

## 2. L'APPROCHE RECOMMANDEE : Role Grants (3 tables MAX)

Oublier le RBAC classique avec tables séparées pour roles, permissions, et role_permissions. Utiliser le pattern **Role Grants** qui est leRBAC simplifié au maximum.

### Pourquoi ce pattern

- **3 tables** au lieu de 5+ tables du RBAC standard
- **Aucune table intermédiaire** role_permission (c'est le chaos)
- Les permissions sont stockées en JSONB dans la table users (PostgreSQL) ou dans une colonne dédiée
- Le Manifest Engine de Lumina déclare déjà les permissions par rôle. On ne fait QUE lire cette déclaration

### Architecture visuelle

```
users
  ├── id, org_id, email, password_hash
  └── role TEXT NOT NULL  -- 'superadmin', 'admin', 'treasurer', 'pastor', 'staff'

org_members          (la seule table RBAC supplémentaire)
  ├── user_id UUID REFERENCES users(id)
  ├── org_id UUID REFERENCES organizations(id)
  └── role TEXT       -- redondant mais intentional: cache la vérification sans JOIN

┌─────────────────────────────────────────────┐
│  manifest.yaml (source de vérité permissions)│
│                                             │
│  roles:                                     │
│    admin:                                   │
│      permissions:                           │
│        - "finance:*"                        │
│        - "members:*"                        │
│        - "events:*"                         │
│                                             │
│  treasurer:                                 │
│      permissions:                           │
│        - "finance:ledger:read"              │
│        - "finance:ledger:write"             │
│        - "finance:bilan:read"               │
│        ...                                  │
└─────────────────────────────────────────────┘
```

### Schéma SQL minimal

```sql
-- Table org_members : lien user <-> org avec role local
CREATE TABLE org_members (
    user_id   UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    org_id    UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role      TEXT NOT NULL CHECK (role IN ('superadmin', 'admin', 'treasurer', 'pastor', 'staff')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index essentiel pour les vérifications rapides
CREATE INDEX idx_org_members_user ON org_members(user_id);
CREATE INDEX idx_org_members_org ON org_members(org_id);

-- La "matrice" permissions existe DANS le manifest.yaml
-- Aucune table nécessaire. C'est de la configuration, pas des données.
```

**C'est 1 table supplémentaire au schéma existant.** Le Manifest Engine lit les permissions depuis le YAML et les injecte dans le JWT à l'authentification.

---

## 3. FLUX DE VERIFICATION TYPESCRIPT COTE CLIENT

Pas de bibliothèque RBAC externe. Pas de contexte complexe. Une seule fonction pure :

```typescript
// src/core/auth/rbac.ts

/**
 * Vérification de permission par pattern matching simple.
 * 
 * Pattern format: "module:resource:action"
 * Wildcard support: "finance:*" matche tout ce qui commence par "finance:"
 * Star seul: "*" matche TOUT
 */
export function hasPermission(
  userPermissions: string[],
  requiredPermission: string
): boolean {
  // 1. Permission explicite ?
  if (userPermissions.includes(requiredPermission)) return true;

  // 2. Wildcard module:* ?
  const [module] = requiredPermission.split(':');
  const wildcard = `${module}:*`;
  if (userPermissions.includes(wildcard)) return true;

  // 3. Super-admin star ?
  if (userPermissions.includes('*')) return true;

  return false;
}

/** Hook React Native simple */
import { useMemo } from 'react';

export function useCan(permission: string) {
  const { permissions } = useAppContext(); // permissions from JWT/UserSession
  
  const can = useMemo(
    () => hasPermission(permissions ?? [], permission),
    [permissions, permission]
  );
  
  return can;
}

/** Utilisation dans un composant */
function LedgerScreen() {
  const canWrite = useCan('finance:ledger:write');
  
  return (
    <View>
      <LedgerList />
      {canWrite && <FAB icon="plus" onPress={createTransaction} />}
    </View>
  );
}
```

C'est 30 lignes de code qui résolvent le problème. Pas de dépendance npm RBAC. Pas de contexte state management. Juste une fonction pure + un hook.

---

## 4. CONNEXION AVEC LES RLS POLICIES POSTGRESQL

C'est ici que le RBAC traditionnel devient infernal : re-déclarer les mêmes règles en SQL + TypeScript + client. La solution : **unifier le point de décision**.

### Le pattern RLS sans duplication

Les RLS policies NE vérifient PAS le role de l'utilisateur. Elles utilisent `current_setting('app.current_org_id')` pour l'isolation multi-tenant ET une edge function InsForge qui valide les permissions AVANT que la requête n'atteigne PostgreSQL.

```
Client --> Edge Function (vérifie role + permission) --> PostgREST --> RLS (vérifie seulement org_id)
```

### Côté InsForge : middleware de permission

```typescript
// functions/_shared/authorize.ts
import { createClient } from '@supabase/supabase-js'  // via InsForge runtime
const postgrest = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SERVICE_ROLE_KEY!
)

export type RequiredPermission = string[];

/**
 * Middleware InsForge : vérifie que l'utilisateur a la permission requise.
 * Injectée via les claims JWT ou un lookup org_members.
 */
export async function authorize(
  req: InsForgeRequest,
  requiredPerms: RequiredPermission
): Promise<void> {
  const user = await req.getUser()  // JWT decoding
  
  // Récupérer le role depuis org_members
  const { data: member } = await postgrest
    .from('org_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('org_id', user.org_id)
    .single()
  
  if (!member) throw new InsForgeError('NOT_MEMBER', 'Non membre de cette org')
  
  // Charger les permissions du manifest correspondant au role
  const manifest = await loadManifest(user.org_id)
  const userPermissions = manifest.roles[member.role]?.permissions ?? []
  
  // Vérifier SI AU MOINS UNE permission matche
  const allowed = requiredPerms.some(p => hasPermission(userPermissions, p))
  if (!allowed) throw new InsForgeError('FORBIDDEN', 'Permission refusée')
}
```

### Côté PostgreSQL : RLS uniquement pour l'isolement tenant

```sql
-- RLS NE GERE QUE L'ISOLATION MULTI-TENANT
-- La validation role/permission est FAITE par l'edge function AVANT

-- Chaque table suit ce pattern identique
CREATE POLICY org_isolation ON transactions FOR ALL
  USING (org_id = current_setting('app.current_org_id')::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id')::uuid);

-- C'est TOUT. Pas de CHECK sur le role. Pas de subquery complexe.
-- L'edge function a déjà filtré qui peut faire quoi.
-- RLS garantit juste que A ne voit PAS les données de B.
```

### Transaction CRUD typique

```typescript
// src/features/finance/transaction-service.ts
import { useCan } from '../../core/auth/rbac'

async function createTransaction(data: TransactionInput) {
  // 1. Check client-side (UX immédiate, bloque l'UI)
  if (!useCan('finance:ledger:write')) {
    throw new Error('No permission to create transactions')
  }
  
  // 2. Envoyer à InsForge (edge function rejete si pas autorisé)
  const response = await api.post('/api/v1/transactions', data)
  
  // 3. RLS protège en cas de bypass de l'edge function
  //    (insparable car org_id est injecté depuis le JWT)
  
  // 4. Synchronisation locale WatermelonDB
  await db.write(async () => {
    await collections.transactions.create(t => {
      t.id = response.data.id
      t.synced = 0
      t.orgId = data.org_id
      // ...
    })
  })
}
```

---

## 5. ANALYSE COMPARATIVE DES APPROCHES

| Critère | RBAC Classique | ABAC | **Role Grants (recommandé)** |
|---------|---------------|------|---------------------------|
| Tables nécessaires | 5+ (roles, permissions, role_permissions, user_roles, users) | 10+ (attributs, politiques, évaluateurs) | **1** (org_members) |
| Code client | 500+ lignes (context, providers, guards) | Impossible | **30 lignes** (1 fonction + 1 hook) |
| Debuggable en 5 min | Non (JOINs, cascades, héritages) | Non (évaluateur d'expressions) | **Oui** (SELECT role FROM org_members WHERE user_id = X) |
| Extensible | Oui mais cher | Extrêmement flexible | **Via manifest.yaml sans DB change** |
| Performance | Index sur 5 tables | Requêtes complexes RLS | **1 index, 1 requête** |
| Lié au manifest? | Non (système séparé) | Non (système séparé) | **Oui (manifest est source de vérité)** |
| Overkill? | Oui pour 4 roles | Absolument | **Non** |

---

## 6. PATTERNS QUI REDUISENT LA COMPLEXITE AU MINIMUM

### Pattern 1: Permissions dérivées du role (pas de mapping many-to-many)

```
User.role = 'treasurer' 
  --> manifest.roles.treasurer.permissions = [...]
  --> injecté dans JWT à l'auth
  --> user.permissions[0..N] lus côté client
```

Jamais de `SELECT JOIN role_permissions JOIN permissions WHERE user_id = X`. Le JWT contient tout.

### Pattern 2: Wildcard au lieu de listes exponentielles

```yaml
# Au lieu de:
permissions:
  - finance:ledger:read
  - finance:ledger:write
  - finance:ledger:delete
  - finance:bilan:read
  - finance:bilan:write
  - finance:rapport:read
  - finance:rapport:write

# On utilise:
permissions:
  - "finance:*"
```

Un seul `*` remplace 15 permissions explicites. La fonction `hasPermission` gère le matching.

### Pattern 3: L'edge function est le seul gardien serveur

```
POST /api/v1/transactions
  |-> InsForge edge function: authorize(['finance:ledger:write'])
  |     |-- getUser() -> decode JWT
  |     |-- lookup org_members.role
  |     |-- resolve manifest permissions
  |     |-- hasPermission() check
  |     |-- THROW 403 si échec
  |-> PostgREST (si authorize passe)
  |     |-- RLS: org_id check ONLY
  |-> INSERT
```

Un seul point de contrôle. Pas de logique dupliquée dans RLS + application code.

### Pattern 4: UI gates basées sur le JWT, pas sur la réponse API

```typescript
// Mauvais: montrer le bouton, attendre 403 de l'API
<Fab onPress={handleCreate} />  // user clique -> ERROR

// Bon: le bouton n'existe même pas pour cet utilisateur
{useCan('finance:ledger:write') && <Fab onPress={handleCreate} />}
```

Côté client = UX instantanée. Côté serveur = sécurité garantie par RLS.

---

## 7. RECOMMENDATION FINALE POUR LUMINA

### Ne PAS faire

- Aucune table `permissions` séparée
- Aucune table `role_permissions` avec many-to-many
- Aucune bibliothèque externe (casl, permcheck, rbac-check)
- Aucun ABAC ( атрибуты dynamiques = complexity sans valeur ajoutée pour 4 roles)
- Aucune autorité RLS basée sur le role (c'est la cause #1 des RLS qui deviennnent injoignables)

### Faire

1. **Table `org_members`** avec `(user_id, org_id, role)` -- 3 colonnes
2. **Permissions déclarées dans `manifest.yaml`** -- configuration, pas données
3. **Permissions injectées dans le JWT** à l'authentification -- zéro requête DB côté client après login
4. **Edge function InsForge** pour valider les permissions avant chaque mutation -- un seul guard centralisé
5. **RLS只做 org_id isolation** -- pas de role checking dans les policies SQL
6. **`hasPermission()` en 30 lignes TS** -- fonction pure avec wildcard matching

### Migration path depuis l'existant

Le schema actuel (`Database-Schema.md`) a `users.role` et `UserSession.permissions` comme JSON array. La migration est triviale :

```sql
-- 1. Créer org_members (nouvelle table)
CREATE TABLE org_members (...);

-- 2. Migrer les donnees existantes
INSERT INTO org_members (user_id, org_id, role)
SELECT id, org_id, role FROM users;

-- 3. Retirer users.role (optionnel, peut rester en legacy)
-- ALTER TABLE users DROP COLUMN role;

-- 4. Mettre à jour l'edge function d'auth pour lire depuis org_members
```

### Est-ce extensible?

Oui. Ajouter un nouveau role = ajouter 5 lignes dans `manifest.yaml` + 1 INSERT dans `org_members`. Aucune migration DB. Aucun changement TypeScript. Le Manifest Engine résout automatiquement les permissions.

Pour V2 quand on aura besoin de roles dynamiques (utilisateurs créent leurs propres roles), on remplace juste `manifest.roles[taken.role].permissions` par un SELECT sur une table `custom_permissions`. La couche RBAC ne bouge pas.

---

**Verdict:** Pour 4 roles, organisation fermée (inscription manuelle), MVP financier en priorité -- l'approche Role Grants + manifest.yaml est la plus simple qui reste fonctionnelle. Le debug prend 30 secondes : `SELECT role FROM org_members WHERE user_id = '<uuid>'`. Fin.

---

*Ce rapport est basé sur une analyse du schéma existant de Lumina v2 (ADRs, Database Schema, Backend Guide, Manifest config) et des meilleures pratiques documentées pour les applications React Native à petit nombre de roles.*
