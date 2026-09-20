import { View, Text, TextInput, StyleSheet } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { COLORS } from '@/constants';
import { useTranslation } from 'react-i18next';

const MOBILE_METHODS = ['orange_money', 'mtn_momo', 'moov_money', 'wave'];

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

export default function PaymentInfoFields({ method, info, onChange }: Props) {
  const { t } = useTranslation();
  if (!method) return null;

  const set = (field: keyof PaymentInfo) => (v: string) =>
    onChange({ ...info, [field]: v });

  /* ── Mobile Money ── */
  if (MOBILE_METHODS.includes(method)) {
    return (
      <View style={s.wrap}>
        <View style={s.iconRow}>
          <FontAwesome5 name="mobile-alt" size={14} color={COLORS.primary} />
          <Text style={s.sectionLabel}>{t('payment.mobileLabel')}</Text>
        </View>
        <TextInput
          style={s.input}
          value={info.phone}
          onChangeText={set('phone')}
          placeholder={t('payment.mobilePlaceholder')}
          placeholderTextColor={COLORS.textMuted}
          keyboardType="phone-pad"
          maxLength={14}
        />
        <Text style={s.hint}>{t('payment.mobileHint')}</Text>
      </View>
    );
  }

  /* ── Carte bancaire ── */
  if (method === 'carte') {
    const formatCard = (v: string) => {
      const digits = v.replace(/\D/g, '').slice(0, 16);
      return digits.replace(/(.{4})/g, '$1 ').trim();
    };
    const formatExpiry = (v: string) => {
      const digits = v.replace(/\D/g, '').slice(0, 4);
      if (digits.length > 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
      return digits;
    };

    return (
      <View style={s.wrap}>
        <View style={s.iconRow}>
          <FontAwesome5 name="credit-card" size={14} color={COLORS.primary} />
          <Text style={s.sectionLabel}>{t('payment.cardLabel')}</Text>
        </View>

        <Text style={s.fieldLabel}>{t('payment.cardNumberLabel')}</Text>
        <TextInput
          style={s.input}
          value={info.cardNumber}
          onChangeText={v => set('cardNumber')(formatCard(v))}
          placeholder="XXXX XXXX XXXX XXXX"
          placeholderTextColor={COLORS.textMuted}
          keyboardType="numeric"
          maxLength={19}
        />

        <View style={s.row}>
          <View style={s.half}>
            <Text style={s.fieldLabel}>{t('payment.cardExpiryLabel')}</Text>
            <TextInput
              style={s.input}
              value={info.cardExpiry}
              onChangeText={v => set('cardExpiry')(formatExpiry(v))}
              placeholder={t('payment.cardExpiryPlaceholder')}
              placeholderTextColor={COLORS.textMuted}
              keyboardType="numeric"
              maxLength={5}
            />
          </View>
          <View style={s.half}>
            <Text style={s.fieldLabel}>{t('payment.cardCvvLabel')}</Text>
            <TextInput
              style={s.input}
              value={info.cardCVV}
              onChangeText={v => set('cardCVV')(v.replace(/\D/g, '').slice(0, 3))}
              placeholder="XXX"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="numeric"
              maxLength={3}
              secureTextEntry
            />
          </View>
        </View>

        <Text style={s.fieldLabel}>{t('payment.cardNameLabel')}</Text>
        <TextInput
          style={s.input}
          value={info.cardName}
          onChangeText={set('cardName')}
          placeholder={t('payment.cardNamePlaceholder')}
          placeholderTextColor={COLORS.textMuted}
          autoCapitalize="characters"
        />
      </View>
    );
  }

  return null;
}

export function validatePaymentInfo(method: string, info: PaymentInfo, t: (key: string) => string): string | null {
  const MOBILE = ['orange_money', 'mtn_momo', 'moov_money', 'wave'];
  if (MOBILE.includes(method)) {
    if (!info.phone || info.phone.replace(/\D/g, '').length < 8)
      return t('payment.invalidPhone');
  }
  if (method === 'carte') {
    if (!info.cardNumber || info.cardNumber.replace(/\s/g, '').length < 16)
      return t('payment.invalidCardNumber');
    if (!info.cardExpiry || info.cardExpiry.length < 5)
      return t('payment.invalidExpiry');
    if (!info.cardCVV || info.cardCVV.length < 3)
      return t('payment.invalidCvv');
    if (!info.cardName.trim())
      return t('payment.invalidCardName');
  }
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
