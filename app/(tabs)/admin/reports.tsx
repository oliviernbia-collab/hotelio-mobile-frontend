import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { reportApi } from '@/services/api';
import { COLORS } from '@/constants';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

const PERIODS = ['day', 'week', 'month', 'year', 'all'];

interface ReportData {
  totalRevenue: number;
  totalReservations: number;
  confirmedCount: number;
  cancelledCount: number;
  avgRating: number;
  byNationality: { nationality: string; total: number; revenue: number }[];
  byRoomType: { type: string; total: number }[];
  hotels: { id: number; name: string; short_name?: string; revenue: number; rating: number }[];
}

export default function AdminReportsScreen() {
  const { t } = useTranslation();
  const [period,  setPeriod]  = useState('month');
  const [data,    setData]    = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reportApi.get({ period });
      setData(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [period]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const maxNationality = data?.byNationality.length ? Math.max(...data.byNationality.map(n => n.total)) : 1;
  const maxRoomType     = data?.byRoomType.length ? Math.max(...data.byRoomType.map(r => r.total)) : 1;

  return (
    <>
      <Stack.Screen options={{ title: t('admin.reports') }} />
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 12, paddingBottom: 40 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periodRow}>
          {PERIODS.map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.periodChip, period === p && styles.periodChipActive]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[styles.periodChipText, period === p && styles.periodChipTextActive]}>
                {t(`reports.period_${p}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading || !data ? (
          <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
        ) : (
          <>
            <View style={styles.statsGrid}>
              <StatCard icon="coins"          color="#10b981" label={t('reports.totalRevenue')}      value={`${data.totalRevenue.toLocaleString()} FCFA`} />
              <StatCard icon="calendar-alt"   color="#3b82f6" label={t('reports.totalReservations')} value={String(data.totalReservations)} />
              <StatCard icon="check-circle"   color="#10b981" label={t('reports.confirmed')}         value={String(data.confirmedCount)} />
              <StatCard icon="times-circle"   color="#ef4444" label={t('reports.cancelled')}         value={String(data.cancelledCount)} />
              <StatCard icon="star"           color="#f59e0b" label={t('reports.avgRating')}         value={`${data.avgRating} / 5`} />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('reports.byNationality')}</Text>
              {data.byNationality.length === 0 ? (
                <Text style={styles.emptyHint}>—</Text>
              ) : data.byNationality.map((n) => (
                <View key={n.nationality} style={styles.barRow}>
                  <Text style={styles.barLabel} numberOfLines={1}>{n.nationality}</Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${(n.total / maxNationality) * 100}%`, backgroundColor: '#3b82f6' }]} />
                  </View>
                  <Text style={styles.barValue}>{n.total}</Text>
                </View>
              ))}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('reports.byRoomType')}</Text>
              {data.byRoomType.length === 0 ? (
                <Text style={styles.emptyHint}>—</Text>
              ) : data.byRoomType.map((r) => (
                <View key={r.type} style={styles.barRow}>
                  <Text style={styles.barLabel} numberOfLines={1}>{r.type}</Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${(r.total / maxRoomType) * 100}%`, backgroundColor: '#f59e0b' }]} />
                  </View>
                  <Text style={styles.barValue}>{r.total}</Text>
                </View>
              ))}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('reports.topHotels')}</Text>
              {data.hotels.map((h, i) => (
                <View key={h.id} style={styles.hotelRow}>
                  <Text style={styles.hotelRank}>#{i + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.hotelName}>{h.short_name ?? h.name}</Text>
                    <Text style={styles.hotelRating}>⭐ {h.rating}</Text>
                  </View>
                  <Text style={styles.hotelRevenue}>{Number(h.revenue ?? 0).toLocaleString()} FCFA</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </>
  );
}

function StatCard({ icon, color, label, value }: { icon: string; color: string; label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconWrap, { backgroundColor: color + '20' }]}>
        <FontAwesome5 name={icon as any} size={16} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.background },
  center:      { paddingTop: 60, alignItems: 'center' },
  periodRow:   { gap: 8, paddingBottom: 12 },
  periodChip:  { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border },
  periodChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  periodChipText:   { fontSize: 12, color: COLORS.textMuted, fontWeight: '600' },
  periodChipTextActive: { color: COLORS.white },
  statsGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  statCard:    { width: '31%', backgroundColor: COLORS.white, borderRadius: 14, padding: 12, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  statIconWrap:{ width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  statValue:   { fontSize: 14, fontWeight: '800', color: COLORS.dark, textAlign: 'center' },
  statLabel:   { fontSize: 10, color: COLORS.textMuted, textAlign: 'center', marginTop: 2 },
  section:     { backgroundColor: COLORS.white, borderRadius: 14, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  sectionTitle:{ fontSize: 14, fontWeight: '700', color: COLORS.dark, marginBottom: 10 },
  emptyHint:   { fontSize: 12, color: COLORS.textMuted, fontStyle: 'italic' },
  barRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  barLabel:    { width: 90, fontSize: 11, color: COLORS.textMuted },
  barTrack:    { flex: 1, height: 8, backgroundColor: COLORS.background, borderRadius: 4, overflow: 'hidden' },
  barFill:     { height: 8, borderRadius: 4 },
  barValue:    { width: 30, fontSize: 11, color: COLORS.dark, fontWeight: '700', textAlign: 'right' },
  hotelRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  hotelRank:   { fontSize: 13, fontWeight: '800', color: COLORS.textMuted, width: 26 },
  hotelName:   { fontSize: 13, fontWeight: '700', color: COLORS.dark },
  hotelRating: { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  hotelRevenue:{ fontSize: 13, fontWeight: '800', color: COLORS.dark },
});
