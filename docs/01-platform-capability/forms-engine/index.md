# Moteur de Formulair — Spécification Complète

**Doc ID:** DOC-PLATFORM-FORMS  
**Version:** 2.0  
**Statut:** VALIDÉ  
**Dépendances:** VOCABULARY-ENGINE (DOC-PLATFORM-VOCA), MANIFEST-ENGINE (DOC-PLATFORM-MANIF)

---

## 1. Vision

Le **Forms Engine** est un moteur de génération de formulaires dynamiques. Il lit des définitions de formulaires en configuration (JSON) et les rend dans l'UI React Native. Chaque champ peut référencer le vocabulaire du métier via le Vocab Engine.

**Principe fondamental :** L'UI n'a JAMAIS de formulaires codés en dur. Tout formulaire est rendu à partir d'une définition JSON. Si un nouveau formulaire est nécessaire, on ajoute une définition — pas du code.

---

## 2. Responsabilités

| Responsabilité | Description |
|---|---|
| **Form Generation** | Convertir une définition JSON en composants React Native |
| **Field Rendering** | Mapper chaque type de champ sur un composant UI approprié |
| **Validation** | Appliquer les règles de validation déclarées dans la définition |
| **Conditional Logic** | Afficher/masquer des champs basé sur d'autres valeurs |
| **Data Binding** | Relier les champs aux modèles de données |
| **Internationalization** | Traduire les labels et messages selon la langue de l'org |

---

## 3. Format de Définition de Formulaire

### 3.1 Structure de Base

```yaml
# forms/transaction.yaml
id: "finance_transaction_form"
name: "Nouvelle Transaction"
model: "Transaction"
version: "1.0"

fields:
  - name: "type"
    label: "Type"
    type: "select"
    required: true
    options:
      source: "vocab:finance/transaction_types"
    default: "income"
      
  - name: "amount"
    label: "Montant"
    type: "number"
    required: true
    min: 0
    max: 999999999.99
    step: 0.01
    currency: "settings.currency"
    
  - name: "date"
    label: "Date"
    type: "date"
    required: true
    default: "today"
    
  - name: "category"
    label: "Catégorie"
    type: "select"
    required: true
    options:
      source: "vocab:finance/categories"
    
  - name: "description"
    label: "Description"
    type: "textarea"
    required: false
    max_length: 500
    
  - name: "receipt_attached"
    label: "Reçu joint"
    type: "file_upload"
    required: false
    accepted_types: ["image/jpeg", "image/png", "application/pdf"]
    max_size_mb: 5
    
  - name: "approver_notes"
    label: "Notes de l'approbateur"
    type: "textarea"
    required: false
    visible_if:
      field: "status"
      operator: "eq"
      value: "pending_approval"
```

### 3.2 Sections et Groupes

```yaml
sections:
  - id: "basic_info"
    title: "Informations de Base"
    fields: ["type", "amount", "date", "category"]
    
  - id: "details"
    title: "Détails"
    fields: ["description", "receipt_attached"]
    
  - id: "approval"
    title: "Approbation"
    fields: ["approver_notes"]
    visible_if:
      field: "status"
      operator: "neq"
      value: "draft"
```

---

## 4. Mapping Champs → Composants React Native

| Type de Champ | Composant RN | Behaviour |
|---|---|---|
| `text` | `TextInput` | Standard text input |
| `number` | `TextInput` (keyboard='numeric') | Numeric keyboard, min/max |
| `email` | `TextInput` (keyboard='email-address') | Email validation |
| `phone` | `TextInput` (keyboard='phone-pad') | Phone formatting |
| `date` | `DatePicker` (react-native-paper) | Date picker modal |
| `time` | `TimePicker` | Time picker modal |
| `select` | `Dropdown` / `Modal` | Single choice from list |
| `multiselect` | `ChipGroup` + Modal | Multiple choice |
| `checkbox` | `Checkbox` (RN Paper) | Boolean toggle |
| `textarea` | `TextInput` (multiline=true) | Multi-line text |
| `file_upload` | `TouchableOpacity` + ImagePicker | Camera/gallery picker |
| `signature` | Custom Canvas | Drawing pad |
| `address` | Group of sub-fields | Street, city, country |
| `rich_text` | HTML viewer/editor | Basic markdown support |

---

## 5. Cycle de Vie d'un Formulaire

```
┌─────────────────┐
│  Config JSON    │  ← Formulaire défini en YAML/JSON
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  Validation     │  ← Schema check + referential integrity
│                 │     Check fields exist in model
│                 │     Check options reference valid vocab
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  Compile        │  ← Transform config → render tree
│                 │     Build component map
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  Render         │  ← React Native components mounted
│                 │     Dynamic form in UI
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  Collect Data   │  ← User fills form
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  Validate       │  ← Client-side rules applied
│                 │     Required, min/max, pattern
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  Submit         │  ← POST to InsForge API
└─────────────────┘
```

---

## 6. API du Moteur

### 6.1 Méthodes Publiques

```typescript
interface FormsEngine {
  // Chargement
  loadForm(orgId: string, formId: string): Promise<FormDefinition>;
  listForms(orgId: string, model?: string): Promise<FormDefinition[]>;
  
  // Rendu
  renderForm(formDef: FormDefinition, data?: Record<string, any>): RenderTree;
  getVisibleFields(formDef: FormDefinition, context: Record<string, any>): Field[];
  
  // Validation
  validateFormData(formDef: FormDefinition, data: Record<string, any>): ValidationResult;
  getInlineErrors(formDef: FormDefinition, data: Record<string, any>): FieldErrors;
}

interface ValidationResult {
  isValid: boolean;
  errors: FieldError[];
  warnings?: Warning[];
}

interface FieldError {
  fieldName: string;
  message: string;
  code: 'required' | 'min' | 'max' | 'pattern' | 'enum' | 'custom';
}
```

---

## 7. Règles d'Or

| Règle | Description |
|---|---|
| **R-01** | Aucun formulaire ne peut être codé en dur dans l'UI. Tout passe par le Forms Engine. |
| **R-02** | Les champs select/multiselect doivent TOUJOURS référencer le vocabulaire du Vocab Engine, jamais de listes en dur. |
| **R-03** | La validation côté client est obligatoire mais insuffisante — la validation serveur doit reproduire exactement les mêmes règles. |
| **R-04** | Les formulaire sensibles (financiers) doivent être verrouillés en lecture après soumission, sauf pour les admins. |
| **R-05** | Chaque formulaire doit avoir une version. Les données liées à une ancienne version ne peuvent pas être modifiées sans migration. |

---

## 8. Conditional Visibility Patterns

```yaml
# Patterns courants de visibilité conditionnelle

# Montrer un champ seulement si un autre a une valeur spécifique
visible_if:
  field: "transaction_type"
  operator: "eq"
  value: "expense"
  
# Masquer un champ si une condition est vraie
hidden_if:
  field: "amount"
  operator: "gt"
  value: 0
  
# Combiner plusieurs conditions
visible_if_all_of:
  - field: "transaction_type"
    operator: "eq"
    value: "expense"
  - field: "amount"
    operator: "gt"
    value: 1000
    
visible_if_any_of:
  - field: "role"
    operator: "in"
    value: ["admin", "treasurer"]
```

---

## 9. Exemples de Formulaires

### 9.1 Formulaire d'Adhésion Membre

```yaml
id: "member_admission_form"
model: "Member"
fields:
  - name: "first_name"
    label: "Prénom"
    type: "text"
    required: true
    
  - name: "last_name"
    label: "Nom"
    type: "text"
    required: true
    
  - name: "date_of_birth"
    label: "Date de Naissance"
    type: "date"
    required: true
    
  - name: "gender"
    label: "Genre"
    type: "select"
    options:
      source: "vocab:common/genders"
    required: false
    
  - name: "photo"
    label: "Photo"
    type: "file_upload"
    accepted_types: ["image/jpeg", "image/png"]
    max_size_mb: 2
```

### 9.2 Formulaire de Rapports Financiers

```yaml
id: "financial_report_form"
model: "FinancialReport"
sections:
  - title: "Période"
    fields: ["start_date", "end_date", "report_type"]
  - title: "Contenu"
    fields: ["include_budget_comparison", "include_trend_analysis"]
  - title: "Annotation"
    fields: ["summary", "notes"]
```

---

## 10. Critères d'Achèvement

- [x] 14 types de champs supportés
- [x] Mapping complet vers composants React Native
- [x] Système de validation client/serveur synchronisé
- [x] Logique conditionnelle (visible_if, hidden_if, combinateurs)
- [x] API TypeScript complète
- [x] Exemples pour 3 formulaires types
