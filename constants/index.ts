import Constants from 'expo-constants';

// En dev local sans .env, on vise le backend (port 3001) sur la machine qui sert le bundle
// Expo : son IP LAN est lue dans hostUri, ce qui suit automatiquement les changements d'IP.
// En production, EXPO_PUBLIC_API_BASE_URL/EXPO_PUBLIC_STORAGE_URL doivent être définies
// (voir eas.json et .env.example) avec une vraie URL HTTPS — ne jamais livrer l'IP de dev.
const DEV_HOST = Constants.expoConfig?.hostUri?.split(':')[0] ?? '192.168.1.66';
export const STORAGE_URL  = process.env.EXPO_PUBLIC_STORAGE_URL ?? `http://${DEV_HOST}:3001`;
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? `${STORAGE_URL}/api`;

export const COLORS = {
  primary:    '#1E3A5F',
  secondary:  '#F4A261',
  success:    '#2ECC71',
  danger:     '#E74C3C',
  warning:    '#F39C12',
  info:       '#3498DB',
  dark:       '#2C3E50',
  light:      '#ECF0F1',
  white:      '#FFFFFF',
  gray:       '#95A5A6',
  grayLight:  '#BDC3C7',
  background: '#F8F9FA',
  card:       '#FFFFFF',
  border:     '#E0E0E0',
  text:       '#2C3E50',
  textMuted:  '#7F8C8D',
};

export const PAYMENT_METHODS = [
  { label: 'Orange Money',     value: 'orange',  logo: require('@/assets/images/payment-methods/orange-money.png'), bg: '#fff' },
  { label: 'MTN MoMo',         value: 'mtn',     logo: require('@/assets/images/payment-methods/mtn-momo.png'),     bg: '#fff' },
  { label: 'Wave',             value: 'wave',    logo: require('@/assets/images/payment-methods/wave.png'),        bg: '#fff' },
  { label: 'Moov Money',       value: 'moov',    logo: require('@/assets/images/payment-methods/moov.png'),        bg: '#fff' },
  { label: 'DJAMO',            value: 'djamo',   badge: 'DJAMO',  bg: '#6C2BD9', fg: '#fff' },
  { label: 'Espèces',          value: 'especes',  icon: 'money-bill-wave', bg: '#15803d', fg: '#fff' },
  { label: 'Virement',         value: 'virement', icon: 'university',     bg: '#4f46e5', fg: '#fff' },
];

export const ROOM_STATUS_COLORS: Record<string, string> = {
  'disponible':    '#2ECC71',
  'réservée':      '#F39C12',
  'occupée':       '#E74C3C',
  'en_nettoyage':  '#3498DB',
  'hors_service':  '#95A5A6',
};

export const RESERVATION_STATUS_COLORS: Record<string, string> = {
  'en_attente': '#F39C12',
  'confirmée':  '#2ECC71',
  'annulée':    '#E74C3C',
  // Check-in / check-out : mêmes statuts que le web (base partagée)
  'arrivée':    '#3498DB',
  'départie':   '#95A5A6',
  'terminée':   '#95A5A6',
  'paiement_échoué': '#E74C3C',
};
