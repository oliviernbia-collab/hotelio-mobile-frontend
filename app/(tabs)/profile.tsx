import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Alert, Image, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { profileApi, staffApi, reservationApi } from '@/services/api';
import { Reservation } from '@/types';
import { LOYALTY_TIERS, getTier } from '@/app/(tabs)/clients';
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

const PROFILE_RES_STATUS_KEYS: Record<string, string> = {
  en_attente: 'reservations.status_en_attente',
  confirmée:  'reservations.status_confirmee',
  terminée:   'reservations.status_finalisee',
  annulée:    'reservations.status_annulee',
};

const PROFILE_ROOM_TYPE_KEYS: Record<string, string> = {
  Simple: 'rooms.type_Simple', Double: 'rooms.type_Double', Twin: 'rooms.type_Twin',
  Suite: 'rooms.type_Suite', Deluxe: 'rooms.type_Deluxe', Familiale: 'rooms.type_Familiale',
  Présidentielle: 'rooms.type_Présidentielle', 'Junior Suite': 'rooms.type_JuniorSuite',
};

export default function ProfileScreen() {
  const { user, logout, setUser } = useAuthStore();
  const { t, i18n } = useTranslation();
  const [editMode,       setEditMode]       = useState(false);
  const [name,           setName]           = useState(user?.name ?? '');
  const [email,          setEmail]          = useState(user?.email ?? '');
  const [loading,        setLoading]        = useState(false);
  const [avatarLoading,  setAvatarLoading]  = useState(false);
  const [staffRecord,    setStaffRecord]    = useState<any>(null);
  const [reservations,   setReservations]   = useState<Reservation[]>([]);
  const [resLoading,     setResLoading]     = useState(false);

  useEffect(() => {
    if (user?.role === 'employe') {
      staffApi.me().then(res => setStaffRecord(res.data)).catch(() => {});
    }
    if (user?.role === 'client') {
      profileApi.get().then(res => setUser({ ...user, ...res.data })).catch(() => {});
      setResLoading(true);
      reservationApi.mine({ per_page: 5 })
        .then(res => {
          const data = res.data?.data ?? res.data;
          setReservations(Array.isArray(data) ? data.slice(0, 5) : []);
        })
        .catch(() => {})
        .finally(() => setResLoading(false));
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
    { icon: 'bell',        label: t('profile.nav_notifications'), onPress: () => router.push('/(tabs)/notifications' as any) },
    ...(user?.role === 'admin' ? [
      { icon: 'users',       label: t('profile.nav_users'),       onPress: () => router.push('/(tabs)/admin/users' as any) },
      { icon: 'list',        label: t('profile.nav_logs'),        onPress: () => router.push('/(tabs)/admin/logs' as any) },
      { icon: 'crown',       label: t('profile.nav_topClients'),  onPress: () => router.push('/(tabs)/clients' as any) },
    ] : []),
    ...(user?.role === 'prestataire' ? [
      { icon: 'crown',       label: t('profile.nav_topClients'),  onPress: () => router.push('/(tabs)/clients' as any) },
    ] : []),
    ...(user?.role !== 'client' ? [
      { icon: 'clock',       label: t('profile.nav_pointage'),   onPress: () => router.push('/(tabs)/pointage' as any) },
      { icon: 'ticket-alt',  label: t('profile.nav_tickets'),    onPress: () => router.push('/(tabs)/tickets' as any) },
      { icon: 'dollar-sign', label: t('profile.nav_billing'),    onPress: () => router.push('/(tabs)/facturations' as any) },
      { icon: 'chart-line',  label: t('profile.nav_expenses'),   onPress: () => router.push('/(tabs)/expenses' as any) },
    ] : [
      { icon: 'calendar-check', label: t('profile.nav_reservations'), onPress: () => router.push('/(tabs)/reservations' as any) },
      { icon: 'heart',          label: t('profile.nav_favorites'),    onPress: () => router.push('/(tabs)/favorites' as any) },
      { icon: 'shopping-bag',   label: t('profile.nav_orders'),       onPress: () => router.push('/(tabs)/boutique/my-orders' as any) },
    ]),
  ];

  return (
    <ScrollView style={styles.container}>
      {/* Header avec avatar */}
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

      {/* Edition profil */}
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
            <InfoRow label={t('profile.twoFA')}  value={user?.two_fa ? t('profile.twoFA_on') : t('profile.twoFA_off')} />
          </>
        )}
      </View>

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

      {/* Points fidélité (client uniquement) */}
      {user?.role === 'client' && (() => {
        const pts  = (user as any).points_fidelite ?? 0;
        const tier = getTier(pts);
        const next = LOYALTY_TIERS.find(ti => ti.min > tier.min);
        const progress = next ? Math.min(1, (pts - tier.min) / (next.min - tier.min)) : 1;
        return (
          <View style={[styles.section, { borderLeftWidth: 4, borderLeftColor: tier.color }]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('profile.myLoyalty')}</Text>
              <View style={[styles.loyaltyBadge, { backgroundColor: tier.bg }]}>
                <Text style={styles.loyaltyBadgeIcon}>{tier.icon}</Text>
                <Text style={[styles.loyaltyBadgeName, { color: tier.color }]}>{tier.name}</Text>
              </View>
            </View>
            <View style={styles.ptsDisplay}>
              <Text style={[styles.ptsNumber, { color: tier.color }]}>{pts}</Text>
              <Text style={styles.ptsSuffix}>{t('profile.points')}</Text>
            </View>
            <View style={styles.progressTrackFull}>
              <View style={[styles.progressFill, { backgroundColor: tier.color, width: `${Math.round(progress * 100)}%` as any }]} />
            </View>
            {next ? (
              <Text style={styles.progressHint}>
                {t('profile.nextLevel', { count: next.min - pts, name: next.name, icon: next.icon })}
              </Text>
            ) : (
              <Text style={[styles.progressHint, { color: tier.color, fontWeight: '700' }]}>
                {t('profile.maxLevel')}
              </Text>
            )}
            <View style={[styles.perkRow, { backgroundColor: tier.bg }]}>
              <FontAwesome5 name="gift" size={13} color={tier.color} />
              <Text style={[styles.perkRowText, { color: tier.color }]}>{tier.perk}</Text>
            </View>
            <Text style={styles.tiersTitle}>{t('profile.allTiers')}</Text>
            {LOYALTY_TIERS.map(ti => (
              <View key={ti.name} style={[styles.tierRow, pts >= ti.min && { opacity: 1 }, pts < ti.min && { opacity: 0.45 }]}>
                <Text style={styles.tierRowIcon}>{ti.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.tierRowName, { color: ti.color }]}>{ti.name} — {ti.min}+ pts</Text>
                  <Text style={styles.tierRowPerk}>{ti.perk}</Text>
                </View>
                {pts >= ti.min && <FontAwesome5 name="check-circle" size={14} color={ti.color} solid />}
              </View>
            ))}
          </View>
        );
      })()}

      {/* Réservations récentes (client uniquement) */}
      {user?.role === 'client' && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('profile.myReservations')}</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/reservations' as any)} style={styles.voirToutBtn}>
              <Text style={styles.voirToutText}>{t('profile.seeAll')}</Text>
              <FontAwesome5 name="chevron-right" size={10} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          {resLoading ? (
            <View style={styles.resLoading}><ActivityIndicator size="small" color={COLORS.primary} /></View>
          ) : reservations.length === 0 ? (
            <View style={styles.resEmpty}>
              <FontAwesome5 name="calendar-times" size={32} color={COLORS.grayLight} />
              <Text style={styles.resEmptyText}>{t('profile.noReservations')}</Text>
              <TouchableOpacity style={styles.resEmptyBtn} onPress={() => router.push('/(tabs)/reservations/create' as any)}>
                <FontAwesome5 name="plus" size={12} color={COLORS.white} />
                <Text style={styles.resEmptyBtnText}>{t('hotels.bookNow')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {reservations.map(r => <ReservationCard key={r.id} item={r} />)}
              <TouchableOpacity style={styles.seeAllRow} onPress={() => router.push('/(tabs)/reservations' as any)}>
                <Text style={styles.seeAllText}>{t('profile.seeAllRes')}</Text>
                <FontAwesome5 name="arrow-right" size={12} color={COLORS.primary} />
              </TouchableOpacity>
            </>
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
  );
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  en_attente: { bg: '#FEF3C7', text: '#92400E' },
  confirmée:  { bg: '#D1FAE5', text: '#065F46' },
  terminée:   { bg: '#DBEAFE', text: '#1E40AF' },
  annulée:    { bg: '#FEE2E2', text: '#991B1B' },
};

function ReservationCard({ item }: { item: Reservation & Record<string, any> }) {
  const { t } = useTranslation();
  const sc = STATUS_COLORS[item.status] ?? { bg: '#F3F4F6', text: '#6B7280' };
  const hotelName  = item.hotel_short_name ?? item.hotel_name ?? item.hotel?.short_name ?? item.hotel?.name ?? '—';
  const roomNumber = item.room_number ?? item.room?.number;
  const roomType   = item.room_type ?? item.room?.type;
  const roomPrice  = item.room_price ?? item.room?.price ?? item.price;
  return (
    <View style={styles.resCard}>
      <View style={styles.resCardLeft}>
        <View style={[styles.resStatusDot, { backgroundColor: sc.text }]} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.resCardTop}>
          <Text style={styles.resHotel} numberOfLines={1}>{hotelName}</Text>
          <View style={[styles.resBadge, { backgroundColor: sc.bg }]}>
            <Text style={[styles.resBadgeText, { color: sc.text }]}>{t(PROFILE_RES_STATUS_KEYS[item.status] ?? item.status)}</Text>
          </View>
        </View>
        <View style={styles.resCardDates}>
          <FontAwesome5 name="calendar-alt" size={10} color={COLORS.textMuted} />
          <Text style={styles.resDates}>{item.checkin} → {item.checkout}</Text>
          {item.nights ? <Text style={styles.resNights}>{item.nights} {item.nights > 1 ? t('common.nights') : t('common.night')}</Text> : null}
        </View>
        {roomNumber ? (
          <Text style={styles.resRoom}>
            {t('common.room')} {roomNumber}{roomType ? ` · ${t(PROFILE_ROOM_TYPE_KEYS[roomType] ?? roomType)}` : ''}
            {roomPrice ? ` · ${Number(roomPrice).toLocaleString()} ${t('createRes.fcfaPerNight')}` : ''}
          </Text>
        ) : null}
      </View>
      <Text style={styles.resTotal}>{item.total?.toLocaleString()} FCFA</Text>
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
  container:     { flex: 1, backgroundColor: COLORS.background },
  header:        { backgroundColor: COLORS.primary, paddingHorizontal: 32, paddingBottom: 32, paddingTop: 16, alignItems: 'center' },
  closeBtnRow:   { width: '100%', flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 },
  closeBtn:      { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)', justifyContent: 'center', alignItems: 'center' },
  avatarWrap:    { position: 'relative', marginBottom: 12 },
  avatar:        { width: 88, height: 88, borderRadius: 44, backgroundColor: COLORS.secondary, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)' },
  avatarImg:     { width: 88, height: 88, borderRadius: 44, borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)' },
  avatarText:    { color: COLORS.white, fontSize: 28, fontWeight: '700' },
  cameraBtn:     { position: 'absolute', bottom: 0, right: 0, backgroundColor: COLORS.dark, width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.white },
  name:          { fontSize: 20, fontWeight: 'bold', color: COLORS.white },
  emailText:     { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 4 },
  roleBadge:     { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 4, marginTop: 8 },
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
  label:         { fontSize: 13, color: COLORS.textMuted, marginTop: 10, marginBottom: 4 },
  input:         { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: COLORS.text, backgroundColor: COLORS.background },
  saveBtn:       { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 16 },
  saveBtnText:   { color: COLORS.white, fontSize: 15, fontWeight: '700' },

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

  voirToutBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  voirToutText:     { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  resLoading:       { paddingVertical: 20, alignItems: 'center' },
  resEmpty:         { alignItems: 'center', paddingVertical: 24, gap: 10 },
  resEmptyText:     { fontSize: 14, color: COLORS.textMuted },
  resEmptyBtn:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  resEmptyBtnText:  { fontSize: 13, color: COLORS.white, fontWeight: '700' },
  resCard:          { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  resCardLeft:      { justifyContent: 'center', paddingTop: 2 },
  resStatusDot:     { width: 8, height: 8, borderRadius: 4 },
  resCardTop:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  resHotel:         { fontSize: 14, fontWeight: '700', color: COLORS.dark, flex: 1, marginRight: 8 },
  resBadge:         { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  resBadgeText:     { fontSize: 10, fontWeight: '700' },
  resCardDates:     { flexDirection: 'row', alignItems: 'center', gap: 5 },
  resDates:         { fontSize: 12, color: COLORS.textMuted },
  resNights:        { fontSize: 11, color: COLORS.textMuted, backgroundColor: COLORS.background, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8 },
  resRoom:          { fontSize: 11, color: COLORS.textMuted, marginTop: 3 },
  resTotal:         { fontSize: 13, fontWeight: '800', color: COLORS.dark, textAlign: 'right' },
  seeAllRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 12, marginTop: 4 },
  seeAllText:       { fontSize: 13, color: COLORS.primary, fontWeight: '600' },

  loyaltyBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  loyaltyBadgeIcon: { fontSize: 14 },
  loyaltyBadgeName: { fontSize: 12, fontWeight: '700' },
  ptsDisplay:       { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginVertical: 8 },
  ptsNumber:        { fontSize: 42, fontWeight: '900' },
  ptsSuffix:        { fontSize: 16, color: COLORS.textMuted, fontWeight: '500' },
  progressTrackFull:{ height: 8, backgroundColor: '#E2E8F0', borderRadius: 4, overflow: 'hidden', marginBottom: 6 },
  progressFill:     { height: 8, borderRadius: 4 },
  progressHint:     { fontSize: 12, color: COLORS.textMuted, marginBottom: 10 },
  perkRow:          { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, marginBottom: 14 },
  perkRowText:      { fontSize: 13, fontWeight: '600', flex: 1 },
  tiersTitle:       { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 },
  tierRow:          { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tierRowIcon:      { fontSize: 18, width: 24, textAlign: 'center' },
  tierRowName:      { fontSize: 13, fontWeight: '700' },
  tierRowPerk:      { fontSize: 11, color: COLORS.textMuted },
});
