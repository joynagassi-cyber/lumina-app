# Lumina v2 — Gap Analysis Documentation

**Doc ID:** DOC-GAP-ANALYSIS  
**Version:** 2.0

---

## 1. Ce Qui Existe (28 documents)

### Architecture & Gouvernance (6)
| Doc | Statut | Qualité |
|---|---|---|
| Architecture-Map.md | ✅ Fait | Très clair, schéma global |
| Dependency-Contract.md | ✅ Fait | Matrice autorisations interdites |
| AI-Collaboration-Protocol.md | ✅ Fait | 4 phases obligatoires |
| Definition-of-Done.md | ✅ Fait | 15 critères objectifs |
| Traceability-Matrix.md | ✅ Fait | PRD→ADR→Engine→Test |
| Documentation-Discipline.md | ✅ Fait | Règle PR sans doc = rejet |

### Platform Capabilities (6)
| Doc | Statut | Qualité |
|---|---|---|
| index.md (overview) | ✅ Fait | 90 lignes |
| Manifest Engine | ✅ Fait | 259 lignes |
| Workflow Engine | ✅ Fait | 241 lignes |
| Forms Engine | ✅ Fait | 325 lignes |
| Vocabulary Engine | ✅ Fait | 179 lignes |
| Capability Engine | ✅ Fait | 137 lignes |

### Offline-First & Config (3)
| Doc | Statut | Qualité |
|---|---|---|
| Offline-First Spec | ✅ Fait | 95 lignes, WatermelonDB + Sync |
| MFE-JC Manifest Example | ✅ Fait | 174 lignes, YAML complet |

### Business Rules & API (3)
| Doc | Statut | Qualité |
|---|---|---|
| Financial Rules | ✅ Fait | 43 lignes |
| Membership Rules | ✅ Fait | 24 lignes |
| API Contracts | ✅ Fait | 145 lignes |

### ADRs (10)
| Doc | Statut | Qualité |
|---|---|---|
| ADR-001 à ADR-010 | ✅ Tous faits | 54-125 lignes chacun |

### Supporting (4+1)
| Doc | Statut | Qualité |
|---|---|---|
| Invariants (10 règles) | ✅ Fait | 79 lignes |
| NeverBreak Rules (10 rules) | ✅ Fait | 110 lignes |
| Decision Trees | ✅ Fait | 132 lignes |
| Glossary | ✅ Fait | 87 lignes |
| INDEX | ✅ Fait + mis à jour | 99 lignes |

### Top Level (2)
| Doc | Statut | Qualité |
|---|---|---|
| PRD v2 | ✅ Réduit à 11 lignes (+ refs) | OK |
| Roadmap | ✅ Fait | 346 lignes |

---

## 2. Ce Qui MANQUE (Spécifications Avant Code)

### CRITIQUE — Empêche le développement si absent

| # | Document Manquant | Impact | Estimation |
|---|---|---|---|
| **M1** | **Database Schema / Data Model** | Aucun schéma SQL, aucune table définie. Impossible de créer les modèles WatermelonDB ou les tables PostgreSQL | 200-300 Lignes |
| **M2** | **Testing Strategy** | DoD mentionne TST-Finance etc. mais aucun doc de stratégie de test. Quelle couverture ? Quels frameworks ? Comment tester l'offline ? | 200-300 Lignes |
| **M3** | **Development Setup Guide** | Comment un agent IA commence-t-il ? `npm init` ? `npx expo init` ? Variables d'environnement ? Structure des dossiers du code source ? | 150-200 Lignes |

### IMPORTANT — Ralentit le développement mais pas bloquant

| # | Document Manquant | Impact | Estimation |
|---|---|---|---|
| **I1** | **UI Component Catalog** | Forms Engine dit "maps to React Native" mais aucun catalogue de composants réutilisables avec leurs props | 200-300 Lignes |
| **I2** | **Error Handling & Status Codes** | APIContracts mentionne APIError mais aucun standard d'erreurs détaillé, map erreurs→UI messages | 100-150 Lignes |
| **I3** | **Security Model** | Pas de doc sur auth flows, token refresh, RLS policies détaillées, input validation | 200-300 Lignes |
| **I4** | **Performance Benchmarks** | SLA: chargement écran < 200ms, sync < 3s. Aucun doc mesurant ces KPIs | 100-150 Lignes |
| **I5** | **State Management Strategy** | React Navigation? Zustand? Redux? Aucune décision prise sur la gestion d'état global | 100-150 Lignes |

### UTILE — Peut être créé pendant le développement

| # | Document Manquant | Impact | Estimation |
|---|---|---|---|
| **U1** | **CI/CD Pipeline Spec** | GitHub Actions, linting, tests auto, déploiement preview | 100-150 Lignes |
| **U2** | **Deployment Guide** | Expo EAS, InsForge production config, domain, SSL | 150-200 Lignes |
| **U3** | **Migration Plan** | Migration depuis l'app Flutter existante (si besoin) | 100-150 Lignes |
| **U4** | **Design System Tokens** | Couleurs, typographies, espacements, shadows, border radius | 100-150 Lignes |

---

## 3. Détails Importants à Prendre en Compte

### 3.1 Le Manifest manque de validateur concret
Le Forms Engine spécifie `validate(data, schema)` mais il n'y a aucun fichier de validation implémentable. Il faut créer un fichier `manifest-validator.ts` qui lit un manifest et vérifie sa cohérence.

### 3.2 L'Offline-First n'a pas de plan de reprise après crash
Si l'app crash pendant un sync, comment retrouver l'état ? Les transactions en attente sont-elles perdues ? Ce n'est pas couvert dans `docs/02-offline-first/index.md`.

### 3.3 Les workflows d'approbation n'ont pas de timeout mechanism
Le Manifest Example définit `timeout: "3d"` pour les étapes mais il n'y a aucune spec sur ce qui se passe quand le timeout expire (escalade ? notification automatique ? passage forcé ?).

### 3.4 La sécurité des tokens est sous-spécifiée
ADR-009 dit "admin only auth" mais ne détaille pas :
- Stockage du token (AsyncStorage sécurisé ? react-native-keychain ?)
- Refresh token flow
- Session timeout
- Protection contre les attaques CSRF/XSS dans WebView

### 3.5 Le rapport Bilan n'a pas de spec de calcul
Business Rules dit "Bilan doit s'équilibrer" mais pas de spec sur ALGEBRE DE CALCUL :
- Comment les accounts sont calculés ?
- Comment le P&L est agrégé ?
- Comment les devises multiples sont gérées ?

---

## 4. Priorité de Création

```
Phase 0 (ABSORU — avant toute ligne de code):
├── M1: Database Schema (30 min)
├── M2: Testing Strategy (20 min)
└── M3: Development Setup (20 min)

Phase 1 (avant UI Coding):
├── I1: UI Component Catalog (30 min)
├── I3: Security Model (30 min)
└── I5: State Management Strategy (15 min)

Phase 2 (pendant coding):
├── I2: Error Handling
├── I4: Performance Benchmarks
└── U1-U4: CI/CD, Deployment, Migration, Design
```
