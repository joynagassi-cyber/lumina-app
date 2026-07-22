# ADR-004 : Immuabilité des Transactions Financières Validées

**Date :** 2026-01-15  
**Statut :** ACCEPTÉ — INVARIABLE  
**Décideurs :** CTO + Responsable Audit + Architecte Principal  
**Conséquences :** Transactions validées = écrites dans le marbre, corrections via écritures compensatoires

---

## 1. Contexte

Le module financier est la priorité K1 de Lumina. Les transactions financières doivent respecter les principes comptables fondamentaux : traçabilité, non-altération, et auditabilité complète. Toute modification d'une transaction validée doit laisser une trace permanente.

## 2. Questions

Comment garantir que les transactions financières validées ne peuvent jamais être modifiées ou supprimées directement, tout en permettant les corrections comptables nécessaires ?

## 3. Décision

Les transactions financières suivent un cycle de vie strict avec **immuabilité absolue après validation** :

```
DRAFT → PENDING_APPROVAL → APPROVED → ARCHIVED
                    ↓
              REJECTED (retour à DRAFT)
```

|Règle|Détail|
|---|---|
|**DRAFT**|Peut être modifiée/supprimée librement|
|**PENDING_APPROVAL**|Peut être modifiée (par le créateur uniquement)/supprimée|
|**APPROVED**|IMMUABLE — Aucune modification ni suppression possible|
|**ARCHIVED**|IMMUABLE — Lecture seule, même pour administrateurs|

**En cas d'erreur comptable :** Créer une transaction compensatoire inverse, pas modifier l'originale.

## 4. Alternatives Envisagées

### Alternative A : Immuabilité avec Écritures Compensatoires (Choix Retenu)
- **Avantages :** Conformité comptable, traçabilité parfaite, audit trail complet
- **Inconvénients :** L'utilisateur final peut être confus par la double transaction

### Alternative B : Modification Libre Même Après Validation
- **Avantages :** Simplicité pour l'utilisateur
- **Inconvénients :** Violation des principes comptables, impossible à auditer, risque de fraude, non-conformité légale potentielle

### Alternative C : Soft Delete Seulement
- **Avantages :** Permet de "cacher" les erreurs sans perdre l'historique
- **Inconvénients :** Les bilans/FIC pourraient inclure/exclure des transactions cachées, ambiguïté pour l'audit

## 5. Conséquences

### Positives
- ✅ Conformité aux principes comptables internationaux
- ✅ Traçabilité complète de chaque transaction (qui a fait quoi, quand)
- ✅ Protection contre la fraude (même un admin ne peut pas effacer une transaction validée)
- ✅ Audit externalisable (n'importe quel comptable peut vérifier les comptes)
- ✅ Références dans Invariants (INV-001) et NeverBreak

### Négatives (et mitigations)
- ⚠️ Interface plus complexe pour les corrections → **Mitigation :** UI claire montrant "Transaction compensatoire" liée à l'originale
- ⚠️ Stockage double en cas d'erreur fréquente → **Mitigation :** Les erreurs sont rares ; le coût stockage est négligeable

## 6. Implémentation Technique

```typescript
// Modèle WatermelonDB - Transaction
class Transaction extends Model {
  @fixed('status') status;         // draft | pending | approved | archived
  @fixed('amount') amount;
  @fixed('type') type;             // income | expense | transfer
  @fixed('category') category;
  @fixed('created_by') created_by;
  @fixed('approved_by') approved_by;
  @fixed('approved_at') approved_at;
  @fixed('compensates_for') compensates_for;  // Référence à la transaction compensée
  @fixed('compensated_by') compensated_by;    // ID de la compensation
  
  get isImmutable() {
    return ['approved', 'archived'].includes(this.status);
  }
  
  // Méthode de correction comptable
  compensate(amount, reason) {
    if (!this.isImmutable) throw new Error("Cannot compensate immutable transaction");
    // Crée une nouvelle transaction inverse liée à cette dernière
  }
}
```

## 7. Références

- INV-001 (Invariant : Immutabilité Comptable)
- NEVERBREAK-RULE-03 (Règle : Intégrité Financière)
- DOC-PLATFORM-MANIF (Section transaction approval workflow)
- DOC-OFFLINE-FIRST (Section conflict resolution for financial data)
