# ADR-009 : Authentification Admin-Uniquement en MVP

**Date :** 2026-01-15  
**Statut :** ACCEPTÉ  
**Décideurs :** CTO + Product Owner + Architecte Principal  
**Conséquences :** Les membres/consanguins ne peuvent PAS se connecter en MVP, seuls les leaders/admins ont un accès

---

## 1. Contexte

Le code Flutter existant inclut une fonctionnalité d'inscription et de connexion pour les membres ordinaires de l'église. Cependant, l'utilisateur a explicitement demandé que cette fonctionnalité soit **exclue du MVP**. L'application est conçue pour les leaders/gestionnaires, pas pour les membres finaux.

## 2. Questions

Qui doit pouvoir se connecter à l'application durante la phase MVP ? Les membres ordinaires sont-ils exclus de la conception multi-org elle-même, ou juste de la phase MVP ?

## 3. Décision

**Seuls les administrateurs et leaders organisés peuvent se connecter en MVP.**

### Clarification : Exclusion des Membres Ordinaires

Les membres ordinaires sont exclus **uniquement de la phase MVP**, pas de la conception architecturelle multi-org. Le DAG organisationnel (ADR-014) est conçu pour supporter les membres à terme, mais l'implémentation MVP se limite aux admins/trésoriers/leaders.

```
┌─────────────────────────────────────────┐
│         AUTHENTIFICATION MVP            │
├─────────────────────────────────────────┤
│ Utilisateurs autorisés :                │
│   - Administrateur (accès total)        │
│   - Trésorier (accès financier)         │
│   - Pasteur/Leader (accès limité)       │
│                                         │
│ Utilisateurs NON supportés en MVP :     │
│   - Membres ordinaires                  │
│   - Visiteurs                           │
│   - Portail public                      │
│                                         │
│ Architecture V2-ready :                 │
│   - DAG organisationnel conçu pour      │
│     membres comme noeuds futurs         │
│   - Multi-tenant org_id persiste        │
│   - Simple activation de features       │
│     sans refonte architecture           │
│                                         │
│ Inscription :                           │
│   - Manuelle par un admin               │
│   - Via dashboard d'administration      │
│   - Pas d'auto-inscription publique     │
└─────────────────────────────────────────┘
```

### Implémentation Technique

```typescript
// Types d'utilisateurs MVP
type UserRole = 'admin' | 'treasurer' | 'pastor' | 'staff';

// Pas de UserType = 'member' ou 'visitor' en MVP
// L'inscription se fait uniquement par l'admin :
POST /api/v1/users/create
Body: {
    email: string,
    password: string,
    role: UserRole,
    org_id: string,
    first_name: string,
    last_name: string
}
```

## 4. Alternatives Envisagées

### Alternative A : Admin-Uniquement en MVP (Choix Retenu)
- **Avantages :** Scope réduit, sécurité maximale, développement plus rapide, pas de portail public à construire
- **Inconvénients :** Les membres ne peuvent pas voir leurs propres données, inscription manuelle par admin

### Alternative B : Authentification Complète (Membres + Leaders)
- **Avantages :** Fonctionnalité complète dès le départ
- **Inconvénients :** +4 semaines de développement, complexité doublée, pas de valeur ajoutée pour le MVP financier

### Alternative C : Portail Public + App Privée
- **Avantages :** Les membres peuvent voir les annonces, événements
- **Inconvénients :** Triple complexité (app + portail + sync), hors scope MVP

## 5. Conséquences

### Positives
- ✅ MVP plus simple et plus rapide à livrer
- ✅ Sécurité renforcée (moins de points d'entrée)
- ✅ Focus sur le module financier (priorité K1)
- ✅ Les membres seront ajoutés manuellement par l'admin (workflow simple)

### Négatives (et mitigations)
- ⚠️ Les membres ne peuvent pas s'inscrire seuls → **Mitigation :** L'admin crée les comptes depuis le dashboard
- ⚠️ Portail public retardé à V2 → **Mitigation :** Communiqué clair sur la roadmap

## 6. Passage à V2 — Membres

L'authentification membre est ajoutée en V2 quand :
1. Le module financier est stable (30+ jours sans bug critique)
2. Au moins une organisation utilise le système quotidiennement
3. L'admin a exprimé le besoin explicite

## 7. Références

- PRD Section "MVP Scope"
- DOC-PLATFORM-MANIF (Rôles et permissions)
- DOC-PLATFORM-AUTH (si créé en V2)
