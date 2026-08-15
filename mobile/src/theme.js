import { Platform, Dimensions } from 'react-native';

export const W = Dimensions.get('window').width;
export const H = Dimensions.get('window').height;

export const COLORS = {
  brand:         '#0333b6',
  brandDark:     '#022a8f',
  brandDeep:     '#0F172A',
  brandDeeper:   '#070614',
  brandLight:    '#e8eeff',
  brandMid:      'rgba(3,51,182,0.10)',
  accent:        '#f59e0b',
  accentDark:    '#d97706',
  accentLight:   '#fef3c7',
  accentMid:     'rgba(245,158,11,0.15)',
  bg:            '#f0f4f9',
  bgAlt:         '#eef2f6',
  bgCard:        '#e6ebf5',
  surface:       '#FFFFFF',
  glass:         'rgba(255,255,255,0.14)',
  glassBorder:   'rgba(255,255,255,0.22)',
  success:       '#10b981',
  successLight:  '#d1fae5',
  error:         '#ef4444',
  errorLight:    '#fee2e2',
  warning:       '#f59e0b',
  warningLight:  '#fef3c7',
  purple:        '#8b5cf6',
  purpleLight:   '#ede9fe',
  teal:          '#14b8a6',
  tealLight:     '#ccfbf1',
  rose:          '#f43f5e',
  roseLight:     '#ffe4e6',
  text:          '#0F172A',
  textSec:       '#475569',
  textTer:       '#94a3b8',
  textInverse:   '#FFFFFF',
  textMuted:     '#cbd5e1',
  border:        '#e2e8f0',
  borderLight:   '#f1f5f9',
  textblack:     '#000',
};

export const FONT = {
  micro: 9, xs: 11, sm: 13, base: 15, md: 16,
  lg: 18, xl: 22, xxl: 26, xxxl: 32, hero: 40,
  w4: '400', w5: '500', w6: '600', w7: '700', w8: '800', w9: '900',
};

export const SPACE = {
  xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 48,
};

export const RADIUS = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 36, full: 999,
};

export const SHADOW = {
  none: {},
  sm: Platform.select({
    ios: { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
    android: { elevation: 0 },
    default: {},
  }),
  md: Platform.select({
    ios: { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 8 },
    android: { elevation: 0 },
    default: {},
  }),
  lg: Platform.select({
    ios: { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.10, shadowRadius: 16 },
    android: { elevation: 0 },
    default: {},
  }),
  xl: Platform.select({
    ios: { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.14, shadowRadius: 24 },
    android: { elevation: 0 },
    default: {},
  }),
  brand: Platform.select({
    ios: { shadowColor: '#0333b6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.30, shadowRadius: 12 },
    android: { elevation: 0 },
    default: {},
  }),
  accent: Platform.select({
    ios: { shadowColor: '#f59e0b', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 10 },
    android: { elevation: 0 },
    default: {},
  }),
};

export const TOP = Platform.OS === 'ios' ? 54 : 44;

// Phone → ngrok
// Web   → Codespaces public port
// const NGROK      = 'https://bauble-aftermost-buffalo.ngrok-free.dev/api/v1';
const NGROK = 'http://10.17.9.48:8000/api/v1'; // Use the VM IP
const CODESPACES = 'https://cautious-eureka-jj56xxggr9vpcq9qj-8000.app.github.dev/api/v1';

export const API_URL  = NGROK; // both web + native use ngrok
export const API_ROOT = API_URL.replace(/\/api\/v1$/, '');

const BASE_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'x-public-origin': API_ROOT,
};

export const API_HEADERS = { ...BASE_HEADERS, 'ngrok-skip-browser-warning': 'true' };


// Fix media URLs — replaces localhost with the correct public base
export function fixMediaUrl(url) {
  if (!url) return null;
  // Already a full public URL
  if (url.startsWith('http') && !url.includes('localhost')) return url;
  // Extract the path part
  const path = url.includes('/media/') ? '/media/' + url.split('/media/')[1] : url;
  return API_ROOT + path;
}
