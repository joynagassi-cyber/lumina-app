# ADR-010 : Priorité Absolue au Module Financier

**Date :** 2026-01-15  
**Statut :** ACCEPTÉ — PRIORITÉ K1  
**Décideurs :** CTO + Product Owner + Responsable Audit  
**Conséquences :** Finance développé en premier, toutes les autres fonctionnalités en dépendent indirectement

---

## 1. Contexte

L'analyse du code existant et des besoins métier a révélé que le **module financier** est la raison principale d'exister de Lumina. Sans un système financier fiable, les autres fonctionnalités (membres, bible, événements) perdent leur valeur.

L'utilisateur a confirmé à plusieurs reprises :
- "Bilan et Rapport sont très importants"
- "La Bible vient après Sacrement, Bilan et Rapport"
- "Je ne veux pas de membres en premier"

## 2. Questions

Quelle fonctionnalité doit être développée en premier et recevoir la plus grande attention architecturale ?

## 3. Décision

Le **Module Financier** est la priorité absolue (K1). Il comprend :

### Composants du Module Financier K1

| Composant | Priorité | Description |
|---|---|---|
| **Grand Livre (Ledger)** | K1 | Enregistrement de toutes les transactions (revenus, dépenses, transferts) |
| **Bilan Financier** | K1 | Vue synthétique : Actif, Passif, Résultat |
| **Rapports Exportables** | K1 | PDF et CSV des données financières |
| **Validation des Transactions** | K1 | Workflow d'approbation (draft → pending → approved) |
| **Immuabilité Comptable** | K1 | Transactions validées = écrites dans le marbre |
| **Audit Trail** | K1 | Qui a fait quoi, quand, et pourquoi |

### Dépendances du Module Financier

```
Finance K1 dépend de :
├── Platform Capabilities (Manifest Engine)
├── Platform Capabilities (Vocabulary Engine)
├── Platform Capabilities (Workflow Engine)
├── Platform Capabilities (Forms Engine)
├── Offline-First (WatermelonDB)
├── Multi-Tenant Isolation
└── Financial Immutability Rule
```

### Fonctionnalités en Second Plan

| Fonctionnalité | Priorité | Pourquoi après Finance |
|---|---|---|
| Membres | K2 | Nécessaire mais pas critique pour le MVP |
| Événements | K2 | Utile mais pas urgent |
| Bible | K3 | Demande explicite de l'utilisateur pour V2 |
| Sacrements | K3 | Spécifique église, non-agnostique |
| Budget | K3 | Avancé, pas dans MVP |

## 4. Alternatives Envisagées

### Alternative A : Finance en Premier (Choix Retenu)
- **Avantages :** Valeur métier immédiate, différenciateur fort, aligné avec les besoins utilisateurs
- **Inconvénients :** L'application semble "incomplète" sans gestion des membres

### Alternative B : Membres en Premier
- **Avantages :** Fonctionnalité visible et familière
- **Inconvénients :** Pas de différenciation (100 apps gèrent les membres), ne répond pas au besoin principal

### Alternative C : Toutes en Parallèle
- **Avantages :** Application "complète" dès le départ
- **Inconvénients :** Qualité médiocre partout, livraison retardée de 6+ mois, risque d'abandon

## 5. Conséquences

### Positives
- ✅ Valeur métier immédiate et mesurable
- ✅ Différenciateur fort vs autres apps organisationnelles
- ✅ Aligné avec les besoins explicites de l'utilisateur
- ✅ Base solide pour ajouter les autres modules ensuite

### Négatives (et mitigations)
- ⚠️ L'application semble "tronquée" sans gestion des membres → **Mitigation :** Dashboard affiche "Module Membres disponible en V2"
- ⚠️ Les utilisateurs attendent la Bible → **Mitigation :** Roadmap communiquée clairement

## 6. Métriques de Succès Finance K1

| Métrique | Objectif |
|---|---|
| Transactions/jour supportées | 100+ sans latence |
| Bilan généré en | < 3 secondes |
| Rapport PDF exporté en | < 5 secondes |
| Données perdues en offline | 0 (zéro) |
| Bugs critiques sur finance | 0 après 30 jours |

## 7. Références

- PRD Section "MVP Scope"
- INV-001 (Invariant : Immutabilité Comptable)
- NEVERBREAK-RULE-03 (Règle : Intégrité Financière)
- ADR-004 (Financial Immutability)
- ADR-007 (MVP 10 Features)
