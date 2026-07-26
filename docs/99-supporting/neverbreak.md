# NeverBreak Rules — Règles Inviolables de Lumina

**Doc ID:** DOC-NEVERBREAK  
**Version:** 2.0  
**Statut :** VALIDÉ — VIOLATION = BLOCAGE DÉPLOIEMENT

---

## 1. Définition

Les **NeverBreak Rules** sont des contraintes architecturales qui, si violées, bloquent automatiquement le déploiement. Contrairement aux Invariants (qui sont des principes), ces rules ont des mécanismes de vérification automatique.

---

## 2. Règles

### NB-RULE-01 : Taille Document Max
**AUCUN fichier de documentation ne peut dépasser 400 lignes.**  
→ Vérifié par script CI qui scanne tous les `.md` sous `docs/`.  
→ Si dépassé : diviser le document en sous-documents + index.

### NB-RULE-02 : Dépendances Cycliques Inter-Moteurs
**AUCUN cycle de dépendance n'existe entre les capacités des Platform Capabilities.**  
Le graphe de dépendances doit être un DAG (Directed Acyclic Graph) :
```
Manifest ← Vocab ← Forms
   ↓          ↓       ↓
Workflow ──────┘       ↓
   ↓                   ↓
Capability ←──────────┘
```
→ Vérifié par script `dependency-check` qui calcule le DAG.

### NB-RULE-03 : Intégrité Financière
**AUCUNE fonction ne peut modifier una transaction avec status='approved' ou 'archived'.**  
→ Vérifié par guard automatique dans le repository WatermelonDB.

### NB-RULE-04 : Org-ID Injection
**TOUTE requête vers InsForge DOIT inclure x-org-id header.**  
→ Vérifié par middleware qui rejette les requêtes sans header.

### NB-RULE-05 : Format Manifest
**Tout fichier manifest doit passer la validation JSON Schema avant d'être compilé.**  
→ Vérifié par hook pre-commit qui valide tous les fichiers YAML/JSON sous `manifests/`.

### NB-RULE-06 : Sync Offline First
**AUCUNE écriture en base distante ne peut précéder l'écriture locale.**  
Dans WatermelonDB, le `writeToDatabase` local est toujours appelé AVANT le sync.

### NB-RULE-07 : TypeScript Strict
**AUCUN `any` type n'est autorisé dans le code source.**  
→ Vérifié par ESLint rule `@typescript-eslint/no-explicit-any`: error.  
→ Exception : les fichiers de migration de legacy code (avec commentaire `// eslint-disable-next-line`).

### NB-RULE-08 : Traductions Minimos
**Toute nouvelle fonctionnaliténalité UI a AU MOINS les traductions FR et EN.**  
→ Vérifié par test de lint qui scanne les fichiers i18n pour keys manquantes.

### NB-RULE-09 : Couverture Tests Finance
**Le module financier a AU MOINS 90% de couverture de tests unitaires.**  
→ Vérifié par CI qui bloque si coverage < 90% sur `src/modules/finance/`.

### NB-RULE-10 : Aucune Hardcoded URL
**AUCUNE URL d'API n'est codée en dur dans les composants UI.**  
Toutes les URLs passent par un config singleton (`config.apiBaseUrl`).  
→ Vérifié par lint rule regex.

---

## 3. Schéma de Violation

```
Violation détectée par CI
        │
        ▼
  Build FAIL
        │
        ├──→ Commentaire automatique sur la PR
        │        "NB-RULE-XX violated: <details>"
        │
        ├──→ Message d'erreur dans les logs
        │        "Build blocked: NeverBreak Rule violation"
        │
        └──→ Bloquer le merge SANS approbation spéciale
```

## 4. Processus de Dérrogation

Une dérogation temporaire à une NeverBreak Rule est possible UNIQUEMENT si :
1. Un ADR est créé expliquant POURQUOI la rule est violée
2. L'ADR est approuvé par le CTO + l'Architecte Principal
3. La dérogation a une expiration (max 2 releases)
4. Un ticket de correction est créé immédiatement

---

## 5. Matrice de Vérification

| Rule | Type de Vérif | Outil | Fréquence |
|---|---|---|---|
| NB-RULE-01 | Ligne count | Script shell | Commit |
| NB-RULE-02 | Dependency graph | Script Node | CI |
| NB-RULE-03 | Guard function | Test unitaire | Commit |
| NB-RULE-04 | Middleware reject | Integration test | CI |
| NB-RULE-05 | JSON Schema | Hook pre-commit | Commit |
| NB-RULE-06 | Write order assertion | Unit test | CI |
| NB-RULE-07 | ESLint no-any | ESLint | Commit |
| NB-RULE-08 | i18n completeness | Custom lint | PR |
| NB-RULE-09 | Coverage threshold | Jest | CI |
| NB-RULE-10 | Regex scan | ESLint | Commit |
