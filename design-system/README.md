# 🎵 Lumina Design System — Spotify Style

> **Fond `#121212`. Orange `#FF6B00` unique accent. Pas de gradients, pas de violet.**

## Palette

| Rôle | Hex | Usage |
|------|-----|-------|
| **Bg** | `#121212` | Fond principal (comme Spotify) |
| **Surface** | `#181818` | Cartes, panels |
| **Elevated** | `#282828` | Hover, inputs |
| **Fire** | `#FF6B00` | **Unique accent** — CTA, liens, highlights |
| **White** | `#FFFFFF` | Titres |
| **Gray** | `#B3B3B3` | Body text |
| **Muted** | `#808080` | Labels, metadata |
| **Green** | `#1DB954` | Recettes positives (spare) |
| **Red** | `#E51332` | Alertes (spare) |

## Règles

1. Jamais de blanc sur noir pur → utiliser `#121212` et `#181818`
2. Un seul accent → `#FF6B00` uniquement
3. Pas de gradients → couleurs solides
4. Boutons ronds (pill shape), cards carrées avec 8px border-radius
5. Typographie bold 700-800 pour les titres

## Écrans (`prototypes/`)

| Fichier | Nom | Description |
|---------|-----|-------------|
| `login.html` | Connexion | Logo cercle orange, inputs sombres arrondis, bouton orange rond |
| `dashboard.html` | Command Center | Sidebar, hero solde orange 56px, feed transactions sobre |
| `ledger.html` | Grand Livre | Search bar arrondie, filtres pills, items liste espacés |
| `rapport.html` | Bilan | Résultat net hero, bar charts verts/rouges, catégories |
| `members.html` | Membres | Stats 4 colonnes, recherche, liste membres avatars colorés |
| `calendar.html` | Calendrier | Grille semaine, event chips colorés, liste événements à venir |

Tous partagent : sidebar `#000` 80px, fond `#121212`, surface `#181818`, accent `#FF6B00`.
