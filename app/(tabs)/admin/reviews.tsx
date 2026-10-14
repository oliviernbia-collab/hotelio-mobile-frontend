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
import { Review } from '@/types';

const STATUSES = ['pending', 'approved', 'rejected'];

const STATUS_COLORS: Record<string, string> = {
  pending:  '#f59e0b',
  approved: '#10b981',
  rejected: '#ef4444',
};

export default function AdminReviewsScreen() {
  const { t } = useTranslation();
  const [reviews,    setReviews]    = useState<Review[]>([]);
  const [filter,     setFilter]     = useState('pending');
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId,     setBusyId]     = useState<number | null>(null);

  const fetchReviews = useCallback(async () => {
    try {
      const params = filter === 'tous' ? undefined : { status: filter };
      const res = await adminApi.reviews.list(params);
      setReviews(res.data);
    } catch (e) { console.error(e?.message || e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [filter]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const handleApprove = async (review: Review) => {
    setBusyId(review.id);
    try {
      await adminApi.reviews.approve(review.id);
      fetchReviews();
    } catch (e: any) {
      Alert.alert(t('common.error'), e.response?.data?.message ?? t('common.error'));
    } finally { setBusyId(null); }
  };

  const handleReject = async (review: Review) => {
    setBusyId(review.id);
    try {
      await adminApi.reviews.reject(review.id);
      fetchReviews();
    } catch (e: any) {
      Alert.alert(t('common.error'), e.response?.data?.message ?? t('common.error'));
    } finally { setBusyId(null); }
  };

  const renderReview = ({ item }: { item: Review }) => {
    const statusColor = STATUS_COLORS[item.status ?? 'pending'];
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hotelName}>{item.hotel_short_name ?? item.hotel_name}</Text>
            <Text style={styles.author}>{item.user_name ?? item.user?.name}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: statusColor + '22' }]}>
            <Text style={[styles.badgeText, { color: statusColor }]}>{t(`reviews.${item.status}`)}</Text>
          </View>
        </View>
        <Text style={styles.stars}>{'⭐'.repeat(item.rating)}</Text>
        {item.title ? <Text style={styles.title}>{item.title}</Text> : null}
        {item.comment ? <Text style={styles.comment}>{item.comment}</Text> : null}
        {item.status === 'pending' && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#D1FAE5' }]}
              onPress={() => handleApprove(item)}
              disabled={busyId === item.id}
            >
              <FontAwesome5 name="check" size={13} color="#065F46" />
              <Text style={[styles.actionText, { color: '#065F46' }]}>{t('reviews.approve')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#FEE2E2' }]}
              onPress={() => handleReject(item)}
              disabled={busyId === item.id}
            >
              <FontAwesome5 name="times" size={13} color={COLORS.danger} />
              <Text style={[styles.actionText, { color: COLORS.danger }]}>{t('reviews.reject')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: t('admin.reviews') }} />
      <View style={styles.container}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {['tous', ...STATUSES].map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.filterChip, filter === s && styles.filterChipActive]}
              onPress={() => setFilter(s)}
            >
              <Text style={[styles.filterChipText, filter === s && styles.filterChipTextActive]}>
                {s === 'tous' ? t('hotels.tab_all') : t(`reviews.${s}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
        ) : (
          <FlatList
            data={reviews}
            keyExtractor={(r) => String(r.id)}
            renderItem={renderReview}
            contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchReviews(); }} colors={[COLORS.primary]} />}
            ListEmptyComponent={
              <View style={styles.empty}>
                <FontAwesome5 name="star" size={42} color={COLORS.grayLight} />
                <Text style={styles.emptyText}>{t('reviews.noReviews')}</Text>
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
  cardHeader:  { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  hotelName:   { fontSize: 14, fontWeight: '700', color: COLORS.dark },
  author:      { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
  badge:       { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeText:   { fontSize: 10, fontWeight: '700' },
  stars:       { fontSize: 13, marginBottom: 4 },
  title:       { fontSize: 13, fontWeight: '700', color: COLORS.dark, marginBottom: 2 },
  comment:     { fontSize: 13, color: COLORS.textMuted, lineHeight: 19 },
  actions:     { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  actionText:  { fontSize: 12, fontWeight: '700' },
  empty:       { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText:   { fontSize: 15, color: COLORS.textMuted },
});
