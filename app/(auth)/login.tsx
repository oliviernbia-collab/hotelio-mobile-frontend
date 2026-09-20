import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, Image,
} from 'react-native';
import { Link, router } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/authStore';
import { COLORS } from '@/constants';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function LoginScreen() {
  const { login, loading, error, clearError } = useAuthStore();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert(t('common.error'), t('auth.fillAllFields'));
      return;
    }
    try {
      await login(email, password);
      router.replace('/(tabs)');
    } catch {}
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.langSwitcherWrap, { top: insets.top + 12 }]}>
        <LanguageSwitcher />
      </View>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.appName}>Hôtelio</Text>
          <Text style={styles.subtitle}>{t('auth.loginTitle')}</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {error ? (
            <View style={styles.errorBox}>
              <FontAwesome5 name="exclamation-circle" size={15} color={COLORS.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Text style={styles.label}>
            <FontAwesome5 name="envelope" size={13} color={COLORS.dark} />{'  '}{t('auth.email')}
          </Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={(t) => { setEmail(t); clearError(); }}
            placeholder={t('auth.emailPlaceholder')}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />

          <Text style={styles.label}>
            <FontAwesome5 name="lock" size={13} color={COLORS.dark} />{'  '}{t('auth.password')}
          </Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.inputInner}
              value={password}
              onChangeText={(t) => { setPassword(t); clearError(); }}
              placeholder="••••••••"
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn}>
              <FontAwesome5 name={showPassword ? 'eye-slash' : 'eye'} size={18} color={COLORS.gray} />
            </TouchableOpacity>
          </View>

          <Link href="/(auth)/forgot-password" style={styles.forgotLink}>
            {t('auth.forgotPassword')}
          </Link>

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {!loading && <FontAwesome5 name="sign-in-alt" size={16} color={COLORS.white} style={{ marginRight: 8 }} />}
            <Text style={styles.btnText}>{loading ? t('auth.loginLoading') : t('auth.loginBtn')}</Text>
          </TouchableOpacity>

          <View style={styles.registerRow}>
            <Text style={styles.registerText}>{t('auth.noAccount')} </Text>
            <Link href="/(auth)/register" style={styles.registerLink}>{t('auth.registerLink')}</Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.primary },
  langSwitcherWrap: { position: 'absolute', right: 16, zIndex: 10 },
  scroll:       { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header:       { alignItems: 'center', marginBottom: 40 },
  logo:         { width: 100, height: 100, marginBottom: 12, borderRadius: 50, overflow: 'hidden' },
  appName:      { fontSize: 32, fontWeight: 'bold', color: COLORS.white, marginBottom: 6 },
  subtitle:     { fontSize: 16, color: 'rgba(255,255,255,0.8)' },
  form:         { backgroundColor: COLORS.white, borderRadius: 16, padding: 24, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
  label:        { fontSize: 14, fontWeight: '600', color: COLORS.dark, marginBottom: 6, marginTop: 12 },
  input:        { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: COLORS.text, backgroundColor: COLORS.background },
  inputWrap:    { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, backgroundColor: COLORS.background },
  inputInner:   { flex: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: COLORS.text },
  eyeBtn:       { paddingHorizontal: 12 },
  forgotLink:   { color: COLORS.primary, fontSize: 13, textAlign: 'right', marginTop: 8, marginBottom: 20 },
  btn:          { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 4, flexDirection: 'row', justifyContent: 'center' },
  btnDisabled:  { opacity: 0.6 },
  btnText:      { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  registerRow:  { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  registerText: { color: COLORS.textMuted, fontSize: 14 },
  registerLink: { color: COLORS.primary, fontSize: 14, fontWeight: '600' },
  errorBox:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEE2E2', borderRadius: 8, padding: 12, marginBottom: 12 },
  errorText:    { color: COLORS.danger, fontSize: 14, flex: 1 },
});
