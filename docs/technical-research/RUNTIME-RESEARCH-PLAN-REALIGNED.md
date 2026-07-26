# Runtime Research Plan — Réaligné

**Doc ID:** DOC-RUNTIME-PLAN  
**Version:** 2.0  
**Statut:** RÉALIGNÉ  
**Date:** 2026-07-24  
**Principe guide:** Le Runtime n'est PAS le centre du système. C'est un orchestrateur d'exécution.

---

## 1. Positionnement du Runtime

Le Runtime est la 5ème couche de la hiérarchie officielle:

```
Conceptual Model      ← Ce qui existe
Architecture          ← Comment c'est structuré
Foundation            ← Services fondamentaux
Platform Capabilities ← Ce que la plateforme sait faire
Runtime               ← Ce que la plateforme FAIT avec ses capacités
Domain Model          ← Instanciation concrète
Data Model            ← Stockage
Applications          → Ce que l'utilisateur voit
```

Le Runtime NE DÉCIDE de rien. Il n'INVENTE rien. Il NE MODIFIE rien.
Il lit la configuration, résout les dépendances, compose les composants, active les Business Packs et orchestre l'exécution.

**Question de contrôle:** cette responsabilité existerait-elle si le Runtime était remplacé par une autre technologie? Si OUI → ce n'est pas une responsabilité du Runtime.

---

## 2. Responsabilités Officielles du Runtime

### 2.1 Chargement des Manifests

Lire, parser et valider les fichiers manifest YAML/JSON pour chaque Organization.
Compiler en configuration runtime vérifiable.
Mettre en cache la configuration compilée.

**Ce n'est PAS:** définir des concepts, stocker des données, modifier le schéma SQL.

**Dépendance:** Manifest Capability (lecture seule à runtime).

### 2.2 Résolution des Dépendances

Déterminer l'ordre d'initialisation des Capacities selon les dépendances déclarées dans les manifestes.
Vérifier l'absence de cycles (DAG strict).

**Ce n'est PAS:** créer de nouvelles Capacities, définir des concepts.

**Dépendance:** Dependency Contract (DOC-DEPENDENCY-CONTRACT).

### 2.3 Orchestration des Capacities

Appeler les méthodes publiques de chaque Capacité dans l'ordre correct.
Passer les configurations compilées aux Capacities.
Gérer les événements entre Capacities via un busTypedEventBus léger.

**Ce n'est PAS:** implémenter la logique métier des Capacities.

### 2.4 Activation des Business Packs

Lier un Template à une Organization lors du setup.
Injecter les paramètres configurables.
Valider que le Template ne modifie pas le comportement du Core.

**Ce n'est PAS:** créer de nouveaux Templates ou Modifier les Capacities existantes.

### 2.5 Composition des Applications

Assembler les modules UI exposées par les Capacities.
Respecter la navigation définie dans le manifest.
Appliquer les permissions et feature flags.

**Ce n'est PAS:** définir des écrans, créer de nouveaux formulaires.

### 2.6 Gestion du Contexte Runtime

Maintenir le contexte actif: Organization courante, User courant, Langue courante, Accent color, Fuseau horaire.
Injecter le context dans les Capacities pendant l'exécution.

**Ce n'est PAS:** stocker des données persistantes.

### 2.7 Coordination de l'Ordre d'Initialisation

Démarrer la Foundation en premier.
Initialiser les Capacities après la Foundation.
Démarrer le Domain Model après les Capacities.
Exécuter le Data Model en dernier.

---

## 3. Ce qui SORT du Runtime

Toutes les responsabilités suivantes ont été identifiées à tort dans le Runtime et doivent être déplacées:

| Élément Actuel | Correct | Pourquoi |
|---------------|---------|----------|
| Manifest Engine = "interprète la config" | Capability: manifest | La Capacité définit QUOI. Le Runtime déclenche COMMENT. |
| Vocabulary Engine = "résout les labels" | Capability: vocabulary | Idem — le catalogue EST une Capacité. |
| Forms Engine = "génère les écrans" | Capability: forms | Le Forms Engine EST l'orchestration Runtime de la Capacité Forms. |
| Workflow Engine = "exécute les workflows" | Capability: workflow | Le Workflow est une Capacité. L'Engine est le mécanisme Runtime. |
| Capability Engine = "liste les features" | Capability: capability-registry | C'est un registry, donc une Capacité de registry. |
| "Finance module" | → Resource + Workflow + Policy + Audit | Feature métier décomposée en Capacities atomiques. |
| "Member module" | → Identity + Resource + Relationship | Feature métier décomposée. |
| "Event module" | → Resource + Activity + Notification | Feature métier décomposée. |
| Branding presets (ChurchOrange, SchoolTeal...) | Capability: branding + Template | Configuration visuelle, pas code Runtime. |
| Feature toggles | Capability: manifest + Policy | Flag dans manifest, évalué par Policy. |

---

## 4. Ce qui RESTE dans le Runtime (CORRECT)

| Élément | Justification |
|---------|--------------|
| Manifest loading & compilation | Responsabilité orchestration |
| Dependency resolution (DAG check) | Responsabilité orchestration |
| Context propagation (orgId, userId, locale) | Responsabilité orchestration |
| Capability activation order | Responsabilité orchestration |
| TypedEventBus inter-capacities | Responsabilité orchestration |
| Business Pack linker | Responsabilité orchestration |
| App composition hook | Responsabilité orchestration |
| Hot-swap engine (activate/deactivate) | Responsabilité orchestration |
| Offline sync trigger coordinator | Responsabilité orchestration |

**Note critique:** Ces 9 éléments sont TOUS des mécanismes d'orchestration. Aucun ne définit un concept, aucune ne manipule de la donnée métier, aucune ne définit un écran.

---

## 5. Plan de Migration Runtime

### Phase 1: Séparer Capacité vs Moteur (Jour 1-2)

Chaque spec moteur existant (`manifest-engine/index.md`, `vocabulary-engine/index.md`...) devient DEUX docs:
1. `platform-capabilities/manifest.md` — LA Capacité (concept, responsabilité, entrée/sortie)
2. `runtime/services/manifest-executor.md` — Le SERVICE Runtime (comment la Capacité est exécutée)

### Phase 2: Remplacer Capability Engine (Jour 3)

Section §4 de `capability-engine/index.md` — remplacer la liste features par le catalogue officiel de Capacities (voir Architecture Alignment Report corrigé).

### Phase 3: Créer Runtime Service Specs (Jour 4-5)

Créer `docs/runtime-service/specs/` avec les 9 servicesRuntime restants.
Chaque spec décrit UNE responsabilité d'orchestration uniquement.

### Phase 4: Nettoyer les références croisées (Jour 6)

Scanner tous les docs pour:
- "moteur finance" → "Capability finance + Runtime execution"
- "module membre" → "Capabilities Identity, Resource, Relationship + Runtime composition"
- "gestion X" → decomposé en Capacities

---

## 6. Règles Runtime Strictes

1. **Un Runtime Service ne peut jamais modifier la définition d'une Capacité.**
2. **Un Runtime Service ne peut jamais inventer un nouveau concept.**
3. **Un Runtime Service ne peut jamais décider QUEL Business Pack charger — seulement charger CELUI qui est configuré.**
4. **Un Runtime Service ne peut JAMAIS connaître de termes métier spécifiques (dîme, baptême, classe, département).**
5. **Si un Runtime Service est modifié pour supporter un nouveau cas d'usage, cette modification doit être refusée et le cas doit passer par un Template ou un Business Pack.**
