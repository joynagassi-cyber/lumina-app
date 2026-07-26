/**
 * NativeWind (Tailwind for React Native) Configuration
 *
 * Per ITS-V1 NB-TECH-008: Design-token driven styling.
 * All colors reference theme tokens derived from organization accent_hex.
 */

module.exports = {
  content: ['./src/**/*.{ts,tsx,jsx,js}' ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      // Lumina design tokens — dark/light mode
      colors: {
        // Core palette (Spotify-inspired dark theme, ADR-011)
        lumina: {
          bg: '#121212',       // Primary background
          surface: '#181818',  // Card/elevation surfaces
          elevated: '#282828', // Higher elevation
          border: '#333333',   // Subtle borders
          text: '#FFFFFF',     // Primary text
          'text-secondary': '#B3B3B3', // Secondary text
          'text-muted': '#727272', // Placeholder/disabled
          accent: '#9966FF',   // Brand accent (dynamic per org accent_hex)
          success: '#1DB954',  // Positive operations
          warning: '#F59E0B',  // Cautionary actions
          error: '#E13C3E',    // Errors/destructive actions
        },
      },
      spacing: {
        // 4px base grid system
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        '2xl': '48px',
      },
    },
  },
  plugins: [],
};
