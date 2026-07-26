# ADR-016 : Conflits Offline — Transactions Draft Multi-Appareil

**Date :** 2026-07-23  
**Statut :** ACCEPTÉ  
**Décideurs :** CTO + Architecte Principal  
**Conséquences :** Stratégie de résolution de conflits pour transactions draft hors-ligne basée sur client_tx_id + device_id + dédoublonnage

---

## 1. Contexte

Deux trésoriers créent une transaction identique (même montant, même catégorie, même date) hors-ligne sur deux appareils différents. Lors du retour en ligne, le serveur reçoit deux opérations `create` identiques. Aucune stratégie de conflit n'était définie pour ce cas (seules les transactions validated étaient couvertes par INV-001).

> **Voir aussi :** ADR-003 (WatermelonDB offline-first), PRD section 3 "Stratégie de Conflits".

## 2. Décision

**Client-side UUID v4 + device_id → dédoublonnage à la sync via comparaison sémantique → side-by-side diff si ambiguïté.**

### Algorithme

```
1. Client génère: { client_tx_id: UUIDv4(), device_id: hash(deviceInfo), ...transaction }
2. Sync push au serveur avec client_tx_id dans le payload
3. Serveur check: SELECT * FROM transactions WHERE org_id = ? AND amount = ? AND type = ? AND date = ? AND category_id = ? AND status = 'draft'
4. Si match trouvé → fusionner (garder l'original, marker l'opinion comme duplicate)
5. Si aucune collision mais données ≈ identiques → afficher side-by-side diff à l'utilisateur
6. Jamais de LWW automatique sur transactions financières, même en état draft
```

## 3. Alternatives Envisagées

### Alternative A : Optimistic Locking (Version ID) — Exclue
- **Avantages :** Simple à implémenter avec WatermelonDB `version` column
- **Inconvénients :** Perte de données utilisateur si collision (le premier gagne, le second perd sa transaction), ne résout pas le dédoublonnage

### Alternative B : Server-Wins Pour Tout — Exclue
- **Avantages :** Maximum de simplicité
- **Inconvénients :** Perte agressive de travail utilisateur hors-ligne, violation UX des principes Lumina (INV-003)

### Alternative C : Client-Side UUID + Dédoublonnage (Choix Retenu)
- **Avantages :** Protège le travail utilisateur, résout automatiquement les doublons exacts, offre une option de fusion manuelle pour les cas ambigus, compatible INV-001 (pas de LWW sur transactions financières)
- **Inconvénients :** Plus complexe à implémenter côté sync, nécessite un champ `client_tx_id` et `device_id` sur le modèle Transaction

## 4. Références

- PRD Section 3 "Offline-First"
- INV-001 (Immutabilité Comptable — s'applique aux drafts, pas seulement aux validated)
- DOC-OFFLINE-FIRST (Architecture Offline & Sync)
- ADR-003 (WatermelonDB)
