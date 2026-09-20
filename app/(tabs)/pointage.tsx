import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { FontAwesome5 } from '@expo/vector-icons';
import { pointageApi } from '@/services/api';
import { Pointage, Staff } from '@/types';
import { COLORS } from '@/constants';
import { useAuthStore } from '@/store/authStore';
import DatePicker from '@/components/DatePicker';

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function firstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function fmtTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toISOString().slice(11, 16);
}
function fmtDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}
function fmtDuration(min: number | null) {
  if (min === null || min === undefined) return '—';
  const h = Math.floor(min / 60), m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/* ── Widget employé : pointer arrivée / départ ─────────────────────────────── */
function EmployeeView() {
  const { t } = useTranslation();
  const [staff,      setStaff]      = useState<Staff | null>(null);
  const [todayRow,   setTodayRow]   = useState<Pointage | null>(null);
  const [history,    setHistory]    = useState<Pointage[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting,     setActing]     = useState(false);
  const [clock,      setClock]      = useState(new Date());

  const load = useCallback(async () => {
    try {
      const res = await pointageApi.me();
      setStaff(res.data.staff);
      setTodayRow(res.data.today);
      setHistory(res.data.history ?? []);
    } catch (e: any) {
      Alert.alert(t('common.error'), e.response?.data?.message ?? t('pointage.loadError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 15000);
    return () => clearInterval(id);
  }, []);

  const onRefresh = () => { setRefreshing(true); load(); };

  const handleCheckIn = async () => {
    setActing(true);
    try {
      const res = await pointageApi.checkIn();
      Alert.alert(t('common.success'), res.data.message);
      load();
    } catch (e: any) {
      Alert.alert(t('common.error'), e.response?.data?.message ?? t('pointage.actionError'));
    } finally {
      setActing(false);
    }
  };

  const handleCheckOut = async () => {
    setActing(true);
    try {
      const res = await pointageApi.checkOut();
      Alert.alert(t('common.success'), res.data.message);
      load();
    } catch (e: any) {
      Alert.alert(t('common.error'), e.response?.data?.message ?? t('pointage.actionError'));
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }
  if (!staff) {
    return (
      <View style={styles.centered}>
        <FontAwesome5 name="user-slash" size={40} color={COLORS.grayLight} />
        <Text style={styles.emptyText}>{t('pointage.noStaffRecord')}</Text>
      </View>
    );
  }

  const hasCheckedIn  = !!todayRow?.check_in;
  const hasCheckedOut = !!todayRow?.check_out;

  return (
    <FlatList
      data={history}
      keyExtractor={h => String(h.id)}
      contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      ListHeaderComponent={
        <>
          <View style={styles.clockCard}>
            <Text style={styles.clockDate}>{clock.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
            <Text style={styles.clockTime}>{clock.toTimeString().slice(0, 5)}</Text>

            {!hasCheckedIn ? (
              <TouchableOpacity style={[styles.actionBtn, styles.checkInBtn]} onPress={handleCheckIn} disabled={acting}>
                {acting ? <ActivityIndicator color={COLORS.white} /> : (
                  <>
                    <FontAwesome5 name="sign-in-alt" size={16} color={COLORS.white} />
                    <Text style={styles.actionBtnText}>{t('pointage.checkIn')}</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : !hasCheckedOut ? (
              <>
                <View style={styles.statusRow}>
                  <FontAwesome5 name="check-circle" size={13} color={COLORS.success} solid />
                  <Text style={styles.statusText}>
                    {t('pointage.arrivedAt', { time: fmtTime(todayRow!.check_in) })}
                    {todayRow!.late_minutes > 0 ? ` — ${t('pointage.lateBy', { min: todayRow!.late_minutes })}` : ''}
                  </Text>
                </View>
                <TouchableOpacity style={[styles.actionBtn, styles.checkOutBtn]} onPress={handleCheckOut} disabled={acting}>
                  {acting ? <ActivityIndicator color={COLORS.white} /> : (
                    <>
                      <FontAwesome5 name="sign-out-alt" size={16} color={COLORS.white} />
                      <Text style={styles.actionBtnText}>{t('pointage.checkOut')}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.doneWrap}>
                <FontAwesome5 name="check-circle" size={26} color={COLORS.success} solid />
                <Text style={styles.doneText}>{t('pointage.dayDone')}</Text>
                <Text style={styles.doneSub}>
                  {fmtTime(todayRow!.check_in)} → {fmtTime(todayRow!.check_out)} · {fmtDuration(todayRow!.worked_minutes)}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.sectionTitle}>{t('pointage.history')}</Text>
        </>
      }
      renderItem={({ item }) => (
        <View style={styles.historyRow}>
          <Text style={styles.historyDate}>{fmtDate(item.date)}</Text>
          <Text style={styles.historyTimes}>{fmtTime(item.check_in)} → {fmtTime(item.check_out)}</Text>
          <View style={[styles.statusBadge, statusBadgeStyle(item.status)]}>
            <Text style={[styles.statusBadgeText, statusBadgeTextStyle(item.status)]}>
              {item.status === 'present' ? t('pointage.present') : item.status === 'retard' ? t('pointage.late') : t('pointage.absent')}
            </Text>
          </View>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.emptyText}>{t('pointage.noHistory')}</Text>}
    />
  );
}

function statusBadgeStyle(status: string) {
  if (status === 'present') return { backgroundColor: '#DCFCE7' };
  if (status === 'retard')  return { backgroundColor: '#FEF3C7' };
  return { backgroundColor: '#F1F5F9' };
}
function statusBadgeTextStyle(status: string) {
  if (status === 'present') return { color: '#166534' };
  if (status === 'retard')  return { color: '#92400E' };
  return { color: '#64748B' };
}

/* ── Rapport propriétaire / admin ──────────────────────────────────────────── */
function ReportView() {
  const { t } = useTranslation();
  const [pointages,  setPointages]  = useState<Pointage[]>([]);
  const [absences,   setAbsences]   = useState<any[]>([]);
  const [stats,      setStats]      = useState<any>({});
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab,        setTab]        = useState<'history' | 'absences'>('history');
  const [from,        setFrom]        = useState(firstOfMonth());
  const [to,          setTo]          = useState(today());
  const [datePicker,  setDatePicker]  = useState<'from' | 'to' | null>(null);
  const [filterHotel, setFilterHotel] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await pointageApi.report({ from, to });
      setPointages(res.data.pointages ?? []);
      setAbsences(res.data.absences ?? []);
      setStats(res.data.stats ?? {});
    } catch (e: any) {
      Alert.alert(t('common.error'), e.response?.data?.message ?? t('pointage.loadError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [from, to, t]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = () => { setRefreshing(true); load(); };

  const hotelOptions = useMemo(() => {
    const map = new Map<number, string>();
    pointages.forEach(p => map.set(p.hotel_id, p.hotel_short_name || p.hotel_name || ''));
    absences.forEach(a => map.set(a.hotel_id, a.hotel_short_name || a.hotel_name || ''));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [pointages, absences]);

  const filteredPointages = filterHotel ? pointages.filter(p => p.hotel_id === filterHotel) : pointages;
  const filteredAbsences  = filterHotel ? absences.filter(a => a.hotel_id === filterHotel)  : absences;

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  const data = tab === 'history' ? filteredPointages : filteredAbsences;

  return (
    <>
      <FlatList
        data={data}
        keyExtractor={(item: any) => String(item.id)}
        contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        ListHeaderComponent={
          <>
            <View style={styles.statsGrid}>
              <View style={styles.statTile}>
                <Text style={styles.statValue}>{stats.punctuality !== null && stats.punctuality !== undefined ? `${stats.punctuality}%` : '—'}</Text>
                <Text style={styles.statLabel}>{t('pointage.punctuality')}</Text>
              </View>
              <View style={styles.statTile}>
                <Text style={[styles.statValue, { color: COLORS.success }]}>{stats.presentCount ?? 0}</Text>
                <Text style={styles.statLabel}>{t('pointage.present')}</Text>
              </View>
              <View style={styles.statTile}>
                <Text style={[styles.statValue, { color: '#D97706' }]}>{stats.lateCount ?? 0}</Text>
                <Text style={styles.statLabel}>{t('pointage.late')}</Text>
              </View>
              <View style={styles.statTile}>
                <Text style={[styles.statValue, { color: COLORS.danger }]}>{stats.absentCount ?? 0}</Text>
                <Text style={styles.statLabel}>{t('pointage.absent')}</Text>
              </View>
            </View>

            <View style={styles.dateRow}>
              <TouchableOpacity style={styles.dateBtn} onPress={() => setDatePicker('from')}>
                <FontAwesome5 name="calendar" size={12} color={COLORS.primary} />
                <Text style={styles.dateBtnText}>{fmtDate(from)}</Text>
              </TouchableOpacity>
              <FontAwesome5 name="arrow-right" size={11} color={COLORS.textMuted} />
              <TouchableOpacity style={styles.dateBtn} onPress={() => setDatePicker('to')}>
                <FontAwesome5 name="calendar" size={12} color={COLORS.primary} />
                <Text style={styles.dateBtnText}>{fmtDate(to)}</Text>
              </TouchableOpacity>
            </View>

            {hotelOptions.length > 1 && (
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={[{ id: 0, name: t('common.all') }, ...hotelOptions]}
                keyExtractor={h => String(h.id)}
                contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.chip, (filterHotel ?? 0) === item.id && styles.chipActive]}
                    onPress={() => setFilterHotel(item.id || null)}
                  >
                    <Text style={[styles.chipText, (filterHotel ?? 0) === item.id && styles.chipTextActive]}>{item.name}</Text>
                  </TouchableOpacity>
                )}
              />
            )}

            <View style={styles.tabBar}>
              <TouchableOpacity style={[styles.tab, tab === 'history' && styles.tabActive]} onPress={() => setTab('history')}>
                <Text style={[styles.tabText, tab === 'history' && styles.tabTextActive]}>{t('pointage.history')} ({filteredPointages.length})</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tab, tab === 'absences' && styles.tabActive]} onPress={() => setTab('absences')}>
                <Text style={[styles.tabText, tab === 'absences' && styles.tabTextActive]}>{t('pointage.absences')} ({filteredAbsences.length})</Text>
              </TouchableOpacity>
            </View>
          </>
        }
        renderItem={({ item }: { item: any }) => tab === 'history' ? (
          <View style={styles.reportRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.reportName}>{item.first_name} {item.last_name}</Text>
              <Text style={styles.reportSub}>{item.hotel_short_name || item.hotel_name} · {fmtDate(item.date)}</Text>
              <Text style={styles.reportTimes}>{fmtTime(item.check_in)} → {fmtTime(item.check_out)} · {fmtDuration(item.worked_minutes)}</Text>
            </View>
            <View style={[styles.statusBadge, statusBadgeStyle(item.status)]}>
              <Text style={[styles.statusBadgeText, statusBadgeTextStyle(item.status)]}>
                {item.status === 'present' ? t('pointage.present') : item.status === 'retard' ? t('pointage.late') : t('pointage.absent')}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.reportRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.reportName}>{item.first_name} {item.last_name}</Text>
              <Text style={styles.reportSub}>{item.hotel_short_name || item.hotel_name} · {fmtDate(item.date)}</Text>
            </View>
            <FontAwesome5 name="user-xmark" size={16} color={COLORS.danger} />
          </View>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>{tab === 'history' ? t('pointage.noHistory') : t('pointage.noAbsences')}</Text>}
      />

      <DatePicker
        visible={datePicker === 'from'}
        value={from}
        title={t('pointage.from')}
        onConfirm={d => { setFrom(d); setDatePicker(null); }}
        onCancel={() => setDatePicker(null)}
      />
      <DatePicker
        visible={datePicker === 'to'}
        value={to}
        minDate={from}
        title={t('pointage.to')}
        onConfirm={d => { setTo(d); setDatePicker(null); }}
        onCancel={() => setDatePicker(null)}
      />
    </>
  );
}

export default function PointageScreen() {
  const { user } = useAuthStore();

  return (
    <View style={styles.container}>
      {user?.role === 'employe' ? <EmployeeView /> : <ReportView />}
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.background },
  centered:    { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 12 },
  emptyText:   { textAlign: 'center', color: COLORS.textMuted, fontSize: 14, marginTop: 12 },

  clockCard:   { backgroundColor: COLORS.white, borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  clockDate:   { fontSize: 12, color: COLORS.textMuted, textTransform: 'capitalize', marginBottom: 4 },
  clockTime:   { fontSize: 40, fontWeight: '800', color: COLORS.dark, marginBottom: 20, fontVariant: ['tabular-nums'] },
  actionBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, paddingHorizontal: 36, borderRadius: 14 },
  checkInBtn:  { backgroundColor: COLORS.success },
  checkOutBtn: { backgroundColor: COLORS.primary },
  actionBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  statusRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  statusText:  { fontSize: 13, color: COLORS.dark },
  doneWrap:    { alignItems: 'center', gap: 6 },
  doneText:    { fontSize: 15, fontWeight: '700', color: COLORS.dark },
  doneSub:     { fontSize: 12, color: COLORS.textMuted },

  sectionTitle:{ fontSize: 14, fontWeight: '700', color: COLORS.dark, marginBottom: 8, marginTop: 4 },
  historyRow:  { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 12, padding: 12, marginBottom: 8, gap: 10 },
  historyDate: { fontSize: 12, color: COLORS.textMuted, width: 72 },
  historyTimes:{ fontSize: 13, color: COLORS.dark, flex: 1 },

  statusBadge:     { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },

  statsGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  statTile:    { flexBasis: '23%', flexGrow: 1, backgroundColor: COLORS.white, borderRadius: 12, padding: 12, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  statValue:   { fontSize: 18, fontWeight: '800', color: COLORS.dark },
  statLabel:   { fontSize: 10, color: COLORS.textMuted, marginTop: 2, textAlign: 'center', textTransform: 'uppercase' },

  dateRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  dateBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.white, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, flex: 1, justifyContent: 'center' },
  dateBtnText: { fontSize: 13, color: COLORS.dark, fontWeight: '600' },

  chip:        { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border },
  chipActive:  { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText:    { fontSize: 12, color: COLORS.textMuted, fontWeight: '600' },
  chipTextActive: { color: COLORS.white },

  tabBar:      { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tab:         { flex: 1, paddingVertical: 9, borderRadius: 20, backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center' },
  tabActive:   { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabText:     { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },
  tabTextActive: { color: COLORS.white },

  reportRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 12, padding: 12, marginBottom: 8, gap: 10 },
  reportName:  { fontSize: 14, fontWeight: '700', color: COLORS.dark },
  reportSub:   { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  reportTimes: { fontSize: 12, color: COLORS.dark, marginTop: 2 },
});
