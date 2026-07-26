# Conceptual Model v1 — Lumina

**Doc ID:** DOC-CONCEPTUAL-MODEL  
**Version:** 1.0  
**Statut:** SOURCE DE VÉRITÉ ABSOLUE  
**Date:** 2026-07-24  
**Règle :** Aucun Runtime, aucun schéma SQL, aucun écran, aucune API ne peut introduire un concept inexistant ici.

---

## Principes

1. Ces concepts existent indépendamment de toute technologie.
2. Ils ne décrivent ni tables, ni écrans, ni moteurs, ni APIs.
3. Chaque concept a des frontières claires et un contre-exemple explicite.
4. Un concept qui ne peut pas survivre dans un autre domaine (banque, gestion, logistique) n'appartient pas ici.

---

## Concepts (17)

### Identity
Entité qui possède un profil unique reconnaissable. Possède des attributs (nom, email, photo, téléphone). Ne présume pas du rôle dans l'organisation.
- **Relations:** appartient à → Organization
- **Invariant:** deux Identity distinctes ne partagent jamais le même identifiant primaire
- **Contre-exemple:** un rôle RBAC n'est PAS une Identity — c'est une Permission

### Organization
Structure administrative autonome possédant une identité, des membres, des ressources et une configuration. Peut appartenir à une Organization parent.
- **Relations:** contient → Identity, Resource; parent de → Organization; possède → Manifest
- **Invariant:** les données de deux Organization n'interagissent jamais
- **Contre-exemple:** un département interne n'est PAS une Organization — c'est une OrgUnit

### OrgUnit
Segment structurel au sein d'une Organization. Supporte la hiérarchie récursive (parent → enfants) et le DAG (multi-appartenance).
- **Relations:** appartient à → Organization; parent → OrgUnit; contient → OrgUnit, Identity
- **Invariant:** profondeur max = 5
- **Contre-exemple:** une transaction financière n'est PAS un OrgUnit

### Resource
Tout objet manipulable par l'Organisation. C'est le concept fondamental le plus générique. Sous-types : Person, Document, Event, Transaction, Asset, Media, etc.
- **Relations:** appartient à → Organization; liée à → Relationship
- **Invariant:** toute Resource manipulable est une Resource — par définition
- **Contre-exemple:** un workflow n'est PAS une Resource — c'est une séquence d'Activity

### Relationship
Connexion universelle entre deux entités. Types : belongs_to, has_many, many_to_many, hierarchical, referenced_by.
- **Relations:** relie → Resource à → Resource; lie → Identity à → OrgUnit; lie → Resource à → Organization
- **Invariant:** une Relationship ne porte AUCUNE logique métier
- **Contre-exemple:** un approval chain n'est PAS une Relationship — c'est un Workflow

### Activity
Événement temporel qui modifie l'état d'une Resource. Type : create, update, delete, approve, reject, transfer, notify.
- **Relations:** affecte → Resource; causée par → Identity; loguée par → Audit
- **Invariant:** une Activity est immuable une fois enregistrée
- **Contre-exemple:** un formulaire n'est PAS une Activity — c'est un moyen de saisir des données

### Capability
Capacité offerte par la plateforme. Inscrire dans le registre officiel. Composable, activable, désactivable, indépendante du métier.
- **Relations:** requiert → Foundation; orchestrée par → Runtime; utilisée par → Business Pack
- **Invariant:** une Capability ne résout qu'un seul problème
- **Contre-exemple:** "Gestion financière" n'est PAS une Capability — c'est une composition de 6+ capacités

### Policy
Règle configurable testable et évaluable sans effet secondaire. Types : approval_threshold, retention_period, rate_limit, quota, visibility_rule.
- **Relations:** applicable à → Resource; évaluée par → Workflow; configurée dans → Manifest
- **Invariant:** une Policy ne contient JAMAIS de logique conditionnelle complexe (>3 niveaux)
- **Contre-exemple:** un formulaire de transaction n'est PAS une Policy — c'est un Form

### Manifest
Configuration complète d'une instance Organization. Compile un Template en configuration runtime. Format YAML/JSON.
- **Relations:** instancié depuis → Template; appliqué à → Organization; interprété par → Runtime
- **Invariant:** un Manifest ne peut PAS ajouter de nouvelles Capacities
- **Contre-exemple:** une table SQL n'est PAS un Manifest — c'est du stockage

### Template
Collection prédéfinie de Vocabularies, Forms, Workflows, Policies, Permissions, Branding réutilisable par type d'Organization.
- **Relations:** instancié par → Manifest; compose → Business Pack
- **Invariant:** un Template ne contient QUE de la configuration, ZÉRO code
- **Contre-exemple:** un moteur d'approbation n'est PAS un Template — c'est un Workflow

### Workflow
Séquence d'étapes déclenchée par un événement. Types d'étapes : auto, approval, notification, conditional, delay, parallel.
- **Relations:** déclenchée par → Activity; applique → Policy; notifie via → Notification
- **Invariant:** un Workflow ne peut modifier directement les données financières validées
- **Contre-exemple:** une table SQL n'est PAS un Workflow — c'est du stockage

### Form
Définition structurée de champs rendue dynamiquement sans JSX dur. Types de champ : text, number, date, select, multiselect, file_upload, signature.
- **Relations:** valide via → Policy; lit labels depuis → Vocabulary; soumet vers → Resource
- **Invariant:** aucun Form n'est codé en JSX — tout passe par la définition
- **Contre-exemple:** un dashboard n'est PAS un Form — c'un écran de présentation

### Vocabulary
Catalogue centralisé de termes, valeurs et traductions avec namespaces. Source unique pour toutes les listes référençables.
- **Relations:** utilisé par → Form, → Workflow, → Manifest
- **Invariant:** une valeur Vocabulary n'est JAMAIS supprimée — marquée deprecated
- **Contre-exemple:** une table categories PostgreSQL n'est PAS le Vocabulary — c'est son stockage

### Branding
Tokens visuels et stylistiques : couleur accent, logo, police, thème, palette. Configurables par Organization.
- **Relations:** appliqué par → UI; défini dans → Manifest; hérité depuis → OrgUnit parent
- **Invariant:** le Branding ne contient JAMAIS de logique comportementale
- **Contre-exemple:** un bouton React n'est PAS du Branding — c'est un composant UI

### Notification
Service de messagerie multi-canal (in_app, push, email, sms) avec templates, triggers et rate limiting.
- **Relations:** déclenchée par → Workflow; personnalisée via → Policy; lue par → Identity
- **Invariant:** une Notification n'est JAMAIS envoyée sans trigger
- **Contre-exemple:** un email marketing n'est PAS une Notification Lumina — c'est hors scope

### Audit
Journal immuable de toutes les actions. Qui, quoi, quand, old_value, new_value, ip_address.
- **Relations:** captée par → Activity; liée à → Identity, → Resource
- **Invariant:** inviolable — jamais modifiable, jamais supprimable
- **Contre-exemple:** un log d'application n'est PAS un Audit Lumina — l'Audit est lié aux actions USER

### Offline Sync
Synchronisation bidirectionnelle entre local (SQLite) et distant (PostgreSQL). Stratégies : LWW, server-wins, immutable, UUID dedup.
- **Relations:** opère sur → Resource; guidé par → Policy; initié par → Application
- **Invariant:** l'écriture locale précède TOUJOURS l'écriture distante
- **Contre-exemple:** un cache HTTP n'est PAS de l'Offline Sync Lumina

### Permission
Droit fin exprimé : `resource : action : level`. Résolu depuis Manifest, injecté dans JWT. Vérifié au runtime.
- **Relations:** attribuée à → Role; utilisée par → Capability; évaluée par → Policy
- **Invariant:** une Permission ne peut jamais être "soustraite" par héritage
- **Contre-exemple:** un User n'est PAS une Permission — c'est une Identity qui PORT des Permissions

---

## Matrice des Dépendances

```
Identity ──→ Manifest, Workflow, Notification, Audit, Permission
Organization ──→ Manifest, OrgUnit, Resource
OrgUnit ──→ Organization, Resource
Resource ──→ Relationship, Activity, Permission, Policy, Offline Sync
Relationship ──→ (aucune — couche fondamentale)
Activity ──→ Audit
Capability ──→ (aucune — auto-portée)
Policy ──→ (aucune — auto-portée)
Manifest ──→ Template, Policy, Vocabulary
Template ──→ (aucune — configuration pure)
Workflow ──→ Activity, Policy, Notification, Form
Form ──→ Vocabulary, Policy
Vocabulary ──→ (aucune — couche fondamentale)
Branding ──→ (aucune — couche fondamentale)
Notification ──→ Policy
Audit ──→ Activity
Offline Sync ──→ Policy
Permission ──→ Identity
```

## Contre-Exemples Globalux

Un concept N'appartient PAS au Conceptual Model si:
- Il mentionne une technologie (SQL, SQLite, React Native, WebSocket)
- Il mentionne une implémentation (table, écran, API endpoint, moteur)
- Il est spécifique à un domaine (dîme, baptême, classe, projet, stock)
- Il peut être remplacé sans changer le comportement utilisateur
- Il décrit UN SEUL cas d'usage
