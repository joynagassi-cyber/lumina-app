# Platform Capabilities — Vue d'ensemble

## 1. Vision

L'ensemble des Platform Capabilities de Lumina est un ensemble de **5 moteurs configurables** qui rendent l'application agnostique par rapport au type d'organisation. Ces moteurs interprètent la configuration du manifeste au lieu d'exécuter uniquement du code écrit à l'avance.

Les Platform Capabilities ne sont pas un langage de programmation. Ce ne sont pas des frameworks complets. C'est un noyau léger de 5 composants qui permet à Lumina de s'adapter à toute organisation sans modification du code.

## 2. Philosophie

> Configuration avant code.
> Composition avant héritage.
> Lisibilité avant ingéniosité.

Si un écran peut être décrit en moins de 50 lignes de React Native + TypeScript, ce n'est pas un moteur.

## 3. Les 5 Moteurs

| Moteur | Responsabilité | Implémentation |
|--------|---------------|----------------|
| Manifest Engine | Lit et valide `manifest.json` | JSON Schema + cache mémoire |
| Vocabulary Engine | Traduit termes techniques → labels | Lookup dans le manifeste |
| Capability Engine | Résout les permissions | Intersection Rôle × Organisation × Ressource |
| Forms Engine | Génère écrans depuis schémas JSON | Générateur React Native dynamique |
| Workflow Engine | Interprète machines à états déclaratives | Machine à états avec guards et actions |

### Ce que les Platform Capabilities ne font PAS

- CRUD classique (développement traditionnel)
- Authentification (JWT existant)
- Sync offline (algorithme complexe, mieux codé explicitement)
- Rendu dashboard (configurable via JSON mais rendu React classique)
- Export CSV/PDF (bibliothèques existantes suffisent)
- Notifications push (backend cloud functions)

## 4. Structure de fichiers

```
src/
├── capabilities/            # ← Platform Capabilities (5 moteurs)
│   ├── manifest/            # Lecture + validation manifest.json
│   ├── vocabulary/          # Traducteur terme → label affiché
│   ├── capability/          # Résolution des permissions
│   ├── forms/               # Générateur d'écrans depuis schémas
│   └── workflow/            # Machine à états interprétée
│
├── features/                # ← Fonctionnalités classiques
│   ├── auth/
│   ├── finance/
│   ├── members/
│   ├── groups/
│   ├── events/
│   └── celebrations/
│
├── shared/                  # ← Utilitaires communs
│   ├── api/                 # Client InsForge REST
│   ├── db/                  # SQLite local (WatermelonDB)
│   ├── sync/                # Logique offline sync
│   ├── storage/             # Stockage photos/reçus
│   └── ui/                  # Composants RN réutilisables
│
└── app/                     # Navigation (Expo Router)
    ├── (auth)/
    ├── (dashboard)/
    ├── (finance)/
    └── ...
```

## 5. Flux Critique — Exemple Concret

Quand le trésorier crée une transaction :

```
1. Forms Engine lit le schéma JSON → génère l'écran "Nouvelle Transaction"
2. Vocabulary Engine traduit "Entrée_financière" → "Transaction"
3. Trésorier remplit le formulaire (montant, catégorie, type)
4. Capability Engine vérifie que treasurer peut faire "finance.create"
5. Données envoyées au backend InsForge (CRUD classique)
6. Workflow Engine active la machine à états → statut passe à "draft"
7. Si montant > seuil → guard déclenche "pending_approval"
8. Pasteur voit la proposition sur son dashboard
9. Si validée → Workflow Engine change le statut → "validated"
```

Seules les étapes 1, 2, 4, 6, 9 passent par les Platform Capabilities. Tout le reste est du code classique.

## 6. Règles d'Architecture

| Règle | Détail |
|-------|--------|
| Un moteur = un dossier | Chaque moteur a son propre espace de noms, tests, documentation |
| Zéro dépendance circulaire | `core/` ne dépend que de bibliothèques standard |
| Tests unitaires obligatoires | Chaque moteur ≥ 80% coverage, testé indépendamment |
| Pas de logique métier dans le Core | Le Core ne sait pas ce qu'est "une dépense" ou "un membre" |
| Interfaces pures | Les 5 moteurs communiquent via interfaces pures, pas de singletons |

## 7. Plan d'Implémentation (12 semaines)

| Semaine | Livrable | Moteurs concernés |
|---------|----------|-------------------|
| 1-2 | Infrastructure React Native + Expo Router + InsForge setup | Aucun |
| 3 | Manifest Engine + schéma JSON validé | Manifest |
| 4 | Vocabulary Engine + intégration au Manifest | Manifest, Vocab |
| 5 | Forms Engine + formulaire transaction | Forms |
| 6 | Capability Engine + système de rôles | Capability |
| 7 | Workflow Engine + machine à états finance | Workflow |
| 8-9 | Features Finance complètes (CRUD, bilan, grand livre) | Crud classique |
| 10 | Features Membres + Groupes | Crud classique |
| 11 | Features Événements + Célébrations | Crud classique |
| 12 | Offline-first sync + Polish UI | Sync classique |
