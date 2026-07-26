# Canonical Element Registry — Lumina v2

**Doc ID:** DOC-001 (FONDAMENTAL)  
**Version:** 1.0  
**Statut:** SOURCE DE VÉRITÉ ABSOLUE  
**Date:** 2026-07-24  

**RÈGLE:** Chaque élément de la plateforme Lumina est catalogué ici. Si un élément n'est pas dans ce registre, il n'existe pas architecturalement. Toute nouvelle proposition d'ajout doit passer par une mise à jour de ce registre + justification.

---

## Méthodologie de Catalogage

Pour chaque élément:
- **Nom:** identifiant officiel unique
- **Type exact:** parmi {Concept, Capability, Runtime Service, Domain Object, Data Model, Template, Policy, Configuration}
- **Couche:** niveau hiérarchique (Vision → UI)
- **Possède-t-il un état?** Non = immuable par définition / Oui = mutable dans le temps
- **Possède-t-il un comportement?** Non = description statique / Oui = exécutable
- **Est-ce persistant?** Non = mémoire vive / Oui = stocké en BDD
- **Est-ce configurable?** Non = défini une fois pour toutes / Oui = paramétrable par org
- **Est-ce exécutable?** Non = donnée / Oui = code qui s'exécute
- **Peut-il être sérialisé?** Non = concept abstrait / Oui = peut être converti en bytes
- **Peut-il être stocké?** Non = structure code / Oui = peut vivre en BDD
- **Peut-il être compilé?** Non = jamais transformé / Oui = transformé en runtime config
- **Peut-il être remplacé?** Non = fondamental, irremplaçable / Oui = technologie interchangeable

---

## REGISTRE DES CONCEPTS (du Conceptual Model)

Ces concepts existent indépendamment de toute technologie.

| Nom | Type | Couche | État? | Comportement? | Persistant? | Configurable? | Exécutable? | Sérialisable? | Stockable? | Compilable? | Remplaçable? |
|-----|------|--------|-------|---------------|-------------|--------------|-------------|--------------|-----------|------------|-------------|
| Identity | Concept | Conceptual Model | Non | Oui (profil unique) | Non | Non | Oui | Non | Non | Non | **Non** |
| Organization | Concept | Conceptual Model | Oui | Oui (structure admin) | Non | Non | Oui | Non | Non | Non | **Non** |
| OrgUnit | Concept | Conceptual Model | Oui | Oui (segment structurel) | Non | Non | Non | Oui | Non | Non | **Non** |
| Resource | Concept | Conceptual Model | Oui | Oui (objet manipulable) | Non | Non | Non | Oui | Non | Non | **Non** |
| Relationship | Concept | Conceptual Model | Non | Oui (connexion universelle) | Non | Non | Non | Non | Non | Non | **Non** |
| Activity | Concept | Conceptual Model | Non | Oui (événement temporel modifiant state) | Non | Non | Oui | Non | Non | Non | **Non** |
| Capability | Concept | Conceptual Model | Non | Oui (unité composable) | Non | Non | Non | Non | Non | Non | **Non** |
| Policy | Concept | Conceptual Model | Non | Oui (règle testable/évaluable) | Non | **Oui** | Non | Oui | Oui | Non | **Non** |
| Manifest | Concept | Conceptual Model | Oui | Non (configuration) | **Oui** | **Oui** | Non | **Oui** | **Oui** | **Oui** | **Oui** |
| Template | Concept | Conceptual Model | Non | Non (blueprint config) | Non | **Oui** | Non | **Oui** | **Oui** | **Oui** | **Non** |
| Workflow | Concept | Conceptual Model | Oui | Oui (séquence événementielle) | Non | **Oui** | Non | **Oui** | Non | Non | **Non** |
| Form | Concept | Conceptual Model | Non | Oui (définition structurée) | Non | **Oui** | Non | **Oui** | Non | Non | **Non** |
| Vocabulary | Concept | Conceptual Model | Non | Oui (catalogue de termes) | Non | **Oui** | Non | **Oui** | **Oui** | Non | **Non** |
| Branding | Concept | Conceptual Model | Oui | Non (tokens visuels) | Non | **Oui** | Non | **Oui** | **Oui** | Non | **Non** |
| Notification | Concept | Conceptual Model | Non | Oui (service multi-canal) | Non | **Oui** | Oui | Oui | Oui | Non | **Non** |
| Audit | Concept | Conceptual Model | Non | Non (journal immuable) | **Oui** | Non | Non | **Oui** | **Oui** | Non | **Non** |
| Offline Sync | Concept | Conceptual Model | Oui | Oui (synchronisation bidirectionnelle) | Non | **Oui** | Oui | Non | Non | Non | **Non** |
| Permission | Concept | Conceptual Model | Non | Oui (droit fin) | Non | Non | Non | Oui | Oui | Non | **Non** |

---

## REGISTRE DES PLATFORM CAPABILITIES

Ce sont les briques universelles que la plateforme fournit.

| Nom | Type | Couche | État? | Comportement? | Persistant? | Configurable? | Exécutable? | Sérialisable? | Stockable? | Compilable? | Remplaçable? |
|-----|------|--------|-------|---------------|-------------|--------------|-------------|--------------|-----------|------------|-------------|
| Resource Capability | Capability | Platform Capabilities | Non | Oui (CRUD générique) | Non | Non | **Oui** | Non | Non | **Oui** | **Non** |
| Identity Capability | Capability | Platform Capabilities | Non | Oui (profiles uniques) | Non | Non | **Oui** | Non | Non | **Oui** | **Non** |
| Relationship Capability | Capability | Platform Capabilities | Non | Oui (connexions universelles) | Non | Non | **Oui** | Non | Non | **Oui** | **Non** |
| Workflow Capability | Capability | Platform Capabilities | Oui | Oui (orchestration étapes) | Non | **Oui** | **Oui** | **Oui** | Non | **Oui** | **Non** |
| Forms Capability | Capability | Platform Capabilities | Non | Oui (génération formulaire dynamique) | Non | **Oui** | **Oui** | **Oui** | Non | **Oui** | **Non** |
| Vocabulary Capability | Capability | Platform Capabilities | Non | Oui (catalogue termes) | Non | **Oui** | **Oui** | **Oui** | **Oui** | Non | **Non** |
| Branding Capability | Capability | Platform Capabilities | Oui | Non (tokens visuels) | Non | **Oui** | Non | **Oui** | **Oui** | Non | **Non** |
| Search Capability | Capability | Platform Capabilities | Non | Oui (full-text + tags) | Non | **Oui** | **Oui** | Non | Non | Non | **Non** |
| Reporting Capability | Capability | Platform Capabilities | Non | Oui (export configurables) | Non | **Oui** | **Oui** | Non | Non | Non | **Non** |
| Notification Capability | Capability | Platform Capabilities | Non | Oui (multi-canal) | Non | **Oui** | **Oui** | **Oui** | Non | Non | **Non** |
| Lifecycle Capability | Capability | Platform Capabilities | Oui | Oui (states configurables) | Non | **Oui** | **Oui** | **Oui** | **Oui** | Non | **Non** |
| Policy Capability | Capability | Platform Capabilities | Non | Oui (règles évaluables) | Non | **Oui** | **Oui** | **Oui** | **Oui** | Non | **Non** |
| Configuration Capability | Capability | Platform Capabilities | Oui | Oui (settings par org) | Non | **Oui** | **Oui** | **Oui** | **Oui** | Non | **Non** |
| Manifest Capability | Capability | Platform Capabilities | Non | Oui (lecture YAML → config) | Non | Non | **Oui** | **Oui** | **Oui** | **Oui** | **Non** |
| Capability Registry | Capability | Platform Capabilities | Non | Oui (registry d'activations) | Non | Non | **Oui** | **Oui** | Non | Non | **Non** |
| Offline Sync Capability | Capability | Platform Capabilities | Non | Oui (sync bidirectionnelle) | Non | **Oui** | **Oui** | Non | Non | **Oui** | **Non** |
| Audit Capability | Capability | Platform Capabilities | Non | Oui (logging immuable) | Non | Non | **Oui** | **Oui** | **Oui** | Non | **Non** |
| Permission Capability | Capability | Platform Capabilities | Non | Oui (droits fins) | Non | Non | **Oui** | **Oui** | Oui | Non | **Non** |

---

## REGISTRE DES RUNTIME SERVICES

Orchestrateurs uniquement. Ne créent rien. Ne décident de rien.

| Nom | Type | Couche | État? | Comportement? | Persistant? | Configurable? | Exécutable? | Sérialisable? | Stockable? | Compilable? | Remplaçable? |
|-----|------|--------|-------|---------------|-------------|--------------|-------------|--------------|-----------|------------|-------------|
| Manifest Loader | Runtime Service | Runtime Services | Non | Oui (charge manifest YAML) | Non | Non | **Oui** | Non | Non | **Non** | **Oui** |
| Dependency Resolver | Runtime Service | Runtime Services | Non | Oui (résout DAG de dépendances) | Non | Non | **Oui** | Non | Non | **Non** | **Oui** |
| Capability Orchestrator | Runtime Service | Runtime Services | Non | Oui (initialise capacités en ordre topologique) | Non | Non | **Oui** | Non | Non | **Non** | **Oui** |
| Context Manager | Runtime Service | Runtime Services | Non | Oui (propage orgId, userId, locale) | Non | Non | **Oui** | Non | Non | **Non** | **Oui** |
| Business Pack Activator | Runtime Service | Runtime Services | Non | Oui (lie template → organization) | Non | Non | **Oui** | Non | Non | **Non** | **Oui** |
| TypedEventBus | Runtime Service | Runtime Services | Non | Oui (communique entre capacités) | Non | Non | **Oui** | Non | Non | **Non** | **Oui** |
| HotSwap Engine | Runtime Service | Runtime Services | Non | Oui (active/désactive/rollback capabilities) | Non | Non | **Oui** | Non | Non | **Non** | **Oui** |
| App Composer | Runtime Service | Runtime Services | Non | Oui (assemble modules UI depuis Capacities) | Non | Non | **Oui** | Non | Non | **Non** | **Oui** |
| Init Coordinator | Runtime Service | Runtime Services | Non | Oui (coordonne ordre d'initialisation) | Non | Non | **Oui** | Non | Non | **Non** | **Oui** |

---

## REGISTRE DES DOMAIN OBJECTS

Instanciations concrètes des Concepts. Ne créent RIEN de nouveau.

| Nom | Type | Couche | État? | Comportement? | Persistant? | Configurable? | Exécutable? | Sérialisable? | Stockable? | Compilable? | Remplaçable? |
|-----|------|--------|-------|---------------|-------------|--------------|-------------|--------------|-----------|------------|-------------|
| Transaction | Domain Object | Domain Model | Oui | Oui (resource financière) | **Oui** | **Oui** | Non | **Oui** | **Oui** | Non | **Non** |
| Category | Domain Object | Domain Model | Oui | Non (resource lookup) | **Oui** | **Oui** | Non | **Oui** | **Oui** | Non | **Non** |
| Member | Domain Object | Domain Model | Oui | Oui (Resource + Identity) | **Oui** | **Oui** | Non | **Oui** | **Oui** | Non | **Non** |
| Event | Domain Object | Domain Model | Oui | Oui (Resource + Activity) | **Oui** | **Oui** | Non | **Oui** | **Oui** | Non | **Non** |
| OrgUnit | Domain Object | Domain Model | Oui | Oui (Resource + Relationship) | **Oui** | **Oui** | Non | **Oui** | **Oui** | Non | **Non** |
| GroupMembership | Domain Object | Domain Model | Non | Non (Relationship) | **Oui** | Non | Non | **Oui** | **Oui** | Non | **Non** |
| ArchiveEntry | Domain Object | Domain Model | Oui | Oui (Resource + Lifecycle) | **Oui** | **Oui** | Non | **Oui** | **Oui** | Non | **Non** |
| NotificationRecord | Domain Object | Domain Model | Non | Non (Activity) | **Oui** | Non | Non | **Oui** | **Oui** | Non | **Non** |
| AuditLogEntry | Domain Object | Domain Model | Non | Non (Activity logged) | **Oui** | Non | Non | **Oui** | **Oui** | Non | **Non** |
| PendingOperation | Domain Object | Domain Model | Non | Non (Activity + Offline) | **Oui** | Non | Non | **Oui** | **Oui** | Non | **Non** |
| UserSession | Domain Object | Domain Model | Non | Non (Identity + Security) | **Oui** | Non | Non | **Oui** | **Oui** | Non | **Non** |

---

## REGISTRE DES DATA MODEL ELEMENTS

Stockage uniquement. Ne définit aucun concept.

| Nom | Type | Couche | État? | Comportement? | Persistant? | Configurable? | Exécutable? | Sérialisable? | Stockable? | Compilable? | Remplaçable? |
|-----|------|--------|-------|---------------|-------------|--------------|-------------|--------------|-----------|------------|-------------|
| organizations (table) | Data Model | Data Model | Non | Non | **Oui** | Non | Non | **Oui** | **Oui** | Non | **Oui** |
| users (table) | Data Model | Data Model | Non | Non | **Oui** | Non | Non | **Oui** | **Oui** | Non | **Oui** |
| transactions (table) | Data Model | Data Model | Oui | Non | **Oui** | **Oui** | Non | **Oui** | **Oui** | Non | **Oui** |
| categories (table) | Data Model | Data Model | Non | Non | **Oui** | **Oui** | Non | **Oui** | **Oui** | Non | **Oui** |
| members (table) | Data Model | Data Model | Oui | Non | **Oui** | **Oui** | Non | **Oui** | **Oui** | Non | **Oui** |
| org_units (table) | Data Model | Data Model | Oui | Non | **Oui** | **Oui** | Non | **Oui** | **Oui** | Non | **Oui** |
| group_memberships (table) | Data Model | Data Model | Non | Non | **Oui** | Non | Non | **Oui** | **Oui** | Non | **Oui** |
| events (table) | Data Model | Data Model | Oui | Non | **Oui** | **Oui** | Non | **Oui** | **Oui** | Non | **Oui** |
| archive_entries (table) | Data Model | Data Model | Oui | Non | **Oui** | **Oui** | Non | **Oui** | **Oui** | Non | **Oui** |
| notifications (table) | Data Model | Data Model | Non | Non | **Oui** | Non | Non | **Oui** | **Oui** | Non | **Oui** |
| audit_logs (table) | Data Model | Data Model | Non | Non | **Oui** | Non | Non | **Oui** | **Oui** | Non | **Oui** |
| pending_operations (table) | Data Model | Data Model | Non | Non | **Oui** | Non | Non | **Oui** | **Oui** | Non | **Oui** |
| user_sessions (table) | Data Model | Data Model | Non | Non | **Oui** | Non | Non | **Oui** | **Oui** | Non | **Oui** |
| org_settings (table) | Data Model | Data Model | Non | Non | **Oui** | **Oui** | Non | **Oui** | **Oui** | Non | **Oui** |
| notification_preferences (table) | Data Model | Data Model | Non | Non | **Oui** | **Oui** | Non | **Oui** | **Oui** | Non | **Oui** |

---

## REGISTRE DES TEMPLATES

Configuration pure. Zéro code exécutable.

| Nom | Type | Couche | État? | Comportement? | Persistant? | Configurable? | Exécutable? | Sérialisable? | Stockable? | Compilable? | Remplaçable? |
|-----|------|--------|-------|---------------|-------------|--------------|-------------|--------------|-----------|------------|-------------|
| church-template | Template | Templates | Non | Non | Non | **Oui** | Non | **Oui** | **Oui** | **Oui** | **Oui** |
| school-template | Template | Templates | Non | Non | Non | **Oui** | Non | **Oui** | **Oui** | **Oui** | **Oui** |
| ngo-template | Template | Templates | Non | Non | Non | **Oui** | Non | **Oui** | **Oui** | **Oui** | **Oui** |
| company-template | Template | Templates | Non | Non | Non | **Oui** | Non | **Oui** | **Oui** | **Oui** | **Oui** |
| custom-template | Template | Templates | Non | Non | Non | **Oui** | Non | **Oui** | **Oui** | **Oui** | **Oui** |

---

## PROPERTIES DE VALIDATION

Après catalogage complet, appliquer ces filtres:

1. **Ambiguïté:** tout élément avec plus d'une couche assignée → ÉLIMINER
2. **Doublon conceptuel:** deux entrées avec même responsabilité mais nom différent → CONSOLIDER
3. **Invention en bas:** une table SQL définissant un concept → REJETER
4. **Runtime décisionnaire:** un Runtime Service créant une Capacité → DÉPLACER
5. **Fonctionnalité déguisée:** une Capability contenant >1 responsabilité métier → DÉCOMPOSER
6. **Capability domain-specific:** une Capability connaissant "église" → MOVER vers Business Pack ou Template
