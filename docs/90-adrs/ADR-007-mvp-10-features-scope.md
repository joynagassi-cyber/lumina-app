# ADR-007 : MVP Réduit à 10 Fonctionnalités Prioritaires

**Date :** 2026-01-15  
**Statut :** ACCEPTÉ  
**Décideurs :** CTO + Product Owner + Architecte Principal  
**Conséquences :** 27 fonctionnalités retirées du MVP, roadmap étalée sur 12 semaines minimum

---

## 1. Contexte

Le code Flutter existant contient **37 fonctionnalités**. L'analyse a montré que la plupart sont :
- Obsolètes ou inutilisées
- Spécifiques à l'église MFE-JC (non-agnostiques)
- Redondantes avec d'autres modules
- Trop complexes pour un MVP

Le développeur unique + IA ne peut pas livrer 37 fonctionnalités de qualité.

## 2. Questions

Combien de fonctionnalités faut-il inclure dans le MVP et dans quel ordre ?

## 3. Décision

**MVP = 10 fonctionnalités maximum**, réparties en 3 niveaux de priorité :

### Niveau K1 — Critique (Semaines 1-4)
| # | Fonctionnalité | Pourquoi |
|---|---|---|
| 1 | **Authentification Admin** | Accès sécurisé, rôles |
| 2 | **Configuration Organisation** | Manifest engine setup |
| 3 | **Grand Livre (Ledger)** | Cœur du système financier |
| 4 | **Bilan Financier** | Exigence métier absolue |
| 5 | **Rapports Financiers** | PDF/CSV export |

### Niveau K2 — Important (Semaines 5-8)
| # | Fonctionnalité | Pourquoi |
|---|---|---|
| 6 | **Gestion Membres** | CRUD basique, dossier |
| 7 | **Calendrier Événements** | Planning de base |
| 8 | **Gestion Rôles/Permissions** | Via manifest |

### Niveau K3 — Souhaitable (Semaines 9-12)
| # | Fonctionnalité | Pourquoi |
|---|---|---|
| 9 | **Notifications** | Alertes internes |
| 10 | **Export/Import Données** | Migration, backup |

### Fonctionnalités RETIRÉES du MVP
- Bible/Études bibliques → V2
- Sacrements → V2
- Gestion financière avancée (budget) → V2
- Communication membres → V3
- Analytics avancés → V3
- Les 30 autres → jamais ou V3+

## 4. Alternatives Envisagées

### Alternative A : Livrer Toutes les 37 Fonctionnalités
- **Avantages :** "Tout est là" dès le départ
- **Inconvénients :** Impossible à livrer en 12 semaines par 1 dev + IA, qualité médiocre, bugs massifs, abandon du projet

### Alternative B : MVP 10 Fonctionnalités (Choix Retenu)
- **Avantages :** Livrable en 12 semaines, qualité élevée, feedback précoce, base extensible
- **Inconvénients :** Fonctionnalités manquantes au démarrage, besoin de communiquer clairement la roadmap

### Alternative C : MVP 5 Fonctionnalités (Ultra-Réduit)
- **Avantages :** Livraison très rapide
- **Inconvénients :** Trop limité pour démontrer la valeur, pas assez de données pour tester le sync offline

## 5. Conséquences

### Positives
- ✅ MVP livrable en 12 semaines par un développeur + IA
- ✅ Focus absolu sur le financier (priorité K1)
- ✅ Chaque fonctionnalité est testée et stable avant la suivante
- ✅ Feedback utilisateur possible dès semaine 4

### Négatives (et mitigations)
- ⚠️ L'église MFE-JC voudra la Bible rapidement → **Mitigation :** Bible en V2, pas dans le scope MVP
- ⚠️ Les sacrements sont importants → **Mitigation :** Sacrements en V2, après le financier stabilisé

## 6. Critères de Passage au V2

Le passage à V2 est déclenché quand :
1. Les 10 fonctionnalités MVP sont déployées et stables (zéro bug critique pendant 30 jours)
2. Au moins 2 organisations utilisent le système en production
3. Le développeur a validé que l'architecture Platform Capabilities fonctionne

## 7. Références

- ROADMAP_DEVELOPPEMENT.md (Phases 1-3)
- PRD Section "MVP Scope"
