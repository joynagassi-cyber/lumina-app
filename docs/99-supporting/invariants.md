# Invariants de Lumina — Règles Absolues

**Doc ID:** DOC-INvariants  
**Version:** 2.0  
**Statut :** VALIDÉ — INVARIABLE  
**Dépendances :** Toutes les specs moteur

---

## 1. Définition

Les **Invariants** sont des vérités fondamentales du système Lumina. Elles ne peuvent jamais être violées, quelque soit la technologie, l'organisation ou le contexte. Si une implémentation viole un invariant, elle est par définition incorrecte.

---

## 2. Liste des Invariants

### INV-001 : Immutabilité Comptable
**Une transaction financière validée ne peut jamais être modifiée ni supprimée.**  
Toute correction doit se faire via une transaction compensatoire inverse liée à l'originale.

```
Transaction APPROVED → IMMUABLE
Erreur → Créer transaction COMPENSATOIRE (status: correction)
         qui référence l'originale (compensates_for: <uuid>)
```

### INV-002 : Séparation Core / Business
**Les Platform Capabilities ne contiennent aucune logique métier spécifique à un type d'organisation.**  
Tout comportement organisationnel passe par un moteur interprété (Manifest, Workflow, Forms). Le code des capacités de la Platform ne contient JAMAIS de `if (type === 'church')`.

### INV-003 : Offline-Absolue
**L'application est toujours fonctionnelle sans connexion réseau.**  
Aucune opération utilisateur ne dépend d'un appel API synchrone. Toute opération est d'abord locale, puis sync async.

### INV-004 : Isolement Multi-Tenant
**Les données de deux organisations ne se croisent JAMAIS.**  
Même au niveau requête SQL, même au niveau cache, même au niveau logs. L'org_id est injecté automatiquement à chaque accès.

### INV-005 : Manifest > Code Dur
**Si une règle peut être exprimée en configuration manifest, elle DOIT l'être, jamais être codée en dur.**  
Le code hardcodé ne sert qu'à implémenter les capacités des Platform Capabilities.

### INV-006 : Vocabulary的唯一Source
**Chaque valeur enum/projetée vient du Vocab Engine.**  
Aucune liste en dur dans l'UI, les formulaires, ou le backend. Chaque option référençable est dans vocabulary/.

### INV-007 : Audit Trail Immuable
**Chaque action utilisateur est journalisée avec : qui, quoi, quand, old_value, new_value.**  
Les logs ne peuvent pas être modifiés ni supprimés. Ils constituent la preuve d'audit.

### INV-008 : Validation Double
**Toute validation côté client doit être reproduite côté serveur.**  
La validation client n'est qu'une UX优化 — le serveur rejette toujours les données invalidées, indépendamment de la validation client.

### INV-009 : Formulaire = JSON → UI
**Aucun formulaire n'est rendu directement en JSX/TSX.**  
Tout formulaire passe par le Forms Engine qui convertit une définition JSON en composants React Native.

### INV-010 : Versioning de Tout
**Toute donnée modifiable a un champ version.**  
Les anciennes versions ne sont jamais écrasées — elles sont conservées pour l'audit et la réversibilité.

---

## 3. Matrice de Respect

| Invariant | Vérifié par | Fréquence |
|---|---|---|
| INV-001 | Tests unitaires + code review | À chaque PR finance |
| INV-002 | Code review + lint custom | À chaque PR core |
| INV-003 | Tests E2E offline | À chaque build |
| INV-004 | Tests d'isolation auto | À chaque déploiement |
| INV-005 | Code review + grep "|code" | À chaque release |
| INV-006 | Tests de régression vocab | À chaque changement vocab |
| INV-007 | Audit automatique monthly | Mensuel |
| INV-008 | Tests double-validation | À chaque formulaire |
| INV-009 | Lint rule forbid "const form =" | Continu (CI/CD) |
| INV-010 | Schema migration check | À chaque schéma change |
