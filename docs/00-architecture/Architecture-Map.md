# Architecture Map — Vue d'Ensemble Lumina v2

**Doc ID:** DOC-ARCHITECTURE-MAP  
**Version:** 2.1  
**Statut :** VALIDÉ  
**Dépendances :** PRD_LUMINA_v2.md (Section 2), tous les specs moteurs

> ⚠️ **En cas de désaccord sur le sens des dépendances, `Dependency-Contract.md` fait foi.**  
> La notation `A ──→ B` signifie "A dépend de B" (= A lit depuis B, A importe B au niveau code).

---

## 1. Vision Globale

Lumina v2 est une **plateforme modulaire** où chaque moteur (Manifest, Workflow, Forms, Vocabulary, Capability) est une roue indépendamment opérationnelle mais qui tourne ensemble. Aucun moteur ne peut fonctionner seul — c'est leur combinaison qui rend la plateforme agnostique.

```
                    ┌─────────────────────────────┐
                    │      Organization User       │
                    │   (Leader, Trésorier, etc.)  │
                    └──────────┬──────────────────┘
                               │
                               ▼
                    ┌─────────────────────────────┐
                    │     Presentation Layer       │
                    │   React Native Components    │
                    │   (Formulaires, Tables,etc.) │
                    └──────────┬──────────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          ▼                    ▼                    ▼
   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
   │  Forms Engine│   │Workflow Eng.|   │Vocab Engine  │
   │ (renders UI) │   │ (orches seq)│   │ (vocab list) │
   └──────┬───────┘   └──────┬──────┘   └──────┬───────┘
          │                  │                  │
          └──────────────────┼──────────────────┘
                             ▼
                    ┌─────────────────────────────┐
                    │      Platform Capabilities    │
                    │   (Manifest + Capability)    │
                    └──────────┬──────────────────┘
                               │
                               ▼
                    ┌─────────────────────────────┐
                    │       Data Layer             │
                    │  WatermelonDB → InsForge    │
                    └─────────────────────────────┘
```

## 2. Les 5 Moteurs

| Moteur | Responsabilité Unique | En Entrée | En Sortie |
|---|---|---|---|
| **Manifest** | Définir *qui* l'org est | Fichier YAML/JSON | Configuration runtime |
| **Vocabulary** | Fournir *quoi* l'org dit | Dictionnaire terms | Enums, labels, i18n keys |
| **Forms** | Construire *comment* on saisit | Définition JSON | Composants React Native |
| **Workflow** | Orchestrer *quand* et *par qui* | Séquence d'étapes | Events, notifications |
| **Capability** | Activer/désactiver *quoi* | Features manifest | Modules activables |

## 3. Dépendances Autorisées

```
Manifest ──→ Tous les autres (c'est le chef d'orchestre)
Forms ──→ Vocabulary (labels, enums)
Workflow ──→ Vocabulary (enums)
Forms ──→ Capability (pour afficher/cacher)
Workflow ──→ Capability (pour déclencher)
Capability ──→ Manifest (lecture configuration — exclu des cycles, voir Dependency-Contract §5)
```

## 4. Flux de Données Principal

```
Manifest → Capability engine → Active "finance"
  → Forms engine → Charge "transaction-form.yaml"
  → Vocab engine → Charge "categories-financial.yaml"
  → Workflow engine → Active "approval-workflow.yaml"
  
User remplit formulaire → Données locales (WatermelonDB)
  → Sync async → Server (InsForge)
  → Validation serveur → Conflits si nécessaire
  → Réplication → Autres appareils
```

## 5. Points d'Entrée pour un Agent IA

| Si tu veux... | Commence par... |
|---|---|
| Ajouter un type d'org | Manifest Engine + Capability Engine |
| Créer un formulaire | Forms Engine + Vocab Engine |
| Définir un workflow | Workflow Engine + Manifest Engine |
| Ajouter un vocabulaire | Vocab Engine (seul) |
| Activer une feature | Capability Engine + Manifest Engine |
