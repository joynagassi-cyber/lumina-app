# ADR-008 : Documentation Modulaire pour Agents IA

**Date :** 2026-01-15  
**Statut :** ACCEPTÉ  
**Décideurs :** CTO + Architecte Principal  
**Conséquences :** Chaque document < 10 pages, structure en dossiers séparés, références croisées entre docs

---

## 1. Contexte

Le développeur travaille seul avec assistance IA. Les contextes IA ont une fenêtre limitée (~200K tokens). Un document unique de 1000+ lignes dépasse rapidement la capacité de compréhension d'un agent.

L'ancienne documentation (si elle existe) est probablement monolithique et difficile à utiliser efficacement par des agents IA.

## 2. Questions

Comment structurer la documentation technique pour qu'elle soit optimale pour un développeur solo assisté par IA ?

## 3. Décision

**Chaque document technique est un fichier unique de moins de 10 pages (~400 lignes).** La documentation est organisée en dossiers thématiques avec des références croisées.

### Structure de Documentation

```
docs/
├── 01-platform-core/          ← Capacités du Platform
│   ├── index.md               ← Vue d'ensemble (2 pages)
│   ├── manifest-engine/
│   │   └── index.md           ← Spécification complète (8 pages max)
│   ├── workflow-engine/
│   │   └── index.md
│   ├── forms-engine/
│   │   └── index.md
│   ├── vocabulary-engine/
│   │   └── index.md
│   └── capability-engine/
│       └── index.md
│
├── 02-offline-first/          ← Spécification technique offline
│   └── index.md               ← WatermelonDB, sync, conflits
│
├── 03-configuration/          ← Fichiers de configuration
│   ├── manifest-example.yaml  ← Exemple manifest complet
│   └── validation-schema.json ← Schema de validation
│
├── 04-business-rules/         ← Règles métier
│   ├── financial-rules.md     ← Règles comptables
│   └── membership-rules.md    ← Règles membres
│
├── 05-api-contracts/          ← Contrats API
│   ├── swagger.yaml           ← OpenAPI spec
│   └── graphql-schema.graphql ← Schéma GraphQL (si applicable)
│
├── 90-adrs/                   ← Architecture Decision Records
│   ├── ADR-001-*.md
│   ├── ADR-002-*.md
│   └── ...
│
├── 99-supporting/             ← Documents transversaux
│   ├── invariants.md          ← Règles absolues (1 page)
│   ├── neverbreak.md          ← Règles inviolables (2 pages)
│   ├── decision-trees.md      ← Arbres de décision (3 pages)
│   └── glossary.md            ← Glossaire (2 pages)
│
└── legacy-analysis/           ← Analyse du code existant
    ├── flutter-audit.md
    └── feature-mapping.md
```

### Règles de Rédaction

| Règle | Détail |
|---|---|
| **Taille max** | 400 lignes par fichier |
| **ID unique** | Chaque doc a un DOC-ID (ex: DOC-PLATFORM-MANIF) |
| **Dépendances** | Chaque doc liste ses dépendances en haut |
| **Références** | Liens vers les autres docs, pas de copier-coller |
| **Version** | Numéro de version dans le frontmatter |
| **Langue** | Anglais pour les IDs et codes, Français pour les descriptions |

## 4. Alternatives Envisagées

### Alternative A : Document Unique Monolithique
- **Avantages :** Tout est au même endroit, pas de navigation
- **Inconvénients :** Dépasse les contextes IA, impossible à maintenir, consultation lente

### Alternative B : Wiki Complet (Notion/Obsidian)
- **Avantages :** Navigation riche, liens bidirectionnels
- **Inconvénients :** Hors du repo, pas de versioning Git, dépendance à un service tiers

### Alternative C : Documentation Modulaire Markdown (Choix Retenu)
- **Avantages :** Versionning Git, compatible IA, chaque doc autonome, structure prévisible
- **Inconvénients :** Navigation manuelle nécessaire, liens à maintenir

## 5. Conséquences

### Positives
- ✅ Chaque document tient dans un contexte IA standard
- ✅ Structure prévisible = agents IA savent où chercher
- ✅ Mise à jour isolée (changer un moteur ne touche pas les autres docs)
- ✅ Référençable depuis le PRD et les ADRs

### Négatives (et mitigations)
- ⚠️ Navigation manuelle entre docs → **Mitigation :** INDEX.md dans chaque dossier + liens croisés
- ⚠️ Risque de duplication entre docs → **Mitigation :** Invariants et Glossary centralisent les définitions

## 6. Template Standard de Document

Chaque document technique suit ce template :
1. **Titre + Métadonnées** (ID, version, statut, dépendances)
2. **Vision** (1 paragraphe)
3. **Responsabilités** (tableau)
4. **Format/Structure** (exemples de code/config)
5. **Cycle de Vie** (diagramme ASCII)
6. **API** (interfaces TypeScript)
7. **Règles d'Or** (tableau de règles)
8. **Exemples** (2-3 cas concrets)
9. **Critères d'Achèvement** (checklist)

## 7. Références

- PRD Section "Documentation Strategy"
- NEVERBREAK-RULE-08 (Règle : Documentation Modulaire)
