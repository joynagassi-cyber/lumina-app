# ADR-014 : Graphe Organisationnel — DAG Hiérarchique avec Héritage Configuratif

**Date :** 2026-07-22  
**Statut :** ACCEPTÉ  
**Décideurs :** CTO + Architecte Principal + Product Owner  
**Conséquences :** Structure organisationnelle en DAG (graphes orientés acycliques), héritage configuratif profond (vocabulaires, formulaires, workflows), données isolées par org_id (ADR-006)

---

## 1. Contexte

L'application supporte plusieurs types d'organisations (églises, ONG, écoles, entreprises). Chaque organisation a sa propre hiérarchie de membres, groupes et départements. La structure n'est pas un arbre simple mais un **DAG** (Directed Acyclic Graph) car :
- Un membre peut appartenir à plusieurs groupes
- Un département peut être rattaché à plusieurs unités parent
- L'héritage configuratif permet à un enfant d'hériter du vocabulaire, des formulaires et workflows du parent

> **Voir aussi :** ADR-006 (multi-tenant org_id + RLS), ADR-009 (rôles utilisateurs, admin-only MVP), ADR-007 (MVP scope — la complexité du DAG est réduite au MVP à 10 features).

## 2. Questions

Comment modéliser une hiérarchie organisationnelle où les membres peuvent appartenir à plusieurs groupes et où la configuration est héritée ? Pourquoi un DAG et non un arbre ?

## 3. Décision

**Modélisation en DAG avec héritage configuratif. Chaque noeud du DAG est une organisation, un département, ou un groupe.**

### Modèle de Données

```sql
-- Noeuds du graphe
CREATE TABLE organizations (
    id UUID PRIMARY KEY,
    org_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),  -- tenant isolation ADR-006
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('église', 'ong', 'école', 'entreprise')),
    parent_org_id UUID REFERENCES organizations(id),        -- hiérarchie multi-org
    config_json JSONB DEFAULT '{}',                         -- héritage configuratif
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Grappes (appartements multiples → DAG)
CREATE TABLE group_memberships (
    group_id UUID NOT NULL REFERENCES groups(id),
    member_id UUID NOT NULL REFERENCES members(id),
    PRIMARY KEY (group_id, member_id)  -- un membre dans un groupe une seule fois
);

-- Départements avec héritage
CREATE TABLE departments (
    id UUID PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations(org_id),
    parent_dept_id UUID REFERENCES departments(id),         -- héritage hiérarchique
    inherits_vocab BOOLEAN DEFAULT true,                    -- hérite vocabulaire parent
    inherits_forms BOOLEAN DEFAULT true,                    -- hérite formulaires parent
    inherits_workflows BOOLEAN DEFAULT true,                -- hérite workflows parent
    inherits_theme BOOLEAN DEFAULT true,                    -- hérite accent/ couleur org parent
    custom_vocab JSONB,                                     -- overrides locaux
    custom_forms JSONB,
    custom_workflows JSONB,
    custom_theme JSONB,                                     -- override couleur par dept
    created_at TIMESTAMTSZ DEFAULT NOW()
);
```

### Héritage Configuratif

Chaque noeud du DAG peut :
1. **Hériter** du vocabulaire, formulaires et workflows de son parent
2. **Déroger** via `custom_vocab`, `custom_forms`, `custom_workflows`
3. **Combiner** héritage + overrides locaux

```typescript
// Résolution d'héritage (exemple)
function getConfig(node: OrgNode): Config {
  if (node.custom_vocab) return node.custom_vocab;
  if (node.parent) return merge(node.parent.config, node.custom_forms ?? {});
  return defaultConfig();
}
```

### Exclusion Explicitée : Membres Ordinaires

Les membres ordinaires (non-admins) sont exclus du MVP (ADR-009). Le DAG initial est donc **mono-org avec admins par org**. Les membres sont créés/manipulés uniquement par les admins depuis le dashboard. La V2 ajoutera les membres comme noeuds du DAG.

## 4. Alternatives Envisagées

### Alternative A : Arbre Hiérarchique Simple (parent_id unique)
- **Avantages :** Modélisation simple, requêtes SQL straightforward, pas de cycles possible naturellement
- **Inconvénients :** Un membre ne peut appartenir qu'à un seul groupe, impossible de modéliser appartements multiples, trop restrictif pour des organisations réelles

### Alternative B : Base de données Graph (Neo4j)
- **Avantages :** Requêtes graph natifs, traversée efficace du DAG, relations multiples naturelles
- **Inconvénients :** Technologie additionnelle à maintenir, pas de SQL natif (relationnes complexes difficiles), overkill pour MVP à 10 features, incompatibilité avec ADR-006 (PostgreSQL + RLS)

### Alternative C : DAG sur PostgreSQL + CTE récursives (Choix Retenu)
- **Avantages :** PostgreSQL gère les CTE récursives nativement, single stack (TS+PG), RLS garde l'isolation multi-tenant (ADR-006), héritage configuratif facile à implémenter avec JSONB, scaling horizontal possible via sharding org_id
- **Inconvénients :** Requêtes de traversée de graphe plus complexes, détection de cycles manuelle (CHECK: pas de boucle), validation ACID nécessaire

## 5. Conséquences

### Positives
- ✅ Supporte cas réels : membres multi-groupes, départements imbriqués
- ✅ Héritage configuratif = moins de duplication entre organisations sœurs
- ✅ Single stack : PostgreSQL + JSONB suffit, pas de DB graphique externe
- ✅ Compatible multi-tenant (org_id sur toutes les tables, RLS garanti)
- ✅ Extensible : la V2 pourra ajouter les membres comme noeuds du DAG

### Négatives (et mitigations)
- ⚠️ Détection de cycles nécessaire → **Mitigation :** Trigger PostgreSQL BEFORE INSERT qui vérifie l'absence de chemin cyclique via CTE récursive
- ⚠️ Requêtes de traversée de graphe moins performantes qu'une DB native → **Mitigation :** Index composite `(org_id, parent_org_id)` + `(org_id, parent_dept_id)`
- ⚠️ Héritage multiple peut créer des conflits de overrides → **Mitigation :** Priorité claire : local > override parent > défaut
- ⚠️ Complexité de développement augmentée pour MVP → **Mitigation :** MVP se limite à mono-org + admins (DAG depth = 1)

### Règles de Performance
1. **Index obligatoire** sur `(org_id, parent_id)` pour toutes les tables de graphe
2. **Profondeur max du DAG en MVP** : 1 niveau (single org)
3. **Requêtes de traversée** : limitées à 3 niveaux max en MVP
4. **Cache côté client** : config résolue mise en cache (WatermelonDB, ADR-003)

## 6. Références

- PRD Section "Organisation & Membres"
- INV-005 (Invariant : Isolement des Données)
- NEVERBREAK-RULE-05 (Règle : Isolement Multi-Tenant)
- ADR-006 (Multi-Tenant — org_id isolation)
- ADR-009 (Admin-Only — membres exclus du MVP DAG)
- DOC-FRONTEND-GUIDE (Section 3 — Feature Contract Pattern)
