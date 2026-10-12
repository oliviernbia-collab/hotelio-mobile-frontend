import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { COLORS } from '@/constants';
import { FontAwesome5 } from '@expo/vector-icons';

export default function Verify2faScreen() {
  const { t } = useTranslation();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { completeTwoFaLogin } = useAuthStore();
  const [otp,     setOtp]     = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (otp.length !== 6) {
      Alert.alert(t('common.error'), t('twoFa.otpLengthError'));
      return;
    }
    setLoading(true);
    try {
      await completeTwoFaLogin(Number(userId), otp);
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert(t('common.error'), err.response?.data?.message ?? t('twoFa.verifyError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <FontAwesome5 name="shield-alt" size={36} color={COLORS.primary} />
      </View>
      <Text style={styles.title}>{t('twoFa.verifyTitle')}</Text>
      <Text style={styles.desc}>{t('twoFa.verifyDesc')}</Text>

      <TextInput
        style={styles.input}
        value={otp}
        onChangeText={(v) => setOtp(v.replace(/[^0-9]/g, '').slice(0, 6))}
        placeholder="000000"
        keyboardType="number-pad"
        maxLength={6}
        textAlign="center"
      />

      <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleVerify} disabled={loading}>
        <Text style={styles.btnText}>{loading ? t('common.loading') : t('twoFa.confirm')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, padding: 24, backgroundColor: COLORS.background, alignItems: 'center' },
  iconWrap:    { width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.primary + '15', justifyContent: 'center', alignItems: 'center', marginTop: 32, marginBottom: 16 },
  title:       { fontSize: 22, fontWeight: 'bold', color: COLORS.dark, marginBottom: 12, textAlign: 'center' },
  desc:        { fontSize: 15, color: COLORS.textMuted, marginBottom: 24, lineHeight: 22, textAlign: 'center' },
  input:       { width: '100%', borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingVertical: 16, fontSize: 24, letterSpacing: 8, fontWeight: '700', backgroundColor: COLORS.white, marginBottom: 20, color: COLORS.dark },
  btn:         { width: '100%', backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnText:     { color: COLORS.white, fontSize: 16, fontWeight: '700' },
});
