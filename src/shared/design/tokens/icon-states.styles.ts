/**
 * Icon States — Visual states definition according to IDS-004.
 *
 * Defines all 10 visual states for the Icon component:
 * Normal, Hover, Pressed, Selected, Disabled, Warning, Error, Loading, Offline, Syncing.
 *
 * Traceability: IDS-004 (Icon Component Architecture), UI-SPEC-001 (Status indicators)
 */

// Design tokens for icon states
export const ICON_TOKENS = {
  // Colors from design system
  colors: {
    primary: '#007AFF',
    secondary: '#6C757D',
    success: '#28A745',
    danger: '#DC3545',
    warning: '#FFC107',
    info: '#17A2B8',
    disabled: '#CCCCCC',
    online: '#28A745',
    offline: '#6C757D',
    white: '#FFFFFF',
    black: '#000000',
  },

  // Opacities for different states
  opacities: {
    normal: 1,
    hover: 0.8,
    pressed: 0.7,
    disabled: 0.4,
    loading: 0.6,
    offline: 0.6,
  },

  // Scale transformations
  transforms: {
    normal: 1,
    hover: 1.05,
    pressed: 0.95,
    selected: 1.1,
  },

  // Animation durations (ms) + NativeWind animation classes
  animations: {
    loading: 1500,
    syncing: 1000,
    warningPulse: 2000,
    errorShake: 500,
    pulse: 'animate-pulse',
    spin: 'animate-spin',
    warning: 'animate-pulse',
  },

  // Easing functions
  easing: {
    smooth: 'ease-in-out',
    instant: 'ease',
  },
};

// State flags interface
export interface IconStateFlags {
  disabled?: boolean;
  loading?: boolean;
  syncing?: boolean;
  hover?: boolean;
  pressed?: boolean;
  selected?: boolean;
  warning?: boolean;
  error?: boolean;
  offline?: boolean;
}

// Interface for computed state styles
export interface IconStateStyles {
  container: Record<string, any>;
  icon: Record<string, any>;
  iconColor: string;
  className?: string;    // NativeWind classes for animations
  transform?: any[];
  opacity?: number;
}

/**
 * Compute the final styles based on combined state flags.
 * Priority order: disabled > loading/syncing > error > warning > selected > hover/pressed > normal
 */
export function getIconStateStyles(
  flags: IconStateFlags & { size?: number; color?: string }
): IconStateStyles {
  const {
    size = 24,
    color = ICON_TOKENS.colors.primary,
    disabled = false,
    loading = false,
    syncing = false,
    hover = false,
    pressed = false,
    selected = false,
    warning = false,
    error = false,
    offline = false,
  } = flags;

  let iconColor = color;
  let containerStyle: Record<string, any> = {};
  let iconStyle: Record<string, any> = {};
  let transform: any[] = [];
  let opacity = ICON_TOKENS.opacities.normal;
  let className = '';

  // Priority 1: Disabled (highest)
  if (disabled) {
    iconColor = ICON_TOKENS.colors.disabled;
    opacity = ICON_TOKENS.opacities.disabled;
    containerStyle.pointerEvents = 'none';
    containerStyle.cursor = 'not-allowed';
    className = 'opacity-40';
  }
  // Priority 2: Loading/Syncing (interactive state)
  else if (loading) {
    className = ICON_TOKENS.animations.pulse;
    opacity = ICON_TOKENS.opacities.loading;
  }
  else if (syncing) {
    className = ICON_TOKENS.animations.spin;
    transform = [{ rotate: '0deg' }];
  }
  // Priority 3: Error
  else if (error) {
    iconColor = ICON_TOKENS.colors.danger;
    className = 'shake'; // Custom shake animation via NativeWind
  }
  // Priority 4: Warning
  else if (warning) {
    iconColor = ICON_TOKENS.colors.warning;
    className = ICON_TOKENS.animations.warning;
  }
  // Priority 5: Offline
  else if (offline) {
    iconColor = ICON_TOKENS.colors.offline;
    opacity = ICON_TOKENS.opacities.offline;
    containerStyle.filter = 'grayscale(100%)';
    className = 'opacity-60';
  }
  // Priority 6: Selected (accent state)
  else if (selected) {
    iconColor = color; // Preserve original color but emphasize
    transform = [{ scale: ICON_TOKENS.transforms.selected }];
    className = 'font-bold';
  }
  // Priority 7: Hover & Pressed (interactive feedback)
  else {
    if (hover) {
      opacity = ICON_TOKENS.opacities.hover;
      transform = [{ scale: ICON_TOKENS.transforms.hover }];
      className = 'opacity-80';
    }
    if (pressed) {
      opacity = ICON_TOKENS.opacities.pressed;
      transform = [{ scale: ICON_TOKENS.transforms.pressed }];
      className = 'opacity-70';
    }
  }

  return {
    container: containerStyle,
    icon: { size, ...iconStyle },
    iconColor,
    className,
    transform: transform.length > 0 ? transform : undefined,
    opacity: opacity !== ICON_TOKENS.opacities.normal ? opacity : undefined,
  };
}

// Export state styles as a simple object for direct usage (as per user request format)
export const iconStates = {
  // Normal state (default)
  normal: {
    opacity: 1,
    transform: 'scale(1)',
  },
  // Hover state
  hover: {
    opacity: 0.8,
    transform: 'scale(1.05)',
  },
  // Pressed state
  pressed: {
    opacity: 0.7,
    transform: 'scale(0.95)',
  },
  // Selected state (accent color)
  selected: {
    scale: 1.1,
    fontWeight: 'bold',
  },
  // Disabled state
  disabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
    pointerEvents: 'none',
  },
  // Warning state (yellow/orange)
  warning: {
    color: ICON_TOKENS.colors.warning,
    animation: 'pulse 2s infinite',
  },
  // Error state (red)
  error: {
    color: ICON_TOKENS.colors.danger,
    animation: 'shake 0.5s infinite',
  },
  // Loading state (spinner/animated)
  loading: {
    animation: 'pulse 1.5s infinite',
    opacity: 0.6,
  },
  // Offline state (grayscale)
  offline: {
    grayscale: '100%',
    opacity: 0.6,
    color: ICON_TOKENS.colors.offline,
  },
  // Syncing state (rotating)
  syncing: {
    animation: 'rotate 1s linear infinite',
  },
};