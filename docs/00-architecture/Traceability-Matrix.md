# Traceability Matrix — Matrice de Traçabilité Lumina v2

**Doc ID:** DOC-TRACEABILITY-MATRIX  
**Version:** 2.0  
**Statut :** VALIDÉ

---

## 1. Principes

Cette matrice relie **chaque besoin métier** (PRD) à sa **décision archi** (ADR), son **implémentation** (Engine/API), et ses **tests**. Elle garantit qu'aucun besoin n'est oublié, aucun code sans test, aucun test sans besoin.

## 2. Méthodologie de Liaison

Chaque élément a un **ID unique** :

| Type | Format | Exemple |
|---|---|---|
| PRD Feature | PRD-N | PRD-001, PRD-002... |
| ADR | ADR-N | ADR-001, ADR-002... |
| Engine Spec | ENG-N | ENG-Manifest, ENG-Workflow... |
| API Endpoint | API-N | API-001 (/api/v1/...) |
| Test Suite | TST-N | TST-Finance, TST-Auth... |
| Doc | DOC-ID | DOC-PLATFORM-MANIF... |

## 3. Matrice Fonctionnelle MVP

### Niveau K1 — Critique

| Feature | ADR | Engines | API | Tests | Docs |
|---|---|---|---|---|---|
| **PRD-01 Auth Admin** | ADR-009, ADR-005 | Capability, Manifest | API-001 | TST-Auth | DOC-PLATFORM-CAPABILITY |
| **PRD-02 Config Org** | ADR-001 | Manifest, Vocab | API-002 | TST-Config | DOC-PLATFORM-MANIF |
| **PRD-03 Grand Livre** | ADR-004, ADR-006 | Forms, Workflow, Vocab | API-003 | TST-Finance | DOC-PLATFORM-FORMS, DOC-BUSINESS-RULES-FINANCE |
| **PRD-04 Bilan Financier** | ADR-010 | Workflow, Capability | API-004 | TST-Finance | DOC-PLATFORM-WORKFLOW |
| **PRD-05 Rapports PDF/CSV** | ADR-007 | Forms, Capability | API-005 | TST-Export | DOC-PLATFORM-FORMS |

### Niveau K2 — Important

| Feature | ADR | Engines | API | Tests | Docs |
|---|---|---|---|---|---|
| **PRD-06 Gestion Membres** | ADR-006 | Forms, Vocab, Manifest | API-006 | TST-Members | DOC-PLATFORM-FORMS, DOC-BUSINESS-RULES-MEMBERS |
| **PRD-07 Calendrier Évts** | ADR-007 | Workflow, Forms | API-007 | TST-Events | DOC-PLATFORM-WORKFLOW |
| **PRD-08 Rôles/Perms** | ADR-001 | Manifest, Capability | API-008 | TST-Roles | DOC-PLATFORM-MANIF, DOC-PLATFORM-CAPABILITY |

### Niveau K3 — Souhaitable

| Feature | ADR | Engines | API | Tests | Docs |
|---|---|---|---|---|---|
| **PRD-09 Notifications** | ADR-007 | Workflow, Forms | API-009 | TST-Notifications | DOC-PLATFORM-WORKFLOW |
| **PRD-10 Export/Import** | ADR-007 | Forms, Capability | API-010 | TST-Import | DOC-PLATFORM-FORMS |

## 4. Matrice Technique

| Composant | Impliqué dans ADRs | Testé par | Dépend de |
|---|---|---|---|
| WatermelonDB | ADR-003 | TST-Sync | Offline-First spec |
| InsForge API | ADR-005, ADR-006 | TST-API | Multi-tenant isolation |
| Manifest Validation | ADR-001 | TST-Manifest | DOC-PLATFORM-MANIF |
| Forms Rendering | ADR-007 | TST-Forms | DOC-PLATFORM-FORMS |
| Workflow Execution | ADR-004 | TST-Workflow | DOC-PLATFORM-WORKFLOW |
| Financial Immutability | ADR-004 | TST-Finance | INV-001, DOC-BUSINESS-RULES-FINANCE |

## 5. Utilisation pour Évolution

```
Besoin utilisateur évolue → PRD-N concerné
    │
    ▼
  Identifier l'ADR impacté → ADR-M-N
    │
    ▼
  Identifier les Engines concernés → engines list
    │
    ▼
  Identifier les APIs impactées → API list
    │
    ▼
  Identifier les tests à modifier → TST list
    │
    ▼
  Identifier les docs à mettre à jour → DOC list
    │
    ▼
  Vérifier NeverBreak Rules concernées → NB list
    │
    ▼
  Planifier la modification avec estimation
```

Exemple concret :
```
Évolution : "Ajouter approbation triple pour transactions > 10000"
→ PRD-03 (Grand Livre)
→ ADR-004 (Financial Immutability) + ADR-007 (MVP Scope)
→ Workflow Engine (étapes d'approbation)
→ API-003 (transaction endpoint)
→ TST-Finance (nouveau cas test)
→ DOC-PLATFORM-WORKFLOW + DOC-BUSINESS-RULES-FINANCE
→ NEVERBREAK-RULE-03 (intégrité financière)
```
