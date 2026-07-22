# Dependency Contract — Règles de Dépendances entre Moteurs

**Doc ID:** DOC-DEPENDENCY-CONTRACT  
**Version:** 2.0  
**Statut :** VALIDÉ  
**Vérification :** CI/CD automatique (script `dependency-check`)

---

## 1. Principes

Ce document définit les **dépendances autorisées** et **interdites** entre les composants du Platform Core. Violé ces règles crée des dépendances circulaires, rendant la plateforme instable et impossible à maintenir.

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
│  (Finance, etc.) │   (doit passer par Platform Core)                 │
├──────────────────┼──────────────────────────────────────────────────┤
│  UI Layer        │ ✗ NE PEUT PAS dépendre du Manifest Engine         │
│  (React Native)  │   (doit passer par Forms Engine)                  │
└──────────────────┴──────────────────────────────────────────────────┘
```

## 4. Matrice de Dépendances

| De \ Vers | Manifest | Vocab | Forms | Workflow | Capability |
|---|---|---|---|---|---|
| **Manifest** | — | → | → | → | → |
| **Vocabulary** | — | — | — | — | — |
| **Forms** | → | → | — | ✗ | → |
| **Workflow** | → | → | ✗ | — | → |
| **Capability** | → | — | ✗ | ✗ | — |

**Légende :**
- `→` : Dépendance autorisée
- `✗` : Dépendance interdite
- `—` : Pas de dépendance (moteur indépendant)

## 5. Cycle de Validation

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

## 6. Exception

Une exception à ces règles est possible UNIQUEMENT via un ADR (ADR-008) avec approbation du CTO + Architecte Principal.
