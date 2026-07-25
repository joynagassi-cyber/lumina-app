# Références Premium — Compatibilité Expo / React Native

> Généré le 2026-07-25 — Audit des 8 sites du "Vibe Coder Toolkit" pour compatibilité avec Expo SDK 52 + RN 0.76 + reanimated ~3.16.

## Tableau récapitulatif

| # | Site | Gratuité | Compatibilité RN/Expo | Niveau d'exposition mobile | Recommandation |
|---|------|----------|-----------------------|----------------------------|----------------|
| 1 | KokonutUI | ✅ MIT (gratuit) | ❌ Web uniquement | Low | Inspirer visuellement, reimplementer avec reanimated |
| 2 | Magic UI | ✅ 100% MIT (open-source) | ❌ Web uniquement | Low | Copier composants simples, remplacer animations par reanimated |
| 3 | React Bits | ✅ MIT + Commons Clause | ❌ Web uniquement | Low | WebGL inapplicable en RN natif |
| 4 | Anime.js | ✅ MIT | ❌ Web uniquement | N/A | Déjà remplacé par react-native-reanimated (déjà installé) |
| 5 | **Motion** | ✅ MIT | ✅ Full (via `motion/react`) | **High** | **Seul à utiliser nativement** |
| 6 | Rive | ✅ Runtime MIT / Éditeur gratuit limité | ⚠️ Full mais nécessite `expo prebuild` + module natif C++ | Medium | Intéressant pour animations interactives complexes |
| 7 | Limora | ✅ Crédits limités | ⚠️ Images raster seulement (PNG/JPG/WebP) | Low | Utile uniquement comme ressource visuelle |
| 8 | Bklit | ✅ CC BY-NC 4.0 / MIT packages/ui | ⚠️ Seulement Expo Web (Tailwind + @visx incompatible RN natif) | Medium | Vérifier licence avant usage commercial |

---

## Détail par site

### 1. KokonutUI (kokonutui.com)

- **License**: MIT sur les composants gratuits (~100+ entrées registry), Pro "pay once" lifetime pour 100+ composants additionnels + 7 templates
- **Intégration**: shadcn CLI (`npx shadcn@latest add @kokonutui/<name>`)
- **Compatibilité RN**: Aucun package RN. Toutes les dépendances sont web-focused (motion/framer-motion fork v12, GSAP, Three.js)
- **Recommandation**: Utiliser comme référence visuelle uniquement. Pour un composant spécifique, copier la structure et réimplementer les animations avec `react-native-reanimated` au lieu de motion/GSAP.

### 2. Magic UI (magicui.design)

- **License**: 100% MIT, open-source (247 registries)
- **Intégration**: shadcn CLI (`npx shadcn@latest add @magicui/<component>`)
- **Dépendances web**: motion/framer-motion, Three.js/cobe, canvas-confetti
- **Compatibilité RN**: Aucune compatibilité native. Tous les composants ciblent le DOM
- **Composants utilisables en RN**: Les composants non-animations peuvent être copié-collé simples (AvatarCircles, Badge, Timeline statique). Remplacer motion par reanimated pour les versions animées
- **Recommandation**: Source d'inspiration principale — copier la structure JSX puis adapter manuellement les animations

### 3. React Bits (reactbits.dev)

- **License**: MIT + Commons Clause
- **Intégration**: shadcn ou jsrepo CLI (`npx shadcn@latest add https://reactbits.dev/r/<Comp>-TS-TW`)
- **Contenu**: 140+ composants, chaque avec 4 variantes
- **Dépendances**: motion/framer-motion fork v12, GSAP, Three.js, OGL (lightweight WebGL), canvas-confetti
- **Compatibilité RN**: Aucun package RN. WebGL (Three.js/OGL) est intrinsèquement web
- **Composants potentiellement utilisables**: Certains composants purement visuels (magnet effect, typewriter statique) pourraient être copiés et adaptés avec reanimated
- **Recommandation**: Inspirant pour la conception UX, mais réimplementation lourde pour RN

### 4. Anime.js (animejs.com)

- **License**: 100% MIT, ~6kb gzipped
- **Compatibilité RN**: Aucune. Anime.js cible CSS properties, SVG, DOM elements, Canvas, WebGL — tous des APIs navigateur absentes de React Native
- **Alternative RN**: `react-native-reanimated` (~3.16) — **déjà installé dans le projet**, c'est l'outil approprié
- **Verdict**: Exclure pour développement RN natif. Utile uniquement si expo-web build

### 5. Motion — (motion.dev) ⭐ RECOMMANDÉ

- **License**: 100% MIT (open-source). Motion Plus GPU: license payante séparée
- **Taille**: ~5.5kb gzipped (tree-shaken)
- **Intégration**: `npm install motion` puis `import { motion } from "motion/react"`
- **Compatibilité RN**: **Full** — `motion/react` entry point auto-adapte au platform (DOM sur web, native sur RN). Successeur de framer-motion + écosystème moti. Supporte Expo SDK 52+ et RN 0.76+
- **Dépendances**: `motion-dom`, `motion-utils`, `tslib` — tous tree-shakeables
- **Fonctionnalités clés**: Animate function, motion components, gesture handling, layout animations, spring physics, drag, variants, presence animations, stagger, MotionConfig
- **Problèmes connus**:
  - Requires version 12+ pour support RN complet
  - Gesture handling dépend de `@use-gesture` — vérifier compatibilité avec `react-native-gesture-handler` déjà installé
  - Layout animations peut avoir des cas limites dans des ScrollView imbriqués profonds
- **Intégration recommandée**:
  ```typescript
  import { motion, AnimatePresence } from "motion/react";
  // Utilisation identique en web et RN
  <motion.View animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 260, damping: 20 }}>
    Content
  </motion.View>
  ```
- **Verdict**: Seule librairie du toolkit à utiliser nativement en RN.

### 6. Rive (rive.app)

- **Runtime License**: 100% MIT (tous les paquets npm: `@rive-app/canvas`, `@rive-app/react-canvas`, `@rive-app/react-native` sont open-source)
- **Éditeur Cloud**: Gratuit pour projets personnels (limité à 2 projets actifs); Cadet $9/mo; Voyager $32/mo; Enterprise $120/mo
- **Le plus important**: Le runtime (.riv files) est toujours libre, même en production commerciale. Seules les features cloud/team sont payantes.
- **Intégration RN**: `npm install @rive-app/react-native`
  - Nécessite `expo prebuild` ou workflow bare (module natif C++ via `react-native-nitro-modules`)
  - **Ne fonctionne PAS dans Expo Go**
- **Impact bundle size**: +2 à +5 MB (compilation C++)
- **Fonctionnalités**: State machines interactifs, animations réactives au curseur/touch, 90% plus léger que Lottie pour contenus similaires
- **Problèmes connus**:
  - Nitro modules 0.5.0-beta a loose peer dep, 0.4.x pins <0.36 — peut nécessiter pinning manuel pour RN 0.76
  - Fichiers .riv doivent être hébergés (Rive servers ou cloud storage)
  - Courbe d'apprentissage plus raide que les libs d'animation programmatiques
- **Alternatives RN**: `lottie-react-native` (plus simple mais pas de state machines), `react-native-skia` (custom)
- **Verdict**: Excellent pour animations designer-authored avec state machines (personnages interactifs, onboarding animé, micro-interactions complexes). À envisager si besoin d'animations hautement interactives.

### 7. Limora (limora.ai)

- **Free tier**: Crédits limités (5 crédits / 300 restants montré en démo); paid tiers probable à partir de $6-12/mo
- **Output**: Images raster statiques (PNG, JPG, WebP)
- **Feature clé**: Brand learning system — upload logo + couleurs + polices une fois, appliqué à tous les assets (14 types d'assets)
- **API/Programmatic**: Aucune. Interface web-only à `app.limora.ai` (Google OAuth ou email)
- **Intégration RN**: Faible. Télécharger les fichiers et placer dans `assets/` du projet — process manuel
- **Limitations connues**:
  - Pas d'API REST, SDK, ou CLI
  - Raster only (pas de SVG/vectoriel)
  - `/pricing` retourne 404 — aucune transparence publique sur les prix
  - Workflow orienté web designer (Framer/Webflow/Figma), pas mobile development
  - Limites de crédits bloquent génération en masse
- **Verdict**: Non pertinent pour le cycle de développement RN. Utilisable comme ressource externe pour générer des images/statiques (splash screen hero images, store assets).

### 8. Bklit UI (bklit.com)

- **License**: CC BY-NC 4.0 sur repo principal (non-commercial) — les subpackages `packages/ui` ont un package.json MIT (à vérifier si couvre vos usages). **Attention: licence non-commerciale incompatible avec app commerciale.**
- **Stargazers GitHub**: 1360 stars
- **Dépends à**: `@visx`, d3, Tailwind CSS v4, Radix UI, motion (framer-motion)
- **Chart types**: 20+ (Area, Bar, Candlestick, Choropleth, Composed, Funnel, Gauge, Heatmap, Line, Pie, Radar, Ring, Scatter, Sankey, Sunburst, etc.)
- **Utilities**: Legend, Grid, Tooltip, Brush, Axis, `useChart` hook
- **Integration**: shadcn CLI (registry), copy-paste TSX/Tailwind source files
- **Compatibilité RN**: 
  - ❌ **Incompatible avec RN natif** — `@visx` cible DOM/SVG (pas `react-native-svg`), Tailwind CSS n'a pas de support natif RN, shadcn/ui utilise des APIs DOM
  - ⚠️ Fonctionne nativement dans **Expo Web** uniquement (build web plateforme)
- **Studio**: Outil configurateur interactif pour themes de charts (warm, forest, lagoon, monochrome)
- **Intégration RN potentielle**: Porterait à remplacer `@visx` par `react-native-svg` + `reanimated`, supprimer Tailwind, réécrire les layouts — effort significatif
- **Requirements**: Node >=18, pnpm 9.0.0, TypeScript 5.9.2, React 19.2.0
- **Alternatives RN pour charts**: `react-native-chart-kit`, `victory-native`, `react-native-svg-charts` (tous compatibles RN natif)
- **Verdict**: Bibliothèque de charts excellente pour Expo Web. Pour RN natif, utiliser `victory-native` ou `react-native-chart-kit` à la place. **Vérifier la licence avant tout usage commercial.**

---

## Synthèse & Plan d'Action

###可直接 utilisées (Drop-in)

| Librerie | Comment | Commande |
|----------|---------|----------|
| **Motion** | `import {...} from "motion/react"` — identical API web/RN | `npm install motion` |

### À adapter lourdement (Copy → Reimplement with Reanimated)

| Bibliothèque | Composants inspirants | Équivalent RN recommandé | Effort |
|--------------|----------------------|--------------------------|--------|
| **Magic UI** | AvatarCircles, Badge, Timeline | `react-native-reanimated` + `Animated.ScrollView` | Moyen |
| **KokonutUI** | Glass-morphism cards, action search bars | Reconstruct with `react-native-reanimated` transforms + shadows | Moyen |
| **React Bits** | Magnet effect, typewriter, hover effects | `react-native-reanimated` + `PanResponder`/`Gesture Handler` | Élevé (WebGL absent) |

### À utiliser comme référence externe

| Outil | Usage | Format output |
|-------|-------|---------------|
| **Limora** | Générer assets visuels on-brand (hero images, icons) | PNG/JPG/WebP → place in `assets/` |
| **Bklit Studio** | Configurer themes de charts | Props TSX → adapter pour `victory-native` |

### Écosystème déjà en place (ne rien ajouter)

L'équipement existant du projet couvre déjà une grande partie des besoins de ce toolkit web :

| Besoin | Outil existant dans projet | Package |
|--------|---------------------------|---------|
| Animations programmatiques | **react-native-reanimated** | `~3.16.0` ✅ |
| SVG/Courbes/Charts | **react-native-svg** | `^15.8.0` ✅ |
| Gestures interactives | **react-native-gesture-handler** | `~2.20.2` ✅ |
| Navigation transitions | **expo-router** | `~4.0.0` ✅ |
| Icones | **lucide-react-native** | `^0.378.0` ✅ |
| Vector Icons | **@expo/vector-icons** | `^14.0.0` ✅ |

**Conclusion**: Le projet a déjà les briques essentielles pour remplacer la majorité des libs web. Motion est le seul addition recommandé — il apporte springs, layout animations, et gesture-driven effects avec une API identique web/RN.
