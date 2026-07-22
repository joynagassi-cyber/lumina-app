# Moteur de Workflow — Spécification Complète

**Doc ID:** DOC-PLATFORM-WORKFLOW  
**Version:** 2.0  
**Statut:** VALIDÉ  
**Dépendances:** MANIFEST-ENGINE (DOC-PLATFORM-MANIF), FORMS-ENGINE (DOC-PLATFORM-FORMS)

---

## 1. Vision

Le **Workflow Engine** est un moteur d'orchestration léger qui définit des séquences d'actions déclenchées par des événements. Il n'est PAS un BPMN complet — il est conçu pour les flux organisationnels simples : approbations, transitions de statut, notifications, et enchaînements de tâches.

**Principe fondamental :** Si un workflow dépasse 7 étapes ou nécessite une boucle conditionnelle complexe, il doit être implémenté comme capability native, pas en configuration.

---

## 2. Responsabilités

| Responsabilité | Description |
|---|---|
| **Event Triggers** | Déclencher des workflows sur des événements système |
| **State Transitions** | Gérer les changements de statut valides |
| **Approval Chains** | Ordonnancer les approbations hiérarchiques |
| **Notifications** | Envoyer des alerts à des rôles spécifiques |
| **Task Assignment** | Attribuer des tâches aux bons utilisateurs/roles |

---

## 3. Format de Workflow

### 3.1 Structure de Base

```yaml
# workflows/transaction_approval.yaml
id: "transaction_approval"
name: "Approbation de Transaction Financière"
trigger: "finance:transaction:created"
version: "1.0"

steps:
  - id: "validate"
    type: "auto"
    action: "validate_transaction"
    timeout: null
    
  - id: "check_threshold"
    type: "conditional"
    condition: "amount > settings.max_auto_approve"
    
  - id: "treasurer_approve"
    type: "approval"
    assign_to_role: "treasurer"
    require_all: true
    timeout: "7d"
    
  - id: "director_approve"
    type: "approval"
    assign_to_role: "admin"
    require_all: false
    only_if: "amount > settings.large_transaction_threshold"
    timeout: "14d"
    
  - id: "notify_created"
    type: "notification"
    send_to_roles: ["treasurer", "admin"]
    template: "transaction_approved"
    
  - id: "update_status"
    type: "auto"
    action: "set_status"
    value: "approved"

on_timeout:
  treasurer_approve: "escalate_to_admin"
  director_approve: "send_reminder"

on_failure:
  any: "log_error_and_alert"
```

### 3.2 Définition des États Validés

```yaml
# states/transaction_states.yaml
model: "Transaction"
states:
  - id: "draft"
    label: "Brouillon"
    initial: true
    
  - id: "pending_approval"
    label: "En attente d'approbation"
    
  - id: "approved"
    label: "Approuvée"
    final: true
    
  - id: "rejected"
    label: "Rejetée"
    final: true

transitions:
  - from: "draft"
    to: "pending_approval"
    trigger: "submit_for_approval"
    permission: "finance:ledger:write"
    
  - from: "pending_approval"
    to: "approved"
    trigger: "approve"
    permission: "finance:approval:write"
    requires_workflow: "transaction_approval"
    
  - from: "pending_approval"
    to: "rejected"
    trigger: "reject"
    permission: "finance:approval:write"
    
  - from: "pending_approval"
    to: "draft"
    trigger: "request_revision"
    permission: "finance:approval:write"
```

---

## 4. Cycle de Vie d'un Workflow

```
┌──────────────────┐
│  Event Triggered │  ← finance:transaction:created
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Match Workflow  │  ← Find workflow by trigger name
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Execute Step N  │  ← Run current step based on state
│                  │     auto / approval / notification
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Complete?       │  ← Are all steps done?
│   YES ──→ End    │
│   NO  ──→ Next   │
└──────────────────┘
```

---

## 5. API du Moteur

### 5.1 Méthodes Publiques

```typescript
interface WorkflowEngine {
  // Exécution
  trigger(event: string, payload: any): Promise<void>;
  executeStep(workflowId: string, stepId: string, result: any): Promise<void>;
  cancelWorkflow(workflowId: string, reason: string): Promise<void>;
  
  // Requêtage
  getWorkflowInstances(orgId: string, model?: string, status?: string): Promise<WorkflowInstance[]>;
  getStepStatus(instanceId: string, stepId: string): Promise<StepStatus>;
  getPendingApprovals(userId: string): Promise<PendingApproval[]>;
  
  // Administration
  registerWorkflow(orgId: string, workflowDef: WorkflowDefinition): Promise<void>;
  updateWorkflow(orgId: string, workflowId: string, newDef: Partial<WorkflowDefinition>): Promise<void>;
  listWorkflows(orgId: string): Promise<WorkflowDefinition[]>;
}
```

### 5.2 Types de Données

```typescript
interface WorkflowInstance {
  id: string;
  orgId: string;
  workflowId: string;
  triggerEvent: string;
  payload: Record<string, any>;
  currentStepIndex: number;
  totalSteps: number;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: Date;
  completedAt?: Date;
  metadata: Record<string, any>;
}

interface StepStatus {
  stepId: string;
  type: 'auto' | 'approval' | 'notification' | 'conditional';
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  assignedTo?: string[];
  timeout?: string;
  result?: any;
  errors?: string[];
}
```

---

## 6. Types d'Étapes Supportés

| Type | Description | Exemple |
|---|---|---|
| `auto` | Exécution automatique sans intervention | Validation de données |
| `approval` | Attente d'approbation d'un rôle | Approbation trésorier |
| `notification` | Envoi d'un message/email | Notification admin |
| `conditional` | Évaluation de conditions | IF amount > threshold |
| `delay` | Attendre avant d'exécuter la suite | Timeout 24h |
| `parallel` | Exécution simultanée de sous-steps | Notifications concurrentes |

---

## 7. Règles d'Or

| Règle | Description |
|---|---|
| **R-01** | Un workflow ne peut jamais modifier directement les données financières. Il ne fait qu'orchestrer les approbations. |
| **R-02** | Chaque étape doit avoir un timeout max de 30 jours. Au-delà, escalation obligatoire. |
| **R-03** | Les approvals en chaîne ne peuvent pas dépasser 5 niveaux hiérarchiques. |
| **R-04** | Un workflow échoué peut être relancé manuellement mais pas automatiquement. |
| **R-05** | Tous les états d'exécution sont journalisés (audit trail). |

---

## 8. Exemples de Workflows

### 8.1 Approbation de Dépense

```yaml
id: "expense_approval"
trigger: "finance:expense:submitted"
steps:
  - type: "auto"
    action: "validate_receipt"
  - type: "approval"
    assign_to_role: "department_head"
    timeout: "3d"
  - type: "conditional"
    condition: "amount > 5000"
  - type: "approval"
    assign_to_role: "admin"
    only_if: "condition_met"
    timeout: "5d"
  - type: "auto"
    action: "process_payment"
```

### 8.2 Admission de Membre

```yaml
id: "member_admission"
trigger: "members:application:submitted"
steps:
  - type: "notification"
    send_to_roles: ["admin"]
  - type: "approval"
    assign_to_role: "pastor"
    timeout: "14d"
  - type: "auto"
    action: "create_member_record"
  - type: "notification"
    send_to_roles: ["applicant"]
    template: "welcome_email"
```

---

## 9. Critères d'Achèvement

- [x] 6 types d'étapes supportés (auto, approval, notification, conditional, delay, parallel)
- [x] Gestion des timeouts et escalades
- [x] Audit trail complet de chaque exécution
- [x] API TypeScript complète
- [x] Exemples pour 2 cas d'usage courants
- [x] Règles d'or documentées
