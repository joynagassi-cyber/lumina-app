# Product

## Register

product

## Users

Leaders d'organisations (pasteurs, trésoriers, administrateurs) qui gèrent quotidiennement une organisation de type église, ONG, école ou entreprise. Ils utilisent Lumina debout, souvent depuis leur téléphone pendant ou après un culte/cérémonie, dans des zones parfois rurales avec réseau limité. Le contexte est urgent, fragmenté et exige de la glanabilité — ils doivent comprendre la situation financière d'un coup d'œil.

| Persona | Rôle | Priorité | Contexte d'usage |
|---------|------|----------|------------------|
| Pasteur Jean | Leader spirituel + admin global | Primary | Debout, téléphone, zone rurale possible, décision rapide |
| Trésorière Ama | Responsable finances | Primary | Saisie rapide après collecte, besoin de précision |
| Admin Système | Configuration org | Secondary | Setup initial, maintenance, hiérarchie |

## Product Purpose

Lumina est une **Plateforme Universelle d'Organisation** — un système d'exploitation organisationnel dont le cœur technique est un runtime interprété par manifest. La première implémentation cible les églises MFE-JC mais le design est techniquement agnostique : NGO, école, entreprise, ou tout type `custom`.

Le MVP inclut 10 features : Finance (Grand Livre, Bilan, Rapports), Membres, Événements, Calendrier, Approbations, Configuration Organisation. L'objectif business est de fournir aux leaders un outil fiable pour gérer leurs finances et organisations, même hors-ligne.

Success = un leader peut saisir une transaction, voir son solde, approuver une dépense, et gérer ses membres sans perdre confiance dans le système, en moins de 3 tap par action.

## Brand Personality

Moderne — Audacieux — Rigoureux

Lumina se veut un outil tech moderne, pas une app institutionnelle austère. Elle assume un caractère fort : thème sombre immersif, accents vifs, typographie bold. Mais derrière cette audace visuelle se cache une rigueur sans faille — chaque chiffre financier est exact, chaque transaction est traçable, chaque décision est justifiée.

Emotions recherchées : confiance, énergie, clarté.

## Anti-references

Ce que Lumina ne doit PAS être :
- **SaaS cream/beige** — Fonds sable/parchemin génériques IA, textures papier. Lumina est sombre, vive, moderne.
- **Gradients & néons** — Dégradés artificiels, couleurs néon criardes sur fond noir. Lumina utilise des couleurs solides.
- **Navigation cachée** — Menus hamburger, navigation cachée derrière icônes. Lumina affiche sa navigation en permanence (bottom bar 5 tabs + FAB central).
- **Template hero-metric** — Gros chiffre isolé avec label petit, stats en grille identique. Lumina privilégie la hiérarchie typographique audacieuse.
- **Cards identiques en grille** — Grilles de cartes carrées sans variation. Lumina varie les layouts (feed, hero card, grid, master-detail).
- **Éyebrows numérotés sur chaque section** — "01 / 02 / 03" au-dessus de chaque heading. Réflexe AI.
- **Texte non lisible** — Corps de texte gris clair sur fond sombre ayant un contraste insuffisant.

## Design Principles

1. **Dark canvas, accent vivant** — Fond universel noir profond (#121212), accent configurable par org. La toile est fixe, la peinture change.
2. **Clarté financière absolue** — Données financières toujours lisibles, toujours contrastées. Green/red/yellow constants pour les indicators financiers, quelle que soit la couleur de l'org.
3. **Un écran, un message** — Hero card + max 3 zones d'action par écran. Pas de surcharge cognitive pour un leader debout avec un téléphone.
4. **Vitesse perçue < latence réelle** — Skeleton screens, optimistic updates, transitions subliminales. L'info apparaît avant même que le serveur ait répondu.
5. **Offline-first par principe** — Aucune opération utilisateur ne dépend d'un appel API synchrone. L'app fonctionne 100% hors-ligne, sync au retour du réseau.

## Accessibility & Inclusion

WCAG AA minimum garanti :
- Texte body ≥ 4.5:1 sur fond (standard #B3B3B3 sur #121212 = 7.2:1)
- Texte principal ≥ 7:1 (AAA, blanc pur #FFFFFF)
- Touch targets ≥ 44px (nos boutons font 48px)
- Support paramètres OS taille texte
- Support daltonisme : données financières utilisez formes ET couleurs (↑↓◆●■)
- Réduction motion respectée (@media prefers-reduced-motion)
- Textes alternatifs sur tous les éléments interactifs
- Screen reader friendly : labels explicites sur boutons et badges
