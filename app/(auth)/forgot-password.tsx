import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { authApi } from '@/services/api';
import { COLORS } from '@/constants';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email) return;
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      Alert.alert(t('auth.emailSent'), t('auth.emailSentMsg'), [
        { text: t('common.ok'), onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert(t('common.error'), err.response?.data?.message || t('auth.genericError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('auth.forgotTitle')}</Text>
      <Text style={styles.desc}>{t('auth.forgotDesc')}</Text>

      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder={t('auth.emailPlaceholder')}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleSubmit} disabled={loading}>
        <Text style={styles.btnText}>{loading ? t('common.sending') : t('auth.sendLink')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, padding: 24, backgroundColor: COLORS.background },
  title:      { fontSize: 22, fontWeight: 'bold', color: COLORS.dark, marginBottom: 12 },
  desc:       { fontSize: 15, color: COLORS.textMuted, marginBottom: 24, lineHeight: 22 },
  input:      { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, backgroundColor: COLORS.white, marginBottom: 20 },
  btn:        { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  btnDisabled:{ opacity: 0.6 },
  btnText:    { color: COLORS.white, fontSize: 16, fontWeight: '700' },
});
