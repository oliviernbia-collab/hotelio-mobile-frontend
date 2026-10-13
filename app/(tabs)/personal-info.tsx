import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, Alert, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { profileApi } from '@/services/api';
import { COLORS } from '@/constants';
import { FontAwesome5 } from '@expo/vector-icons';

const ROLE_KEYS: Record<string, string> = {
  admin: 'roles.admin', prestataire: 'roles.prestataire_full', employe: 'roles.employe', client: 'roles.client',
};

export default function PersonalInfoScreen() {
  const { user, setUser } = useAuthStore();
  const { t } = useTranslation();
  const [editMode, setEditMode] = useState(false);
  const [name,     setName]     = useState(user?.name ?? '');
  const [email,    setEmail]    = useState(user?.email ?? '');
  const [loading,  setLoading]  = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await profileApi.update({ name, email });
      if (res.data?.user) setUser(res.data.user);
      else setUser({ ...user!, name, email });
      setEditMode(false);
      Alert.alert(t('common.success'), t('profile.updateSuccess'));
    } catch (e: any) {
      Alert.alert(t('common.error'), e.response?.data?.message ?? t('profile.updateError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('profile.personalInfo')}</Text>
          <TouchableOpacity onPress={() => setEditMode(!editMode)}>
            <FontAwesome5 name={editMode ? 'times' : 'pencil-alt'} size={20} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {editMode ? (
          <>
            <Text style={styles.label}>{t('profile.name')}</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} />
            <Text style={styles.label}>{t('auth.email')}</Text>
            <TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            <TouchableOpacity style={[styles.saveBtn, loading && { opacity: 0.6 }]} onPress={handleSave} disabled={loading}>
              <Text style={styles.saveBtnText}>{loading ? t('common.saving') : t('common.save')}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <InfoRow label={t('profile.name')}  value={user?.name ?? ''} />
            <InfoRow label={t('auth.email')}     value={user?.email ?? ''} />
            <InfoRow label={t('profile.role')}   value={t(ROLE_KEYS[user?.role ?? 'client'] ?? 'roles.client')} />
            <TouchableOpacity style={styles.twoFaRow} onPress={() => router.push('/(tabs)/two-factor' as any)}>
              <Text style={styles.twoFaLabel}>{t('profile.twoFA')}</Text>
              <View style={styles.twoFaValueWrap}>
                <Text style={styles.twoFaValue}>{user?.two_fa ? t('profile.twoFA_on') : t('profile.twoFA_off')}</Text>
                <FontAwesome5 name="chevron-right" size={12} color={COLORS.grayLight} />
              </View>
            </TouchableOpacity>
          </>
        )}
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
      <Text style={{ flex: 1, color: COLORS.textMuted, fontSize: 14 }}>{label}</Text>
      <Text style={{ color: COLORS.dark, fontSize: 14, fontWeight: '500' }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: COLORS.background },
  section:       { backgroundColor: COLORS.white, margin: 12, borderRadius: 14, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle:  { fontSize: 16, fontWeight: '700', color: COLORS.dark },
  label:         { fontSize: 13, color: COLORS.textMuted, marginTop: 10, marginBottom: 4 },
  input:         { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: COLORS.text, backgroundColor: COLORS.background },
  twoFaRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  twoFaLabel:     { flex: 1, color: COLORS.textMuted, fontSize: 14 },
  twoFaValueWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  twoFaValue:     { color: COLORS.dark, fontSize: 14, fontWeight: '500' },
  saveBtn:       { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 16 },
  saveBtnText:   { color: COLORS.white, fontSize: 15, fontWeight: '700' },
});
