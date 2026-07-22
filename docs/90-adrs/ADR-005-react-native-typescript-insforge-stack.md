# ADR-005 : Stack Technique — React Native + TypeScript + InsForge

**Date :** 2026-01-15  
**Mise à jour :** 2026-07-22 (correction contradiction UI Library + références croisées explicites)  
**Statut :** ACCEPTÉ  
**Décideurs :** CTO + Architecte Principal  
**Conséquences :** Écosystème JavaScript/TypeScript unifié, apprentissage RN requis, écosystème web pour le recrutement, thème personnalisable par org via ADR-011

---

## 1. Contexte

L'application existante est en **Flutter/Dart** avec backend **Supabase**. La réécriture vise une stack plus maintenable, scalable, et alignée avec les compétences de l'équipe (développeur + IA).

> **Voir aussi :** ADR-002 (pourquoi réécrire vs migrer Flutter), ADR-003 (choix WatermelonDB pour offline-first), ADR-006 (multi-tenant data isolation), ADR-011 (Design System — toile sombre #121212, accent configurable par org).

## 2. Questions

Quelle stack technique choisir pour la réécriture complète de Lumina ?

## 3. Décision

```
┌─────────────────────────────────────────────┐
│              LUMINA TECH STACK               │
├─────────────────────────────────────────────┤
│ Frontend     │ React Native + TypeScript    │
│              │ Expo (managed workflow)       │
│ Offline DB   │ WatermelonDB (SQLite wrapper) │
│ Backend      │ InsForge                      │
│ Database     │ PostgreSQL                    │
│ Auth         │ JWT + Session                 │
│ Deployment   │ Expo EAS (mobile)             │
│              │ Vercel (API/InsForge si besoin)│
│ State Mgmt   │ React Context + useReducer    │
│ UI Library   │ react-native-reanimated       │
│              │ + react-native-gesture-handler│
│ Theme        │ Dark Canvas + Accent par org  │
│ Forms        │ @rjsf/core (JSON Schema → RN) │
│ Charts       │ react-native-chart-kit        │
│ Icons        │ lucide-react-native           │
│ i18n         │ expo-localization + custom ctx│
│ Offline Net. │ NetInfo + React Query stale   │
└─────────────────────────────────────────────┘
```

**Justifications :**
- **React Native** : Écosystème plus large que Flutter, recrutement plus facile, réutilisation de composants web
- **TypeScript** : Typage statique essentiel pour maintenir une architecture complexe
- **Expo** : Workflow managed = moins de config native, mises à jour OTA facilitées
- **InsForge** : Backend unifié, génération automatique d'API, intégration auth/data
- **reanimated + gesture-handler** : Animations 60fps thread worklet, gestures complexes (swipe drag, pan), bien mieux qu'une UI library pré-fabriquée pour un design system custom "Dark Canvas" avec accent configurable par org

## 4. Alternatives Envisagées

### Alternative A : Flutter + Supabase (Stack Actuelle)
- **Avantages :** Stack existante, code déjà partiellement fonctionnel
- **Inconvénients :** Dette technique accumulée, architecture orientée "église", écosystème plus petit, migration obligatoire quand même

### Alternative B : React Native + Firebase
- **Avantages :** Sync offline intégré (Firestore), auth facile, bon scaling
- **Inconvénients :** Vendor lock-in Google, pas de SQL natif (relations complexes difficiles), bilans financiers mal servis par NoSQL

### Alternative C : React Native + InsForge + PostgreSQL (Choix Retenu)
- **Avantages :** SQL natif pour requêtes financières complexes, relations bien modélisées, agnosticisme fournisseur, TypeScript end-to-end
- **Inconvénients :** Sync offline nécessite WatermelonDB config supplémentaire, plus de work backend initial

### Alternative D : React Native Paper / NativeBase (UI Libraries)
- **Avantages :** Composants prêts à l'emploi, moins de code boilerplate
- **Inconvénients :** Thème par défaut clair (incompatible avec le canvas #121212 fixe de ADR-011), limitations animations personnalisées, impossible d atteindre le niveau de fidélité demandé, couleurs imposées par la library au détriment du design system

## 5. Conséquences

### Positives
- ✅ TypeScript end-to-end = moins de bugs type
- ✅ PostgreSQL = requêtes financières complexes directes
- ✅ Expo EAS = build simplifié, distribution OTA et store
- ✅ reanimated = animations performantes au niveau natif (60fps)
- ✅ Écosystème npm = packages matures pour tout

### Négatives (et mitigations)
- ⚠️ Transition Flutter → RN pour le développeur → **Mitigation :** Le développeur connaît déjà les concepts cross-platform
- ⚠️ WatermelonDB sync à configurer → **Mitigation :** Spécification détaillée dans DOC-OFFLINE-FIRST (voir ADR-003)
- ⚠️ Pas de UI library pré-fabriquée → **Mitigation :** Design System défini dans ADR-011 fournit composants custom conformes

## 6. Références

- PRD Section "Technologies"
- ADR-002 (Réécriture RN — pourquoi on recommence de zéro)
- ADR-003 (WatermelonDB — pourquoi WatermelonDB et pas autre chose)
- ADR-006 (Multi-Tenant — dépendance isolée org_id, RLS PostgreSQL)
- ADR-011 (Design System — toile sombre #121212, accent configurable par org)
