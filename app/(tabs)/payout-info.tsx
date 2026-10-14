import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useTranslation } from 'react-i18next';
import { profileApi } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { COLORS } from '@/constants';
import { FontAwesome5 } from '@expo/vector-icons';

type PayoutMethod = 'wave' | 'orange_money' | 'mtn' | 'moov' | 'djamo' | 'bank';

const MOBILE_METHODS: { value: PayoutMethod; label: string }[] = [
  { value: 'wave', label: 'Wave' },
  { value: 'orange_money', label: 'Orange Money' },
  { value: 'mtn', label: 'MTN Mobile Money' },
  { value: 'moov', label: 'Moov Money' },
  { value: 'djamo', label: 'Djamo (carte prépayée)' },
];

/** Masque toute chaîne sauf les 4 derniers caractères, ex: "2250701234567" -> "••••••••4567". */
function mask(value: string): string {
  if (!value) return '';
  const visible = value.slice(-4);
  return '•'.repeat(Math.max(value.length - 4, 4)) + visible;
}

export default function PayoutInfoScreen() {
  const { t } = useTranslation();
  const { user, setUser } = useAuthStore();

  // Verrou biométrique : ces coordonnées (RIB, mobile money) ne sont chargées/affichées
  // qu'après authentification réussie, pour protéger un téléphone volé/déverrouillé.
  const [unlocked, setUnlocked] = useState(false);
  const [unlocking, setUnlocking] = useState(true);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const [method,  setMethod]  = useState<PayoutMethod>('wave');
  const [phone,   setPhone]   = useState('');
  const [bankName, setBankName] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [swiftCode, setSwiftCode] = useState('');
  const [agencyCode, setAgencyCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ribKey, setRibKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [current, setCurrent] = useState<{ method?: string; identifier?: Record<string, string> } | null>(null);
  const [revealed, setRevealed] = useState(false);

  const tryUnlock = async () => {
    setUnlocking(true);
    setUnlockError(null);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) {
        // Pas de biométrie/code dispo sur l'appareil : on laisse passer plutôt que de
        // bloquer définitivement l'accès à une fonctionnalité légitime.
        setUnlocked(true);
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: t('payoutInfo.unlockPrompt'),
        disableDeviceFallback: false,
      });
      if (result.success) {
        setUnlocked(true);
      } else {
        setUnlockError(t('payoutInfo.unlockFailed'));
      }
    } catch {
      // En cas d'erreur du module biométrique lui-même, ne pas bloquer l'utilisateur.
      setUnlocked(true);
    } finally {
      setUnlocking(false);
    }
  };

  useEffect(() => { tryUnlock(); }, []);

  useEffect(() => {
    if (!unlocked) return;
    profileApi.get().then((res) => {
      const u = res.data;
      if (u.payout_method) {
        setMethod(u.payout_method);
        setCurrent({ method: u.payout_method, identifier: u.payout_identifier });
        if (u.payout_method === 'bank' && u.payout_identifier) {
          setBankName(u.payout_identifier.bankName ?? '');
          setBankCode(u.payout_identifier.bankCode ?? '');
          setSwiftCode(u.payout_identifier.swiftCode ?? '');
          setAgencyCode(u.payout_identifier.agencyCode ?? '');
          setAccountNumber(u.payout_identifier.accountNumber ?? '');
          setRibKey(u.payout_identifier.key ?? '');
        } else if (u.payout_identifier?.number) {
          setPhone(u.payout_identifier.number);
        }
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [unlocked]);

  const isBank = method === 'bank';

  const handleSave = async () => {
    if (!isBank && !phone.trim()) {
      Alert.alert(t('common.error'), t('payoutInfo.phoneRequired'));
      return;
    }
    if (isBank && (!bankName || !bankCode || !swiftCode || !agencyCode || !accountNumber || !ribKey)) {
      Alert.alert(t('common.error'), t('payoutInfo.bankFieldsRequired'));
      return;
    }
    setSaving(true);
    try {
      const payload = isBank
        ? { payout_method: method, bank_name: bankName, bank_code: bankCode, swift_code: swiftCode, agency_code: agencyCode, account_number: accountNumber, rib_key: ribKey }
        : { payout_method: method, phone_number: phone.trim() };
      await profileApi.updatePayout(payload);
      Alert.alert(t('common.success'), t('payoutInfo.saved'));
    } catch (e: any) {
      Alert.alert(t('common.error'), e.response?.data?.message ?? t('payoutInfo.saveError'));
    } finally {
      setSaving(false);
    }
  };

  if (unlocking) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  if (!unlocked) {
    return (
      <View style={styles.center}>
        <FontAwesome5 name="lock" size={32} color={COLORS.textMuted} />
        <Text style={styles.lockText}>{unlockError ?? t('payoutInfo.unlockFailed')}</Text>
        <TouchableOpacity style={styles.unlockBtn} onPress={tryUnlock}>
          <Text style={styles.saveBtnText}>{t('payoutInfo.retryUnlock')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={styles.hint}>{t('payoutInfo.hint')}</Text>

      {current?.method && (
        <View style={styles.currentBox}>
          <FontAwesome5 name="check-circle" size={14} color={COLORS.success} solid />
          <Text style={styles.currentText}>
            {t('payoutInfo.currentMethod')}: {current.method === 'bank' ? t('payoutInfo.bankAccount') : MOBILE_METHODS.find(m => m.value === current.method)?.label}
            {current.identifier?.number ? ` — ${revealed ? current.identifier.number : mask(current.identifier.number)}` : ''}
          </Text>
          {current.identifier?.number && (
            <TouchableOpacity onPress={() => setRevealed(r => !r)}>
              <FontAwesome5 name={revealed ? 'eye-slash' : 'eye'} size={14} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      <Text style={styles.label}>{t('payoutInfo.methodLabel')}</Text>
      <View style={styles.methodGrid}>
        {[...MOBILE_METHODS, { value: 'bank' as PayoutMethod, label: t('payoutInfo.bankAccount') }].map((m) => (
          <TouchableOpacity
            key={m.value}
            style={[styles.methodChip, method === m.value && styles.methodChipActive]}
            onPress={() => setMethod(m.value)}
          >
            <Text style={[styles.methodChipText, method === m.value && styles.methodChipTextActive]}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {!isBank ? (
        <>
          <Text style={styles.label}>{t('payoutInfo.phoneLabel')}</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="+2250701234567"
            keyboardType="phone-pad"
            secureTextEntry={!revealed && phone.length > 0}
          />
          {method === 'djamo' && (
            <View style={styles.hintBox}>
              <FontAwesome5 name="info-circle" size={12} color={COLORS.info} />
              <Text style={styles.hintBoxText}>{t('payoutInfo.djamoHint')}</Text>
            </View>
          )}
        </>
      ) : (
        <>
          <Text style={styles.label}>{t('payoutInfo.bankName')}</Text>
          <TextInput style={styles.input} value={bankName} onChangeText={setBankName} />
          <Text style={styles.label}>{t('payoutInfo.bankCode')}</Text>
          <TextInput style={styles.input} value={bankCode} onChangeText={setBankCode} />
          <Text style={styles.label}>{t('payoutInfo.swiftCode')}</Text>
          <TextInput style={styles.input} value={swiftCode} onChangeText={setSwiftCode} />
          <Text style={styles.label}>{t('payoutInfo.agencyCode')}</Text>
          <TextInput style={styles.input} value={agencyCode} onChangeText={setAgencyCode} />
          <Text style={styles.label}>{t('payoutInfo.accountNumber')}</Text>
          <TextInput style={styles.input} value={accountNumber} onChangeText={setAccountNumber} secureTextEntry={!revealed && accountNumber.length > 0} />
          <Text style={styles.label}>{t('payoutInfo.ribKey')}</Text>
          <TextInput style={styles.input} value={ribKey} onChangeText={setRibKey} secureTextEntry={!revealed && ribKey.length > 0} />
        </>
      )}

      <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.saveBtnText}>{t('common.save')}</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.background },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 14 },
  lockText:    { fontSize: 14, color: COLORS.textMuted, textAlign: 'center' },
  unlockBtn:   { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24, marginTop: 8 },
  hint:        { fontSize: 13, color: COLORS.textMuted, lineHeight: 19, marginBottom: 16 },
  currentBox:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#D1FAE5', borderRadius: 10, padding: 12, marginBottom: 16 },
  currentText: { fontSize: 12, color: '#065F46', fontWeight: '600', flex: 1 },
  label:       { fontSize: 13, fontWeight: '600', color: COLORS.dark, marginBottom: 6, marginTop: 14 },
  methodGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  methodChip:  { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border },
  methodChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  methodChipText:   { fontSize: 12, color: COLORS.textMuted, fontWeight: '600' },
  methodChipTextActive: { color: COLORS.white },
  input:       { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: COLORS.text, backgroundColor: COLORS.white },
  hintBox:     { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8, backgroundColor: '#EFF6FF', borderRadius: 8, padding: 10 },
  hintBoxText: { flex: 1, fontSize: 11, color: COLORS.info, lineHeight: 16 },
  saveBtn:     { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  saveBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
});
