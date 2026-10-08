import { View, Text, StyleSheet } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { COLORS } from '@/constants';
import { useTranslation } from 'react-i18next';

const GATEWAY_METHODS = ['orange', 'mtn', 'moov', 'wave', 'djamo'];

// Conservé pour compatibilité de forme avec les écrans existants (plus aucun champ saisi ici :
// Jèko collecte lui-même le numéro sur sa page de paiement hébergée).
export interface PaymentInfo {
  phone:      string;
  cardNumber: string;
  cardExpiry: string;
  cardCVV:    string;
  cardName:   string;
}

export const EMPTY_PAYMENT_INFO: PaymentInfo = {
  phone: '', cardNumber: '', cardExpiry: '', cardCVV: '', cardName: '',
};

interface Props {
  method:   string;
  info:     PaymentInfo;
  onChange: (info: PaymentInfo) => void;
}

export default function PaymentInfoFields({ method }: Props) {
  const { t } = useTranslation();
  if (!method) return null;

  /* ── Moyens gérés par Jèko : la page hébergée demande elle-même le numéro ── */
  if (GATEWAY_METHODS.includes(method)) {
    return (
      <View style={s.wrap}>
        <View style={s.iconRow}>
          <FontAwesome5 name="lock" size={14} color={COLORS.primary} />
          <Text style={s.sectionLabel}>{t('payment.gatewayLabel')}</Text>
        </View>
        <Text style={s.hint}>{t('payment.gatewayHint')}</Text>
      </View>
    );
  }

  return null;
}

export function validatePaymentInfo(_method?: string, _info?: PaymentInfo, _t?: (key: string) => string): string | null {
  // Plus aucune saisie locale à valider : Jèko gère le numéro/la carte sur sa page
  // hébergée, et Espèces/Virement ne requièrent aucune information.
  return null;
}

const s = StyleSheet.create({
  wrap:         { marginTop: 4, marginBottom: 4, backgroundColor: '#F0F4FF', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#C7D2FE' },
  iconRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  fieldLabel:   { fontSize: 12, fontWeight: '600', color: COLORS.dark, marginBottom: 5, marginTop: 10 },
  input:        { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: COLORS.text, backgroundColor: COLORS.white },
  row:          { flexDirection: 'row', gap: 10 },
  half:         { flex: 1 },
  hint:         { fontSize: 11, color: COLORS.textMuted, marginTop: 6, fontStyle: 'italic' },
});
