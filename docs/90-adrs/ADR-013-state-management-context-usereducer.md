# ADR-013 : State Management — Context + useReducer vs Store Externe

**Date :** 2026-07-22  
**Statut :** ACCEPTÉ  
**Décideurs :** CTO + Architecte Principal  
**Conséquences :** Architecture state simple, pas de dépendance externe au state, pas de middleware (Saga/Thunk), séparation explicite local/global

---

## 1. Contexte

L'application Lumina gère deux types de state :
1. **State local par feature** — formulaires, UI state, loading states
2. **State global** — utilisateur courant, organisation active, permissions

Le projet exclut explicitement Redux, MobX et Zustand (voir DOC-FRONTEND-GUIDE). La question est de déterminer quelle approche vanilla React utiliser.

> **Voir aussi :** ADR-005 (React Native TypeScript stack), ADR-003 (offline-first = state local à synchroniser via WatermelonDB), ADR-006 (multi-tenant = current_org_id dans le state global).

## 2. Questions

Quelle stratégie de state management choisir pour une application React Native ? Pourquoi pas Redux / Zustand / Recoil ?

## 3. Décision

**React Context + useReducer pour le state global, useState local pour le state feature.**

### Architecture State à Deux Niveaux

```typescript
// Niveau 1: AppContext Global (singleton, lecture seule)
const AppContext = createContext<AppState>({
  user: null,
  orgId: null,          // current org, injecté par middleware ADR-006
  permissions: [],      // rôle-based
  isLoading: true,
  language: 'fr',       // i18n locale
});

// Niveau 2: Feature-level useReducer (encapsulé par module)
function financeReducer(state: FinanceState, action: FinanceAction): FinanceState {
  switch (action.type) {
    case 'SET_FILTERS': return { ...state, filters: action.payload };
    case 'ADD_TRANSACTION': return { ...state, transactions: [...state.transactions, action.payload] };
    case 'APPROVE_TRANSACTION': return updateTransactionStatus(state, action.id, 'approved');
    default: return state;
  }
}
```

### Règles d'Architecture

1. **State local feature** → `useState` ou `useReducer` dans le composant/feature
2. **State global partagé** → `AppContext` singleton (user, org, lang, permissions)
3. **Aucun reducer cross-feature** — chaque feature gère son propre state
4. **Data fetching** → géré par React Query (stale-while-revalidate, voir ADR-005)
5. **Server state ≠ Client state** — React Query gère le server state (cache, sync, optimistic updates)
6. **WatermelonDB** — gère la persistance offline (state local persisté automatiquement)

### Exclusifs Implicites

- **Pas de Redux/Redux Toolkit** — boilerplate excessif pour une app MVP, `useReducer` suffit
- **Pas de Zustand** — bien que minimaliste, apporte une dépendance externe non nécessaire
- **Pas de Recoil** — atoms/selction trop verbeux, pas aligné avec patterns React
- **Pas de Saga/Thunk** — React Query gère déjà les side-effects data fetching

## 4. Alternatives Envisagées

### Alternative A : Zustand
- **Avantages :** API la plus minimaliste du marché (~200 bytes), hooks natifs, TypeScript friendly
- **Inconvénients :** Dépendance externe ajoutée, pas besoin réel vu la complexité actuelle de l'app, "premature abstraction"

### Alternative B : Redux Toolkit
- **Avantages :** Écosystème mature, DevTools puissants, patterns éprouvés, middleware (Saga/Thunk)
- **Inconvénients :** Boilerplate significatif (actions, reducers, slices), sur-engineering pour une app où 90% du state est local aux features

### Alternative C : Recoil / Jotai (Atomic State)
- **Avantages :** Granularité fine, selectors dérivés, pas de re-render excessif
- **Inconvénients :** Courbe d'apprentissage, abstraction inutile pour un state global simple, risque de grain trop fin créant de la fragmentation

### Alternative D : Context + useReducer (Choix Retenu)
- **Avantages :** Zéro dépendance, API native React, `useReducer` pour logique action-based, facile à testeur, perf acceptable pour state small (user + org + lang)
- **Inconvénients :** Re-render potentiellement excessif si context refchange souvent → **Mitigation :** state global immuable + split context (authContext vs orgContext) si besoin futur

## 5. Conséquences

### Positives
- ✅ Zéro dépendance state management = bundle plus léger
- ✅ Patterns React natifs = pas de courbe d'apprentissage supplémentaire
- ✅ `useReducer` fournit structure actions/REDUCER quand logic devient complexe
- ✅ React Query gère le server state séparément (cache, sync, optimistic updates)
- ✅ Compatible offline-first (WatermelonDB persiste localement, state sync à restore)

### Négatives (et mitigations)
- ⚠️ Context trigger re-render tous les consumers si non-split → **Mitigation :** Split en plusieurs contexts (authContext, orgContext, uiContext) si problème détecté
- ⚠️ Pas de DevTools Redux → **Mitigation :** React DevTools + RN Debugger suffisent pour MVP
- ⚠️ Si l'app grossit → **Mitigration :** Migration vers Zustand possible sans rewrite (zustand accepte état initialement Context-compatible)

## 6. Références

- PRD Section "State Management"
- DOC-FRONTEND-GUIDE (Section 1 — Stack Technique)
- ADR-003 (WatermelonDB — state offline à synchroniser)
- ADR-006 (Multi-Tenant — current_org_id required in global state)
