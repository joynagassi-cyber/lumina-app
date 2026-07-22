# ADR-015 : API Contract Strategy — REST Only (Pas de GraphQL)

**Date :** 2026-07-22  
**Statut :** ACCEPTÉ  
**Décideurs :** CTO + Architecte Principal  
**Conséquences :** Toutes les communications client/serveur utilisent REST via InsForge, format JSON, pas de layer GraphQL, pas d'Apollo/Relay

---

## 1. Contexte

L'application Lumina communique avec le backend InsForge via une API. La question est de choisir entre REST pur, GraphQL, ou une approche hybride. Le projet utilise déjà WatermelonDB pour le state offline (ADR-003) et InsForge comme backend unifié.

> **Voir aussi :** ADR-005 (InsForge backend, TypeScript end-to-end), ADR-003 (WatermelonDB adapter pattern), DOC-FRONTEND-GUIDE (Feature Contract Pattern).

## 2. Questions

Quelle stratégie d'API contracts adopter : REST, GraphQL, ou hybride ? Justifier l'exclusion de GraphQL.

## 3. Décision

**REST uniquement. Format JSON. Pas de GraphQL, pas d'Apollo, pas de Relay.**

### Stratégie REST

```
GET    /api/v1/transactions           → list
GET    /api/v1/transactions/:id       → get
POST   /api/v1/transactions           → create
PATCH  /api/v1/transactions/:id       → update
POST   /api/v1/transactions/:id/approve → transition status

GET    /api/v1/members                → list
POST   /api/v1/members                → create
PATCH  /api/v1/members/:id            → update
DELETE /api/v1/members/:id            → soft delete

GET    /api/v1/groups                 → list
POST   /api/v1/groups                 → create
```

### Règles de Contrat

1. **Toutes les responses JSON** — standardisé, type-safe avec TypeScript
2. **org_id injecté par middleware** (ADR-006) — jamais dans les params request
3. **Pagination offset-based** — `?page=1&limit=50` (simple, compatible WatermelonDB)
4. **Filters via query params** — `?dateFrom=2026-01-01&type=income`
5. **Status codes sémantiques** — 200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 409 Conflict (sync), 422 Unprocessable (validation)
6. **Error response standardisé :**
   ```json
   { "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [...] } }
   ```
7. **InsForge génère automatiquement** les endpoints CRUD à partir du schéma DB
8. **Edge functions** pour logique métier complexe (calcul bilan, export PDF/CSV)

### Exclusion Explicitée : GraphQL

**GraphQL est explicitement exclu** car :
- ❌ Complexité supplémentaire inutile pour une app MVP à 10 features
- ❌ Pas de cache HTTP natif (nécessite Apollo Cache ou Relay Store additionnels)
- ❌ Overhead de tooling (schema validation, codegen, typegen) disproportionné
- ❌ Debugging plus difficile (un endpoint `/graphql` vs 20 routes REST claires)
- ❌ InsForge génère naturellement des endpoints REST — forcer GraphQL serait contre-nature
- ❌ WatermelonDB adapter pattern fonctionne directement avec HTTP REST calls
- ❌ Bundle size add-on (Apollo Client ~60KB gzipped) non justifié

## 4. Alternatives Envisagées

### Alternative A : GraphQL (Apollo/Relay)
- **Avantages :** Query exacte des données nécessaires, pas de over-fetching, auto-generated types, good for complex relationships
- **Inconvénients :** Complexité ajoutée inutilement, over-engineering pour MVP, pas aligné avec capabilities naturelles d'InsForge, bundle size plus lourd

### Alternative B : Hybride (REST + GraphQL)
- **Avantages :** REST pour CRUD simple, GraphQL pour requêtes complexes
- **Inconvénients :** Double maintenance, deux couches network différentes, debugging confus, overkill absolu pour le scope actuel

### Alternative C : REST Only (Choix Retenu)
- **Avantages :** Simplicité maximale, compatible HTTP cache natif, InsForge génère automatiquement, debugging clair, zero additional deps, WatermelonDB adapter pattern direct
- **Inconvénients :** Over-fetching possible si endpoints mal conçus → **Mitigation :** Feature Contract Pattern (DOC-FRONTEND-GUIDE Section 3) expose uniquement ce qui est nécessaire

## 5. Conséquences

### Positives
- ✅ Zero dépendance API client — juste `fetch` / InsForgeClient wrapper
- ✅ HTTP cache natif fonctionne (React Query utilise stale-while-revalidate)
- ✅ Debugging simple : logs network clairs, chaque endpoint identifiable
- ✅ Compatible avec InsForge native génération
- ✅ WatermelonDB adapter fait mapping HTTP → Model directement
- ✅ Bundle size minimal (pas d'Apollo/Relay à打包)

### Négatives (et mitigations)
- ⚠️ Over-fetching possible sur certains endpoints → **Mitigation :** Feature Contract Pattern (chaque feature expose uniquement les champs nécessaires)
- ⚠️ Relations complexes nécessitent plusieurs appels → **Mitigation :** Endpoints batch (`/api/v1/transactions/batch?ids=a,b,c`) pour lectures groupées

## 6. Références

- PRD Section "API & Backend"
- DOC-FRONTEND-GUIDE (Section 2 — Architecture Features)
- DOC-FRONTEND-GUIDE (Section 3 — Feature Contract Pattern)
- ADR-003 (WatermelonDB — adapter layer HTTP ↔ Models)
- ADR-005 (InsForge backend — génération automatique API)
- ADR-006 (Multi-Tenant — org_id injecté par middleware)
