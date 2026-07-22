# ADR-002 : Réécriture React Native au lieu de Migrer Flutter Vers RN

**Date :** 2026-01-15  
**Statut :** ACCEPTÉ  
**Décideurs :** CTO + Architecte Principal  
**Conséquences :** Perte du code Flutter existant, contrôle total sur l'architecture, coût de migration initial élevé

---

## 1. Contexte

L'application Lumina existe actuellement en **Flutter/Dart** avec un backend **Supabase**. Le code contient ~37 fonctionnalités, dont beaucoup sont obsolètes, mal architecturées, ou spécifiques à l'église MFE-JC. Le développeur souhaite passer à **React Native + TypeScript** avec un backend **InsForge**.

## 2. Questions

Faut-il migrer le code Flutter existant vers React Native (translation automatique) ou tout réécrire de zéro en React Native ?

## 3. Décision

Nous **réécrivons entièrement** l'application en React Native. Le code Flutter existant n'est conservé QUE comme référence pour :
- Comprendre les fonctionnalités métier
- Identifier ce qui a bien/mal fonctionné
- Extraire les données persistantes (members, transactions)

**AUCUN code Flutter n'est translité automatiquement.** Chaque écran, chaque logique métier est repensé depuis zéro dans la nouvelle architecture.

## 4. Alternatives Envisagées

### Alternative A : Translation Flutter → React Native
- **Avantages :** Conservation du code existant, développement plus rapide initialement
- **Inconvénients :** Hérite de toutes les dettes techniques, architecture toujours orientée "église", migration des données toujours nécessaire, duplication du work final

### Alternative B : Réécriture Complète (Choix Retenu)
- **Avantages :** Architecture propre dès le départ, agnosticisme natif, suppression des 27 fonctionnalités non-MVP, choix technologique optimal (RN + TS), nettoyage forcé de la dette
- **Inconvénients :** Temps de développement initial plus long, perte du code existant, nécessité d'une migration de données séparée

### Alternative C : Co-existence Provisionnelle
- **Avantages :** L'ancien code continue de fonctionner pendant la réécriture
- **Inconvénients :** Double maintenance, confusion pour les utilisateurs, complexité opérationnelle excessive

## 5. Conséquences

### Positives
- ✅ Architecture agnostique native dès le premier jour
- ✅ Élimination forcée de 27 fonctionnalités obsolètes sur 37
- ✅ Stack moderne et bien supportée (React Native + TypeScript)
- ✅ Données migrées une seule fois depuis Supabase vers InsForge
- ✅ Pas de dette technique héritée

### Négatives (et mitigations)
- ⚠️ Perte du code Flutter existant → **Mitigation :** Documentation exhaustive dans `legacy-analysis/`
- ⚠️ Temps de développement initial +40% → **Mitigation :** MVP réduit à 10 fonctionnalités prioritaires
- ⚠️ Migration de données nécessaire → **Mitigation :** Script de migration dédié dans Phase 0

## 6. Critères de Révision

Cette décision sera réévaluée si :
1. Plus de 60% du code Flutter est encore fonctionnellement nécessaire au moment de la réécriture
2. Le temps de développement initial dépasse de plus de 50% la roadmap planifiée

## 7. Références

- PRD Section "Technologies"
- legacy-analysis/Flutter_Code_Audit.md
- ADR-005 (Stack Technique — quelle stack on choisit ET pourquoi)
