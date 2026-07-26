# Moteur de Vocabulaire — Spécification Complète

**Doc ID:** DOC-PLATFORM-VOCA  
**Version:** 2.0  
**Statut:** VALIDÉ  
**Dépendances:** MANIFEST-ENGINE (DOC-PLATFORM-MANIF)

---

## 1. Vision

Le **Vocabulary Engine** est un catalogue centralisé de tous les termes et valeurs possibles utilisés dans une organisation. C'est LA source de vérité pour les enums, les catégories, les labels, et les traductions.

**Principe fondamental :** Jamais de listes en dur dans le code ou les formulaires. Chaque liste référençable est dans le vocabulaire.

---

## 2. Responsabilités

| Responsabilité | Description |
|---|---|
| **Term Registry** | Enregistrer et gérer tous les termes métier |
| **Category Management** | Gérer les catégories et leurs valeurs |
| **Translation Support** | Fournir les traductions par langue |
| **Cross-Reference** | Permettre aux formulaires et manifests de référencer le vocabulaire |
| **Versioning** | Suivre les changements dans les termes |

---

## 3. Format de Vocabulaire

### 3.1 Structure de Base

```yaml
# vocabulary/finance.yaml
namespace: "finance"
terms:
  transaction_types:
    label: "Types de Transaction"
    description: "Catégories principales de transactions financières"
    values:
      - key: "income"
        label: "Revenu"
        label_en: "Income"
        color: "#4CAF50"
      - key: "expense"
        label: "Dépense"
        label_en: "Expense"
        color: "#F44336"
      - key: "transfer"
        label: "Transfert"
        label_en: "Transfer"
        color: "#2196F3"
        
  expense_categories:
    label: "Catégories de Dépenses"
    description: "Catégories détaillées pour les dépenses"
    parent: "transaction_types"
    filter: "type == expense"
    values:
      - key: "utilities"
        label: "Utilities"
        label_en: "Utilities"
      - key: "salaries"
        label: "Salaires"
        label_en: "Salaries"
      - key: "maintenance"
        label: "Maintenance"
        label_en: "Maintenance"
      - key: "events"
        label: "Événements"
        label_en: "Events"
        
  income_categories:
    label: "Catégories de Revenus"
    parent: "transaction_types"
    filter: "type == income"
    values:
      - key: "tithes"
        label: "Dîmes"
        label_en: "Tithes"
      - key: "offerings"
        label: "Offrandes"
        label_en: "Offerings"
      - key: "donations"
        label: "Dons"
        label_en: "Donations"
      - key: "fundraising"
        label: "Collecte de fonds"
        label_en: "Fundraising"
```

### 3.2 Vocabulaire Commun

```yaml
# vocabulary/common.yaml
namespace: "common"
terms:
  genders:
    label: "Genres"
    values:
      - key: "male"
        label: "Masculin"
        label_en: "Male"
      - key: "female"
        label: "Féminin"
        label_en: "Female"
      - key: "other"
        label: "Autre"
        label_en: "Other"
        
  marital_statuses:
    label: "Statuts Civils"
    values:
      - key: "single"
        label: "Célibataire"
        label_en: "Single"
      - key: "married"
        label: "Marié(e)"
        label_en: "Married"
      - key: "divorced"
        label: "Divorcé(e)"
        label_en: "Divorced"
      - key: "widowed"
        label: "Veuf(ve)"
        label_en: "Widowed"
        
  languages:
    label: "Langues Supportées"
    values:
      - key: "fr"
        label: "Français"
        label_en: "French"
      - key: "en"
        label: "English"
        label_en: "English"
      - key: "sw"
        label: "Swahili"
        label_en: "Swahili"
```

---

## 4. API du Moteur

```typescript
interface VocabularyEngine {
  // Accès aux termes
  getTerm(namespace: string, termKey: string): TermDefinition;
  getValues(namespace: string, termKey: string): TermValue[];
  getValueByNamespaceAndKey(namespace: string, termKey: string, valueKey: string): TermValue | null;
  
  // Recherche
  searchTerms(query: string, namespace?: string): SearchResult[];
  getAllNamespaces(): string[];
  
  // Modification (admin only)
  addValue(namespace: string, termKey: string, value: TermValue): Promise<void>;
  updateValue(namespace: string, termKey: string, valueKey: string, updates: Partial<TermValue>): Promise<void>;
  deleteValue(namespace: string, termKey: string, valueKey: string): Promise<void>;
  
  // Traduction
  translate(namespace: string, termKey: string, valueKey: string, lang: string): string;
}

interface TermDefinition {
  key: string;
  label: string;
  label_en: string;
  description?: string;
  parent?: string;
  filter?: string;
  values: TermValue[];
}

interface TermValue {
  key: string;
  label: string;
  label_en: string;
  color?: string;
  metadata?: Record<string, any>;
}
```

---

## 5. Règles d'Or

| Règle | Description |
|---|---|
| **R-01** | Les valeurs du vocabulaire ne sont JAMAIS supprimées — elles sont marquées comme `deprecated: true`. |
| **R-02** | Chaque terme doit avoir une traduction minimale en français et anglais. |
| **R-03** | Les clés (keys) sont stables et ne changent jamais. Seuls les labels peuvent évoluer. |
| **R-04** | Un formulaire qui référence un terme inexistant ne se rend pas — erreur explicite. |

---

## 6. Critères d'Achèvement

- [x] Structure YAML définie avec namespaces
- [x] API TypeScript complète
- [x] Support multilingue (FR/EN minimum)
- [x] Système de deprecated values
- [x] Exemples pour finance et common
