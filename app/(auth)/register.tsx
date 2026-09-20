import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, Image, ActivityIndicator,
} from 'react-native';
import { Link, router } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/authStore';
import { COLORS } from '@/constants';
import LanguageSwitcher from '@/components/LanguageSwitcher';

type Role = 'client' | 'prestataire';

interface ProofFile {
  uri:      string;
  name:     string;
  mimeType: string;
  size:     number;
}

export default function RegisterScreen() {
  const { register, loading, error, clearError } = useAuthStore();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [name,          setName]          = useState('');
  const [email,         setEmail]         = useState('');
  const [password,      setPassword]      = useState('');
  const [confirm,       setConfirm]       = useState('');
  const [role,          setRole]          = useState<Role>('client');
  const [proof,         setProof]         = useState<ProofFile | null>(null);
  const [showPassword,  setShowPassword]  = useState(false);
  const [showConfirm,   setShowConfirm]   = useState(false);
  const [pickingFile,   setPickingFile]   = useState(false);

  const pickDocument = async () => {
    setPickingFile(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets.length > 0) {
        const file = result.assets[0];
        setProof({
          uri:      file.uri,
          name:     file.name,
          mimeType: file.mimeType ?? 'application/octet-stream',
          size:     file.size ?? 0,
        });
      }
    } catch {
      Alert.alert(t('common.error'), t('auth.cannotPickFile'));
    } finally {
      setPickingFile(false);
    }
  };

  const handleRegister = async () => {
    if (!name || !email || !password || !confirm) {
      Alert.alert(t('common.error'), t('auth.fillAllFields'));
      return;
    }
    if (password !== confirm) {
      Alert.alert(t('common.error'), t('auth.passwordMismatch'));
      return;
    }
    if (password.length < 8) {
      Alert.alert(t('common.error'), t('auth.passwordTooShort'));
      return;
    }
    if (role === 'prestataire' && !proof) {
      Alert.alert(t('auth.docRequired'), t('auth.docRequiredMsg'));
      return;
    }

    const formData = new FormData();
    formData.append('name',                  name);
    formData.append('email',                 email);
    formData.append('password',              password);
    formData.append('password_confirmation', confirm);
    formData.append('role',                  role);

    if (role === 'prestataire' && proof) {
      formData.append('proof_document', {
        uri:  proof.uri,
        type: proof.mimeType,
        name: proof.name,
      } as any);
    }

    try {
      await register(formData);
      if (role === 'prestataire') {
        Alert.alert(
          t('auth.requestSent'),
          t('auth.requestSentMsg'),
          [{ text: t('common.ok'), onPress: () => router.replace('/(auth)/login') }]
        );
      } else {
        router.replace('/(tabs)');
      }
    } catch {}
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TouchableOpacity
        style={[styles.backBtn, { top: insets.top + 12 }]}
        onPress={() => router.back()}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <FontAwesome5 name="arrow-left" size={16} color={COLORS.white} />
      </TouchableOpacity>
      <View style={[styles.langSwitcherWrap, { top: insets.top + 12 }]}>
        <LanguageSwitcher />
      </View>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.header}>
          <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.appName}>Hôtelio</Text>
          <Text style={styles.subtitle}>{t('auth.registerTitle')}</Text>
        </View>

        <View style={styles.form}>
          {error ? (
            <View style={styles.errorBox}>
              <FontAwesome5 name="exclamation-circle" size={15} color={COLORS.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* ── Sélection du rôle ── */}
          <Text style={styles.sectionLabel}>{t('auth.iAm')}</Text>
          <View style={styles.roleRow}>
            <TouchableOpacity
              style={[styles.roleCard, role === 'client' && styles.roleCardActive]}
              onPress={() => { setRole('client'); setProof(null); clearError(); }}
            >
              <Text style={styles.roleEmoji}>🧳</Text>
              <Text style={[styles.roleTitle, role === 'client' && styles.roleTitleActive]}>{t('auth.roleClient')}</Text>
              <Text style={[styles.roleDesc,  role === 'client' && styles.roleDescActive]}>{t('auth.roleClientDesc')}</Text>
              {role === 'client' && (
                <View style={styles.roleCheck}>
                  <FontAwesome5 name="check-circle" size={16} color={COLORS.primary} solid />
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.roleCard, role === 'prestataire' && styles.roleCardActive]}
              onPress={() => { setRole('prestataire'); clearError(); }}
            >
              <Text style={styles.roleEmoji}>🏨</Text>
              <Text style={[styles.roleTitle, role === 'prestataire' && styles.roleTitleActive]}>{t('auth.roleOwner')}</Text>
              <Text style={[styles.roleDesc,  role === 'prestataire' && styles.roleDescActive]}>{t('auth.roleOwnerDesc')}</Text>
              {role === 'prestataire' && (
                <View style={styles.roleCheck}>
                  <FontAwesome5 name="check-circle" size={16} color={COLORS.primary} solid />
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* ── Champs communs ── */}
          <Text style={styles.label}>
            <FontAwesome5 name="user" size={12} color={COLORS.dark} />{'  '}{t('auth.fullName')}
          </Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={v => { setName(v); clearError(); }}
            placeholder={t('auth.fullNamePlaceholder')}
            autoCapitalize="words"
          />

          <Text style={styles.label}>
            <FontAwesome5 name="envelope" size={12} color={COLORS.dark} />{'  '}{t('auth.email')}
          </Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={v => { setEmail(v); clearError(); }}
            placeholder={t('auth.emailPlaceholder')}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>
            <FontAwesome5 name="lock" size={12} color={COLORS.dark} />{'  '}{t('auth.password')}
          </Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.inputInner}
              value={password}
              onChangeText={v => { setPassword(v); clearError(); }}
              placeholder={t('auth.passwordMin')}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn}>
              <FontAwesome5 name={showPassword ? 'eye-slash' : 'eye'} size={16} color={COLORS.gray} />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>
            <FontAwesome5 name="lock" size={12} color={COLORS.dark} />{'  '}{t('auth.confirmPassword')}
          </Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.inputInner}
              value={confirm}
              onChangeText={v => { setConfirm(v); clearError(); }}
              placeholder="••••••••"
              secureTextEntry={!showConfirm}
            />
            <TouchableOpacity onPress={() => setShowConfirm(v => !v)} style={styles.eyeBtn}>
              <FontAwesome5 name={showConfirm ? 'eye-slash' : 'eye'} size={16} color={COLORS.gray} />
            </TouchableOpacity>
          </View>

          {/* ── Document justificatif (propriétaire seulement) ── */}
          {role === 'prestataire' && (
            <View style={styles.proofSection}>
              <View style={styles.proofHeader}>
                <FontAwesome5 name="file-alt" size={16} color={COLORS.primary} />
                <Text style={styles.proofTitle}>{t('auth.proofSection')}</Text>
              </View>
              <Text style={styles.proofHint}>{t('auth.proofHint')}</Text>

              <TouchableOpacity
                style={[styles.uploadBtn, proof && styles.uploadBtnDone]}
                onPress={pickDocument}
                disabled={pickingFile}
              >
                {pickingFile ? (
                  <ActivityIndicator color={COLORS.primary} size="small" />
                ) : (
                  <FontAwesome5
                    name={proof ? 'check-circle' : 'cloud-upload-alt'}
                    size={20}
                    color={proof ? COLORS.success : COLORS.primary}
                    solid={!!proof}
                  />
                )}
                <Text style={[styles.uploadText, proof && styles.uploadTextDone]}>
                  {proof ? proof.name : t('auth.chooseDoc')}
                </Text>
              </TouchableOpacity>

              {proof && (
                <TouchableOpacity style={styles.removeFile} onPress={() => setProof(null)}>
                  <FontAwesome5 name="trash-alt" size={13} color={COLORS.danger} />
                  <Text style={styles.removeFileText}>{t('auth.removeFile')}</Text>
                </TouchableOpacity>
              )}

              <View style={styles.infoBox}>
                <FontAwesome5 name="info-circle" size={14} color={COLORS.info} />
                <Text style={styles.infoText}>{t('auth.validationInfo')}</Text>
              </View>
            </View>
          )}

          {/* ── Bouton ── */}
          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <>
                <FontAwesome5
                  name={role === 'prestataire' ? 'paper-plane' : 'user-plus'}
                  size={15}
                  color={COLORS.white}
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.btnText}>
                  {role === 'prestataire' ? t('auth.sendRequestBtn') : t('auth.registerBtn')}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.loginRow}>
            <Text style={styles.loginText}>{t('auth.alreadyAccount')} </Text>
            <Link href="/(auth)/login" style={styles.loginLink}>{t('auth.loginLink')}</Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: COLORS.primary },
  backBtn:         { position: 'absolute', left: 16, zIndex: 10, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  langSwitcherWrap:{ position: 'absolute', right: 16, zIndex: 10 },
  scroll:          { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header:          { alignItems: 'center', marginBottom: 28 },
  logo:            { width: 90, height: 90, marginBottom: 10, borderRadius: 45, overflow: 'hidden' },
  appName:         { fontSize: 30, fontWeight: 'bold', color: COLORS.white, marginBottom: 4 },
  subtitle:        { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  form:            { backgroundColor: COLORS.white, borderRadius: 16, padding: 20, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
  errorBox:        { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEE2E2', borderRadius: 8, padding: 12, marginBottom: 8 },
  errorText:       { color: COLORS.danger, fontSize: 13, flex: 1 },
  sectionLabel:    { fontSize: 13, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, marginTop: 4 },
  roleRow:         { flexDirection: 'row', gap: 10, marginBottom: 16 },
  roleCard:        { flex: 1, borderWidth: 2, borderColor: COLORS.border, borderRadius: 14, padding: 14, alignItems: 'center', gap: 4, position: 'relative', backgroundColor: COLORS.background },
  roleCardActive:  { borderColor: COLORS.primary, backgroundColor: '#EEF2FF' },
  roleEmoji:       { fontSize: 28 },
  roleTitle:       { fontSize: 14, fontWeight: '700', color: COLORS.dark },
  roleTitleActive: { color: COLORS.primary },
  roleDesc:        { fontSize: 11, color: COLORS.textMuted, textAlign: 'center' },
  roleDescActive:  { color: COLORS.primary },
  roleCheck:       { position: 'absolute', top: 8, right: 8 },
  label:           { fontSize: 13, fontWeight: '600', color: COLORS.dark, marginBottom: 6, marginTop: 14 },
  input:           { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: COLORS.text, backgroundColor: COLORS.background },
  inputWrap:       { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, backgroundColor: COLORS.background },
  inputInner:      { flex: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: COLORS.text },
  eyeBtn:          { paddingHorizontal: 12 },
  proofSection:    { marginTop: 16, borderWidth: 1.5, borderColor: '#DBEAFE', borderRadius: 12, padding: 14, backgroundColor: '#F0F7FF' },
  proofHeader:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  proofTitle:      { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  proofHint:       { fontSize: 12, color: COLORS.textMuted, lineHeight: 18, marginBottom: 12 },
  uploadBtn:       { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: COLORS.primary, borderStyle: 'dashed', borderRadius: 10, padding: 14, justifyContent: 'center', backgroundColor: COLORS.white },
  uploadBtnDone:   { borderStyle: 'solid', borderColor: COLORS.success, backgroundColor: '#F0FDF4' },
  uploadText:      { fontSize: 14, color: COLORS.primary, fontWeight: '600', flex: 1, textAlign: 'center' },
  uploadTextDone:  { color: COLORS.success },
  removeFile:      { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end', marginTop: 6 },
  removeFileText:  { fontSize: 12, color: COLORS.danger },
  infoBox:         { flexDirection: 'row', gap: 6, marginTop: 12, backgroundColor: '#EFF6FF', borderRadius: 8, padding: 10 },
  infoText:        { fontSize: 12, color: COLORS.info, flex: 1, lineHeight: 17 },
  btn:             { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 20, flexDirection: 'row', justifyContent: 'center' },
  btnDisabled:     { opacity: 0.6 },
  btnText:         { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  loginRow:        { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  loginText:       { color: COLORS.textMuted, fontSize: 14 },
  loginLink:       { color: COLORS.primary, fontSize: 14, fontWeight: '600' },
});
