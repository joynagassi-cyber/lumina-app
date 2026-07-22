# ADR-001 : Platform Core (Lightweight Runtime) au lieu de Runtime Organisationnel Complet

**Date :** 2026-01-15  
**Statut :** ACCEPTÉ  
**Décideurs :** CTO + Architecte Principal  
**Conséquences :**架构 simplifiée, maintenance réduite, extensibilité contrôlée

---

## 1. Contexte

L'équipe a initialement conçu un **"Organisation Runtime"** massif avec 20+ moteurs interdépendants (Meta Model, Query Language, AI Engine, Transformation Engine, etc.). Cette vision visait un système d'exploitation organisationnel universel.

Cependant, l'analyse a révélé que :
- **15 des 20 moteurs** n'apportent rien au MVP
- **5 moteurs** sont véritablement essentiels pour l'agnosticisme
- Le risque de sur-ingénierie est **élevé** (retard, bugs, maintenance impossible)
- Le développeur unique + IA ne peut pas maintenir un runtime complet

## 2. Questions

Doit-on implémenter un runtime organisationnel complet (20+ moteurs) ou un Platform Core léger (5 moteurs) ?

## 3. Décision

Nous adoptons le **Platform Core (Lightweight Runtime)** avec exactement **5 moteurs configurables** :

| Moteur | Rôle | Type |
|---|---|---|
| Manifest Engine | Configuration organisationnelle via YAML/JSON | Interprété |
| Vocabulary Engine | Catalogue centralisé de termes et valeurs | Interprété |
| Forms Engine | Génération de formulaires dynamiques | Interprété |
| Workflow Engine | Orchestration de séquences et approbations | Hybride |
| Capability Engine | Registre de fonctionnalités activables | Code |

**Tout moteur supplémentaire doit être une capability native écrite en TypeScript, pas un nouveau moteur interprété.**

## 4. Alternatives Envisagées

### Alternative A : Runtime Organisationnel Complet (20+ moteurs)
- **Avantages :** Extensibilité maximale, tous les cas d'usage supportés nativement
- **Inconvénients :** Complexité explosive, temps de développement x5, risque de non-livraison, maintenance impossible pour un seul développeur + IA

### Alternative B : Pas de Runtime Du Tout (Code Dur)
- **Avantages :** Simplicité maximale, développement rapide
- **Inconvénients :** Zéro agnosticisme, chaque nouveau type d'organisation nécessite un fork du code, non maintenable

### Alternative C : Platform Core (Choix Retenu)
- **Avantages :** Agnosticisme réel pour les cas courants, risque maîtrisé, MVP livrable, extensible via capabilities
- **Inconvénients :** Ne couvre PAS tous les cas d'usage (certuns cas très spécifiques nécessiteront du code custom)

## 5. Conséquences

### Positives
- ✅ Développement du MVP en 12 semaines réalisable
- ✅ Architecture compréhensible par un développeur seul + IA
- ✅ Chaque document d'engine < 10 pages = contexte IA gérable
- ✅ Les organisations courantes (église, NGO, école, entreprise) sont supportées sans code change
- ✅ L'audit financier reste stable car pas de logic runtime dessus

### Négatives (et mitigations)
- ⚠️ Certains cas d'usage très spécifiques ne seront pas couverts → **Mitigation :** Les capabilities natives peuvent être ajoutées
- ⚠️ Risque que le Platform Core soit insuffisant à grande échelle → **Mitigation :** Réévaluation à v3.0 si 50+ organisations actives

## 6. Critères de Révision

Cette décision sera réévaluée quand :
1. Plus de 5 organisations différentes sont actives simultanément
2. Au moins 3 nouvelles capabilities natives ont été ajoutées
3. Le taux de features rejetées par le manifest dépasse 20%

## 7. Références

- DOC-PLATFORM-CAPA (Capability Engine)
- DOC-PLATFORM-MANIF (Manifest Engine)
- PRD Section "Universal Organization Platform"
