# Organization Graph Specification — Lumina v2

**Doc ID:** DOC-ORG-GRAPH-SPEC  
**Version:** 2.0  
**Statut :** SPECIFICATION COMPLÈTE  
**Dépendances :** PRD_LUMINA_v2.md (Section 2), ADR-001, ADR-006

---

## 1. Vision Fondamentale

Lumina ne connaît **aucun métier spécifique**. Il n'existe pas de tables `church`, `annex`, `district`.

Le **seul concept métier du Core** est : **Organization**

Toute hiérarchie (église → district → région → union ; ou entreprise → filiale → département ; ou ONG → bureau national → bureau régional) est un simple graphe d'organisations.

### Principe Directeur

```
❌ Jamais : CreateChurch(parentId, manifest)
❌ Jamais : SetDistrictName(orgId, name)
✅ Toujours : CreateOrganization(parentId, {type, config})
✅ Toujours : UpdateOrganization(orgId, {name, config})
```

Si une opération ressemble à `CreateAnnex()`, c'est que l'architecture est cassée. Créer une annexe = créer une Organisation enfant avec un manifest configuré pour le type "annexe". Le code du Core ne change jamais.

---

## 2. Structure Organisationnelle

### 2.1 Type Générique Unifié

| Champ | Description |
|-------|-------------|
| `id` | UUID unique immuable |
| `parent_id` | UUID du parent direct (null = racine) |
| `name` | Nom affiché (i18n via Vocab Engine) |
| `type` | Enum générique : `root`, `union`, `network`, `region`, `district`, `org` |
| `status` | `active`, `pending`, `archived`, `deleted`, `merged` |
| `config` | JSONB — manifest complet (types métier comme "church", "ngo" sont ici) |
| `created_at` | Timestamp |
| `updated_at` | Timestamp |

### 2.2 Le Graphe (pas un arbre !)

```
                    [Org: Union Nationale] (racine)
                       /                  \
              [Org: Fédération Est]    [Org: Fédération Ouest]
                  /      \                  /      \
         [Org: District A] [Org: District B]  [Org: Région X]
             |                |                   |
       [Org: Église 1]   [Org: Église 2]     [Org: Église 3]
          /    \                              |
    [Annexe] [Annexe]                   [Annexe]
```

Chaque flèche = un lien `parent_id`. Profondeur illimitée. Pas de restriction sur le nombre d'enfants.

---

## 3. Règles d'Héritage Détaillées

### 3.1 Types d'Héritage

| Élément | Héritage | Surchargeable ? |
|---------|----------|-----------------|
| **Vocabulaire** (termes par défaut) | ✅ Propagé enfant | Oui, l'enfant peut redéfinir ses termes |
| **Formulaires** (templates) | ✅ Propagé enfant | Oui, l'enfant peut créer les siens |
| **Workflows** (par défaut) | ✅ Propagé enfant | Oui, l'enfant peut définir les siens |
| **Permissions de base** | ✅ Propagé enfant | Non, immutable via Capability Engine |
| **Currency par défaut** | ✅ Propagé enfant | Oui |
| **Fiscal year default** | ✅ Propagé enfant | Oui |
| **Data financière** | ❌ Jamais isolé | N/A |
| **Membres** | ❌ Jamais isolé | N/A |
| **Historique** | ❌ Jamais isolé | N/A |

### 3.2 Algorithme d'Héritage

```
Quand une organisation LIT une configuration (vocabulaire, workflow, form) :

1. Vérifier si l'org possède sa propre version → Si oui, l'utiliser
2. Sinon, remonter la chaîne parent → enfant jusqu'à trouver une version
3. Si aucune version trouvée → Utiliser les valeurs par défaut du manifest template
4. Si aucune valeur par défaut → Erreur explicite

Exception : Les permissions se calculent différemment (voir Section 8)
```

### 3.3 Règle Stricte

Un enfant NE PEUT JAMAIS modifier le manifest de son parent. Les configurations enfants sont TOUJOURS en override partiel (deep merge). L'héritage est DOWNWARD ONLY (parent → enfant).

---

## 4. Création d'une Organisation

### 4.1 Opération Unique

```typescript
async function createOrganization(params: {
  parentId: string | null;
  name: string;
  orgType: string;
  config?: Record<string, any>;
  createdBy: string;
  inheritsFromParent: boolean;
}): Promise<{ success: boolean }> {
  
  // 1. Vérifier capacité org:create_child
  if (!hasPermission(createdBy, 'org:create_child')) {
    throw new PermissionDeniedError('Cannot create child org')
  }
  
  // 2. Vérifier cycle (voir validateNoCycle)
  if (parentId && await isAncestor(parentId, newlyCreatedOrg.id)) {
    return { success: false }
  }
  
  // 3. Hériter config parent si enabled
  let resolvedConfig = config || {}
  if (inheritsFromParent && parentId) {
    const parentManifest = await loadManifest(parentId)
    resolvedConfig = deepMerge(parentManifest.config, config)
  }
  
  // 4. Créer l'org + log audit
  const org = await db.createOrganization({ ...params, config: resolvedConfig })
  await logAudit({ action: 'organization_create', orgId: org.id })
  
  return { success: true }
}
```

### 4.2 Scénarios Concrets

#### Créer une Église Indépendante

```typescript
// Le Core voit juste une Organisation quelconque.
// C'est le manifest qui définit que c'est une église.
const church = await createOrganization({
  parentId: null,              // Racine autonome
  name: "Église de la Paix",
  orgType: "org",              // Type générique
  config: {
    type: "church",            // Métier uniquement dans le manifest
    features: { bible: true }, 
    roles: { pastor: true }
  },
  createdBy: "user-uuid",
  inheritsFromParent: false
})
```

#### Créer un District

```typescript
const district = await createOrganization({
  parentId: "regional-org-id",
  name: "District Nord",
  orgType: "district",
  config: { level: "district" },
  createdBy: "regional-admin-uuid",
  inheritsFromParent: true
})
```

---

## 5. Modification de la Hiérarchie

### 5.1 Changement de Rattachement (Transfer)

```typescript
async function transferOrganization(orgId: string, newParentId: string | null): Promise<boolean> {
  // 1. Vérifier cycle (CRITIQUE)
  if (newParentId && await isAncestor(newParentId, orgId)) {
    throw new Error('Cycle détecté')
  }
  
  // 2. Vérifier capacité org:manage_hierarchy
  if (!hasPermission(currentUser, 'org:manage_hierarchy')) throw new Error('Permission denied')
  
  // 3. Exécution
  await db.updateOrganization(orgId, { parentId: newParentId })
  await logAudit({ action: 'organization_transfer', orgId, newParentId })
  return true
}
```

### 5.2 Autonomie d'une Organisation

Pour transformer une annexe en org autonome : déconnecter du parent. Le rattachement initial reste dans l'historique pour traçabilité complète. Aucune donnée n'est perdue.

---

## 6. Suppression et Archivage

| Action | Effet | Conditions |
|--------|-------|------------|
| `ArchiveOrganization(id)` | Passe `status='archived'` | Pas de transactions actives en cours |
| `UndeleteOrganization(id)` | Repasse `status='active'` | Impossible après merge/suppression définitive |
| `DeleteOrganization(id)` | Suppression complète | Seulement si `status='deleted'` pendant 2 ans |

### Fusion

1. Migrer utilisateurs vers targetId
2. Agréger données financières dans targetId
3. Marquer source comme mergée (`status='merged'`)
4. Notifier tous les utilisateurs impactés

---

## 7. Gestion des Membres Multi-Organisations

### Modèle

```typescript
interface OrgMembership {
  userId: string           // User global unique
  orgId: string            // L'organisation spécifique
  roleId: string           // Rôle défini dans le manifest de cette org
  departmentId?: string
  joinedAt: Date
  status: 'active' | 'inactive' | 'transferred' | 'deceased'
}
```

### Principe

Jean peut être simultanément :
- Pasteur dans l'Organisation A (config manifest church)
- Membre simple dans l'Organisation B (config manifest company)
- Administrateur dans l'Organisation C (config manifest ngo)

Chaque appartenance est une entrée distincte dans `OrgMembership`. Les rôles sont **isolés** : le rôle "pastor" d'Org A n'a aucun lien avec le rôle "member" d'Org B.

---

## 8. Unités Organisationnelles

**Ne jamais coder "Youth", "Choir", "Finance".** Créer un modèle générique :

```typescript
@Table('org_units')
export class OrgUnit extends Model {
  id            = prop()
  _synced       = column('synced', 1)
  createdAt     = column('created_at')
  updatedAt     = column('updated_at')
  
  orgId         = column('org_id')
  parentId      = column('parent_unit_id')  // Auto-référence pour hiérarchie
  name          = column('name')
  unitType      = column('unit_type')       // configurable: ministry, dept, committee...
  description   = column('description')
  status        = column('status', 'active')
  memberCount   = column('member_count', 0)
}
```

Les types disponibles sont configurés dans le manifest :

```yaml
available_types:
  - type: "ministry"
    requires_leader: true
    allows_sub_units: true
  - type: "department"
    requires_budget: true
    allows_sub_units: true
  - type: "committee"
    requires_approval: false
    allows_sub_units: false
```

---

## 9. Permissions

### Matrice

| Permission | Hérite-t-elle du Parent ? |
|------------|---------------------------|
| `org:*:read` | Oui |
| `finance:*` | Non (isolé par org) |
| `members:*` | Non (isolé par org) |
| `org:merge` | Jamais héritée |
| `org:delete` | Jamais héritée |

---

## 10. Agrégation Financière

Les transactions appartiennent à une **Organisation spécifique**. Pour obtenir les chiffres d'un niveau supérieur :

```typescript
async function aggregateFinancials(parentOrgId: string, periodStart: Date, periodEnd: Date): Promise<FinancialReport> {
  const descendants = await getDescendants(parentOrgId)
  
  const transactions = await db.query(
    Q.where('org_id', 'in', descendants.map(d => d.id)),
    Q.where('transaction_date', 'between', periodStart, periodEnd),
    Q.not('status', 'rejected')
  ).fetch()
  
  const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
  const expense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
  
  return { orgId: parentOrgId, income, expense, netResult: income - expense }
}
```

**Règle critique :** Exclure les transferts internes entre parent/enfant pour éviter double comptage.

---

## 11. Tableaux de Bord

Un dashboard calcule toujours en agrégeant :
1. L'organisation elle-même
2. Tous ses descendants (récursivement)
3. Filtres période + statuts

### Types

| Niveau | Source | Exemple |
|--------|--------|---------|
| Local | Une seule org | Dashboard Église du Plateau |
| Régional | Org + descendants | Dashboard Région Nord |
| National | Toutes les orgs enfant | Rapport annuel national |
