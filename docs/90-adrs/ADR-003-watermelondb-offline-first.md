# ADR-003 : WatermelonDB pour la Synchronisation Offline-First

**Date :** 2026-01-15  
**Statut :** ACCEPTÉ  
**Décideurs :** CTO + Architecte Principal  
**Conséquences :** SQLite local, synchronisation async, gestion de conflits complexe mais maîtrisée

---

## 1. Contexte

L'application doit fonctionner **100% hors-ligne** avec synchronisation automatique dès que la connexion revient. Les données financières sont critiques et ne peuvent PAS être perdues lors d'une déconnexion. Le backend InsForge utilise PostgreSQL.

## 2. Questions

Quelle technologie choisir pour la couche offline-first et la synchronisation entre SQLite local et PostgreSQL distant ?

## 3. Décision

Nous utilisons **WatermelonDB** comme solution officielle d'offline-first. WatermelonDB fournit :
- Une base de données SQLite locale performante avec API réactive
- Un système de synchronisation bidirectionnelle intégré
- Un modèle de données orienté records avec timestamps
- Une API compatible React Native

## 4. Alternatives Envisagées

### Alternative A : WatermelonDB (Choix Retenu)
- **Avantages :** Conçu spécifiquement pour React Native, API réactive native, synchronisation intégrée, bonne documentation, communauté active
- **Inconvénients :** Courbe d'apprentissage pour la config de sync, gestion manuelle des conflits complexes

### Alternative B : RxDB
- **Avantages :** Plus mature sur le plan de la gestion des conflits (CRDTs), supporte plusieurs backends
- **Inconvénients :** Surdimensionné pour notre cas, bundle size 3x plus lourd, pas d'optimisation React Native, compatibilité SQLite incertaine

### Alternative C : Solutions Custom (Realm + Sync)
- **Avantages :** Contrôle total, performances potentielles meilleures
- **Inconvénients :** Développement énorme (mois de work supplémentaire), maintenance interne, bugs de sync non testés par la communauté, support écosystème nul

### Alternative D : Pas d'Offline First
- **Avantages :** Architecture simplifiée, zéro problème de sync
- **Inconvénients :** Données perdues à chaque déconnexion, expérience utilisateur inacceptable dans zones à réseau instable, violation des exigences métier

## 5. Conséquences

### Positives
- ✅ Fonctionnement 100% offline garanti
- ✅ Synchronisation automatique au retour du réseau
- ✅ API réactive pour l'UI (mise à jour automatique des listes)
- ✅ Stack technique cohérente avec React Native
- ✅ SQLite local = pas de dépendance serveur pour la lecture

### Négatives (et mitigations)
- ⚠️ Gestion manuelle des conflits → **Mitigation :** Stratégie définie dans DOC-OFFLINE-FIRST (LWW pour la plupart, immutable pour finance)
- ⚠️ Migration de données depuis Supabase nécessaire → **Mitigation :** Script dédié en Phase 0
- ⚠️ Debugging sync complexe → **Mitigation :** Logs détaillés, outil de visualisation de queue de sync

## 6. Stratégie de Conflits Définie

| Type de Donnée | Stratégie | Raison |
|---|---|---|
| **Transactions financières** | Immutable (bloquer modification après validation) | Intégrité comptable absolue |
| **Membres** | Last-Writer-Wins (timestamp) | Données évolutives, rare conflit simultané |
| **Événements** | Last-Writer-Wins avec notification | Conflits possibles sur dates |
| **Formulaires** | Server-wins si schema mismatch | Éviter corruption de structure |

## 7. Critères de Révision

Cette décision sera réévaluée si :
1. WatermelonDB abandonne le projet ou ne supporte plus RN
2. Plus de 100 orgs actives simultanément avec conflits fréquents
3. La taille des données locales dépasse 500MB régulièrement

## 8. Références

- DOC-OFFLINE-FIRST (Section "WatermelonDB Configuration")
- DOC-OFFLINE-FIRST (Section "Conflict Resolution Strategy")
- PRD Section "Offline-First Requirements"
