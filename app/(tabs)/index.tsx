import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity,
  Modal, Image, Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, changeLanguage, LangCode } from '@/i18n';
import { dashboardApi, roomApi, notificationApi } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { COLORS } from '@/constants';
import { FontAwesome5 } from '@expo/vector-icons';
import { Room } from '@/types';

const { width: SCREEN_W } = Dimensions.get('window');
const MENU_W = Math.min(300, SCREEN_W * 0.82);

interface Stat { label: string; value: string | number; icon: string; color: string; }

const ROLE_KEYS: Record<string, string> = {
  admin: 'roles.admin', prestataire: 'roles.prestataire', employe: 'roles.employe', client: 'roles.client',
};

const DASH_ROOM_TYPE_KEYS: Record<string, string> = {
  Simple: 'rooms.type_Simple', Double: 'rooms.type_Double', Twin: 'rooms.type_Twin',
  Suite: 'rooms.type_Suite', Deluxe: 'rooms.type_Deluxe', Familiale: 'rooms.type_Familiale',
  Présidentielle: 'rooms.type_Présidentielle', 'Junior Suite': 'rooms.type_JuniorSuite',
};

const DASH_STATUS_KEYS: Record<string, string> = {
  en_attente: 'reservations.status_en_attente',
  confirmée:  'reservations.status_confirmee',
  occupée:    'reservations.status_occupee',
  terminée:   'reservations.status_finalisee',
  annulée:    'reservations.status_annulee',
};

export default function DashboardScreen() {
  const { user, logout } = useAuthStore();
  const { t, i18n } = useTranslation();
  const [data,           setData]           = useState<any>(null);
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [menuOpen,       setMenuOpen]       = useState(false);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [unreadNotifs,   setUnreadNotifs]   = useState(0);

  const fetchRooms = async () => {
    if (user?.role !== 'employe') return;
    try {
      const res = await roomApi.list({ status: 'disponible' });
      setAvailableRooms(Array.isArray(res.data) ? res.data : []);
    } catch {}
  };

  const fetchData = async () => {
    try {
      const res = await dashboardApi.get();
      setData(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchUnread = async () => {
    try {
      const res = await notificationApi.list();
      setUnreadNotifs(res.data.unread_count ?? 0);
    } catch {}
  };

  useEffect(() => {
    fetchData();
    fetchRooms();
    fetchUnread();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    Promise.all([fetchData(), fetchRooms(), fetchUnread()]);
  };

  const buildStats = (): Stat[] => {
    if (!data?.stats) return [];
    const s = data.stats;
    if (user?.role === 'admin') return [
      { label: t('dashboard.users'),        value: s.total_users,        icon: 'users',        color: '#8b5cf6' },
      { label: t('dashboard.hotels'),       value: s.total_hotels,       icon: 'building',     color: '#06b6d4' },
      { label: t('dashboard.reservations'), value: s.total_reservations, icon: 'calendar-alt', color: '#f59e0b' },
      { label: t('dashboard.revenue'),      value: s.total_revenue?.toLocaleString(), icon: 'dollar-sign', color: '#10b981' },
    ];
    if (user?.role === 'prestataire') return [
      { label: t('dashboard.myHotels'),    value: s.my_hotels,           icon: 'building',     color: '#8b5cf6' },
      { label: t('dashboard.availRooms'),  value: s.available_rooms,     icon: 'bed',          color: '#10b981' },
      { label: t('dashboard.activeRes'),   value: s.active_reservations, icon: 'calendar-alt', color: '#f59e0b' },
      { label: t('dashboard.revenue'),     value: s.total_revenue?.toLocaleString(), icon: 'dollar-sign', color: '#06b6d4' },
    ];
    if (user?.role === 'employe') return [
      { label: t('dashboard.availRooms'),    value: s.available_rooms, icon: 'bed',         color: '#10b981' },
      { label: t('dashboard.occupiedRooms'), value: s.occupied_rooms,  icon: 'bed',         color: '#E74C3C' },
      { label: t('dashboard.checkinsToday'), value: s.today_checkins,  icon: 'sign-in-alt', color: '#f59e0b' },
      { label: t('dashboard.checkoutsToday'),value: s.today_checkouts, icon: 'sign-out-alt',color: '#06b6d4' },
    ];
    return [
      { label: t('dashboard.stays'),         value: s.total_stays,    icon: 'bed',          color: '#8b5cf6' },
      { label: t('dashboard.totalSpent'),     value: `${s.total_spend?.toLocaleString()} FCFA`, icon: 'dollar-sign', color: '#10b981' },
      { label: t('dashboard.loyaltyPoints'),  value: s.loyalty_points, icon: 'star',         color: '#f59e0b' },
      { label: t('dashboard.reservations'),   value: s.reservations,   icon: 'calendar-alt', color: '#06b6d4' },
    ];
  };

  const getInitials = () =>
    (user?.name ?? 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const groupByHotel = (rooms: Room[]) => {
    const map = new Map<number, { hotel_id: number; hotel_name: string; count: number }>();
    rooms.forEach(r => {
      const id   = r.hotel_id;
      const name = (r as any).hotel_name ?? t('dashboardExtra.hotelFallback', { id });
      if (!map.has(id)) map.set(id, { hotel_id: id, hotel_name: name, count: 0 });
      map.get(id)!.count++;
    });
    return Array.from(map.values());
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    );
  }

  const stats = buildStats();

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        {/* Greeting */}
        <View style={styles.greetingCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{t('dashboard.greeting', { name: user?.name?.split(' ')[0] })}</Text>
            <Text style={styles.role}>{t(ROLE_KEYS[user?.role ?? 'client'] ?? 'roles.client')}</Text>
          </View>
          <View style={styles.greetingRight}>
            {/* Sélecteur de langue — cycle FR→EN→ES */}
            <TouchableOpacity
              style={styles.langBtn}
              onPress={() => {
                const idx  = LANGUAGES.findIndex(l => l.code === i18n.language);
                const next = LANGUAGES[(idx + 1) % LANGUAGES.length] as typeof LANGUAGES[number];
                changeLanguage(next.code as LangCode);
              }}
            >
              <Text style={styles.langFlag}>
                {LANGUAGES.find(l => l.code === i18n.language)?.flag ?? '🌐'}
              </Text>
              <Text style={styles.langCode}>
                {(i18n.language ?? 'fr').toUpperCase()}
              </Text>
            </TouchableOpacity>

            {/* Avatar */}
            <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} style={styles.avatarWrap}>
              {user?.avatar ? (
                <Image source={{ uri: user.avatar }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>{getInitials()}</Text>
                </View>
              )}
            </TouchableOpacity>
            {/* Cloche notifications */}
            <TouchableOpacity style={styles.menuBtn} onPress={() => router.push('/(tabs)/notifications')}>
              <FontAwesome5 name="bell" size={16} color={COLORS.white} />
              {unreadNotifs > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{unreadNotifs > 9 ? '9+' : String(unreadNotifs)}</Text>
                </View>
              )}
            </TouchableOpacity>
            {/* Menu */}
            <TouchableOpacity style={styles.menuBtn} onPress={() => setMenuOpen(true)}>
              <FontAwesome5 name="bars" size={18} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsGrid}>
          {stats.map((stat, i) => (
            <View key={i} style={[styles.statCard, { borderLeftColor: stat.color }]}>
              <FontAwesome5 name={stat.icon} size={24} color={stat.color} />
              <Text style={styles.statValue}>{stat.value ?? 0}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Quick actions */}
        <Text style={styles.sectionTitle}>{t('dashboard.quickActions')}</Text>
        <View style={styles.actionsGrid}>
          {user?.role === 'admin' && (
            <>
              <QuickAction icon="calendar-alt" label={t('dashboard.action_reservations')} color={COLORS.primary}   onPress={() => router.push('/(tabs)/reservations')} />
              <QuickAction icon="building"     label={t('dashboard.action_hotels')}       color="#06b6d4"           onPress={() => router.push('/(tabs)/hotels')} />
              <QuickAction icon="users"        label={t('dashboard.action_staff')}        color="#8b5cf6"           onPress={() => router.push('/(tabs)/staff')} />
              <QuickAction icon="shield-alt"   label={t('dashboard.action_admin')}        color="#f59e0b"           onPress={() => router.push('/(tabs)/admin')} />
              <QuickAction icon="clock"        label={t('dashboard.action_pointage')}     color="#0ea5e9"           onPress={() => router.push('/(tabs)/pointage')} />
            </>
          )}
          {user?.role === 'prestataire' && (
            <>
              <QuickAction icon="calendar-alt"    label={t('dashboard.action_reservations')} color={COLORS.primary}   onPress={() => router.push('/(tabs)/reservations')} />
              <QuickAction icon="bed"             label={t('dashboard.action_rooms')}        color={COLORS.info}       onPress={() => router.push('/(tabs)/rooms')} />
              <QuickAction icon="users"           label={t('dashboard.action_staff')}        color="#8b5cf6"           onPress={() => router.push('/(tabs)/staff')} />
              <QuickAction icon="clock"           label={t('dashboard.action_pointage')}     color="#0ea5e9"           onPress={() => router.push('/(tabs)/pointage')} />
              <QuickAction icon="concierge-bell"  label={t('dashboard.action_services')}     color="#10b981"           onPress={() => router.push('/(tabs)/services')} />
              <QuickAction icon="building"        label={t('dashboard.action_myHotels')}     color="#f59e0b"           onPress={() => router.push({ pathname: '/(tabs)/hotels', params: { scope: 'mine' } })} />
              <QuickAction icon="utensils"        label={t('dashboard.action_menu')}         color="#ef4444"           onPress={() => router.push('/(tabs)/menu')} />
            </>
          )}
          {user?.role === 'employe' && (
            <>
              <QuickAction icon="clock"        label={t('dashboard.action_pointage')}     color="#0ea5e9"           onPress={() => router.push('/(tabs)/pointage')} />
              <QuickAction icon="calendar-alt" label={t('dashboard.action_reservations')} color={COLORS.primary}   onPress={() => router.push('/(tabs)/reservations')} />
              <QuickAction icon="bed"          label={t('dashboard.action_rooms')}        color={COLORS.info}       onPress={() => router.push('/(tabs)/rooms')} />
              <QuickAction icon="utensils"     label={t('dashboard.action_menu')}         color="#10b981"           onPress={() => router.push('/(tabs)/menu')} />
              <QuickAction icon="ticket-alt"   label={t('dashboard.action_tickets')}      color="#f59e0b"           onPress={() => router.push('/(tabs)/tickets')} />
            </>
          )}
          {user?.role === 'client' && (
            <>
              <QuickAction icon="search"       label={t('dashboard.action_search')}   color={COLORS.primary}   onPress={() => router.push('/(tabs)/hotels')} />
              <QuickAction icon="calendar-alt" label={t('dashboard.action_book')}     color={COLORS.danger}    onPress={() => router.push('/(tabs)/reservations/create')} />
              <QuickAction icon="shopping-bag" label={t('dashboard.action_boutique')} color="#10b981"           onPress={() => router.push('/(tabs)/boutique')} />
              <QuickAction icon="receipt"      label={t('dashboard.action_orders')}   color="#f59e0b"           onPress={() => router.push('/(tabs)/boutique/my-orders')} />
            </>
          )}
          <QuickAction icon="user" label={t('dashboard.action_profile')} color={COLORS.dark} onPress={() => router.push('/(tabs)/profile')} />
        </View>

        {/* Chambres disponibles — employés uniquement */}
        {user?.role === 'employe' && (
          <>
            <View style={styles.sectionRow}>
              <Text style={[styles.sectionTitle, { marginHorizontal: 0, marginTop: 0, marginBottom: 0 }]}>
                {t('dashboard.availableRooms')}
              </Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/rooms')}>
                <Text style={styles.sectionLink}>{t('common.seeAll')}</Text>
              </TouchableOpacity>
            </View>

            {availableRooms.length === 0 ? (
              <View style={styles.emptyRooms}>
                <FontAwesome5 name="bed" size={28} color={COLORS.grayLight} />
                <Text style={styles.emptyRoomsText}>{t('dashboard.noRoomsAvailable')}</Text>
              </View>
            ) : (
              <>
                {/* ── Récap par hôtel ── */}
                {groupByHotel(availableRooms).map(group => (
                  <TouchableOpacity
                    key={group.hotel_id}
                    style={styles.hotelSummaryCard}
                    onPress={() => router.push('/(tabs)/rooms')}
                    activeOpacity={0.85}
                  >
                    <View style={styles.hotelSummaryLeft}>
                      <FontAwesome5 name="building" size={16} color={COLORS.primary} />
                      <Text style={styles.hotelSummaryName} numberOfLines={1}>{group.hotel_name}</Text>
                    </View>
                    <View style={styles.hotelSummaryRight}>
                      <View style={styles.hotelCountBadge}>
                        <Text style={styles.hotelCountNumber}>{group.count}</Text>
                        <Text style={styles.hotelCountLabel}>{group.count > 1 ? t('createRes.availableWordPlural') : t('createRes.availableWord')}</Text>
                      </View>
                      <FontAwesome5 name="chevron-right" size={12} color={COLORS.textMuted} />
                    </View>
                  </TouchableOpacity>
                ))}

                {/* ── Carrousel des chambres individuelles ── */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.roomsScroll}
                >
                  {availableRooms.map(room => (
                    <View key={room.id} style={styles.roomCard}>
                      <View style={styles.roomCardTop}>
                        <Text style={styles.roomNumber}>{t('createRes.noLabel')}{room.number}</Text>
                        <View style={[styles.roomStatusDot, { backgroundColor: '#2ECC71' }]} />
                      </View>
                      <Text style={styles.roomType}>{t(DASH_ROOM_TYPE_KEYS[room.type] ?? room.type)}</Text>
                      <Text style={styles.roomFloor}>{t('common.floor')} {room.floor}</Text>
                      <View style={styles.roomFooter}>
                        <FontAwesome5 name="user-friends" size={10} color={COLORS.textMuted} />
                        <Text style={styles.roomCapacity}> {room.capacity} {t('common.person')}</Text>
                      </View>
                      <Text style={styles.roomPrice}>{room.price?.toLocaleString()} FCFA</Text>
                    </View>
                  ))}
                </ScrollView>
              </>
            )}
          </>
        )}

        {/* Réservations récentes */}
        {data?.recent_reservations?.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>{t('dashboard.recentReservations')}</Text>
            {data.recent_reservations.slice(0, 5).map((r: any) => (
              <View key={r.id} style={styles.recentCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recentCode}>{r.code}</Text>
                  <Text style={styles.recentInfo}>
                    {r.client?.first_name} {r.client?.last_name} · {r.hotel?.short_name}
                  </Text>
                  <Text style={styles.recentDates}>{r.checkin} → {r.checkout}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: r.status === 'confirmée' ? '#D1FAE5' : '#FEF3C7' }]}>
                  <Text style={[styles.statusText, { color: r.status === 'confirmée' ? '#065F46' : '#92400E' }]}>
                    {t(DASH_STATUS_KEYS[r.status] ?? r.status)}
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* ─── Menu latéral ─── */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <View style={styles.menuOverlay}>
          {/* Fond cliquable pour fermer */}
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setMenuOpen(false)} />

          {/* Panneau */}
          <View style={[styles.menuPanel, { width: MENU_W }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* En-tête utilisateur */}
              <View style={styles.menuHeader}>
                {/* Bouton fermer */}
                <View style={styles.menuCloseBtnRow}>
                  <TouchableOpacity
                    style={styles.menuCloseBtn}
                    onPress={() => setMenuOpen(false)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <FontAwesome5 name="times" size={18} color={COLORS.white} />
                  </TouchableOpacity>
                </View>

                {user?.avatar ? (
                  <Image source={{ uri: user.avatar }} style={styles.menuAvatar} />
                ) : (
                  <View style={styles.menuAvatarCircle}>
                    <Text style={styles.menuAvatarText}>{getInitials()}</Text>
                  </View>
                )}
                <Text style={styles.menuUserName}>{user?.name}</Text>
                <Text style={styles.menuUserEmail}>{user?.email}</Text>
                <View style={styles.menuRoleBadge}>
                  <Text style={styles.menuRoleText}>{t(ROLE_KEYS[user?.role ?? 'client'] ?? 'roles.client')}</Text>
                </View>
              </View>

              {/* Statistiques clés */}
              {stats.length > 0 && (
                <View style={styles.menuSection}>
                  <Text style={styles.menuSectionTitle}>{t('dashboard.overview')}</Text>
                  {stats.map((s, i) => (
                    <View key={i} style={styles.menuStatRow}>
                      <View style={[styles.menuStatDot, { backgroundColor: s.color }]} />
                      <Text style={styles.menuStatLabel}>{s.label}</Text>
                      <Text style={[styles.menuStatValue, { color: s.color }]}>{s.value ?? 0}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Navigation principale */}
              <View style={styles.menuSection}>
                <Text style={styles.menuSectionTitle}>{t('dashboard.navigation')}</Text>
                {[
                  { icon: 'home',         label: t('dashboard.menu_dashboard'),    path: '/(tabs)/' },
                  { icon: 'hotel',        label: t('dashboard.menu_hotels'),       path: '/(tabs)/hotels?scope=tous' },
                  { icon: 'calendar-alt', label: t('dashboard.menu_reservations'), path: '/(tabs)/reservations' },
                  { icon: 'shopping-bag', label: t('dashboard.menu_boutique'),     path: '/(tabs)/boutique' },
                  ...(user?.role !== 'client' ? [
                    { icon: 'bed',        label: t('dashboard.menu_rooms'),        path: '/(tabs)/rooms' },
                    { icon: 'ticket-alt', label: t('dashboard.menu_tickets'),      path: '/(tabs)/tickets' },
                  ] : [
                    { icon: 'heart',      label: t('dashboard.menu_favorites'),    path: '/(tabs)/favorites' },
                    { icon: 'receipt',    label: t('dashboard.menu_orders'),       path: '/(tabs)/boutique/my-orders' },
                  ]),
                  { icon: 'bell',         label: t('dashboard.menu_notifications'),path: '/(tabs)/notifications' },
                  { icon: 'user',         label: t('dashboard.menu_profile'),      path: '/(tabs)/profile' },
                ].map(item => (
                  <TouchableOpacity
                    key={item.path}
                    style={styles.menuNavItem}
                    onPress={() => { setMenuOpen(false); router.push(item.path as any); }}
                  >
                    <View style={styles.menuNavIcon}>
                      <FontAwesome5 name={item.icon as any} size={14} color={COLORS.primary} />
                    </View>
                    <Text style={styles.menuNavLabel}>{item.label}</Text>
                    <FontAwesome5 name="chevron-right" size={12} color={COLORS.grayLight} />
                  </TouchableOpacity>
                ))}
              </View>

              {/* Infos appli */}
              <View style={styles.menuSection}>
                <Text style={styles.menuSectionTitle}>{t('dashboard.about')}</Text>
                <View style={styles.menuAppInfo}>
                  <Image source={require('@/assets/logo.png')} style={styles.menuLogo} resizeMode="contain" />
                  <Text style={styles.menuAppName}>Hôtelio</Text>
                  <Text style={styles.menuAppDesc}>{t('dashboard.appDesc')}</Text>
                  <Text style={styles.menuAppVersion}>{t('common.version')} 1.0.0</Text>
                </View>
              </View>

              {/* Déconnexion */}
              <TouchableOpacity
                style={styles.menuLogout}
                onPress={() => {
                  setMenuOpen(false);
                  setTimeout(() => {
                    logout().then(() => router.replace('/(auth)/login'));
                  }, 300);
                }}
              >
                <FontAwesome5 name="sign-out-alt" size={16} color={COLORS.danger} />
                <Text style={styles.menuLogoutText}>{t('dashboard.disconnect')}</Text>
              </TouchableOpacity>

              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function QuickAction({ icon, label, color, onPress }: { icon: string; label: string; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: color }]} onPress={onPress}>
      <FontAwesome5 name={icon} size={22} color={COLORS.white} />
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: COLORS.background },
  centered:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText:    { color: COLORS.textMuted, fontSize: 16 },

  /* Greeting */
  greetingCard:   { backgroundColor: COLORS.primary, padding: 20, margin: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center' },
  greeting:       { fontSize: 20, fontWeight: 'bold', color: COLORS.white },
  role:           { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 3 },
  greetingRight:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: 10 },
  avatarWrap:     {},
  avatarCircle:   { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.secondary, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' },
  avatarImg:      { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' },
  avatarText:     { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  langBtn:        { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)' },
  langFlag:       { fontSize: 15 },
  langCode:       { color: COLORS.white, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  menuBtn:        { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  notifBadge:     { position: 'absolute', top: -4, right: -4, backgroundColor: COLORS.danger, borderRadius: 8, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  notifBadgeText: { color: COLORS.white, fontSize: 9, fontWeight: '800' },

  /* Stats */
  statsGrid:      { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8 },
  statCard:       { width: '47%', margin: '1.5%', backgroundColor: COLORS.white, borderRadius: 12, padding: 14, borderLeftWidth: 4, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 3 },
  statValue:      { fontSize: 22, fontWeight: 'bold', color: COLORS.dark, marginVertical: 4 },
  statLabel:      { fontSize: 12, color: COLORS.textMuted },

  /* Actions */
  sectionTitle:   { fontSize: 17, fontWeight: '700', color: COLORS.dark, marginHorizontal: 16, marginTop: 20, marginBottom: 12 },
  actionsGrid:    { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 8 },
  actionBtn:      { width: '47%', flexGrow: 1, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 10, alignItems: 'center', gap: 6 },
  actionLabel:    { color: COLORS.white, fontSize: 12, fontWeight: '600', textAlign: 'center' },

  /* Section header row */
  sectionRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 16, marginTop: 20, marginBottom: 12 },
  sectionLink:    { fontSize: 13, color: COLORS.primary, fontWeight: '600' },

  /* Hotel summary card */
  hotelSummaryCard:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.white, marginHorizontal: 16, marginBottom: 8, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 5, elevation: 2, borderLeftWidth: 4, borderLeftColor: '#2ECC71' },
  hotelSummaryLeft:   { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  hotelSummaryName:   { fontSize: 14, fontWeight: '700', color: COLORS.dark, flex: 1 },
  hotelSummaryRight:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hotelCountBadge:    { alignItems: 'center', backgroundColor: '#ECFDF5', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  hotelCountNumber:   { fontSize: 22, fontWeight: '800', color: '#059669', lineHeight: 26 },
  hotelCountLabel:    { fontSize: 10, color: '#059669', fontWeight: '600' },

  /* Rooms carousel */
  roomsScroll:    { paddingHorizontal: 16, paddingBottom: 4, gap: 10 },
  roomCard:       { width: 130, backgroundColor: COLORS.white, borderRadius: 14, padding: 14, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 6, elevation: 3, borderTopWidth: 3, borderTopColor: '#2ECC71' },
  roomCardTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  roomNumber:     { fontSize: 16, fontWeight: '800', color: COLORS.dark },
  roomStatusDot:  { width: 8, height: 8, borderRadius: 4 },
  roomType:       { fontSize: 12, fontWeight: '600', color: COLORS.primary, marginBottom: 2 },
  roomFloor:      { fontSize: 11, color: COLORS.textMuted, marginBottom: 6 },
  roomFooter:     { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  roomCapacity:   { fontSize: 11, color: COLORS.textMuted },
  roomPrice:      { fontSize: 13, fontWeight: '700', color: COLORS.dark },
  emptyRooms:     { alignItems: 'center', paddingVertical: 20, gap: 8, marginHorizontal: 16, backgroundColor: COLORS.white, borderRadius: 14 },
  emptyRoomsText: { fontSize: 13, color: COLORS.textMuted },

  /* Recent */
  recentCard:     { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, marginHorizontal: 16, marginBottom: 8, borderRadius: 12, padding: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  recentCode:     { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  recentInfo:     { fontSize: 13, color: COLORS.dark, marginTop: 2 },
  recentDates:    { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  statusBadge:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText:     { fontSize: 11, fontWeight: '700' },

  /* Menu overlay */
  menuOverlay:    { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.5)' },
  menuPanel:      { backgroundColor: COLORS.white, height: '100%', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 20, elevation: 20 },

  menuHeader:     { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingBottom: 24, paddingTop: 14, alignItems: 'center' },
  menuCloseBtnRow:{ width: '100%', flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 10 },
  menuCloseBtn:   { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)', justifyContent: 'center', alignItems: 'center' },
  menuAvatar:     { width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)', marginBottom: 10 },
  menuAvatarCircle:{ width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.secondary, justifyContent: 'center', alignItems: 'center', marginBottom: 10, borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)' },
  menuAvatarText: { color: COLORS.white, fontSize: 24, fontWeight: '700' },
  menuUserName:   { fontSize: 17, fontWeight: '700', color: COLORS.white },
  menuUserEmail:  { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 3 },
  menuRoleBadge:  { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 3, marginTop: 8 },
  menuRoleText:   { color: COLORS.white, fontSize: 12, fontWeight: '600' },

  menuSection:    { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  menuSectionTitle:{ fontSize: 11, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },

  menuStatRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, gap: 10 },
  menuStatDot:    { width: 8, height: 8, borderRadius: 4 },
  menuStatLabel:  { flex: 1, fontSize: 13, color: COLORS.dark },
  menuStatValue:  { fontSize: 14, fontWeight: '700' },

  menuNavItem:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, gap: 12 },
  menuNavIcon:    { width: 30, height: 30, borderRadius: 8, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center' },
  menuNavLabel:   { flex: 1, fontSize: 14, color: COLORS.dark },

  menuAppInfo:    { alignItems: 'center', paddingVertical: 12, gap: 4 },
  menuLogo:       { width: 56, height: 56, borderRadius: 14 },
  menuAppName:    { fontSize: 20, fontWeight: '800', color: COLORS.primary, marginTop: 6 },
  menuAppDesc:    { fontSize: 13, color: COLORS.textMuted },
  menuAppVersion: { fontSize: 11, color: COLORS.grayLight, marginTop: 2 },

  menuLogout:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, margin: 16, padding: 14, backgroundColor: '#FEE2E2', borderRadius: 12 },
  menuLogoutText: { color: COLORS.danger, fontSize: 14, fontWeight: '700' },
});
