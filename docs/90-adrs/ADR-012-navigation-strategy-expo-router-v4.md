# ADR-012 : Navigation Strategy — Expo Router v4

**Date :** 2026-07-22  
**Statut :** ACCEPTÉ  
**Décideurs :** CTO + Architecte Principal  
**Conséquences :** Architecture de routing basée sur le système de fichiers, profondeurs de navigation gérées par Expo, deep linking natif

---

## 1. Contexte

L'application nécessite une navigation multi-niveaux : auth → tabs principaux → écrans détaillés par feature. Le projet utilise Expo comme framework React Native managed. Une stratégie de navigation doit être décidée avant toute implémentation d'écran.

> **Voir aussi :** ADR-005 (Expo stack), ADR-011 (Design System — chaque écran doit suivre les règles visuelles), DOC-FRONTEND-GUIDE (structure navigation/).

## 2. Questions

Quel framework de navigation choisir pour une application Expo ? Quelle approche (file-system routes vs programmation) ?

## 3. Décision

**Expo Router v4 avec système de fichiers (FileSystem Routes).**

### Structure de Routing

```
navigation/
├── _layout.tsx           # Root layout (tab bar, headers globaux)
├── _index.tsx            # Redirect logic (auth check → route correcte)
├── auth/
│   ├── _layout.tsx       # Stack auth (login → forgot password → onboarding)
│   ├── login.tsx         # /auth/login
│   └── forgot-password.tsx # /auth/forgot-password
├── main/
│   ├── _layout.tsx       # Tab layout (5 tabs + FAB central)
│   ├── index.tsx         # /main/dashboard (home)
│   ├── finance/
│   │   ├── index.tsx     # /main/finance (ledger)
│   │   └── rapport.tsx   # /main/finance/rapport
│   ├── members/
│   │   ├── index.tsx     # /main/members
│   │   └── detail/[id].tsx # /main/members/:id
│   ├── settings/         # /main/settings
│   └── groups/           # /main/groups
└── feature/
    └── [deep-link].tsx   # Deep links universels
```

### Règles de Navigation

1. **Convention par fichiers** — chaque fichier `.tsx` dans `navigation/` devient une route
2. **Dynamic routes** — `[id].tsx` pour paramètres URL (`/main/members/:id`)
3. **Layouts imbriqués** — `_layout.tsx` dans chaque sous-dossier définit navigation stack
4. **Guards centraux** — `AuthGuard` appliqué dans `_index.tsx`, pas dans chaque écran
5. **Deep linking activé** — pattern `/feature/nom?param=valeur`

### Exclusion Explicitée

**Pas de react-navigation直接使用.** Expo Router v4 est un wrapper sur react-navigation qui fournit :
- Convention de fichiers (moins de boilerplate config)
- Deep linking automatique (configuré dans app.json)
- Pré-rendering Server-Side compatible avec InsForge
- Type-safety via TypeScript paths

## 4. Alternatives Envisagées

### Alternative A : react-navigation pur (programmatically)
- **Avantages :** Contrôle granulaire sur chaque transition, communauté plus large
- **Inconvénients :** Config manuelle de chaque route, boilerplate important, pas de convention de fichiers, déprécié par l'équipe Expo au profit du Router v4

### Alternative B : Navigator (React Navigation v7 native-style)
- **Avantages :** API moderne, bonnes animations par défaut
- **Inconvénients :** Nécessite une migration Expo SDK vers bare workflow (ou expo-dev-client), perdu l'avantage du managed workflow, non-aligné avec la roadmap Expo

### Alternative C : Expo Router v4 (Choix Retenu)
- **Avantages :** Convention de fichiers, deep linking natif, SSr compatible, léger boilerplate, recommandé officiellement par Expo, type-safe TS
- **Inconvénients :** Moins de contrôle fin sur certaines transitions (mitigable avec reanimated)

## 5. Conséquences

### Positives
- ✅ Convention de fichiers = développement d'écrans plus rapide
- ✅ Deep linking configuré une fois, fonctionne partout
- ✅ Compatible SSR si besoin de pré-rendering côté InsForge
- ✅ Type-safety intégrée (params typed automatiquement)
- ✅ Aligné avec la direction officielle Expo

### Négatives (et mitigations)
- ⚠️ Contrôle limité sur certaines animations de transition → **Mitigation :** reanimated remplace les transitions par défaut (ADR-005)
- ⚠️ Debugging deep linking plus complexe en dev → **Mitigation :** `expo-router` fournit un debug overlay en développement

## 6. Références

- PRD Section "Navigation"
- DOC-FRONTEND-GUIDE (Section 5 — Navigation Rules)
- ADR-005 (Expo managed workflow)
- ADR-011 (Design System — chaque écran navigue dans le thème sombre)
