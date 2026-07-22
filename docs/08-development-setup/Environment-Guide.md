# Environment Setup Guide — Prérequis et Configuration

**Doc ID:** DOC-ENV-GUIDE  
**Version:** 2.0  
**Statut :** SPÉCIFICATION DE CONFIGURATION  
**Dépendances :** ADR-005 (tech stack), Development-Handbook

---

## 1. Prérequis Système

| Logiciel | Version requise | Platform | Installation |
|---|---|---|---|
| Node.js | ≥ 20.x LTS | Win/Mac/Linux | nvm ou direct download |
| npm | ≥ 10.x |bundlé avec Node | — |
| Expo CLI | dernière stable | Global ou npx | `npm install -g expo-cli` OU toujours `npx expo` |
| Java JDK | ≥ 17 (pour Android) | Win/Mac/Linux | pour build Android uniquement |
| Xcode CLI tools | macOS latest | Mac uniquement | `xcode-select --install` |
| Watchman | dernière stable | Mac/Linux | `brew install watchman` (Mac) |
| InsForge CLI | dernière stable | Global | `npm install -g @insforge/cli` OU `npx @insforge/cli` |

**Environnement minimum recommandé :**
- RAM : 8 Go minimum, 16 Go recommandé
- Disk : 10 Go libres minimum
- CPU : 4 cores minimum

---

## 2. Variables d'Environnement

Fichier `.env.local` à la racine du projet React Native :

```bash
# Frontend (React Native / Expo)
EXPO_PUBLIC_INSFORGE_URL=https://your-project.us-east.insforge.app
EXPO_PUBLIC_INSFORGE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
EXPO_PUBLIC_APP_VERSION=2.0.0
EXPO_PUBLIC_DEBUG_MODE=false
EXPO_PUBLIC_API_TIMEOUT_MS=10000
EXPO_PUBLIC_SYNC_INTERVAL_MS=300000  # 5 minutes
```

> **Comment obtenir la URL et l'anon key :**
> 1. Lier le projet : `npx @insforge/cli link`
> 2. Récupérer l'anon key : `npx @insforge/cli secrets get ANON_KEY`
> 3. La URL est dans `.insforge/project.json` → champ `oss_host`
>
> Fichier `.env.local` NE JAMAIS commité. Ajouter au `.gitignore`.

---

## 3. Initialisation du Projet (Step-by-Step)

### Step 1: Cloner et installer

```bash
cd ZCodeProject/Eglise-MFE-Stable-V2

# Créer le dossier front-end
mkdir lumina-app && cd lumina-app

# Initialiser Expo TypeScript
npx create-expo-app . --template typescript

# Installer les dépendances de base
npm install @nozbe/watermelondb @insforge/sdk react-native-reanimated react-native-gesture-handler expo-router expo-localization lucide-react-native @rjsf/core react-native-chart-kit

# Installer les dev dependencies
npm install --save-dev @types/react @types/react-native jest ts-jest @testing-library/react-native eslint-plugin-import @typescript-eslint/parser @typescript-eslint/eslint-plugin prettier husky lint-staged
```

### Step 2: Configurer TypeScript

Créer `tsconfig.json` (remplacer celui d'Expo par défaut si nécessaire) :
```json
{
  "compilerOptions": {
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-native"
  },
  "extends": "expo/tsconfig.base",
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["node_modules"]
}
```

**Règle critique :** `strict: true` est obligatoire (NB-RULE-07). Si un agent ne peut pas respecter strict mode, il doit demander une exception documentée par ADR.

### Step 3: Configurer ESLint

Créer `.eslintrc.js` :
```javascript
module.exports = {
  root: true,
  extends: ['expo', 'eslint:recommended'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'import'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',  // NB-RULE-07
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'react-hooks/exhaustive-deps': 'error',
    'no-console': ['warn', { allow: ['warn', 'error'] }]
  },
  ignorePatterns: ['node_modules/', 'dist/', 'build/']
};
```

### Step 4: Configurer Husky (pre-commit hooks)

```bash
npx husky init

# Créer hook pre-commit
cat > .husky/pre-commit << 'EOF'
npx lint-staged
EOF

# Configurer lint-staged dans package.json
# "lint-staged": {
#   "*.{ts,tsx}": ["eslint --fix"],
#   "*.md": ["wc -l < {} | xargs test {} <= 400"]  // NB-RULE-01
# }
```

---

## 4. Workflow InsForge Backend

### Initialiser le backend

```bash
# Depuis la racine du projet (pas dans lumina-app/)
cd ZCodeProject/Eglise-MFE-Stable-V2

# Vérifier l'auth
npx @insforge/cli whoami

# Vérifier le projet lié
npx @insforge/cli current

# Si pas lié : lier ou créer
npx @insforge/cli link          # si déjà un projet
npx @insforge/cli create        # si nouveau projet
```

### Appliquer les migrations

```bash
# Lister les migrations existantes
npx @insforge/cli db migrations list

# Appliquer les pending migrations
npx @insforge/cli db migrations up --all

# Vérifier les tables créées
npx @insforge/cli db tables
```

---

## 5. Lancement du Développement

### Frontend (Expo)

```bash
cd lumina-app

# Démarrer le dev server
npx expo start

# Options :
# - Pour iOS simulator : npx expo start --ios
# - Pour Android emulator : npx expo start --android
# - Pour scanner QR code sur téléphone : npx expo start (option A)
```

### Backend verification

```bash
# Vérifier que le frontend parle bien au backend
curl -H "Authorization: Bearer $ANON_KEY" \
     -H "x-org-id: test-org" \
     $INSFORGE_URL/api/health
```

---

## 6. Debugging Common Issues

| Problème | Cause probable | Solution |
|---|---|---|
| `any` TypeScript error | Strict mode non actif | Vérifier `"strict": true` dans tsconfig |
| WatermelonDB crash | Model non enregistré | Vérifier `Database.ts` → models array |
| Network timeout | Mauvaise URL InsForge | Vérifier `.env.local` → `INSFORGE_URL` |
| RLS policy violation | Missing org_id header | Vérifier interceptor → ajoute `x-org-id` |
| Sync infinite loop | Conflict resolution fails | Vérifier adapter → log conflict details |
| Hot reload broken | Animate dependency | `npm install react-native-reanimated` |

---

## 7. Checklist Pre-Commit

Avant chaque commit, l'agent doit vérifier :
- [ ] `npx tsc --noEmit` passes without errors
- [ ] `npx eslint src/ --max-warnings 0` passes
- [ ] Tests unitaires passent (`npm test`)
- [ ] Nouvelle feature → nouvelle doc créée ou doc existante mise à jour
- [ ] Pas de `console.log` dans le code final (sauf warn/error)
- [ ] Variables sensibles NE sont PAS dans le commit (`.env`, keys, etc.)
