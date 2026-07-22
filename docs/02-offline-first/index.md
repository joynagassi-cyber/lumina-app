# Architecture Offline-First & Synchronisation Delta

**Niveau :** Technique / Backend & Frontend  
**Responsabilité unique :** Garantir que toutes les opérations critiques (surtout financières) restent fonctionnelles sans réseau, tout en assurant une synchronisation fiable et résolvant les conflits multi-utilisateurs.

---

## 1. Principes Fondamentaux

1. **Le Local est la Source de Vérité Immédiate**  
   Toute action utilisateur (création, modification, suppression logique) est appliquée instantanément à la base de données locale (SQLite). L'utilisateur ne subit jamais de latence due à l'état du réseau.
2. **Le Serveur est l'Autorité Finale (Serf)**  
   La base de données InsForge/PostgreSQL détient la version définitive des données après validation et intégrité métier.
3. **Synchronisation Delta, jamais Complète**  
   L'application n'enverra/ne téléchargera jamais toute la base. Elle transmettra uniquement les modifications depuis la dernière connexion connue (point de horodatage).
4. **Architecture Réactive Locale**  
   L'interface utilisateur (React Native) est liée aux modèles locaux (WatermelonDB). Si la BDD locale change, l'écran se met à jour en < 16ms.

---

## 2. Pile Technologique Choisie

| Composant | Choix Technique | Justification |
|-----------|----------------|---------------|
| **Base Locale** | **SQLite** via librairie `react-native-sqlite-storage` | Support natif Android/iOS offline, très performant, accessible hors-ligne. |
| **ORM Réactif** | **WatermelonDB** | Gère automatiquement les requêtes SQL complexes en local, synchronisation native avec les changements, et est conçu spécifiquement pour l'offline-first mobile. |
| **Gestion Conflits** | **CRDTs simplifiés & Timestamps** | Utilisation de `updated_at` (Last-Writer-Wins) pour la plupart des entités ; validation manuelle forcée pour les transactions financières critiques. |
| **File d'Attente** | **OpQueue** | Une table locale `.pending_operations` qui gère les mises en file avant envoi au backend. |

### Pourquoi WatermelonDB plutôt qu'un CRUD manuel ?
Les erreurs précédentes provenaient souvent de la propagation des IDs (`church_id`, `member_id`) à travers des appels API séquentiels fragiles. WatermelonDB lie les objets relationnels localement. Vous n'avez pas besoin de `SELECT` manuels ; l'ORM le calcule à la volée. De plus, le système de `sync()` automatise le delta.

---

## 3. Modèles de Convergence et Résolution de Conflits

Le cœur du problème offline est : *que se passe-t-il si deux utilisateurs modifient la même chose ?*

### 3.1 Stratégie "Last-Writer-Wins" (LWW) — Fallback Général
Appliquée aux ressources non-critiques (membres, groupes, événements).
- Règle : La version arrivée en dernier côté serveur écrase les autres.
- Implémentation : Chaque table possède une colonne `last_modified` (timestamp server).
- Si le client essaie d'envoyer une modification plus ancienne que ce qui est déjà en base : **Discard silently**.

### 3.2 Stratégie "Verrouillage Métier" (Finance & Bilans)
Appliquée aux transactions financières validées.
- Règle : Une transaction `validated=true` devient immutable.
- Si deux trésoriers tentent de modifier une dépense validée simultanément :
  1. Le premier gagnant valide sa mise à jour.
  2. Le second voit son synchronisation échouer explicitement.
  3. L'appel génère un **Conflit Local** : Un écran React Native apparaît "Modification impossible, une mise à jour serveur est en attente. Fusionner ?"
- Ce mode empêche toute perte accidentelle d'argent.

### 3.3 Synthèse des Stratégies par Domaine

| Entité | Stratégie de Conflit | Raison |
|--------|---------------------|--------|
| Membres | LWT Standard | Données éditoriales, modifications rarement simultanées. |
| Groupes | LWT Standard | Structure administrative. |
| Transactions (Draft) | Optimistic Locking (Version ID) | Empêche le trésorier B d'écraser le travail du trésorier A. |
| Transactions (Validated) | Bloquant / Interdit | Sécurité financière absolue. |
| Reçus (Images) | Multiples OK | Une image est stockée dans le cloud object storage (S3-compatible InsForge), les meta-données se fusionnent par Hash de fichier. |

---

## 4. Le Cycle de Synchronisation

Lorsque l'application détecte une connexion réseau (ou via un intervalle de fond), elle lance le pipeline suivant :

1. **Push Local** : Envoi au serveur de toutes les lignes de `.pending_operations` dont le statut est `pending`.
2. **Pull Delta** : Le serveur InsForge renvoie uniquement les ID changés depuis le dernier timestamp connu.
3. **Apply Remote** : Les nouvelles données sont insérées/mises à jour dans SQLite.
4. **Resolve Conflicts** : Si une opération Push a échoué (conflit), elle est marquée `needs_review`.
5. **Cleanup** : Les opérations servies sont supprimées de la file d'attente.

### Exemple de Flux de Données JSON

**Envoi au serveur (Push):**
```json
{
  "operations": [
    {
      "id": "op_1721",
      "resource": "financial_entry",
      "action": "create",
      "payload": { "amount": 50000, "category_id": 4, "type": "income" },
      "timestamp_client": 1687291000
    }
  ]
}
```

**Réponse Serveur (Diff Sync):**
```json
{
  "changes": [
    {
      "resource": "group",
      "id": "uuid_xxx",
      "updated_at": "2023-06-21T10:00:00Z",
      "data": { "name": "Jeunesse A", "updated_by": "pastor_bob" }
    }
  ],
  "conflicts": []
}
```

---

## 5. Intégration avec le Platform Core

Le Platform Core interagit avec le module Offline uniquement via des abstractions paires :
- `Manifest Engine` reste en charge du schéma (`forms schema`, `workflow states`) même offline. Le moteur de formulaires s'exécute entièrement dans `src/core/forms/` et pointe vers le cache SQLite local.
- Aucun moteur ne doit faire d'appel HTTP bloquant. Si le réseau tombe au milieu d'une sauvegarde, le formulaire reste ouvert, sauvegardant localement jusqu'à ce que l'utilisateur puisse continuer.

---

## 6. Points de Vigilance pour les Agents IA

Si vous manipulez ce module :
1. Ne jamais effacer `.pending_operations` sans avoir sécurisé une copie de secours (export CSV/JSON).
2. Toute modification du schéma WatermelonDB nécessite une `migration()`. WatermelonDB a une forte contrainte sur le nommage des colonnes (`id`, `text` fields prefixed with `_`).
3. Pour les rapports financiers (`Bilan`, `Grand Livre`), l'algorithme doit calculer sur le local + appliquer un filtre `WHERE synced=true` pour exclure les opérations en cours de transit non confirmées, sinon le solde sera faux.
