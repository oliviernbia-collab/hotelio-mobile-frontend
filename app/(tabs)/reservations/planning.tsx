import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, SectionList, StyleSheet, TouchableOpacity,
  RefreshControl, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { reservationApi } from '@/services/api';
import { Reservation } from '@/types';
import { COLORS, RESERVATION_STATUS_COLORS } from '@/constants';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';

/* ── Types ─────────────────────────────────────────────────────────────── */
type Period    = '7j' | '30j' | '90j';
type ViewMode  = 'arrivees' | 'departs' | 'tous';
type StatusFilter = 'tous' | 'confirmée' | 'en_attente' | 'annulée' | 'complétée';

/* ── Constantes ────────────────────────────────────────────────────────── */
const PERIODS: { key: Period; labelKey: string; days: number }[] = [
  { key: '7j',  labelKey: 'planning.period_7d',  days: 7  },
  { key: '30j', labelKey: 'planning.period_30d', days: 30 },
  { key: '90j', labelKey: 'planning.period_3m',  days: 90 },
];

const STATUS_FILTERS: { key: StatusFilter; labelKey: string }[] = [
  { key: 'tous',       labelKey: 'hotels.tab_all'             },
  { key: 'confirmée',  labelKey: 'planning.filter_confirmed'  },
  { key: 'en_attente', labelKey: 'reservations.status_en_attente' },
  { key: 'annulée',    labelKey: 'planning.filter_cancelled'  },
  { key: 'complétée',  labelKey: 'planning.filter_completed'  },
];

const STATUS_LABEL_KEYS: Record<string, string> = {
  confirmée: 'reservations.status_confirmee', en_attente: 'planning.status_attente',
  annulée: 'reservations.status_annulee', complétée: 'planning.status_completed', terminée: 'planning.status_completed',
};

/* ── Helpers ───────────────────────────────────────────────────────────── */
function toISO(date: Date) { return date.toISOString().split('T')[0]; }

function addDays(date: Date, days: number) {
  const d = new Date(date); d.setDate(d.getDate() + days); return d;
}

function formatDate(iso: string) {
  if (!iso) return '-';
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

function sectionTitle(dateStr: string, t: (k: string) => string): { label: string; isToday: boolean } {
  if (!dateStr) return { label: '-', isToday: false };
  const d     = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const isTomorrow = d.toDateString() === addDays(today, 1).toDateString();
  let label = d.toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  if (isToday)    label = t('notifications.date_today') + ' · ' + label;
  if (isTomorrow) label = t('reservations.tomorrow') + ' · '       + label;
  return { label, isToday };
}

type Section = { title: string; date: string; isToday: boolean; data: Reservation[] };

/* ══════════════════════════════════════════════════════════════════════════
   SCREEN
══════════════════════════════════════════════════════════════════════════ */
export default function PlanningScreen() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const isManager = user?.role === 'admin' || user?.role === 'prestataire' || user?.role === 'employe';

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [period,       setPeriod]       = useState<Period>('30j');
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [view,         setView]         = useState<ViewMode>('tous');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('tous');
  const [expandedId,   setExpandedId]   = useState<number | null>(null);

  const { from, to } = useMemo(() => {
    const now = new Date();
    return {
      from: toISO(now),
      to:   toISO(addDays(now, PERIODS.find(p => p.key === period)!.days)),
    };
  }, [period]);

  const loadData = useCallback(async () => {
    try {
      const params: Record<string, string> = { from, to };
      const res = user?.role === 'client'
        ? await reservationApi.mine(params)
        : await reservationApi.list(params);
      const list: Reservation[] = res.data.data ?? res.data;
      setReservations(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [from, to, user?.role]);

  useEffect(() => { loadData(); }, [loadData]);

  /* ── Check-in / Check-out ─────────────────────────────────────────────── */
  const handleCheckIn = async (id: number) => {
    try {
      await reservationApi.checkIn(id);
      loadData();
    } catch (e: any) {
      Alert.alert(t('common.error'), e.response?.data?.message ?? t('planning.cannotCheckIn'));
    }
  };

  const handleCheckOut = async (id: number) => {
    try {
      await reservationApi.checkOut(id);
      loadData();
    } catch (e: any) {
      Alert.alert(t('common.error'), e.response?.data?.message ?? t('planning.cannotCheckOut'));
    }
  };

  /* ── Stats ────────────────────────────────────────────────────────────── */
  const stats = useMemo(() => {
    const active   = reservations.filter(r => r.status !== 'annulée');
    const revenue  = active.reduce((s, r) => s + (Number(r.total) || 0), 0);
    return {
      total:      reservations.length,
      arrivees:   reservations.filter(r => r.checkin  >= from && r.checkin  <= to).length,
      departs:    reservations.filter(r => r.checkout >= from && r.checkout <= to).length,
      confirmees: reservations.filter(r => r.status   === 'confirmée').length,
      revenue,
    };
  }, [reservations, from, to]);

  /* ── Sections filtrées ────────────────────────────────────────────────── */
  const sections: Section[] = useMemo(() => {
    const map = new Map<string, Reservation[]>();

    const filtered = reservations.filter(r => {
      const viewOk =
        view === 'arrivees' ? (r.checkin  >= from && r.checkin  <= to) :
        view === 'departs'  ? (r.checkout >= from && r.checkout <= to) :
        true;
      const statusOk = statusFilter === 'tous' || r.status === statusFilter;
      return viewOk && statusOk;
    });

    filtered.forEach(r => {
      const key = view === 'departs' ? r.checkout : r.checkin;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => {
        const { label, isToday } = sectionTitle(date, t);
        return { title: label, date, isToday, data };
      });
  }, [reservations, view, statusFilter, from, to, t]);

  /* ── Rendu d'une ligne ────────────────────────────────────────────────── */
  const renderItem = ({ item }: { item: Reservation }) => {
    const statusColor = (RESERVATION_STATUS_COLORS as any)[item.status] ?? COLORS.gray;
    const isCheckin   = item.checkin  >= from && item.checkin  <= to;
    const isCheckout  = item.checkout >= from && item.checkout <= to;
    const isExpanded  = expandedId === item.id;
    const today       = toISO(new Date());
    const canCheckin  = item.status === 'confirmée' && item.checkin <= today && !item.checkin_at;
    const canCheckout = item.status === 'confirmée' && !!item.checkin_at && !item.checkout_at;

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setExpandedId(isExpanded ? null : item.id)}
        style={[styles.row, isExpanded && styles.rowExpanded]}
      >
        {/* Indicateur arrivée/départ */}
        <View style={styles.rowIndicator}>
          {isCheckin && !isCheckout && (
            <View style={[styles.badge, { backgroundColor: '#D1FAE5' }]}>
              <FontAwesome5 name="arrow-right" size={9} color="#065F46" />
            </View>
          )}
          {isCheckout && !isCheckin && (
            <View style={[styles.badge, { backgroundColor: '#FEE2E2' }]}>
              <FontAwesome5 name="arrow-left" size={9} color="#991B1B" />
            </View>
          )}
          {isCheckin && isCheckout && (
            <View style={[styles.badge, { backgroundColor: '#DBEAFE' }]}>
              <FontAwesome5 name="exchange-alt" size={9} color="#1E40AF" />
            </View>
          )}
          {!isCheckin && !isCheckout && (
            <View style={[styles.badge, { backgroundColor: COLORS.background }]}>
              <FontAwesome5 name="bed" size={9} color={COLORS.textMuted} />
            </View>
          )}
        </View>

        {/* Infos client */}
        <View style={styles.rowClient}>
          <Text style={styles.rowClientName} numberOfLines={1}>
            {(item as any).first_name ?? item.client?.first_name ?? '—'}{' '}
            {(item as any).last_name  ?? item.client?.last_name  ?? ''}
          </Text>
          <Text style={styles.rowMeta} numberOfLines={1}>
            {(item as any).hotel_short_name ?? (item as any).hotel_name ?? item.hotel?.name ?? '—'}
            {(item as any).room_number ? t('planning.roomPrefix', { number: (item as any).room_number }) : ''}
          </Text>
        </View>

        {/* Dates + nuits */}
        <View style={styles.rowDates}>
          <Text style={styles.rowDateLabel}>
            {formatDate(item.checkin)} → {formatDate(item.checkout)}
          </Text>
          <Text style={styles.rowNights}>{item.nights} {item.nights > 1 ? t('common.nights') : t('common.night')}</Text>
        </View>

        {/* Statut */}
        <View style={[styles.statusPill, { backgroundColor: statusColor + '22' }]}>
          <Text style={[styles.statusPillText, { color: statusColor }]} numberOfLines={1}>
            {t(STATUS_LABEL_KEYS[item.status] ?? item.status)}
          </Text>
        </View>

        {/* Détails expandables */}
        {isExpanded && (
          <View style={styles.expandSection}>
            {/* Montant */}
            <View style={styles.expandRow}>
              <FontAwesome5 name="money-bill-wave" size={12} color={COLORS.success} />
              <Text style={styles.expandLabel}>{t('reservations.total')}</Text>
              <Text style={styles.expandValue}>
                {Number(item.total || 0).toLocaleString('fr-FR')} FCFA
                {item.paid ? t('planning.paidStatus') : t('planning.unpaidStatus')}
              </Text>
            </View>
            {/* Mode paiement */}
            {item.payment_method && (
              <View style={styles.expandRow}>
                <FontAwesome5 name="credit-card" size={12} color={COLORS.primary} />
                <Text style={styles.expandLabel}>{t('reservations.paymentMethod')}</Text>
                <Text style={styles.expandValue}>{item.payment_method}</Text>
              </View>
            )}
            {/* Type chambre */}
            {(item as any).room_type && (
              <View style={styles.expandRow}>
                <FontAwesome5 name="bed" size={12} color={COLORS.primary} />
                <Text style={styles.expandLabel}>{t('reservations.room')}</Text>
                <Text style={styles.expandValue}>
                  {(item as any).room_type}
                  {(item as any).room_number ? t('planning.roomNumberSuffix', { number: (item as any).room_number }) : ''}
                </Text>
              </View>
            )}
            {/* Notes */}
            {item.notes ? (
              <View style={styles.expandRow}>
                <FontAwesome5 name="sticky-note" size={12} color={COLORS.textMuted} />
                <Text style={styles.expandLabel}>{t('reservations.notes')}</Text>
                <Text style={[styles.expandValue, { flex: 1 }]} numberOfLines={2}>{item.notes}</Text>
              </View>
            ) : null}
            {/* Actions check-in / check-out */}
            {isManager && (canCheckin || canCheckout) && (
              <View style={styles.actionRow}>
                {canCheckin && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: COLORS.success }]}
                    onPress={() => handleCheckIn(item.id)}
                  >
                    <FontAwesome5 name="sign-in-alt" size={12} color={COLORS.white} />
                    <Text style={styles.actionBtnText}>{t('resList.checkIn')}</Text>
                  </TouchableOpacity>
                )}
                {canCheckout && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: COLORS.danger }]}
                    onPress={() => handleCheckOut(item.id)}
                  >
                    <FontAwesome5 name="sign-out-alt" size={12} color={COLORS.white} />
                    <Text style={styles.actionBtnText}>{t('resList.checkOut')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  /* ── En-tête de section ─────────────────────────────────────────────── */
  const renderSectionHeader = ({ section }: { section: Section }) => (
    <View style={[styles.sectionHeader, section.isToday && styles.sectionHeaderToday]}>
      <FontAwesome5
        name="calendar-day"
        size={12}
        color={section.isToday ? COLORS.white : COLORS.primary}
      />
      <Text style={[styles.sectionTitle, section.isToday && { color: COLORS.white }]}>
        {section.title}
      </Text>
      <View style={[styles.sectionCount, section.isToday && { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
        <Text style={styles.sectionCountText}>{section.data.length}</Text>
      </View>
    </View>
  );

  /* ══════════════════════════════════════════════════════════════════════════
     RENDU
  ══════════════════════════════════════════════════════════════════════════ */
  return (
    <>
      <Stack.Screen options={{ title: t('resList.planning'), headerBackTitle: t('common.back') }} />
      <View style={styles.container}>

        {/* ── Stats ─────────────────────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statsRow}
        >
          <StatPill label={t('reservations.title')}              value={stats.total}      icon="list"         color={COLORS.primary} />
          <StatPill label={t('reservations.checkin')}           value={stats.arrivees}   icon="arrow-right"  color={COLORS.success} />
          <StatPill label={t('reservations.checkout')}          value={stats.departs}    icon="arrow-left"   color={COLORS.danger}  />
          <StatPill label={t('reservations.status_confirmee')}  value={stats.confirmees} icon="check-circle" color={COLORS.info}    />
          <StatPill
            label={t('dashboard.revenue')}
            value={stats.revenue}
            icon="wallet"
            color="#f59e0b"
            isCurrency
          />
        </ScrollView>

        {/* ── Filtres période + vue ──────────────────────────────────────── */}
        <View style={styles.filtersWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
            {PERIODS.map(p => (
              <TouchableOpacity
                key={p.key}
                style={[styles.pill, period === p.key && styles.pillActive]}
                onPress={() => setPeriod(p.key)}
              >
                <Text style={[styles.pillText, period === p.key && styles.pillTextActive]}>{t(p.labelKey)}</Text>
              </TouchableOpacity>
            ))}
            <View style={styles.pillSep} />
            {(['tous', 'arrivees', 'departs'] as ViewMode[]).map(v => (
              <TouchableOpacity
                key={v}
                style={[styles.pill, view === v && styles.pillSecondaryActive]}
                onPress={() => setView(v)}
              >
                <Text style={[styles.pillText, view === v && { color: '#6366f1', fontWeight: '700' }]}>
                  {v === 'tous' ? t('planning.viewAll') : v === 'arrivees' ? t('planning.arrivals') : t('planning.departures')}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Filtre statut */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusFilterRow}>
            {STATUS_FILTERS.map(sf => {
              const active = statusFilter === sf.key;
              const color  = sf.key === 'tous' ? COLORS.primary
                : (RESERVATION_STATUS_COLORS as any)[sf.key] ?? COLORS.gray;
              return (
                <TouchableOpacity
                  key={sf.key}
                  style={[styles.statusFilterPill, active && { backgroundColor: color + '22', borderColor: color }]}
                  onPress={() => setStatusFilter(sf.key)}
                >
                  {sf.key !== 'tous' && (
                    <View style={[styles.statusDot, { backgroundColor: color }]} />
                  )}
                  <Text style={[styles.statusFilterText, active && { color, fontWeight: '700' }]}>
                    {t(sf.labelKey)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ── En-têtes colonnes ─────────────────────────────────────────── */}
        <View style={styles.tableHeader}>
          <View style={styles.rowIndicator} />
          <Text style={[styles.colHead, { flex: 1.4 }]}>{t('reservations.hotel')}</Text>
          <Text style={[styles.colHead, { flex: 1.4 }]}>{t('reservations.checkin')} / {t('reservations.checkout')}</Text>
          <Text style={[styles.colHead, { width: 72 }]}>{t('reservations.status')}</Text>
        </View>

        {/* ── Contenu ───────────────────────────────────────────────────── */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : sections.length === 0 ? (
          <View style={styles.center}>
            <FontAwesome5 name="calendar-times" size={48} color={COLORS.grayLight} />
            <Text style={styles.emptyText}>{t('reservations.noReservations')}</Text>
            {statusFilter !== 'tous' && (
              <TouchableOpacity
                style={styles.resetFilterBtn}
                onPress={() => setStatusFilter('tous')}
              >
                <Text style={styles.resetFilterText}>{t('reservations.status')}</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            renderSectionHeader={renderSectionHeader}
            contentContainerStyle={{ paddingBottom: 40 }}
            stickySectionHeadersEnabled
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); loadData(); }}
                colors={[COLORS.primary]}
              />
            }
          />
        )}
      </View>
    </>
  );
}

/* ── StatPill ───────────────────────────────────────────────────────────── */
function StatPill({
  label, value, icon, color, isCurrency = false,
}: {
  label: string; value: number; icon: string; color: string; isCurrency?: boolean;
}) {
  const display = isCurrency
    ? (value >= 1_000_000
        ? `${(value / 1_000_000).toFixed(1)} M`
        : value >= 1_000
          ? `${(value / 1_000).toFixed(0)} k`
          : String(value))
    : String(value);
  return (
    <View style={[styles.statPill, { borderColor: color + '44' }]}>
      <FontAwesome5 name={icon as any} size={12} color={color} />
      <Text style={[styles.statPillValue, { color }]}>{display}</Text>
      <Text style={styles.statPillLabel}>{label}</Text>
    </View>
  );
}

/* ── Styles ─────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: COLORS.background },

  /* Stats */
  statsRow:        { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  statPill:        { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.white, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1.5, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  statPillValue:   { fontSize: 14, fontWeight: '700' },
  statPillLabel:   { fontSize: 11, color: COLORS.textMuted },

  /* Filtres */
  filtersWrap:         { backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  filtersRow:          { paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  statusFilterRow:     { paddingHorizontal: 12, paddingBottom: 8, gap: 6 },
  pill:                { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border },
  pillActive:          { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pillSecondaryActive: { backgroundColor: '#EEF2FF', borderColor: '#6366f1' },
  pillText:            { fontSize: 12, color: COLORS.textMuted },
  pillTextActive:      { color: COLORS.white, fontWeight: '700' },
  pillSep:             { width: 1, backgroundColor: COLORS.border, marginHorizontal: 4 },
  statusFilterPill:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 5, borderRadius: 20, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border },
  statusDot:           { width: 7, height: 7, borderRadius: 4 },
  statusFilterText:    { fontSize: 12, color: COLORS.textMuted },

  /* En-tête tableau */
  tableHeader:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F4FF', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  colHead:         { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase' },

  /* Section */
  sectionHeader:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F8F9FA', paddingHorizontal: 14, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  sectionHeaderToday: { backgroundColor: COLORS.primary },
  sectionTitle:       { flex: 1, fontSize: 12, fontWeight: '700', color: COLORS.dark, textTransform: 'capitalize' },
  sectionCount:       { backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 7, paddingVertical: 2 },
  sectionCountText:   { fontSize: 11, color: COLORS.white, fontWeight: '700' },

  /* Ligne réservation */
  row:          { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, paddingHorizontal: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F0F0F0', gap: 6, flexWrap: 'wrap' },
  rowExpanded:  { backgroundColor: '#FAFBFF' },
  rowIndicator: { width: 22, alignItems: 'center' },
  badge:        { width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  rowClient:    { flex: 1.4, marginRight: 4 },
  rowClientName:{ fontSize: 13, fontWeight: '700', color: COLORS.dark },
  rowMeta:      { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  rowDates:     { flex: 1.4 },
  rowDateLabel: { fontSize: 11, color: COLORS.dark, fontWeight: '600' },
  rowNights:    { fontSize: 10, color: COLORS.textMuted, marginTop: 1 },
  statusPill:   { width: 72, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 12, alignItems: 'center' },
  statusPillText:{ fontSize: 10, fontWeight: '700' },

  /* Section expandable */
  expandSection: { width: '100%', marginTop: 10, backgroundColor: '#F4F6FF', borderRadius: 10, padding: 12, gap: 8 },
  expandRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  expandLabel:   { fontSize: 12, color: COLORS.textMuted, width: 68 },
  expandValue:   { fontSize: 12, fontWeight: '600', color: COLORS.dark },
  actionRow:     { flexDirection: 'row', gap: 10, marginTop: 4 },
  actionBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  actionBtnText: { color: COLORS.white, fontSize: 13, fontWeight: '700' },

  /* Vide */
  center:          { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 60 },
  emptyText:       { fontSize: 15, color: COLORS.textMuted, textAlign: 'center', paddingHorizontal: 30 },
  resetFilterBtn:  { marginTop: 4, backgroundColor: COLORS.primary + '18', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  resetFilterText: { fontSize: 13, color: COLORS.primary, fontWeight: '700' },
});
