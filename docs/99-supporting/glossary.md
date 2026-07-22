# Glossaire de Lumina — Terminologie Officielle

**Doc ID:** DOC-GLOSSARY  
**Version:** 2.0  
**Statut :** VALIDÉ

---

## 1. Architecture

| Terme | Définition |
|---|---|
| **Platform Core** | Ensemble des 5 moteurs configurables (Manifest, Vocab, Forms, Workflow, Capability) qui rendent Lumina agnostique |
| **Capability** | Fonctionnalité native implémentée en TypeScript, enregistrée dans le Capability Engine |
| **Manifest** | Fichier de configuration (YAML/JSON) qui décrit une organisation spécifique |
| **Vocabulary** | Catalogue centralisé de tous les termes, catégories et valeurs utilisées dans l'application |
| **Runtime** | État compilé du Platform Core après chargement du manifest d'une organisation |

## 2. Données

| Terme | Définition |
|---|---|
| **Transaction** | Enregistrement financier (revenu, dépense, transfert) avec immutabilité après validation |
| **Ledger (Grand Livre)** | Enregistrement chronologique de toutes les transactions financières |
| **Bilan** | Rapport synthétique : Actif = Passif + Résultat |
| **Compensation** | Transaction inverse créée pour corriger une transaction validée |
| **Audit Trail** | Journal immuable de toutes les actions utilisateur |
| **Org-ID** | Identifiant unique de l'organisation, injecté à chaque accès données |

## 3. Workflow

| Terme | Définition |
|---|---|
| **Workflow** | Séquence d'étapes déclenchées par un événement |
| **Étape** | Unité atomique d'un workflow (auto, approval, notification) |
| **Trigger** | Événement qui démarre un workflow |
| **Approval Chain** | Suite hiérarchique d'approbations requises |
| **Timeout** | Délai max avant escalade ou rejet automatique |

## 4. Offline

| Terme | Définition |
|---|---|
| **Offline-First** | Architecture où l'application fonctionne localement et sync async |
| **WatermelonDB** | Bibliothèque SQLite wrapper pour React Native, utilisée pour le cache local |
| **Sync Queue** | File d'attente des opérations locales à synchroniser |
| **Conflict** | Situation où deux appareils modifient la même donnée |
| **LWW** | Last-Writer-Wins — stratégie de résolution de conflit par timestamp |
| **Immutable Record** | Données qui ne peuvent pas être modifiées après validation |

## 5. Interface

| Terme | Définition |
|---|---|
| **Formulaire Dynamique** | Formulaire rendu à partir d'une définition JSON, pas codé en dur |
| **Composant UI** | Élément React Native rendu par le Forms Engine |
| **Dashboard** | Page d'accueil personnalisée selon le rôle de l'utilisateur |
| **Role** | Ensemble de permissions attribué à un utilisateur |
| **Permission** | Droite fine (ex: `finance:ledger:write`) |

## 6. Organisation

| Terme | Définition |
|---|---|
| **Type d'Organisation** | Catégorie : church, school, ngo, company, custom |
| **Department** | Groupe logique d'utilisateurs au sein d'une organisation |
| **Feature Toggle** | Switch activant/désactivant une fonctionnalité par organisation |
| **Custom Org** | Organisation dont le type ne correspond à aucun template prédéfini |

## 7. Règles

| Terme | Définition |
|---|---|
| **Invariant** | Vérité fondamentale du système, jamais violée |
| **NeverBreak Rule** | Contrainte vérifiée automatiquement, violation = blocage déploiement |
| **ADR** | Architecture Decision Record — justification d'un choix architectural majeur |
| **PRD** | Product Requirements Document — spécification produit |

## 8. Termes Spécifiques MFE-JC

| Terme | Définition |
|---|---|
| **MFE-JC** | Mission Familiale Emmanuel - Jésus, organisation fondatrice de Lumina |
| **Ministère** | Département au sein d'une église (enfance, jeunes, hommes, femmes...) |
| **Dîme** | Contribution financière obligatoire (10% des revenus) dans les églises |
| **Offrande** | Contribution financière volontaire dans les églises |
| **Sacrement** | Rituel religieux (baptême, communion) — module V2 |
