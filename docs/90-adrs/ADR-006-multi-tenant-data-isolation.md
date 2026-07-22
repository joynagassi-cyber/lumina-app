# ADR-006 : Isolément des Données Multi-Tenants

**Date :** 2026-01-15  
**Statut :** ACCEPTÉ  
**Décideurs :** CTO + Architecte Principal  
**Conséquences :** Schéma PostgreSQL avec colonne org_id, politiques RLS granulaires, données jamais mélangées entre organisations

---

## 1. Contexte

Lumina supporte plusieurs types d'organisations (églises, ONG, écoles, entreprises). Chaque organisation a ses propres données, utilisateurs, formulaires et configurations. Les données doivent être **strictement isolées** entre organisations.

## 2. Questions

Comment isoler les données de différentes organisations au niveau base de données et application ?

## 3. Décision

Architecture multi-tenant avec **colonne org_id sur toutes les tables** + **RLS (Row Level Security)** PostgreSQL + **middleware d'isolation** côté serveur InsForge.

### Schéma de Base de Données

```sql
-- Toutes les tables de données utilisateur ont cette colonne
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    -- ... autres colonnes
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    -- ... autres colonnes
);

-- Politique RLS automatique
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON transactions
    USING (org_id = current_setting('app.current_org_id')::UUID);
```

### Middleware InsForge

```typescript
// Middleware d'isolation automatique
app.use('/api/v1/*', (req, res, next) => {
    const orgId = req.headers['x-org-id'];
    if (!orgId) return res.status(400).json({ error: 'org_id required' });
    
    // Injection automatique dans toutes les requêtes
    req.orgId = orgId;
    prisma.$use(async (params, next) => {
        if (['findMany', 'findFirst', 'create', 'update', 'delete'].includes(params.action)) {
            params.args.where = {
                ...params.args.where,
                org_id: orgId
            };
        }
        return next(params);
    });
    return next();
});
```

## 4. Alternatives Envisagées

### Alternative A : Schémas PostgreSQL Separés par Org
- **Avantages :** Isolement physique total, backup séparé possible
- **Inconvénients :** Gestion de N schémas complexe, migrations doivent s'appliquer à tous, overhead opérationnel

### Alternative B : Base de Données Séparée Par Org
- **Avantages :** Isolement maximal, scaling indépendant possible
- **Inconvénients :** Coût x10 (N bases au lieu d'une), maintenance nightmare, surcoût infrastructure énorme

### Alternative C : Colonne org_id + RLS (Choix Retenu)
- **Avantages :** Isolement logique parfait, single schema manageable, RLS PostgreSQL garanti au niveau DB, scaling horizontal possible via sharding futur
- **Inconvénients :** Risque théorique de fuite si middleware sauté → atténué par RLS DB

## 5. Conséquences

### Positives
- ✅ Isolement garanti à 3 niveaux : middleware, RLS DB, application
- ✅ Single schema = migrations simples
- ✅ Requêtes跨-org facilement possibles pour reporting global
- ✅ Scaling possible vers sharding basé sur org_id si besoin

### Négatives (et mitigations)
- ⚠️ Risque théorique de fuite de données → **Mitigation :** RLS PostgreSQL en dernier rempart, tests auto sur chaque endpoint
- ⚠️ Indexation org_id obligatoire sur toutes les tables → **Mitigation :** Index automatiques lors de la création de table

## 6. Tests d'Isolation Obligatoires

```typescript
describe('Data Isolation', () => {
    it('Org A cannot query Org B data', async () => {
        const tokenA = generateToken('org-a');
        const result = await api.withToken(tokenA).get('/transactions');
        expect(result.every(t => t.org_id === 'org-a')).toBe(true);
    });
    
    it('Missing org_id header is rejected', async () => {
        const result = await api.get('/transactions');
        expect(result.status).toBe(400);
    });
});
```

## 7. Références

- DOC-PLATFORM-MANIF (org_id dans manifest)
- INV-005 (Invariant : Isolement des Données)
- NEVERBREAK-RULE-05 (Règle : Isolement Multi-Tenant)
