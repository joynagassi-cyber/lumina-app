# Canonical Architecture Model — Lumina v2

**Doc ID:** DOC-000 (FONDAMENTAL)  
**Version:** 1.0  
**Statut:** SOURCE DE VÉRITÉ ABSOLUE  
**Date:** 2026-07-24  

**RÈGLE PRIMORDIALE:** Tout nouveau document, toute nouvelle table SQL, toute nouvelle Capability, tout nouveau Runtime Service, toute nouvelle API doit démontrer sa place dans cette hiérarchie. Si un élément ne peut pas être tracé jusqu'à un niveau de cette hiérarchie, il ne doit pas exister.

Ce document surpasse tous les autres documents y compris le PRD et les ADRs en cas de contradiction.

---

## HIÉRARCHIE OFFICIELLE

```
Vision                          ← Pourquoi la plateforme existe
  ↓
Architecture Principles         ← Comment elle est structurée
  ↓
Conceptual Model                ← Ce qui EST (sources de vérité)
  ↓
Foundation                      ← Services fondamentaux indispensables
  ↓
Platform Capabilities           ← Ce que la plateforme sait faire
  ↓
Runtime Services                ← Comment la plateforme orchestre
  ↓
Business Packs                  ← Compositions métier des Capacities
  ↓
Templates                       ← Configuration prédéfinie réutilisable
  ↓
Organization Manifest           ← Instance configurée par org
  ↓
Domain Model                    ← Instanciation concrète des concepts
  ↓
Data Model                      ← Stockage uniquement
  ↓
API                             ← Contrats d'interface externe
  ↓
UI                            ← Interfaces utilisateur
```

---

## PRINCIPES DE LA HIÉRARCHIE

### Règle 1: Flux unidirectionnel
Une couche peut REFERENCES les couches en dessous. Elle ne REFERENCES JAMAIS les couches au-dessus.

### Règle 2: Un seul propriétaire par responsabilité
Chaque responsabilité appartient à UNE ET UNE SEULE couche.

### Règle 3: Aucune invention en bas
Aucune couche inférieure ne peut INVENTER un concept. Elle ne fait que l'instancier, le stocker ou l'exposer.

### Règle 4: Les couches inférieures sont interchangeables
Le Data Model peut changer de technologie (PostgreSQL → Drizzle → Prisma). Le Runtime peut changer (Node.js → Deno → Bun). Le Conceptual Model ne change PAS.

### Règle 5: Le Conceptual Model est la source de vérité absolue
Tout ce qui n'est pas dans le Conceptual Model n'existe PAS architecturalement.

---

## DÉFINITION CHAQUE NIVEAU

### 1. Vision
Pourquoi Lumina existe. Pas de détails techniques. Pas de fonctionnalités. Juste l'intention fondamentale.
- **Contenu:** "Plateforme universelle d'organisation"
- **Ne contient pas:** technologies, features, dates, roadmap

### 2. Architecture Principles
Règles non-négociables de structure. Invariants architecturaux.
- **Contenu:** Constitution, Invariants, NeverBreak Rules
- **Ne contient pas:** implémentations, choix technologiques

### 3. Conceptual Model
Tous les concepts universels, their responsibilities, invariants, contre-exemples.
- **Contenu:** 17+ concepts définis dans CONCEPTUAL-MODEL-V1.md
- **Ne contient pas:** tables, écrans, API, technologies, code

### 4. Foundation
Services fondamentaux universellement nécessaires, indépendants du domaine.
- **Contenu:** Identity, Security, Permissions, Storage, Configuration, Localization, Logging, Offline, Audit
- **Ne contient pas:** logique métier, formulaires spécifiques, vocabulaire

### 5. Platform Capabilities
Briques composables, universelles, stables, testables, réutilisables.
- **Contenu:** cataloguées dans PLATFORM-CAPABILITY-CATALOG.md
- **Ne contient pas:** fonctionnalités métier (finance, members...)

### 6. Runtime Services
Couche d'orchestration minimale. Ne crée rien. Ne possède rien. Exécute.
- **Contenu:** manifest loader, dependency resolver, capability orchestrator, context manager
- **Ne contient pas:** logique métier, règles de validation métier, formulaires

### 7. Business Packs
Compositions de Capacities pour un domaine spécifique. Church Pack, School Pack...
- **Contenu:** agrégation de Capacities + Templates
- **Ne contient pas:** nouvelles Capacities

### 8. Templates
Configuration pure réutilisable. Zéro code.
- **Contenu:** vocabularies pré-remplis, forms templates, workflow templates, policies, branding presets
- **Ne contient pas:** code, logic, exécution

### 9. Organization Manifest
Instance compilée d'un Template pour une Organisation donnée.
- **Contenu:** YAML/JSON spécifique à une org
- **Ne contient pas:** définition de capacité

### 10. Domain Model
Objets manipulés concrètement dans un contexte donné.
- **Contenu:** ChurchMember (extends Person), BaptismEvent (extends Event), TithingTransaction (extends Transaction)...
- **Ne contient pas:** nouveaux concepts (uniquement des instanciations)

### 11. Data Model
Tables, index, contraintes, optimisations. Stockage uniquement.
- **Contenu:** PostgreSQL schema, WatermelonDB models
- **Ne contient pas:** concepts, capabilities, logique

### 12. API
Contrats d'interface externe. Entrées/Sorties.
- **Contenu:** REST endpoints, event contracts
- **Ne contient pas:** implémentation

### 13. UI
Interfaces utilisateur. Écrans, composants.
- **Contenu:** React Native screens, navigation
- **Ne contient pas:** concepts, stockage, logique métier

---

## RÈGLES DE CONTRÔLE PAR NIVEAU

Chaque niveau a un garde-fou:

| Niveau | Garde-fou | Violation type |
|--------|----------|----------------|
| Architecture | Constitution | Introduire du domaine dans le Core |
| Conceptual Model | Aucun concept technique | Ajouter SQL dans un concept |
| Foundation | Indépendant du domaine | Connaître "église", "école", etc. |
| Platform Capabilities | Atomes composable | Résoudre >1 problème |
| Runtime Services | Orchestration seulement | Décider quoi exécuter |
| Business Packs | Composition seulement | Créer de nouvelles capacités |
| Templates | Configuration pure | Code exécutable |
| Manifest | Instance uniquement | Nouveau concept |
| Domain Model | Instanciation uniquement | Inventer un concept |
| Data Model | Stockage uniquement | Définir un concept |
| API | Contrat uniquement | Implémentation |
| UI | Consommation uniquement | Nouvelles responsabilités |
