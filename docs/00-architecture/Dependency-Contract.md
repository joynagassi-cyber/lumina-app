# Dependency Contract — Règles de Dépendances entre Moteurs

**Doc ID:** DOC-DEPENDENCY-CONTRACT  
**Version:** 2.0  
**Statut :** VALIDÉ  
**Vérification :** CI/CD automatique (script `dependency-check`)

---

## 1. Principes

Ce document définit les **dépendances autorisées** et **interdites** entre les composants des Platform Capabilities. Violé ces règles crée des dépendances circulaires, rendant la plateforme instable et impossible à maintenir.

---

## 2. Dépendances Autorisées

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DÉPENDANCES AUTORISÉES                        │
├──────────────────┬──────────────────────────────────────────────────┤
│  Manifest Engine │ → Capability Engine                               │
│                  │ → Vocabulary Engine (lecture seule)               │
│                  │ → Workflow Engine (lecture seule)                 │
│                  │ → Forms Engine (lecture seule)                    │
├──────────────────┼──────────────────────────────────────────────────┤
│  Vocabulary      │ → AUCUN (couches inférieure)                     │
│  Engine          │   (seul moteur en lecture pure)                   │
├──────────────────┼──────────────────────────────────────────────────┤
│  Forms Engine    │ → Vocabulary Engine (labels, enums)              │
│                  │ → Capability Engine (pour afficher/cacher)        │
│                  │ → Manifest Engine (lecture configuration)         │
├──────────────────┼──────────────────────────────────────────────────┤
│  Workflow Engine │ → Capability Engine (pour déclencher)            │
│                  │ → Manifest Engine (lecture configuration)         │
│                  │ → Vocabulary Engine (enums, labels)              │
├──────────────────┼──────────────────────────────────────────────────┤
│  Capability      │ → Manifest Engine (lecture)                      │
│  Engine          │   (sait quelles features sont activées)           │
└──────────────────┴──────────────────────────────────────────────────┘
```

## 3. Dépendances Interdites

```
┌─────────────────────────────────────────────────────────────────────┐
│                         DÉPENDANCES INTERDITES                       │
├──────────────────┬──────────────────────────────────────────────────┤
│  Forms Engine    │ ✗ NE PEUT PAS dépendre de Workflow Engine         │
│                  │   (le formulaire ne doit pas connaître le workflow)│
├──────────────────┼──────────────────────────────────────────────────┤
│  Vocabulary      │ ✗ NE PEUT PAS dépendre d'aucun autre moteur       │
│  Engine          │   (c'est une couche de lecture pure)              │
├──────────────────┼──────────────────────────────────────────────────┤
│  Capability      │ ✗ NE PEUT PAS dépendre de Forms Engine            │
│  Engine          │ ✗ NE PEUT PAS dépendre de Workflow Engine         │
│                  │   (la capability est indépendante)                │
├──────────────────┼──────────────────────────────────────────────────┤
│  Module Métier   │ ✗ NE PEUT PAS dépendre directement de Database   │
│  (Finance, etc.) │   (doit passer par Platform Capabilities)         │
├──────────────────┼──────────────────────────────────────────────────┤
│  UI Layer        │ ✗ NE PEUT PAS dépendre du Manifest Engine         │
│  (React Native)  │   (doit passer par Forms Engine)                  │
└──────────────────┴──────────────────────────────────────────────────┘
```

## 4. Matrice de Dépendances

| De \ Vers | Manifest* | Vocab | Forms | Workflow | Capability |
|---|---|---|---|---|---|
| **Manifest** | — | → | → | → | → |
| **Vocabulary** | — | — | — | — | — |
| **Forms** | *→ | → | — | ✗ | → |
| **Workflow** | *→ | → | ✗ | — | → |
| **Capability** | *→ | — | ✗ | ✗ | — |

**Légende :**
- `→` : Dépendance autorisée (code)
- `*→` : Lecture de configuration runtime (EXCLUE de la détection de cycles, voir §5)
- `✗` : Dépendance interdite
- `—` : Pas de dépendance (moteur indépendant)

## 5. Cas Spécial — Lecture de Configuration vs Dépendance Structurelle

**Règle fondamentale :** Lire les **données** d'un autre moteur (via API, contexte, ou store) n'est PAS une dépendance structurelle. Seuls les **imports de code** (modules, classes, fonctions cross-moteur) comptent pour la détection de cycles.

### Explication

Le Manifest Engine expose une interface `CompiledManifest` (objet JavaScript/TypeScript). Quand Forms Engine fait `manifest.get('forms')` :
- Il ne fait **pas** `import { ManifestEngine } from '../manifest'`
- Il lit des **données de configuration** compilées, pas du code dépendant

C'est le même patron que `React.useContext(AppContext)` — le composant consomme des données, il ne dépend pas structureuellement du provider.

### Distinction pour le script `dependency-check`

```
IMPORT DE CODE = Dépendance structurelle → vérifié contre la matrice
CONSOMMATION DE DONNÉES = Lecture config runtime → EXCLU de la détection

Exemple validé (AUTORISÉ) :
  FormsEngine → manifest.get()    // Données de config → exclu
  WorkflowEngine → manifest.get() // Données de config → exclu
  CapabilityEngine → manifest.get()// Données de config → exclu

Exemple invalidé (INTERDIT) :
  FormsEngine imports ManifestEngine class    // ← Cycle !
  CapabilityEngine imports WorkflowEngine     // ← Cycle !
```

## 6. Cycle de Validation

```
Développement d'une feature
        │
        ▼
  Le nouveau code dépend-il d'un autre moteur ?
   ├─ OUI → Vérifier la matrice ci-dessus
   │         ├─ Autorisé → Continuer
   │         └─ Interdit → Refactorer → Re-vérifier
   └─ NON → Continuer
        │
        ▼
  Le CI/CD exécute dependency-check
        │
        ▼
  Si cycle détecté → BUILD FAIL
```

## 7. Exception

Une exception à ces règles est possible UNIQUEMENT via un ADR (ADR-008) avec approbation du CTO + Architecte Principal.
