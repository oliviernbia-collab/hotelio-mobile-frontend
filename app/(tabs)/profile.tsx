import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, Image, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { profileApi, staffApi } from '@/services/api';
import { COLORS } from '@/constants';
import { FontAwesome5 } from '@expo/vector-icons';
import { LANGUAGES, changeLanguage, LangCode } from '@/i18n';

const ROLE_KEYS: Record<string, string> = {
  admin: 'roles.admin', prestataire: 'roles.prestataire_full', employe: 'roles.employe', client: 'roles.client',
};

const STAFF_ROLE_KEYS: Record<string, string> = {
  'Réceptionniste':    'staff.role_receptionniste',
  'Femme de chambre':  'staff.role_femme_chambre',
  'Valet de chambre':  'staff.role_valet_chambre',
  'Room service':      'staff.role_room_service',
  'Cuisinier':         'staff.role_cuisinier',
  'Serveur':           'staff.role_serveur',
  'Barman':            'staff.role_barman',
  'Agent de sécurité': 'staff.role_agent_securite',
  'Maintenance':       'staff.role_maintenance',
  'Responsable':       'staff.role_responsable',
  'Manager':           'staff.role_manager',
};

const STAFF_TASK_KEYS: Record<string, string> = {
  'Check-in / Check-out clients': 'staff.task_checkin_checkout',
  'Nettoyage des chambres':       'staff.task_nettoyage',
  'Room service':                 'staff.task_room_service',
  'Accueil & réception':          'staff.task_accueil',
  'Sécurité / surveillance':      'staff.task_securite',
  'Restauration':                 'staff.task_restauration',
  'Maintenance technique':        'staff.task_maintenance_technique',
  'Gestion administrative':       'staff.task_gestion_admin',
  'Service petit-déjeuner':       'staff.task_petit_dej',
  'Blanchisserie & linge':        'staff.task_blanchisserie',
};

export default function ProfileScreen() {
  const { user, logout, setUser } = useAuthStore();
  const { t, i18n } = useTranslation();
  const [avatarLoading,  setAvatarLoading]  = useState(false);
  const [staffRecord,    setStaffRecord]    = useState<any>(null);

  useEffect(() => {
    if (user?.role === 'employe') {
      staffApi.me().then(res => setStaffRecord(res.data)).catch(() => {});
    }
    if (user?.role === 'client') {
      profileApi.get().then(res => setUser({ ...user, ...res.data })).catch(() => {});
    }
  }, [user?.role]);

  const getInitials = () =>
    (user?.name ?? 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const handlePickAvatar = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'image/*', copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setAvatarLoading(true);
      const formData = new FormData();
      formData.append('avatar', { uri: asset.uri, name: asset.name || 'avatar.jpg', type: asset.mimeType || 'image/jpeg' } as any);
      const res = await profileApi.uploadAvatar(formData);
      if (res.data?.user) setUser(res.data.user);
      Alert.alert(t('profile.photoUpdated'), t('profile.photoUpdatedMsg'));
    } catch (e: any) {
      Alert.alert(t('common.error'), e.response?.data?.message ?? t('profile.photoError'));
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(t('profile.logout'), t('profile.logoutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.logoutBtn'), style: 'destructive',
        onPress: async () => { await logout(); router.replace('/(auth)/login'); },
      },
    ]);
  };

  const handleChangeLanguage = async (code: LangCode) => {
    await changeLanguage(code);
  };

  const navItems = [
    { icon: 'id-card',     label: t('profile.personalInfo'),      onPress: () => router.push('/(tabs)/personal-info' as any) },
    { icon: 'bell',        label: t('profile.nav_notifications'), onPress: () => router.push('/(tabs)/notifications' as any) },
    ...(user?.role === 'admin' ? [
      { icon: 'users',       label: t('profile.nav_users'),       onPress: () => router.push('/(tabs)/admin/users' as any) },
      { icon: 'list',        label: t('profile.nav_logs'),        onPress: () => router.push('/(tabs)/admin/logs' as any) },
      { icon: 'crown',       label: t('profile.nav_topClients'),  onPress: () => router.push('/(tabs)/clients' as any) },
    ] : []),
    ...(user?.role === 'prestataire' ? [
      { icon: 'crown',       label: t('profile.nav_topClients'),  onPress: () => router.push('/(tabs)/clients' as any) },
      { icon: 'hand-holding-usd', label: t('profile.nav_payoutInfo'), onPress: () => router.push('/(tabs)/payout-info' as any) },
    ] : []),
    ...(user?.role !== 'client' ? [
      { icon: 'clock',       label: t('profile.nav_pointage'),   onPress: () => router.push('/(tabs)/pointage' as any) },
      { icon: 'ticket-alt',  label: t('profile.nav_tickets'),    onPress: () => router.push('/(tabs)/tickets' as any) },
      { icon: 'dollar-sign', label: t('profile.nav_billing'),    onPress: () => router.push('/(tabs)/facturations' as any) },
      { icon: 'chart-line',  label: t('profile.nav_expenses'),   onPress: () => router.push('/(tabs)/expenses' as any) },
      { icon: 'water',       label: t('profile.nav_pools'),      onPress: () => router.push('/(tabs)/pools' as any) },
      { icon: 'receipt',     label: t('profile.nav_orders_staff'), onPress: () => router.push('/(tabs)/orders' as any) },
    ] : [
      { icon: 'medal',          label: t('profile.myLoyalty'),        onPress: () => router.push('/(tabs)/loyalty' as any) },
      { icon: 'calendar-check', label: t('profile.nav_reservations'), onPress: () => router.push('/(tabs)/reservations' as any) },
      { icon: 'heart',          label: t('profile.nav_favorites'),    onPress: () => router.push('/(tabs)/favorites' as any) },
      { icon: 'shopping-bag',   label: t('profile.nav_orders'),       onPress: () => router.push('/(tabs)/boutique/my-orders' as any) },
    ]),
  ];

  return (
    <View style={styles.screen}>
      {/* Header avec avatar (fixe) */}
      <View style={styles.header}>
        <View style={styles.closeBtnRow}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <FontAwesome5 name="times" size={20} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.avatarWrap} onPress={handlePickAvatar} disabled={avatarLoading}>
          {avatarLoading ? (
            <View style={styles.avatar}><ActivityIndicator color={COLORS.white} /></View>
          ) : user?.avatar ? (
            <Image source={{ uri: user.avatar }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatar}><Text style={styles.avatarText}>{getInitials()}</Text></View>
          )}
          <View style={styles.cameraBtn}>
            <FontAwesome5 name="camera" size={11} color={COLORS.white} />
          </View>
        </TouchableOpacity>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.emailText}>{user?.email}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{t(ROLE_KEYS[user?.role ?? 'client'] ?? 'roles.client')}</Text>
        </View>
        {staffRecord?.hotel_name && (
          <View style={styles.hotelBadge}>
            <FontAwesome5 name="hotel" size={11} color={COLORS.white} />
            <Text style={styles.hotelBadgeText}>{staffRecord.hotel_name}</Text>
          </View>
        )}
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Sélecteur de langue */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('profile.language')}</Text>
            <FontAwesome5 name="globe" size={16} color={COLORS.primary} />
          </View>
          <View style={styles.langRow}>
            {LANGUAGES.map(lang => {
              const active = i18n.language === lang.code;
              return (
                <TouchableOpacity
                  key={lang.code}
                  style={[styles.langBtn, active && styles.langBtnActive]}
                  onPress={() => handleChangeLanguage(lang.code)}
                >
                  <Text style={styles.langFlag}>{lang.flag}</Text>
                  <Text style={[styles.langLabel, active && styles.langLabelActive]}>{lang.label}</Text>
                  {active && <FontAwesome5 name="check-circle" size={13} color={COLORS.primary} solid />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Poste & hôtel (employé uniquement) */}
        {staffRecord && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('profile.myPost')}</Text>
              <FontAwesome5 name="briefcase" size={16} color={COLORS.primary} />
            </View>
            <InfoRow label={t('profile.hotelLabel')} value={staffRecord.hotel_name ?? '—'} />
            {staffRecord.hotel_city && <InfoRow label={t('profile.cityLabel')} value={staffRecord.hotel_city} />}
            <InfoRow label={t('profile.postLabel')}  value={staffRecord.role ? t(STAFF_ROLE_KEYS[staffRecord.role] ?? staffRecord.role) : '—'} />
            {staffRecord.phone && <InfoRow label={t('profile.phone')} value={staffRecord.phone} />}
            {staffRecord.salary > 0 && (
              <InfoRow label={t('profile.salary')} value={`${Number(staffRecord.salary).toLocaleString()} ${t('profile.salaryUnit')}`} />
            )}
            {staffRecord.tasks?.length > 0 && (
              <View style={styles.tasksWrap}>
                <Text style={styles.tasksLabel}>{t('profile.assignedTasks')}</Text>
                <View style={styles.tasksList}>
                  {staffRecord.tasks.map((task: string) => (
                    <View key={task} style={styles.taskChip}>
                      <Text style={styles.taskChipText}>{t(STAFF_TASK_KEYS[task] ?? task)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* Navigation */}
        <View style={styles.section}>
          {navItems.map((item) => (
            <TouchableOpacity key={item.label} style={styles.navItem} onPress={item.onPress}>
              <FontAwesome5 name={item.icon as any} size={22} color={COLORS.primary} />
              <Text style={styles.navLabel}>{item.label}</Text>
              <FontAwesome5 name="chevron-right" size={18} color={COLORS.grayLight} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Déconnexion */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <FontAwesome5 name="sign-out-alt" size={22} color={COLORS.danger} />
          <Text style={styles.logoutText}>{t('profile.logout')}</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
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
  screen:        { flex: 1, backgroundColor: COLORS.primary },
  container:     { flex: 1, backgroundColor: COLORS.background },
  header:        { backgroundColor: COLORS.primary, paddingHorizontal: 32, paddingBottom: 12, paddingTop: 0, alignItems: 'center' },
  closeBtnRow:   { width: '100%', flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 2 },
  closeBtn:      { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)', justifyContent: 'center', alignItems: 'center' },
  avatarWrap:    { position: 'relative', marginBottom: 6 },
  avatar:        { width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.secondary, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)' },
  avatarImg:     { width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)' },
  avatarText:    { color: COLORS.white, fontSize: 24, fontWeight: '700' },
  cameraBtn:     { position: 'absolute', bottom: 0, right: 0, backgroundColor: COLORS.dark, width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.white },
  name:          { fontSize: 18, fontWeight: 'bold', color: COLORS.white },
  emailText:     { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 },
  roleBadge:     { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 4, marginTop: 6 },
  roleText:      { color: COLORS.white, fontSize: 13, fontWeight: '600' },
  hotelBadge:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 4, marginTop: 6 },
  hotelBadgeText:{ color: COLORS.white, fontSize: 12, fontWeight: '500' },
  tasksWrap:     { marginTop: 12 },
  tasksLabel:    { fontSize: 13, color: COLORS.textMuted, marginBottom: 8 },
  tasksList:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  taskChip:      { backgroundColor: '#EEF2FF', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  taskChipText:  { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  section:       { backgroundColor: COLORS.white, margin: 12, borderRadius: 14, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle:  { fontSize: 16, fontWeight: '700', color: COLORS.dark },

  /* Langue */
  langRow:       { flexDirection: 'row', gap: 8 },
  langBtn:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10, paddingVertical: 10, backgroundColor: COLORS.background },
  langBtnActive: { borderColor: COLORS.primary, backgroundColor: '#EEF2FF' },
  langFlag:      { fontSize: 18 },
  langLabel:     { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  langLabelActive:{ color: COLORS.primary },

  navItem:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, gap: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  navLabel:      { flex: 1, fontSize: 15, color: COLORS.dark },
  logoutBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.white, margin: 12, borderRadius: 14, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  logoutText:    { color: COLORS.danger, fontSize: 16, fontWeight: '700' },
});
