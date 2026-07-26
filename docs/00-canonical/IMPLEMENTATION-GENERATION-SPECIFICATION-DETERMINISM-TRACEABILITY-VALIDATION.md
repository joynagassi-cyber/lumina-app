# IGS-v1 — Determinism, Traceability & Validation Rules

**Doc ID:** IGS-v1-DTV (HORS SÉRIE CANONIQUE)  
**Version:** 1.0  
**Statut:** RÈGLES FIGÉES DE DÉTERMINISME, TRACABILITÉ ET VALIDATION  
**Date:** 2026-07-24  
**Référence :** Applique IGS-v1 + DOC-000 à DOC-024

---

## PRÉAMBULE

Ce document définit les règles de déterminisme, traçabilité et validation qui gouvernent CHAQUE génération d'artefact technique. Ces règles sont IMMUABLES. Toute violation entraîne le rejet immédiat de la génération.

---

## SECTION A — RÈGLES DE DÉTERMINISME

### A.1 Principe fondamental

```
ENTRÉE canonique identique → SORTIE technique identique
```

Si deux exécutions du même générateur avec les mêmes entrées produisent des sorties différentes, alors :
1. L'une des exécutions a appliqué une règle incorrecte, OU
2. Une entrée canonique a changé entre les deux exécutions, OU
3. Le générateur utilise un état implicite (violation bloquante)

### A.2 Règles de déterminisme

| Règle | Description | Enforcement |
|-------|-------------|-------------|
| **DET-001** | Pas de random dans la génération | Hash stable SHA-256 pour tous les IDs |
| **DET-002** | Ordre déterministe des tables | Tri alphabétique par nom canonique |
| **DET-003** | Ordre déterministe des colonnes | Ordre défini dans DOC-021 |
| **DET-004** | Pas de dépendance horaire | Timestamps uniquement dans migration filenames, pas dans contenu |
| **DET-005** | Formats standards | JSON/YAML/SQL formatting constant via `prettier` / `sql-formatter` |
| **DET-006** | Zéro état implicite | Chaque générateur lit EXCLUSIVEMENT ses entrées documentées (§3 IGS-v1) |
| **DET-007** | Ambiguïté = blocage | Si information contradictoire → STOP, signalisation, jamais d'hypothèse |
| **DET-008** | Différence de sortie = différence d'entrée | Comparaison hash entrée vs hash sortie permet détection de dérive |

### A.3 Détection de non-déterminisme

**Algorithme :**

```
function detect_non_determinism(generation1, generation2):
    if hash(generation1.source_canonical) != hash(generation2.source_canonical):
        return "Entrées différentes — régénération nécessaire"
    
    if generation1.validation_hash == generation2.validation_hash:
        return "Identique — pas de dérive"
    
    if generation1.source_canonical == generation2.source_canonical:
        return "VIOLATION DETECTÉE: même entrée, sortie différente"
    
    return "Ambiguïté — vérifier les documents sources"
```

---

## SECTION B — RÈGLES DE TRACABILITÉ

### B.1 Métadonnées obligatoires par artefact

Chaque artefact généré DOIT contenir ces métadonnées dans son en-tête :

```yaml
# === IGS METADATA ===
generation_id: <SHA-256 of artifact content>
source_canonical: ["DOC-021§3.1", "DOC-023§5"]
transformation_rule: "schema-generator v1.0"
generation_date: "2026-07-24T10:30:00Z"
architecture_version: "v1.0 (DOC-000-DOC-024 + ARA-v1)"
validation_hash: <SHA-256 of content excluding metadata header>
compliance_status: "COMPLIANT | VIOLATION | BLOCKED"
# =====================
```

### B.2 Règles de traçabilité

| Règle | Description | Application |
|-------|-------------|-------------|
| **TRACE-001** | Aucun artefact orphelin | Chaque élément de chaque artefact doit pointer vers ≥ 1 doc source |
| **TRACE-002** | Changement de sortie = changement d'entrée | Si hash diffère, source canonique doit avoir changé |
| **TRACE-003** | Vérification automatique possible | Scripts `validate-traceability` exécutables automatiquement |
| **TRACE-004** | Chaîne complète obligatoire | Pour tout artefact X: `Source Canonique → Règle → Artefact → Validation Hash` |
| **TRACE-005** | Aucune rétroaction vers canon | Les artefacts générés ne MODIFIENT JAMAIS les documents canoniques |

### B.3 Script de vérification de traçabilité

```
function validate_traceability(artifact):
    // Check metadata completeness
    required_fields = ["generation_id", "source_canonical", 
                       "transformation_rule", "generation_date",
                       "architecture_version", "validation_hash",
                       "compliance_status"]
    for field in required_fields:
        if not artifact.has_metadata(field):
            return FAIL: "Champ de métadonnées manquant: {field}"
    
    // Check compliance status
    if artifact.compliance_status == "BLOCKED":
        return REJECT: "Artéfact bloqué — régénération requise"
    
    // Check traceability of each element
    for element in artifact.all_elements():
        canonical_source = find_canonical_source(element)
        if canonical_source is null:
            return FAIL: "Élément orphelin: {element}"
        if not canonical_source.exists_in(DOC_000_TO_024):
            return FAIL: "Élément non-catalogué: {element}"
    
    return PASS
```

---

## SECTION C — BOUCLE DE VALIDATION

### C.1 Six validations en cascade

Chaque génération passe par 6 validations séquentielles. Si l'une échoue, la génération est REJETÉE.

```
┌─────────────────────────────────────────────────────────────┐
│                    VALIDATION PIPELINE                       │
│                                                              │
│  V-STRUCT ──NON──→ STOP                                     │
│       │ OUI                                                 │
│       ▼                                                      │
│  V-COHERE ──NON──→ STOP                                     │
│       │ OUI                                                 │
│       ▼                                                      │
│  V-TRACE ──NON──→ STOP                                      │
│       │ OUI                                                 │
│       ▼                                                      │
│  V-NB ──NON──→ STOP                                         │
│       │ OUI                                                 │
│       ▼                                                      │
│  V-REGRESS ──NON──→ STOP                                    │
│       │ OUI                                                 │
│       ▼                                                      │
│  V-INVENT ──NON──→ STOP                                     │
│       │ OUI                                                 │
│       ▼                                                      │
│  RESULTAT: APPROVED                                         │
└─────────────────────────────────────────────────────────────┘
```

### C.2 Détail de chaque validation

#### V-STRUCT (Validation Structurelle)

**Vérifie :** Syntaxe valide, structure conforme au template attendu.
**Sources :** Format de sortie du générateur.
**Échoue si :** Format invalide, JSON mal formé, SQL syntax errors.

```
function validate_structural(artifact, expected_format):
    parsed = parse(artifact.content, expected_format)
    if parsed is null:
        return FAIL: "Format invalide pour {expected_format}"
    return PASS
```

#### V-COHERE (Validation de Cohérence)

**Vérifie :** Relations logiques entre éléments de l'artefact.
**Sources :** DOC-023 §2-9 (Relational Rules).
**Échoue si :** Relation invalide, cardinalité incorrecte, FK sans référence.

```
function validate_consistency(artifact, relational_rules):
    for relation in artifact.all_relations():
        if not relational_rules.allows(relation.direction, relation.cardinality):
            return FAIL: "Relation invalide: {relation}"
    return PASS
```

#### V-TRACE (Validation de Traçabilité)

**Vérifie :** Chaque élément trace vers ≥ 1 document canonique.
**Sources :** Règles §B.2 TRACE-001.
**Échoue si :** Élément orphelin détecté.

```
function validate_traceability(artifact):
    for element in artifact.all_elements():
        source = find_canonical_source(element)
        if source is null or source not in [DOC-000..DOC-024]:
            return FAIL: "Élément orphelin: {element}"
    return PASS
```

#### V-NB (Validation NeverBreak)

**Vérifie :** Jamais de règle métier inventée, jamais de boundary change, jamais de new concept.
**Sources :** DOC-017 §6 NeverBreak Rules, DOC-023 §9 NeverBreak Relational Rules.
**Échoue si :** Violation détectée.

```
function validate_neverbreak(artifact, nb_rules):
    for rule in nb_rules:
        if artifact.violates(rule):
            return FAIL: "Violation {rule.id}: {rule.description}"
    return PASS
```

#### V-REGRESS (Validation Non-régression)

**Vérifie :** Le changement ne casse pas ce qui existait avant.
**Sources :** Hashs comparés entre générations précédentes.
**Échoue si :** Dérive sémantique détectée.

```
function validate_regression(artifact, previous_generation):
    if artifact.hash_changed() and artifact.source_unchanged():
        return FAIL: "Dérive détectée — entrée inchangée mais sortie différente"
    return PASS
```

#### V-INVENT (Validation absence d'invention)

**Vérifie :** Jamais de nouveau concept, capability, aggregate, ou règle métier inventée.
**Sources :** DOC-001 (Element Registry), DOC-008 Step 2 (Concept validation).
**Échoue si :** Élément non catalogué trouvé.

```
function validate_no_invention(artifact):
    for element in artifact.business_elements():
        if not is_catalogued_in(element, DOC_001_ELEMENT_REGISTRY):
            return FAIL: "Invention détectée: {element} n'est pas dans DOC-001"
    return PASS
```

### C.3 Règles de blocage

| Validation | En cas d'échec | Message | Correction requise |
|------------|----------------|---------|-------------------|
| V-STRUCT | STOP immédiat | "Format invalide" | Corriger le template de sortie |
| V-COHERE | STOP immédiat | "Relation logique invalide" | Corriger les relations dans DOC-023 |
| V-TRACE | STOP immédiat | "Élément orphelin" | Ajouter la trace vers DOC-source |
| V-NB | STOP immédiat | "Violation NeverBreak {rule_id}" | Corriger l'artefact ou le doc source |
| V-REGRESS | STOP immédiat | "Dérive détectée" | Identifier la cause de la différence |
| V-INVENT | STOP immédiat | "Invention: {element}" | Retirer l'invention du générateur |

**Aucune correction automatique ne doit masquer une violation.** Une génération échouée se termine par `compliance_status: VIOLATION`. L'artefact rejeté ne doit PAS être utilisé.

---

## SECTION D — RÈGLES DE NON-RÉGRESSION

### D.1 Comparaison de générations

Deux générations sont identiques si et seulement si :

```
hash(source_canonical_A) == hash(source_canonical_B)
AND hash(validation_content_A) == hash(validation_content_B)
AND same_number_of_elements(A, B)
```

### D.2 Invalidation de générations précédentes

Une génération précédente EST invalidée si :

1. Sa `source_canonical` ne correspond plus aux documents canoniques actuels
2. Son `validation_hash` ne matche pas le hash actuel de l'artefact re-généré
3. Un document canonique qu'elle utilisait a été modifié depuis sa génération

### D.3 Archivage des générations

Chaque génération est archivée avec son hash. Les versions précédentes sont conservées (jamais supprimées) pour audit et rollback.

**Règle :** Un artefact rejeté (status VIOLATION ou BLOCKED) NE PEUT JAMAIS être réutilisé. Il doit être archivé sous un nom différent (`artifact.sql.broken`) et ne jamais remplacer un artefact COMPLIANT.

---

## SECTION E — MATRICE DE VALIDATION PAR GÉNÉRATEUR

| Générateur | V-STRUCT | V-COHERE | V-TRACE | V-NB | V-REGRESS | V-INVENT |
|------------|----------|----------|---------|------|-----------|----------|
| Schema Generator | ✓ DDL valide | ✓ FK, cardinalités | ✓ DOC-021+023 | ✓ NB-PERSIST | ✓ Hash stable | ✓ Pas de new concept |
| Migration Gen | ✓ SQL valide | ✓ Topo sort | ✓ Étape 1 | ✓ NB-PERSIST | ✓ Hash stable | ✓ Pas de new concept |
| Constraint Gen | ✓ SQL valide | ✓ Index logic | ✓ DOC-023 | ✓ NB-RR | ✓ Hash stable | ✓ Pas de new rules |
| RLS Gen | ✓ SQL valide | ✓ Policies cohérentes | ✓ DOC-021 org_id | ✓ NB-PERSIST-002 | ✓ Hash stable | ✓ No bypass tenant |
| API Contract Gen | ✓ OpenAPI YAML | ✓ Endpoints ↔ Commands | ✓ DOC-014+013 | ✓ Boundary respected | ✓ Hash stable | ✓ Pas de new Commands |
| Service Gen | ✓ Code valide | ✓ Guards cohérents | ✓ DOC-012+015 | ✓ Invariants 58 | ✓ Hash stable | ✓ Pas de new BR |
| Deploy Config | ✓ YAML/JSON | ✓ Services catalogués | ✓ DOC-001 | ✓ Flux descendant | ✓ Hash stable | ✓ Pas de new runtime |
| UI Gen | ✓ RN JSX | ✓ Forms + Vocab | ✓ DOC-012+019 | ✓ BR-FRM | ✓ Hash stable | ✓ Pas de new forms |
| Test Gen | ✓ Test code | ✓ Coverage matrix | ✓ DOC-015+012 | ✓ INV couvre BR | ✓ Hash stable | ✓ Pas de new tests spec |
| Consistency Checker | ✓ Report format | ✓ Cross-check | ✓ All steps | ✓ All NB | ✓ Full pipeline | ✓ Global scan |

---

## HISTORIQUE

| Version | Date | Auteur | Modification | Validation |
|---------|------|--------|-------------|-----------|
| 1.0 | 2026-07-24 | Chief Platform Architect | Création — Règles de déterminisme, traçabilité et validation pour le pipeline de génération | GO |

---

*Ce document ne fait pas partie de la série DOC-000 à DOC-024. C'est une spécification de génération qui dépend entièrement de l'architecture canonique.*
