import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FontAwesome5 } from '@expo/vector-icons';
import { adminApi } from '@/services/api';
import { COLORS, PAYMENT_METHODS } from '@/constants';

/* Administration : toutes les commandes boutique — équivalent de la page web
   « Dashboard Commandes » (admin/commandes). */

type AdminOrder = {
  id: number;
  created_at: string | null;
  total: number;
  statut: string;
  mode_paiement: string | null;
  buyer_name: string | null;
  nb_items: number;
};
type Stats = { count: number; total_sales: number; paid: number; pending: number; cancelled: number };

const PAID = ['payé', 'payée', 'confirmée', 'livrée'];
const FILTERS = ['tous', 'payé', 'en_cours', 'annulée'] as const;

function statusVisual(statut: string): { color: string; bg: string; icon: string; key: string } {
  if (PAID.includes(statut)) return { color: '#065F46', bg: '#D1FAE5', icon: 'check-circle', key: 'adminOrders.status_paid' };
  if (statut === 'en_cours') return { color: '#92400E', bg: '#FEF3C7', icon: 'clock', key: 'adminOrders.status_pending' };
  return { color: '#991B1B', bg: '#FEE2E2', icon: 'times-circle', key: 'adminOrders.status_cancelled' };
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString('fr-FR')} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

export default function AdminOrdersScreen() {
  const { t } = useTranslation();
  const [filter,     setFilter]     = useState<typeof FILTERS[number]>('tous');
  const [orders,     setOrders]     = useState<AdminOrder[]>([]);
  const [stats,      setStats]      = useState<Stats | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await adminApi.orders.list(filter === 'tous' ? undefined : { statut: filter });
      setOrders(res.data.orders ?? []);
      setStats(res.data.stats ?? null);
    } catch (e: any) {
      console.error(e?.message || e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const renderItem = ({ item }: { item: AdminOrder }) => {
    const v = statusVisual(item.statut);
    const method = PAYMENT_METHODS.find((p) => p.value === item.mode_paiement)?.label ?? item.mode_paiement ?? '—';
    return (
      <View style={s.card}>
        <View style={{ flex: 1 }}>
          <Text style={s.orderId}>#{item.id}</Text>
          <Text style={s.meta}>{item.buyer_name ?? '—'} · {item.nb_items} {t('adminOrders.items')}</Text>
          <Text style={s.meta}>{fmtDate(item.created_at)} · {method}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Text style={s.total}>{Number(item.total).toLocaleString()} FCFA</Text>
          <View style={[s.badge, { backgroundColor: v.bg }]}>
            <FontAwesome5 name={v.icon} size={10} color={v.color} solid />
            <Text style={[s.badgeText, { color: v.color }]}>{t(v.key)}</Text>
          </View>
        </View>
      </View>
    );
  };

  const header = (
    <>
      {stats && (
        <View style={s.statsRow}>
          <Stat icon="coins"        color={COLORS.success} value={`${stats.total_sales.toLocaleString()} FCFA`} label={t('adminOrders.totalSales')} />
          <Stat icon="receipt"      color={COLORS.primary} value={String(stats.count)}   label={t('adminOrders.count')} />
          <Stat icon="clock"        color="#F59E0B"        value={String(stats.pending)} label={t('adminOrders.status_pending')} />
          <Stat icon="check-circle" color={COLORS.success} value={String(stats.paid)}    label={t('adminOrders.paid')} />
        </View>
      )}
      <View style={s.filters}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            style={[s.chip, filter === f && s.chipActive]}
            onPress={() => { setLoading(true); setFilter(f); }}
          >
            <Text style={[s.chipText, filter === f && s.chipTextActive]}>{t(`adminOrders.filter_${f === 'tous' ? 'all' : f === 'payé' ? 'paid' : f === 'en_cours' ? 'pending' : 'cancelled'}`)}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );

  return (
    <>
      <Stack.Screen options={{ title: t('admin.orders') }} />
      {loading ? (
        <View style={s.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : (
        <FlatList
          style={s.container}
          data={orders}
          keyExtractor={(o) => String(o.id)}
          renderItem={renderItem}
          ListHeaderComponent={header}
          contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[COLORS.primary]} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <FontAwesome5 name="receipt" size={42} color={COLORS.grayLight} />
              <Text style={s.emptyText}>{t('adminOrders.empty')}</Text>
            </View>
          }
        />
      )}
    </>
  );
}

function Stat({ icon, color, value, label }: { icon: string; color: string; value: string; label: string }) {
  return (
    <View style={s.stat}>
      <FontAwesome5 name={icon} size={14} color={color} solid />
      <Text style={s.statValue} numberOfLines={1}>{value}</Text>
      <Text style={s.statLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: COLORS.background },
  centered:   { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  statsRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  stat:       { width: '48%', flexGrow: 1, backgroundColor: COLORS.white, borderRadius: 12, padding: 12, gap: 4, borderWidth: 1, borderColor: COLORS.border },
  statValue:  { fontSize: 17, fontWeight: '800', color: COLORS.dark },
  statLabel:  { fontSize: 11, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  filters:    { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  chip:       { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText:   { fontSize: 13, color: COLORS.textMuted, fontWeight: '600' },
  chipTextActive: { color: COLORS.white },
  card:       { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
  orderId:    { fontSize: 15, fontWeight: '800', color: COLORS.primary },
  meta:       { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  total:      { fontSize: 16, fontWeight: '800', color: COLORS.success },
  badge:      { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText:  { fontSize: 11, fontWeight: '700' },
  empty:      { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText:  { fontSize: 14, color: COLORS.textMuted },
});
