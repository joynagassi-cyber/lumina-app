# Configuration Exemple — Manifest Complet d'Église MFE-JC

**Doc ID:** DOC-CONFIG-MFEJC  
**Version:** 2.0

---

## 1. Manifest Principal

```yaml
# manifests/mfe-jc.yaml
version: "2.0"
organization:
  id: "org-mfejc-001"
  name: "Ministère le Feu de l'Evangile de Jésus-Christ"
  type: "church"
  language: "fr-FR"
  timezone: "Africa/Lubumbashi"
  created_at: "2026-01-01T00:00:00Z"
  logo_url: "/assets/logos/mfejc.png"

settings:
  currency: "USD"
  currency_symbol: "$"
  fiscal_year_start: "01-01"
  require_approval_for_expense: true
  max_auto_approve: 500        # Montant max sans approbation
  large_transaction_threshold: 5000  # Seuil pour approbation double

features:
  finance:
    enabled: true
    sub_features:
      - ledger
      - bilan
      - rapport
      - budget
  members:
    enabled: true
    sub_features:
      - directory
      - attendance
  bible:
    enabled: false  # V2
  sacraments:
    enabled: false  # V2
  events:
    enabled: true
    sub_features:
      - calendar
      - registration
  notifications:
    enabled: true

roles:
  - id: "super_admin"
    name: "Super Administrateur"
    description: "Accès total, gestion multi-org"
    permissions: ["*"]
    parent: null
    
  - id: "admin"
    name: "Administrateur"
    description: "Admin local, gestion complète"
    permissions:
      - "finance:*"
      - "members:*"
      - "events:*"
      - "reports:*"
      - "settings:*"
    parent: "super_admin"
    
  - id: "pastor"
    name: "Pasteur"
    description: "Direction spirituelle, accès lecture finance"
    permissions:
      - "members:directory:read"
      - "members:attendance:write"
      - "events:calendar:read"
      - "events:calendar:write"
      - "finance:bilan:read"
      - "finance:rapport:read"
    parent: "admin"
    
  - id: "treasurer"
    name: "Trésorier"
    description: "Gestion financière complète"
    permissions:
      - "finance:ledger:read"
      - "finance:ledger:write"
      - "finance:bilan:read"
      - "finance:bilan:write"
      - "finance:rapport:read"
      - "finance:rapport:write"
      - "members:directory:read"
    parent: "admin"
    
  - id: "staff"
    name: "Staff"
    description: "Accès limité, lectures seuleme"
    permissions:
      - "members:directory:read"
      - "events:calendar:read"
      - "finance:rapport:read"
    parent: "admin"

departments:
  - id: "direction"
    name: "Direction"
    role: "pastor"
    children: []
    
  - id: "finance_dept"
    name: "Département Financier"
    role: "treasurer"
    children: []
    
  - id: "chorale"
    name: "Chorale"
    role: "staff"
    children: []
    
  - id: "jeunesse"
    name: "Jeunesse"
    role: "staff"
    children: []
    
  - id: "enfants"
    name: "Ministère des Enfants"
    role: "staff"
    children: []

workflow_overrides:
  expense_approval:
    steps:
      - id: "treasurer_check"
        assign_to_role: "treasurer"
        timeout: "3d"
      - id: "pastor_check"
        only_if: "amount > 500"
        assign_to_role: "pastor"
        timeout: "5d"
      - id: "auto_post"
        action: "post_transaction"

forms_overrides: {}
```

---

## 2. Validation Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Transaction Schema",
  "type": "object",
  "required": ["type", "amount", "date", "category"],
  "properties": {
    "type": {
      "type": "string",
      "enum": ["income", "expense", "transfer"]
    },
    "amount": {
      "type": "number",
      "minimum": 0,
      "maximum": 999999999.99
    },
    "date": {
      "type": "string",
      "format": "date"
    },
    "category": {
      "type": "string"
    },
    "description": {
      "type": "string",
      "maxLength": 500
    },
    "status": {
      "type": "string",
      "enum": ["draft", "pending", "approved", "rejected", "archived"],
      "default": "draft"
    }
  }
}
```
