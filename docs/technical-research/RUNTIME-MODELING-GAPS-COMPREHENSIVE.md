# Analyse Complète — Éléments à Modéliser en Runtime Déclaratif

> **Date:** 2026-07-24  
> **Objectif:** Identifier TOUT ce qui doit être configuré/déclaratif dans Lumina avant d'écrire une seule ligne de code pour l'architecture + les scripts SQL + les diagrammes de base de données  
> **Sources:** PRD + Architecture Map + 16 ADRs + Database Schema + Org Graph Spec + Business Rules (finance, members) + Invariants + NeverBreak Rules + Capability/Forms/Workflow/Vocab/Manifest specs + RBAC research + Design research

---

## Méthodologie

Pour CHAQUE aspect du système:

1. Ce qui était **hardcodé** dans l'ancienne approche (Flutter/code classique)
2. Ce qui **DOIT devenir declaratif/runtime** via les 5 moteurs
3. Quel moteur gère l'aspect runtime
4. Le GAP identifié entre le spec actuel et la réalité declarative

---

## A. ÉLÉMENTS FINANCIERS (Cœur Critique — K1)

### A.1 Catégories Financières — Tree de Hiérarchie

**Ce qui existe actuellement:**
```sql
CREATE TABLE categories (
    parent_category_id UUID REFERENCES categories(id),
    category_type TEXT CHECK (IN ('income', 'expense', 'asset', 'liability', 'equity')),
    is_immutable BOOLEAN DEFAULT false
);
```

**Ce qui manque (hardcodé):**
- Aucune configuration manifest décrivant ARBRE des catégories (ex: income → tithes, offerings, donations)
- Pas de mapping `category_key → report_group` (comment regrouper "dîmes" et "offrandes" dans le bilan)
- Pas de régles de couleurs par catégorie dans YAML
- Pas de `reports_as` tag pour l'agrégation du bilan

**Ce qu'il faut déclarer dans manifest:**
```yaml
finance:
  categories:
    income:
      - key: "tithes"
        label: "Dîmes"
        color: "#4CAF50"
        reports_as: "main_income"
      - key: "offerings"
        label: "Offrandes"
        color: "#FF9800"
        reports_as: "main_income"
      - key: "donations"
        label: "Dons"
        color: "#81C784"
        reports_as: "other_income"
    expense:
      - key: "ministry"
        label: "Dépenses ministérielles"
        color: "#F44336"
        reports_as: "ministry"
  # Chaque catégorie → comment elle apparaît dans le rapport bilan
```

**Moteur:** Vocabulary Engine + Manifest Engine

---

### A.2 Règles Métier Financières (BR-FIN-001 à BR-FIN-033)

Tout doit venir du manifest. C'est la SEULE façon d'éviter que chaque règle soit hardcodée dans le code.

```yaml
finance:
  business_rules:
    recording:
      - id: "BR-FIN-001"
        description: "Type obligatoire (income/expense/transfer)"
        type: "required_field"
        field: "type"
        valid_values: ["income", "expense", "transfer"]
      
      - id: "BR-FIN-002"
        description: "Montant strictement positif (> 0)"
        type: "validation"
        field: "amount"
        min: 0
        exclusive_min: true
      
      - id: "BR-FIN-003"
        description: "Date pas dans futur"
        type: "validation"
        field: "date"
        max_value: "today"
        default: "today"
      
      - id: "BR-FIN-004"
        description: "Catégorie obligatoire, doit exister dans vocabulaire"
        type: "enum_validation"
        field: "category"
        source: "vocab:finance/categories"
      
      - id: "BR-FIN-005"
        description: "Description min 1 caractère si montant > 100"
        type: "conditional_required"
        field: "description"
        condition: "amount > 100"
    
    approval:
      - id: "BR-FIN-010"
        description: "Transaction < max_auto_approve → auto-approbée"
        type: "auto_approve"
        threshold: "settings.max_auto_approve"
      
      - id: "BR-FIN-011"
        description: "Transaction >= seuil_large → double approbation"
        type: "dual_approval"
        threshold: "settings.large_transaction_threshold"
        requires_roles: ["treasurer", "admin"]
      
      - id: "BR-FIN-012"
        description: "Rejet → retour en draft"
        type: "state_transition"
        from: "pending_approval"
        to: "draft"
        trigger: "rejected"
      
      - id: "BR-FIN-013"
        description: "Approbation nécessite commentaire"
        type: "required_comment"
        on_action: "approve"
    
    reporting:
      - id: "BR-FIN-020"
        description: "Bilan doit s'équilibrer (Actif = Passif + Résultat)"
        type: "balance_check"
        formula: "assets == liabilities + equity + net_result"
      
      - id: "BR-FIN-021"
        description: "Rapport mensuel: 1er au dernier du mois"
        type: "period_constraint"
        default: "month_start_to_end"
      
      - id: "BR-FIN-022"
        description: "Export PDF avec horodatage + signature numérique"
        type: "export_requirements"
        pdf_metadata: ["timestamp", "digital_signature", "org_logo"]
      
      - id: "BR-FIN-023"
        description: "Rapport archivé non modifiable"
        type: "read_only_guard"
        on_status: "archived"
        actions: ["update", "delete"]
    
    audit:
      - id: "BR-FIN-030"
        description: "Toute modification logguée avec old_value et new_value"
        type: "audit_log"
        log_fields: ["old_value", "new_value", "actor", "timestamp"]
      
      - id: "BR-FIN-031"
        description: "Logs conservés minimum 7 ans"
        type: "retention_policy"
        years: 7
        immutable: true
      
      - id: "BR-FIN-032"
        description: "Impossible d'effacer un log d'audit"
        type: "immutable_guard"
        allowed_actions: ["read"]
      
      - id: "BR-FIN-033"
        description: "Accès aux logs restreint admins et auditeurs"
        type: "permission_guard"
        required_permissions: ["finance:audit:read"]
```

**Moteurs:** Forms Engine (validation rules), Workflow Engine (approval rules), Capability Engine (audit rules)

---

### A.3 Règles de Consolidation Financière (Multi-Niveaux)

Déjà couvert dans ADR-017 (`finance.consolidation_rules`). Le gap principal restant: définir la stratégie de merge pour les catégories lors de la consolidation.

```yaml
finance:
  consolidation_rules:
    merged_categories:
      default: "by_key"  # regroup per category key across all scopes
      custom_mappings:
        main_income:
          sources: ["tithes", "offerings"]
        other_income:
          sources: ["donations", "fundraising", "membership_fees"]
```

---

### A.4 Templates de Rapports

```yaml
finance:
  report_types:
    - id: "bilan"
      label: "Bilan Financier"
      sections:
        - title: "Actifs"
          categories: ["cash", "bank_accounts", "receivables", "fixed_assets"]
        - title: "Passifs"
          categories: ["payables", "loans", "provisions"]
        - title: "Capitaux Propres"
          categories: ["capital", "retained_earnings"]
        - title: "Résultat"
          formula: "total_income - total_expense"
      export_formats: ["pdf", "csv"]
      permissions_required: ["finance:bilan:read"]
    
    - id: "rapport_mensuel"
      label: "Rapport Mensuel"
      sections:
        - title: "Revenus du mois"
          time_range: "month"
        - title: "Dépenses du mois"
          time_range: "month"
        - title: "Variation vs mois précédent"
          comparison: "previous_month"
      export_formats: ["pdf", "csv"]
    
    - id: "rapport_annuel"
      label: "Rapport Annuel"
      sections:
        - title: "Résumé annuel"
          time_range: "year"
        - title: "Tendance mensuelle"
          chart_type: "bar"
          data_source: "monthly_totals"
      export_formats: ["pdf", "csv", "excel"]
```

---

## B. AUTHENTIFICATION & SÉCURITÉ

### B.1 Paramètres Auth Configuration

```yaml
auth:
  enabled_methods: ["email_password"]
  session_duration_days: 30
  session_buffer_minutes: 5
  password_min_length: 8
  password_complexity:
    require_uppercase: true
    require_number: true
    require_special: false
  max_login_attempts: 5
  lockout_duration_minutes: 15
  enable_password_reset: true
  invite_only: true  # MVP: no self-registration
```

**Ce qui est actuellement hardcodé:** session_duration (30 jours), buffer JWT (5 minutes), invite_only (toujours true en MVP). Tous doivent être dans le manifest pour permettre changements sans déploiement.

---

### B.2 Sécurité Configuration

```yaml
security:
  token_rotation:
    algorithm: "HS256"
    refresh_enabled: true
  
  encryption:
    secure_store: "expo-secure-store"
  
  tls_pinning:
    enabled: false  # MVP skip, V2+ enable
  
  obfuscation:
    proguard_enabled: true  # Android release
```

---

## C. ORGANISATION GRAPHE (DAG)

### C.1 Status Lifecycle Configuration

```yaml
organization:
  status_transitions:
    active:
      can_transition_to: ["pending", "archived"]
      requires_approval_from: ["superadmin"]
    pending:
      can_transition_to: ["active", "archived"]
      requires_approval_from: []
    archived:
      can_transition_to: ["active"]
      requires_approval_from: ["superadmin"]
    deleted:
      can_transition_to: []  # terminal state
    merged:
      can_transition_to: []  # terminal state
```

**Gap majeur:** Actuellement硬code les transitions de status. Un admin ne peut PAS changer la politique de lifecycle.

---

### C.2 Héritage Configuratif

Déjà dans ADR-014 mais hardcodé comme boolean flags:

```yaml
organization:
  inheritance:
    vocabulary:
      inherit: true
      override_strategy: "local_priority"
    forms:
      inherit: true
      override_strategy: "local_priority"
    workflows:
      inherit: true
      override_strategy: "local_priority"
    theme:
      inherit: true
      override_strategy: "org_override"
```

---

### C.3 Unit Types Configuration

```yaml
organization:
  unit_types:
    - type: "ministry"
      requires_leader: true
      allows_sub_units: true
      icon: "church"
      financial_scope_allowed: true
    - type: "department"
      requires_budget: true
      allows_sub_units: true
      icon: "business"
      financial_scope_allowed: true
    - type: "committee"
      requires_approval: false
      allows_sub_units: false
      icon: "groups"
      financial_scope_allowed: false
    - type: "sub_group"
      requires_leader: false
      allows_sub_units: false
      icon: "people"
      financial_scope_allowed: true
```

**Gap majeur:** Les types d'unités sont définis dans le code TS. Impossible d'ajouter "music_team" ou "prayer_warriors" sans modifier TypeScript.

---

### C.4 Merge Policy

```yaml
organization:
  merge_policy:
    preserve_history: true  # toujours garder historique
    financial_aggregation: "sum_all_descendants"
    member_transfer: "preserve_all_memberships"
    notify_impacted_users: true
    notification_message: "template:org_merged"
```

---

## D. FORMULAIRES DYNAMIQUES

### D.1 Template Onboarding Wizard

```yaml
onboarding:
  steps:
    - id: "org_type"
      label: "Type d'organisation"
      form_template: "org_type_selector"
      required: true
      options_source: "manifest:organization.type_options"
      next_steps: ["color_picker", "info_entry", "feature_toggles", "review"]
    
    - id: "color_picker"
      label: "Couleur d'identité"
      form_template: "color_picker"
      required: true
      presets: ["org_presets"]  # resolve from manifest
      custom_hex_allowed: true
      validate_contrast: true  # WCAG AA large text min 3:1
    
    - id: "info_entry"
      label: "Informations"
      form_template: "org_info_form"
      required: true
      fields: ["name", "country", "timezone", "language", "currency"]
    
    - id: "feature_toggles"
      label: "Modules"
      form_template: "feature_selection"
      required: false
      allow_skip: true
      template_based_selection: true  # show only features from selected org type
      pre_selected_by_type: true  # finance=meme, members=pre-selected
    
    - id: "review"
      label: "Récapitulatif"
      form_template: "manifest_preview"
      required: true
      preview_type: "yaml"
      editable: true
```

**Gap CRITIQUE:** L'onboarding est l'écran principal de l'app. S'il est dur, l'utilisateur ne PERSONNALISE RIEN. Chaque org arrive avec le même flux. C'est la pire violation du principe Manifest > Code Dur.

---

### D.2 Custom Forms par Feature

Chaque feature K1/K2/K3 doit avoir son form template:

```yaml
forms_templates:
  transaction_creation:
    form_id: "finance_transaction_form"
    required_fields: ["type", "amount", "category", "date"]
    optional_fields: ["description", "receipt_attached"]
    conditional_fields:
      - field: "approver_notes"
        visible_if:
          condition: "status eq 'pending_approval'"
  
  member_admission:
    form_id: "member_admission_form"
    required_fields: ["first_name", "last_name", "date_of_birth"]
    optional_fields: ["email", "phone", "gender", "photo"]
  
  org_configuration:
    form_id: "org_setup_form"
    wizard_style: true
    steps_reference: "onboarding.steps"
  
  role_configuration:
    form_id: "role_config_form"
    accessible_to: ["admin", "superadmin"]
    fields: ["name", "permissions[]", "parent_role"]
```

---

## E. WORKFLOWS COMPLÉMENTS

### E.1 Workflows Organisationnels (pas financiers)

```yaml
workflow_overrides:
  org_create_child:
    id: "org_create_child"
    trigger: "org:create_child_request"
    steps:
      - type: "approval"
        assign_to_role: "superadmin"
        timeout: "7d"
      - type: "auto"
        action: "create_organization"
        data: { inherits_from_parent: true }
      - type: "notification"
        send_to_roles: ["admin"]
        template: "child_org_created"
  
  org_merge:
    id: "org_merge"
    trigger: "org:merge_request"
    steps:
      - type: "approval"
        assign_to_role: "superadmin"
        timeout: "14d"
      - type: "parallel"
        steps:
          - type: "auto"
            action: "transfer_members"
          - type: "auto"
            action: "aggregate_finances"
          - type: "auto"
            action: "archive_source_org"
      - type: "notification"
        send_to_roles: ["admin", "treasurer"]
        template: "org_merged_notification"
  
  member_delete_soft:
    id: "member_delete_soft"
    trigger: "members:delete_request"
    steps:
      - type: "approval"
        assign_to_role: "admin"
        timeout: "3d"
      - type: "auto"
        action: "set_member_status"
        value: "archived"
      - type: "notification"
        send_to_roles: ["admin"]
        template: "member_archived"
```

---

## F. NOTIFICATIONS SYSTEM CONFIG

```yaml
notifications:
  channels:
    - type: "push"
      enabled: true
      provider: "expo-notifications"
    - type: "in_app"
      enabled: true
      badge_counter: true
    - type: "email"
      enabled: false  # MVP disabled, V2+ configurable
  
  templates:
    transaction_approved:
      push_title: "Transaction approuvée"
      push_body: "{{transaction_type}} de {{amount}} {{currency}} — {{category}}"
      in_app_title: "Transaction approuvée"
      in_app_body: "La transaction {{id}} a été approuvée par {{approver}}"
    
    new_transaction_pending:
      push_title: "Nouvelle transaction en attente"
      push_body: "Transaction de {{amount}} {{currency}} attend votre approbation"
  
  rate_limiting:
    max_per_hour: 10
    quiet_hours:
      enabled: true
      start: "22:00"
      end: "06:00"
  
  user_preferences:
    default_opt_in: true
    can_disable_push: true
    can_disable_in_app: false  # in_app always on for leaders
```

---

## G. EXPORT / IMPORT SYSTEM

```yaml
data_management:
  export:
    formats:
      - type: "pdf"
        template: "financial_report.pdf.hbs"
        available_report_types: ["bilan", "rapport_mensuel", "rapport_annuel"]
        include_header: true
        include_org_logo: true
        include_transaction_list: true
        include_category_breakdown: true
        include_trend_chart: true
      
      - type: "csv"
        delimiter: ";"
        date_format: "YYYY-MM-DD"
        number_format: "locale"
        available_model_types: ["transactions", "members", "categories"]
        include_headers: true
      
      - type: "json"
        available_model_types: ["transactions", "members", "manifest"]
        pretty_print: true
  
  import:
    sources:
      - type: "csv"
        supported_models: ["members", "transactions"]
        validation:
          required_columns_check: true
          type_validation: true
          duplicate_detection: true
        conflict_strategy: "skip_existing"  # or "overwrite" or "merge"
        column_mappings:
          members:
            first_name: ["prenom", "firstname", "First Name"]
            last_name: ["nom", "lastname", "Last Name"]
            email: ["email", "mail"]
            phone: ["telephone", "phone", "Tel"]
          transactions:
            amount: ["montant", "amount", "Sum"]
            date: ["date", "Date"]
            description: ["description", "Libellé", "Description"]
```

---

## H. I18N / MULTI-LANGUE

```yaml
i18n:
  supported_languages:
    - code: "fr"
      label: "Français"
      default: true
    - code: "en"
      label: "English"
      default: false
  
  formatting:
    date: "DD/MM/YYYY"
    time: "HH:mm"
    currency:
      symbol_before: false  # "1 000 USD" not "USD 1 000"
      decimal_separator: ","
      thousands_separator: " "
    number:
      decimal_separator: ","
      thousands_separator: " "
  
  error_messages:
    authentication_failed: "Email ou mot de passe incorrect"
    network_error: "Pas de connexion réseau"
    validation_error: "Veuillez vérifier les champs soulignés"
    sync_conflict: "Conflit de synchronisation détecté"
    permission_denied: "Vous n'avez pas les permissions nécessaires"
  
  ui_labels:
    auto_translate_from_vocab: true  # use Vocabulary Engine for labels
```

---

## I. PERFORMANCE / PERCEPTION UX

```yaml
performance:
  skeleton_loading:
    enabled: true
    shimmer_accent_color: "accent@10%"
    shimmer_animation_speed_ms: 1500
  
  optimistic_updates:
    enabled: true
    confirm_timeout_ms: 5000  # rollback if server doesn't respond
    success_feedback: "checkmark_animation"
    failure_feedback: "toast_error"
  
  animations:
    duration_default_ms: 200
    max_duration_ms: 300
    enable_count_up: true  # numbers animate from 0 to target
    count_up_speed_ms: 300
  
  accessibility:
    os_font_scale_respect: true
    reduce_motion_option: false  # disabled: animations always subtle
    high_contrast_boost: true
    colorblind_support:
      enabled: true
      financial_shapes: ["↑", "↓", "◆", "●", "■"]
```

---

## RÉSUMÉ FINAL DES 23 GAPS DÉTECTÉS

### Avant de coder UNE LIGNE, il faut modéliser en runtime:

| Catégorie | Gaps à résoudre | Tables DB impactées | Moteurs concernés |
|-----------|-----------------|---------------------|-------------------|
| **Finance** | Categories hierarchy, BR-FIN-xxx rules, Report templates, Consolidation merges | `categories` (enhanced), `transactions` (scope_type+scope_target) | Forms + Vocab + Manifest + Workflow |
| **Auth** | Password policy, session config, password reset toggle | `users` (password_hash_policy) | Manifest Engine |
| **Org Graph** | Status transitions, inheritance strategy, unit types, merge policy | `organizations` (config JSONB extended), `org_units` (extended) | Manifest Engine |
| **Forms** | Onboarding wizard, custom forms per feature, conditional fields | Pas de table (forms are YAML→UI) | Forms Engine |
| **Workflows** | 10+ missing workflows for org/member/audit operations | `pending_operations` (extended resource_type enum) | Workflow Engine |
| **Notifications** | Templates, triggers, channels, rate limiting, quiet hours | `notifications` (NEW) | Capability Engine |
| **Data Management** | Export formats, import mappings, conflict strategies | `exports` (NEW) | Capability Engine |
| **I18N** | Date/number/currency formats, error messages translation | Pas de table (i18n strings in manifest) | Vocabulary Engine |
| **Performance** | Skeleton loading, optimistic updates, animation defaults | Pas de table | Manifest Engine |

### Ordre logique de modélisation (dépendances):

```
1. Settings org (currency, language, timezone, accent)  ← base de TOUT
2. i18n formats (date, number, currency display)        ← utilisé par finance
3. Categories hierarchy                                 ← utilisé par forms
4. Financial rules (BR-FIN-xxx)                         ← utilisé par workflow
5. Report templates                                     ← utilisent categories + rules
6. Unit types                                           ← utilisé par org structure
7. Organization settings                                ← utilisé par onboarding
8. Onboarding wizard                                    ← première expérience utilisateur
9. Workflows (all missing)                              ← dépend de rules + types
10. Notifications                                      ← dépend de workflows
11. Export/Import                                       ← dépend de forms + rules
12. Performance settings                               ← indépendant (ajout final)
```

Chaque étape modélisée = 1 section YAML dans le manifest + 1 migration DB (si besoin) + 1 implementation de moteur.

---

*Analyse Runtime Modeling Exhaustive — 2026-07-24 — Lumina v2*
