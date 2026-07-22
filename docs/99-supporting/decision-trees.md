# Decision Trees — Arbres de Décision Lumina

**Doc ID:** DOC-DECISION-TREES  
**Version:** 2.0  
**Statut :** VALIDÉ

---

## 1. Arbre : Ajouter une Nouvelle Fonctionnalité

```
Besoin métier identifié
        │
        ▼
  Est-ce un type d'organisation différent ?
   ├─ OUI → Vérifier Manifest Engine (DOC-PLATFORM-MANIF)
   │         Peut-on configurer sans code ?
   │         ├─ OUI → Modifier manifest.yaml → DONE
   │         └─ NON → Voir ci-dessous
   │
   ├─ NON → Est-ce un nouveau workflow ?
   │         ├─ OUI → Vérifier Workflow Engine (DOC-PLATFORM-WORKFLOW)
   │         │         Peut-on définir sans code ?
   │         │         ├─ OUI → Créer workflow YAML → DONE
   │         │         └─ NON → Créer capability native
   │         │
   │         └─ NON → Est-ce un nouveau formulaire ?
   │                   ├─ OUI → Vérifier Forms Engine (DOC-PLATFORM-FORMS)
   │                   │         Peut-on définir sans code ?
   │                   │         ├─ OUI → Créer form YAML → DONE
   │                   │         └─ NON → Étendre Forms Engine
   │                   │
   │                   └─ NON → Est-ce une nouvelle capability ?
   │                             ├─ OUI → Créer capability native
   │                             │         (TypeScript, sous src/modules/)
   │                             │         Enregistrer dans Capability Engine
   │                             └─ NON → Demander nouvelle architecture → ADR
```

## 2. Arbre : Corriger un Bug

```
Bug signalé
        │
        ▼
  Le bug affecte-t-il les données financières ?
   ├─ OUI → INV-001 s'applique ?
   │         ├─ OUI → Ne jamais modifier la transaction
   │         │         Créer transaction compensatoire
   │         │         Journaliser l'erreur (INV-007)
   │         └─ NON → Corriger normalement
   │
   ├─ NON → Le bug est-il lié au sync offline ?
   │         ├─ OUI → Vérifier DOC-OFFLINE-FIRST
   │         │         Vérifier conflit resolution strategy
   │         │         Tester en mode avion
   │         └─ NON → Bug standard
   │                   → Reproduire localement
   │                   → Écrire test unitaire
   │                   → Corriger
   │                   → Vérifier qu'aucun invariant n'est violée
```

## 3. Arbre : Choisir un Type d'Organisation

```
Nouveau client potentiel
        │
        ▼
  Quel est le type d'organisation ?
   ├─ Église
   │   → Utiliser manifest-template-church.yaml
   │   → Features: finance, members, bible, sacraments, events
   │
   ├─ ONG
   │   → Utiliser manifest-template-ngo.yaml
   │   → Features: finance, members, projects, reports
   │
   ├─ École
   │   → Utiliser manifest-template-school.yaml
   │   → Features: finance, members, events, reports
   │
   ├─ Entreprise
   │   → Utiliser manifest-template-company.yaml
   │   → Features: finance, members, hr, projects
   │
   └─ Personnalisé
       → Partir de manifest-template-custom.yaml
       → Configurer manuellement
       → Valider avec Manifest Engine
```

## 4. Arbre : Migration de Données

```
Migration nécessaire
        │
        ▼
  Quelle est la source ?
   ├─ Supabase (PostgreSQL)
   │   → Script de migration dédié
   │   → Transformer schema Flutter → schema RN
   │   → Vérifier intégrité post-migration
   │
   ├─ Excel/CSV
   │   → Import via formulaire dédié
   │   → Validation côté client + serveur
   │
   └─ Autre app
       → Export CSV d'abord
       → Puis import via formulaire
       → Mapping manuel des champs
```

## 5. Arbre : Déploiement

```
Prêt à déployer ?
        │
        ▼
  ✓ Tous les tests passent ?
  ✓ Coverage finance >= 90% ?
  ✓ Aucune violation NeverBreak ?
  ✓ Aucune donnée corrompue en test offline ?
  ✓ Manifest de la target org validé ?
        │
        ├─ NON → Corriger avant déploiement
        └─ OUI → Déployer
              → Monitoring actif 24h
              → Vérifier logs sync
              → Vérifier intégrité données
```
