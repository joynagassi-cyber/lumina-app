/**
 * Icon Registry — Common icon names for the Icon component.
 *
 * This registry defines the set of valid icon names that can be used with the
 * Icon component. Each name corresponds to a Lucide icon.
 *
 * Traceability: IDS-001 (Icon Design Constitution), IDS-004 (Icon Component Architecture)
 */

// Export a union type of all valid icon names
export type IconName =
  | 'organization'
  | 'user'
  | 'users'
  | 'home'
  | 'settings'
  | 'sync'
  | 'warning'
  | 'error'
  | 'check'
  | 'x'
  | 'loader'
  | 'network'
  | 'network-off'
  | 'activity'
  | 'battery'
  | 'bell'
  | 'calendar'
  | 'chart'
  | 'cloud'
  | 'code'
  | 'compass'
  | 'database'
  | 'download'
  | 'edit'
  | 'external-link'
  | 'facebook'
  | 'file'
  | 'folder'
  | 'globe'
  | 'hash'
  | 'headphones'
  | 'heart'
  | 'inbox'
  | 'instagram'
  | 'key'
  | 'layers'
  | 'link'
  | 'linkedin'
  | 'list'
  | 'lock'
  | 'mail'
  | 'menu'
  | 'message'
  | 'mic'
  | 'minus'
  | 'monitor'
  | 'moon'
  | 'more'
  | 'music'
  | 'navigation'
  | 'octagon'
  | 'package'
  | 'phone'
  | 'photo'
  | 'play'
  | 'plus'
  | 'push'
  | 'question'
  |'rocket'
  | 'save'
  | 'search'
  | 'send'
  | 'server'
  | 'share'
  | 'shopping'
  | 'slack'
  | 'slider'
  | 'smile'
  | 'spotify'
  | 'star'
  | 'stop'
  | 'terminal'
  | 'text'
  | 'twitter'
  | 'type'
  | 'upload'
  | 'video'
  | 'volume'
  | 'youtube'
  | 'zap';

/**
 * Symbolic name for the registry (for documentation purposes)
 */
export const ICON_REGISTRY = {
  ORGANIZATION: 'organization',
  USER: 'user',
  USERS: 'users',
  HOME: 'home',
  SETTINGS: 'settings',
  SYNC: 'sync',
  WARNING: 'warning',
  ERROR: 'error',
  CHECK: 'check',
  X: 'x',
  LOADER: 'loader',
  NETWORK: 'network',
  NETWORK_OFF: 'network-off',
  ACTIVITY: 'activity',
  BATTERY: 'battery',
  BELL: 'bell',
  CALENDAR: 'calendar',
  CHART: 'chart',
  CLOUD: 'cloud',
  CODE: 'code',
  COMPASS: 'compass',
  DATABASE: 'database',
  DOWNLOAD: 'download',
  EDIT: 'edit',
  EXTERNAL_LINK: 'external-link',
  FACEBOOK: 'facebook',
  FILE: 'file',
  FOLDER: 'folder',
  GLOBE: 'globe',
  HASH: 'hash',
  HEADPHONES: 'headphones',
  HEART: 'heart',
  INBOX: 'inbox',
  INSTAGRAM: 'instagram',
  KEY: 'key',
  LAYERS: 'layers',
  LINK: 'link',
  LINKEDIN: 'linkedin',
  LIST: 'list',
  LOCK: 'lock',
  MAIL: 'mail',
  MENU: 'menu',
  MESSAGE: 'message',
  MIC: 'mic',
  MINUS: 'minus',
  MONITOR: 'monitor',
  MOON: 'moon',
  MORE: 'more',
  MUSIC: 'music',
  NAVIGATION: 'navigation',
  OCTAGON: 'octagon',
  PACKAGE: 'package',
  PHONE: 'phone',
  PHOTO: 'photo',
  PLAY: 'play',
  PLUS: 'plus',
  PUSH: 'push',
  QUESTION: 'question',
  ROCKET: 'rocket',
  SAVE: 'save',
  SEARCH: 'search',
  SEND: 'send',
  SERVER: 'server',
  SHARE: 'share',
  SHOPPING: 'shopping',
  SLACK: 'slack',
  SLIDER: 'slider',
  SMILE: 'smile',
  SPOTIFY: 'spotify',
  STAR: 'star',
  STOP: 'stop',
  TERMINAL: 'terminal',
  TEXT: 'text',
  TWITTER: 'twitter',
  TYPE: 'type',
  UPLOAD: 'upload',
  VIDEO: 'video',
  VOLUME: 'volume',
  YOUTUBE: 'youtube',
  ZAP: 'zap',
} as const;

/**
 * Type-safe access to icon registry
 */
export type IconRegistry = typeof ICON_REGISTRY;
