import { useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, ScrollView, StyleSheet,
  TouchableOpacity, Alert, RefreshControl,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { reservationApi } from '@/services/api';
import { Reservation } from '@/types';
import { COLORS, RESERVATION_STATUS_COLORS } from '@/constants';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';

const canSeePlanning = (role?: string) =>
  role === 'admin' || role === 'prestataire' || role === 'employe';

const BANNER_W    = 280;
const BANNER_GAP  = 10;
const BANNER_STEP = BANNER_W + BANNER_GAP;

const PROMO_BANNERS = [
  { id: 1, titleKey: 'resList.promo_weekend_title',   descKey: 'resList.promo_weekend_desc',   icon: 'moon',    bg: '#1E3A5F', accent: '#F4A261' },
  { id: 2, titleKey: 'resList.promo_suite_title',     descKey: 'resList.promo_suite_desc',     icon: 'star',    bg: '#7C3AED', accent: '#FCD34D' },
  { id: 3, titleKey: 'resList.promo_breakfast_title', descKey: 'resList.promo_breakfast_desc', icon: 'coffee',  bg: '#065F46', accent: '#6EE7B7' },
  { id: 4, titleKey: 'resList.promo_loyalty_title',   descKey: 'resList.promo_loyalty_desc',   icon: 'gift',    bg: '#9D174D', accent: '#FCA5A5' },
];

const STATUS_TABS = ['tous', 'en_attente', 'confirmée', 'terminée', 'annulée'];

const RES_STATUS_KEYS: Record<string, string> = {
  en_attente: 'reservations.status_en_attente',
  confirmée:  'reservations.status_confirmee',
  occupée:    'reservations.status_occupee',
  terminée:   'reservations.status_finalisee',
  annulée:    'reservations.status_annulee',
};

function PromoBanners() {
  const { t } = useTranslation();
  const scrollRef   = useRef<ScrollView>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIdx(prev => {
        const next = (prev + 1) % PROMO_BANNERS.length;
        scrollRef.current?.scrollTo({ x: next * BANNER_STEP, animated: true });
        return next;
      });
    }, 3200);
    return () => clearInterval(timer);
  }, []);

  return (
    <View style={styles.bannersSection}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.bannersWrap}
        scrollEventThrottle={16}
        onMomentumScrollEnd={e => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / BANNER_STEP);
          setActiveIdx(idx % PROMO_BANNERS.length);
        }}
      >
        {PROMO_BANNERS.map(b => (
          <View key={b.id} style={[styles.banner, { backgroundColor: b.bg }]}>
            <View style={[styles.bannerIconWrap, { backgroundColor: b.accent + '33' }]}>
              <FontAwesome5 name={b.icon} size={22} color={b.accent} solid />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>{t(b.titleKey)}</Text>
              <Text style={styles.bannerDesc}>{t(b.descKey)}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={styles.dotRow}>
        {PROMO_BANNERS.map((_, i) => (
          <View key={i} style={[styles.dot, i === activeIdx && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

export default function ReservationsScreen() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [activeTab,    setActiveTab]    = useState('tous');
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);

  const fetchData = async () => {
    try {
      const params = activeTab !== 'tous' ? { status: activeTab } : {};
      const isClient = user?.role === 'client';
      const res = isClient
        ? await reservationApi.mine(params)
        : await reservationApi.list(params);
      setReservations(res.data.data ?? res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, [activeTab]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const handleCheckIn = async (id: number) => {
    try {
      await reservationApi.checkIn(id);
      fetchData();
    } catch (e: any) {
      Alert.alert(t('common.error'), e.response?.data?.message ?? t('resList.cannotCheckIn'));
    }
  };

  const handleCheckOut = async (id: number) => {
    try {
      await reservationApi.checkOut(id);
      fetchData();
    } catch (e: any) {
      Alert.alert(t('common.error'), e.response?.data?.message ?? t('resList.cannotCheckOut'));
    }
  };

  const handleCancel = (item: Reservation) => {
    const fee    = Math.round((item.total ?? 0) * 0.01);
    const refund = (item.total ?? 0) - fee;
    Alert.alert(
      t('reservations.status_annulee'),
      t('resList.cancelMsg', { fee: fee.toLocaleString(), refund: refund.toLocaleString() }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              await reservationApi.updateStatus(item.id, 'annulée');
              fetchData();
            } catch (e: any) {
              Alert.alert(t('common.error'), e.response?.data?.message ?? t('resList.cannotCancel'));
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: Reservation }) => {
    const statusColor = RESERVATION_STATUS_COLORS[item.status] ?? COLORS.gray;

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View>
            <Text style={styles.code}>{item.code}</Text>
            <Text style={styles.guestName}>
              {item.client?.first_name} {item.client?.last_name}
            </Text>
            <Text style={styles.hotelName}>{item.hotel?.short_name}</Text>
          </View>
          <View>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '22' }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>{t(RES_STATUS_KEYS[item.status] ?? item.status)}</Text>
            </View>
            {!!item.paid && (
              <View style={[styles.statusBadge, { backgroundColor: '#D1FAE5', marginTop: 4 }]}>
                <Text style={[styles.statusText, { color: '#065F46' }]}>{t('resList.paid')}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.datesRow}>
          <FontAwesome5 name="calendar-alt" size={14} color={COLORS.textMuted} />
          <Text style={styles.dates}> {item.checkin} → {item.checkout} · {item.nights} {item.nights > 1 ? t('common.nights') : t('common.night')}</Text>
        </View>

        <View style={styles.cardBottom}>
          <Text style={styles.total}>{item.total?.toLocaleString()} FCFA</Text>

          {user?.role !== 'client' && item.status === 'confirmée' && !item.checkin_at && (
            <TouchableOpacity style={styles.actionBtn} onPress={() => handleCheckIn(item.id)}>
              <Text style={styles.actionBtnText}>{t('resList.checkIn')}</Text>
            </TouchableOpacity>
          )}
          {user?.role !== 'client' && item.status === 'confirmée' && item.checkin_at && !item.checkout_at && (
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.warning }]} onPress={() => handleCheckOut(item.id)}>
              <Text style={styles.actionBtnText}>{t('resList.checkOut')}</Text>
            </TouchableOpacity>
          )}
          {!item.paid && item.status !== 'annulée' ? (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: COLORS.success }]}
              onPress={() => router.push({ pathname: '/(tabs)/reservations/payment', params: { id: item.id } })}
            >
              <Text style={styles.actionBtnText}>{t('reservations.paymentMethod')}</Text>
            </TouchableOpacity>
          ) : null}
          {user?.role === 'client' && (item.status === 'en_attente' || item.status === 'confirmée') ? (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#FEE2E2' }]}
              onPress={() => handleCancel(item)}
            >
              <Text style={[styles.actionBtnText, { color: COLORS.danger }]}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: t('reservations.title'),
          headerRight: () =>
            canSeePlanning(user?.role) ? (
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/reservations/planning')}
                style={{ marginRight: 8, flexDirection: 'row', alignItems: 'center', gap: 5 }}
              >
                <FontAwesome5 name="calendar-alt" size={16} color={COLORS.white} />
                <Text style={{ color: COLORS.white, fontSize: 13, fontWeight: '600' }}>{t('resList.planning')}</Text>
              </TouchableOpacity>
            ) : undefined,
        }}
      />
      <View style={styles.container}>
        <FlatList
          data={reservations}
          keyExtractor={r => String(r.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
          ListHeaderComponent={
            <>
              {/* Bannières auto-défilantes (clients uniquement) */}
              {user?.role === 'client' ? <PromoBanners /> : null}

              {/* Onglets statut */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tabsWrap}
              >
                {STATUS_TABS.map(tab => (
                  <TouchableOpacity
                    key={tab}
                    style={[styles.tab, activeTab === tab && styles.tabActive]}
                    onPress={() => setActiveTab(tab)}
                  >
                    <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                      {tab === 'tous' ? t('hotels.tab_all') : t(RES_STATUS_KEYS[tab] ?? tab)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          }
          ListEmptyComponent={
            !loading ? (
              <View style={styles.empty}>
                <FontAwesome5 name="calendar-alt" size={48} color={COLORS.grayLight} />
                <Text style={styles.emptyText}>{t('reservations.noReservations')}</Text>
              </View>
            ) : null
          }
        />

        <TouchableOpacity style={styles.fab} onPress={() => router.push('/(tabs)/reservations/create')}>
          <FontAwesome5 name="plus" size={28} color={COLORS.white} />
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: COLORS.background },

  /* Bannières */
  bannersSection: { marginBottom: 4 },
  bannersWrap:    { paddingHorizontal: 12, paddingVertical: 10, gap: BANNER_GAP },
  banner:         { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 14, width: BANNER_W },
  bannerIconWrap: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  bannerTitle:    { fontSize: 14, fontWeight: '700', color: '#FFFFFF', marginBottom: 3 },
  bannerDesc:     { fontSize: 11, color: 'rgba(255,255,255,0.78)', lineHeight: 15 },
  dotRow:         { flexDirection: 'row', justifyContent: 'center', gap: 5, marginBottom: 6 },
  dot:            { width: 6, height: 6, borderRadius: 3, backgroundColor: '#CBD5E1' },
  dotActive:      { width: 18, height: 6, borderRadius: 3, backgroundColor: COLORS.primary },

  /* Onglets */
  tabsWrap:       { paddingHorizontal: 8, paddingVertical: 8, gap: 4, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tab:            { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  tabActive:      { backgroundColor: COLORS.primary },
  tabText:        { fontSize: 12, color: COLORS.textMuted },
  tabTextActive:  { color: COLORS.white, fontWeight: '700' },

  /* Cards */
  card:           { backgroundColor: COLORS.white, borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 5, elevation: 2 },
  cardTop:        { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  code:           { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  guestName:      { fontSize: 15, fontWeight: '600', color: COLORS.dark, marginTop: 2 },
  hotelName:      { fontSize: 13, color: COLORS.textMuted },
  statusBadge:    { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start' },
  statusText:     { fontSize: 11, fontWeight: '700' },
  datesRow:       { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  dates:          { fontSize: 13, color: COLORS.textMuted },
  cardBottom:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 },
  total:          { fontSize: 16, fontWeight: '700', color: COLORS.dark },
  actionBtn:      { backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  actionBtnText:  { color: COLORS.white, fontSize: 12, fontWeight: '700' },

  /* Vide */
  empty:          { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText:      { fontSize: 16, color: COLORS.textMuted },

  /* FAB */
  fab:            { position: 'absolute', bottom: 20, right: 20, backgroundColor: COLORS.primary, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 8 },
});
