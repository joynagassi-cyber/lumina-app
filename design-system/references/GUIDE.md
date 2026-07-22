# 🚀 Lumina — Guide du Design System

Bienvenue dans le design system de **Lumina**, la Plateforme Universelle d'Organisation.

## 📋 Table des Matières

| Élément | Description | Lien |
|---------|-------------|------|
| **📘 INDEX.md** | Document complet du design system (couleurs, typo, espacements, règles) | [Voir](./INDEX.md) |
| **🎨 Prototypes HTML** | Écrans interactifs du design | Voir ci-dessous |

## 🖥️ Écrans Prototypés

### 1. Écran de Connexion
![Login Preview](./references/login-preview.png)

Un écran d'authentification élégant avec les couleurs de marque orange → violet, des orbes organiques animées en arrière-plan, et un formulaire minimaliste.

**Caractéristiques :**
- Gradient hero orange → violet profond
- Logo Lumina avec effet de lumière pulsante
- Formulaire email + mot de passe
- Badge "Prêt pour le mode hors-ligne"
- Lien "Demander l'Accès" (admin-only MVP)

**Fichier :** [`prototypes/login.html`](./prototypes/login.html)

---

### 2. Dashboard Principal
![Dashboard Preview](./references/dashboard-preview.png)

Le hub central de l'application — résumé financier, actions rapides, graphique d'activité et liste des transactions récentes.

**Caractéristiques :**
- Header avec logo + avatar utilisateur
- 3 cartes de résumé financier (recettes, dépenses, solde)
- 4 boutons d'actions rapides
- Graphique d'activité hebdomadaire
- Liste des transactions récentes
- Navigation inférieure fixe avec bouton "+" central

**Fichier :** [`prototypes/dashboard.html`](./prototypes/dashboard.html)

---

### 3. Grand Livre (Ledger)
![Ledger Preview](./references/ledger-preview.png)

Interface de saisie et consultation des transactions financières avec filtres, recherche et badges d'immuabilité.

**Caractéristiques :**
- Barre de recherche globale
- Chips de filtres par catégorie
- Résumé total recettes / dépenses
- Liste chronologique avec séparateurs de date
- Badges "Immutable" pour transactions validées
- Badge rappel INV-001 (règle d'immuabilité)
- Bouton d'action flottant (FAB)

**Fichier :** [`prototypes/ledger.html`](./prototypes/ledger.html)

---

### 4. Rapport Financier
![Rapport Preview](](./references/rapport-preview.png)

Vue d'ensemble financière avec donut chart, catégories détaillées et options d'export.

**Caractéristiques :**
- Résultat net en hero gradient
- Résumé recettes / dépenses en colonnes
- Taux d'épargne calculé
- Donut chart de répartition des dépenses
- Catégories détaillées avec barres de progression
- Section d'export PDF/CSV

**Fichier :** [`prototypes/rapport.html`](./prototypes/rapport.html)

---

## 🎨 Palette de Couleurs

```
Orange Lumina     #FF8C42  — CTA, accents chauds
Amber             #FFA552  — Highlights, hover
Violet Lumina     #6B3FA0  — États actifs
Indigo            #8B5CF6  — Gradients, interactif
```

Gradient principal : `linear-gradient(135deg, #FF8C42 0%, #C026D3 100%)`

## 📱 Principes UX

1. **Clarté financière** — Les chiffres sont lisibles et précis
2. **Confiance** — Transparence absolue sur chaque transaction
3. **Rapidité** — Interface pensée pour les leaders qui agissent
4. **Organique** — Formes fluides, gradients naturels, pas de rigidité

## 🧭 Navigation

Tous les écrans partagent :
- Un header sticky avec logo Lumina
- Une navigation inférieure fixe (Accueil | Finance | + | Membres | Réglages)
- Des transitions douces entre les sections
- Un style de carte unifié avec ombres subtiles et bordures légères

## 📐 Prochaines Étapes

- [ ] Créer l'écran "Gestion Membres"
- [ ] Créer l'écran "Calendrier Événements"
- [ ] Créer l'écran "Configuration Organisation"
- [ ] Ajouter les états de chargement (skeleton screens)
- [ ] Définir les états vides (empty states)
- [ ] Créer les modales et dialogs
- [ ] Ajouter les animations de transition
- [ ] Adapter pour le mode sombre (v2)

---

*Design System Lumina v1.0 — Créé le 22 Juillet 2026*
