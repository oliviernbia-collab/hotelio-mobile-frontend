import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, ScrollView, RefreshControl, ActivityIndicator,
} from 'react-native';
import { Stack } from 'expo-router';
import { adminApi } from '@/services/api';
import { COLORS } from '@/constants';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Subscription } from '@/types';

const STATUSES = ['active', 'past_due', 'pending_payment'];

const STATUS_COLORS: Record<string, string> = {
  active: '#10b981',
  past_due: '#ef4444',
  pending_payment: '#f59e0b',
  cancelled: '#6b7280',
};

const STATUS_LABEL_KEYS: Record<string, string> = {
  active: 'subscriptionsAdmin.statusActive',
  past_due: 'subscriptionsAdmin.statusPastDue',
  pending_payment: 'subscriptionsAdmin.statusPending',
  cancelled: 'subscriptionsAdmin.statusCancelled',
};

export default function AdminSubscriptionsScreen() {
  const { t } = useTranslation();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [filter,     setFilter]     = useState('');
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId,     setBusyId]     = useState<number | null>(null);

  const fetchSubscriptions = useCallback(async () => {
    try {
      const res = await adminApi.subscriptions.list(filter ? { status: filter } : undefined);
      setSubscriptions(res.data);
    } catch (e) { console.error(e?.message || e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [filter]);

  useEffect(() => { fetchSubscriptions(); }, [fetchSubscriptions]);

  const handleRecordPayment = (sub: Subscription) => {
    Alert.alert(
      t('subscriptionsAdmin.recordPayment'),
      t('subscriptionsAdmin.confirmPayment', { name: sub.user_name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.ok'),
          onPress: async () => {
            setBusyId(sub.id);
            try {
              await adminApi.subscriptions.recordPayment(sub.id);
              Alert.alert(t('common.success'), t('subscriptionsAdmin.paymentRecorded'));
              fetchSubscriptions();
            } catch (e: any) {
              Alert.alert(t('common.error'), e.response?.data?.message ?? t('common.error'));
            } finally { setBusyId(null); }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: Subscription }) => {
    const color = STATUS_COLORS[item.status] ?? COLORS.textMuted;
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{item.user_name}</Text>
            <Text style={styles.userEmail}>{item.user_email}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: color + '22' }]}>
            <Text style={[styles.badgeText, { color }]}>{t(STATUS_LABEL_KEYS[item.status] ?? item.status)}</Text>
          </View>
        </View>
        <View style={styles.planRow}>
          <FontAwesome5 name="layer-group" size={12} color={COLORS.primary} />
          <Text style={styles.planText}>{item.plan_name} — {item.price_monthly?.toLocaleString()} FCFA/mois</Text>
        </View>
        <View style={styles.datesRow}>
          {item.started_at && <Text style={styles.dateText}>{t('subscriptionsAdmin.startedLabel')}: {item.started_at}</Text>}
          {item.current_period_end && <Text style={styles.dateText}>{t('subscriptionsAdmin.dueLabel')}: {item.current_period_end}</Text>}
        </View>
        <TouchableOpacity
          style={[styles.payBtn, busyId === item.id && { opacity: 0.6 }]}
          onPress={() => handleRecordPayment(item)}
          disabled={busyId === item.id}
        >
          <FontAwesome5 name="money-check-alt" size={13} color="#065F46" />
          <Text style={styles.payBtnText}>{t('subscriptionsAdmin.recordPayment')}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: t('subscriptionsAdmin.screenTitle') }} />
      <View style={styles.container}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          <TouchableOpacity style={[styles.filterChip, !filter && styles.filterChipActive]} onPress={() => setFilter('')}>
            <Text style={[styles.filterChipText, !filter && styles.filterChipTextActive]}>{t('subscriptionsAdmin.filterAll')}</Text>
          </TouchableOpacity>
          {STATUSES.map((s) => (
            <TouchableOpacity key={s} style={[styles.filterChip, filter === s && styles.filterChipActive]} onPress={() => setFilter(filter === s ? '' : s)}>
              <Text style={[styles.filterChipText, filter === s && styles.filterChipTextActive]}>{t(STATUS_LABEL_KEYS[s])}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
        ) : (
          <FlatList
            data={subscriptions}
            keyExtractor={(s) => String(s.id)}
            renderItem={renderItem}
            contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSubscriptions(); }} colors={[COLORS.primary]} />}
            ListEmptyComponent={
              <View style={styles.empty}>
                <FontAwesome5 name="credit-card" size={42} color={COLORS.grayLight} />
                <Text style={styles.emptyText}>{t('subscriptionsAdmin.noSubscriptions')}</Text>
              </View>
            }
          />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.background },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
  filterRow:   { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  filterChip:  { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipText:   { fontSize: 12, color: COLORS.textMuted, fontWeight: '600' },
  filterChipTextActive: { color: COLORS.white },
  card:        { backgroundColor: COLORS.white, borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardHeader:  { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  userName:    { fontSize: 14, fontWeight: '700', color: COLORS.dark },
  userEmail:   { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
  badge:       { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeText:   { fontSize: 10, fontWeight: '700' },
  planRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  planText:    { fontSize: 12, color: COLORS.dark, fontWeight: '600' },
  datesRow:    { flexDirection: 'row', gap: 12, marginBottom: 10 },
  dateText:    { fontSize: 11, color: COLORS.textMuted },
  payBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#D1FAE5', borderRadius: 10, paddingVertical: 8 },
  payBtnText:  { fontSize: 12, fontWeight: '700', color: '#065F46' },
  empty:       { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText:   { fontSize: 15, color: COLORS.textMuted },
});
