import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Image, Alert, ActivityIndicator,
} from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { twoFaApi } from '@/services/api';
import { COLORS } from '@/constants';
import { FontAwesome5 } from '@expo/vector-icons';

export default function TwoFactorScreen() {
  const { t } = useTranslation();
  const { user, setUser } = useAuthStore();
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [otp,           setOtp]           = useState('');
  const [password,      setPassword]      = useState('');
  const [loadingSetup,  setLoadingSetup]  = useState(false);
  const [saving,        setSaving]        = useState(false);

  const handleStartSetup = async () => {
    setLoadingSetup(true);
    try {
      const { data } = await twoFaApi.setup();
      setQrCodeDataUrl(data.qrCodeDataUrl);
    } catch (e: any) {
      Alert.alert(t('common.error'), e.response?.data?.message ?? t('twoFa.setupError'));
    } finally {
      setLoadingSetup(false);
    }
  };

  const handleEnable = async () => {
    if (otp.length !== 6) {
      Alert.alert(t('common.error'), t('twoFa.otpLengthError'));
      return;
    }
    setSaving(true);
    try {
      await twoFaApi.enable(otp);
      setUser({ ...user!, two_fa: true });
      setQrCodeDataUrl(null);
      setOtp('');
      Alert.alert(t('common.success'), t('twoFa.enableSuccess'));
    } catch (e: any) {
      Alert.alert(t('common.error'), e.response?.data?.message ?? t('twoFa.enableError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDisable = async () => {
    if (!password) {
      Alert.alert(t('common.error'), t('common.required'));
      return;
    }
    setSaving(true);
    try {
      await twoFaApi.disable(password);
      setUser({ ...user!, two_fa: false });
      setPassword('');
      Alert.alert(t('common.success'), t('twoFa.disableSuccess'));
    } catch (e: any) {
      Alert.alert(t('common.error'), e.response?.data?.message ?? t('twoFa.disableError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: t('twoFa.screenTitle') }} />
      <View style={styles.container}>
        <View style={styles.statusCard}>
          <FontAwesome5 name="shield-alt" size={28} color={user?.two_fa ? COLORS.secondary : COLORS.grayLight} />
          <View style={{ marginLeft: 14, flex: 1 }}>
            <Text style={styles.statusTitle}>{t('twoFa.screenTitle')}</Text>
            <View style={[styles.badge, { backgroundColor: user?.two_fa ? '#D1FAE5' : '#F3F4F6' }]}>
              <Text style={[styles.badgeText, { color: user?.two_fa ? '#065F46' : '#6B7280' }]}>
                {user?.two_fa ? t('twoFa.enabledBadge') : t('twoFa.disabledBadge')}
              </Text>
            </View>
          </View>
        </View>

        {user?.two_fa ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('twoFa.disableTitle')}</Text>
            <Text style={styles.hint}>{t('twoFa.disableHint')}</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder={t('twoFa.enterPassword')}
              secureTextEntry
            />
            <TouchableOpacity style={[styles.btnDanger, saving && styles.btnDisabled]} onPress={handleDisable} disabled={saving}>
              {saving ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.btnText}>{t('twoFa.disable')}</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('twoFa.enableTitle')}</Text>
            <Text style={styles.hint}>{t('twoFa.enableHint')}</Text>

            {!qrCodeDataUrl ? (
              <TouchableOpacity style={[styles.btn, loadingSetup && styles.btnDisabled]} onPress={handleStartSetup} disabled={loadingSetup}>
                {loadingSetup ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.btnText}>{t('twoFa.startSetup')}</Text>}
              </TouchableOpacity>
            ) : (
              <>
                <Text style={styles.hint}>{t('twoFa.scanQr')}</Text>
                <View style={styles.qrWrap}>
                  <Image source={{ uri: qrCodeDataUrl }} style={styles.qrImage} />
                </View>
                <Text style={styles.label}>{t('twoFa.enterCode')}</Text>
                <TextInput
                  style={[styles.input, styles.otpInput]}
                  value={otp}
                  onChangeText={(v) => setOtp(v.replace(/[^0-9]/g, '').slice(0, 6))}
                  placeholder="000000"
                  keyboardType="number-pad"
                  maxLength={6}
                  textAlign="center"
                />
                <TouchableOpacity style={[styles.btn, saving && styles.btnDisabled]} onPress={handleEnable} disabled={saving}>
                  {saving ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.btnText}>{t('twoFa.confirm')}</Text>}
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.background, padding: 16 },
  statusCard:  { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 16, padding: 18, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  statusTitle: { fontSize: 15, fontWeight: '700', color: COLORS.dark, marginBottom: 6 },
  badge:       { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText:   { fontSize: 12, fontWeight: '700' },
  section:     { backgroundColor: COLORS.white, borderRadius: 16, padding: 18, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  sectionTitle:{ fontSize: 16, fontWeight: '700', color: COLORS.dark, marginBottom: 8 },
  hint:        { fontSize: 13, color: COLORS.textMuted, marginBottom: 14, lineHeight: 19 },
  label:       { fontSize: 13, fontWeight: '600', color: COLORS.dark, marginBottom: 6 },
  input:       { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: COLORS.text, backgroundColor: COLORS.background, marginBottom: 14 },
  otpInput:    { fontSize: 22, letterSpacing: 8, fontWeight: '700' },
  qrWrap:      { alignItems: 'center', marginBottom: 16 },
  qrImage:     { width: 200, height: 200 },
  btn:         { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  btnDanger:   { backgroundColor: COLORS.danger, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnText:     { color: COLORS.white, fontSize: 15, fontWeight: '700' },
});
