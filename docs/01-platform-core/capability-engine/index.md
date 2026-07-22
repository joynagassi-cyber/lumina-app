# Moteur de Capacité — Spécification Complète

**Doc ID:** DOC-PLATFORM-CAPA  
**Version:** 2.0  
**Statut:** VALIDÉ  
**Dépendances:** MANIFEST-ENGINE (DOC-PLATFORM-MANIF)

---

## 1. Vision

Le **Capability Engine** est un registre de toutes les fonctionnalités que le Platform Core peut offrir. C'est la limite de ce qui peut être configuré via le Manifest. Les capabilities sont écrites en code TypeScript — le manifest ne fait que les activer/désactiver.

**Principe fondamental :** Si une demande métier ne correspond à aucune capability existante, on doit pouvoir créer une nouvelle capability sans modifier le Platform Core lui-même.

---

## 2. Responsabilités

| Responsabilité | Description |
|---|---|
| **Capability Registry** | Enregistrer et répertorier toutes les capabilities |
| **Lifecycle Management** | Gérer les états : draft → active → deprecated |
| **Dependency Tracking** | Suivre les dépendances entre capabilities |
| **Feature Gate** | Fournir l'API pour vérifier si une capability est disponible |
| **Plugin Interface** | Définir l'interface pour ajouter de nouvelles capabilities |

---

## 3. Format de Définition de Capability

```yaml
# capabilities/finance.yaml
id: "finance"
name: "Module Financier"
description: "Gestion complète des transactions et rapports financiers"
version: "1.0"
status: "active"

sub_capabilities:
  - id: "ledger"
    name: "Grand Livre"
    description: "Enregistrement et consultation des transactions"
    api_path: "/api/v1/finance/ledger"
    
  - id: "bilan"
    name: "Bilan Financier"
    description: "Génération du bilan (actif, passif, résultat)"
    api_path: "/api/v1/finance/bilan"
    
  - id: "rapport"
    name: "Rapports"
    description: "Rapports financiers exportables (PDF, CSV)"
    api_path: "/api/v1/finance/reports"
    
  - id: "budget"
    name: "Budget"
    description: "Planification et suivi budgétaire"
    status: "deprecated"
    deprecation_note: "Remplacé par module planning dans v3"

dependencies:
  - "vocabulary"
  - "forms"
  - "workflow"

permissions_required:
  - "finance:ledger:read"
  - "finance:ledger:write"
  - "finance:bilan:read"
  - "finance:rapport:read"
```

---

## 4. Capabilities de Base (MVP)

| ID | Nom | Statut | Description |
|---|---|---|---|
| `identity` | Identité Org | Active | Gère l'identité organisationnelle |
| `auth` | Authentification | Active | Login, session, permissions |
| `membership` | Gestion Membres | Active | CRUD membres, dossiers |
| `finance` | Financier | Active | Ledger, Bilan, Rapports |
| `events` | Événements | Active | Calendrier, inscriptions |
| `forms` | Formulaires | Active | Rendu dynamique de formulaires |
| `notifications` | Notifications | Active | Alertes, emails, push |
| `reports` | Rapports | Active | Export PDF/CSV |

---

## 5. API du Moteur

```typescript
interface CapabilityEngine {
  // Requêtage
  listCapabilities(): CapabilityDefinition[];
  getCapability(id: string): CapabilityDefinition | null;
  isCapabilityActive(orgId: string, capId: string): boolean;
  hasDependency(orgId: string, capId: string, depId: string): boolean;
  
  // Plugin Interface
  registerCapability(def: Partial<CapabilityDefinition>): void;
  unregisterCapability(id: string): void;
}

interface CapabilityDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  status: 'draft' | 'active' | 'deprecated';
  sub_capabilities?: SubCapability[];
  dependencies: string[];
  permissions_required: string[];
}
```

---

## 6. Règles d'Or

| Règle | Description |
|---|---|
| **R-01** | Une capability ne peut être désactivée QUE si aucune donnée active ne dépend d'elle. |
| **R-02** | Une capability deprecated doit rester lisible pendant au moins 2 versions majeures. |
| **R-03** | Tout plugin personnalisé DOIT implémenter l'interface CapabilityPlugin. |
| **R-04** | Les dépendances circulaires entre capabilities sont interdites. |

---

## 7. Critères d'Achèvement

- [x] 8 capabilities de base définies
- [x] Interface de plugin documentée
- [x] Système de dépendances avec détection de cycles
- [x] Cycle de vie : draft → active → deprecated
- [x] Règles d'or implémentées
