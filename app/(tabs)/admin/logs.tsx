import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, SectionList, TextInput, TouchableOpacity, StyleSheet,
  Alert, RefreshControl, ScrollView, Platform,
} from 'react-native';
import { Stack } from 'expo-router';
import { adminApi } from '@/services/api';
import { COLORS } from '@/constants';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Log {
  id: number;
  user_id?: number;
  user_name?: string;
  user_role?: string;
  action: string;
  description?: string;
  ip_address?: string;
  created_at: string;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const ACTION_META: Record<string, { icon: string; color: string; labelKey: string }> = {
  login:    { icon: 'sign-in-alt',         color: '#10b981', labelKey: 'logs.action_login'    },
  logout:   { icon: 'sign-out-alt',        color: '#6b7280', labelKey: 'logs.action_logout'   },
  created:  { icon: 'plus-circle',         color: '#6366f1', labelKey: 'logs.action_created'  },
  updated:  { icon: 'edit',                color: '#f59e0b', labelKey: 'logs.action_updated'  },
  deleted:  { icon: 'trash-alt',           color: '#ef4444', labelKey: 'logs.action_deleted'  },
  viewed:   { icon: 'eye',                 color: '#3b82f6', labelKey: 'logs.action_viewed'   },
  exported: { icon: 'file-export',         color: '#8b5cf6', labelKey: 'logs.action_exported' },
  payment:  { icon: 'credit-card',         color: '#0ea5e9', labelKey: 'logs.action_payment'  },
  error:    { icon: 'exclamation-triangle', color: '#dc2626', labelKey: 'logs.action_error'   },
};
const FALLBACK_META = { icon: 'info-circle', color: '#94a3b8', labelKey: 'logs.action_fallback' };
const ROLE_LABEL_KEYS: Record<string, string> = {
  admin: 'roles.admin', prestataire: 'roles.prestataire', employe: 'roles.employe', client: 'roles.client',
};

const ROLE_STYLE: Record<string, { bg: string; text: string }> = {
  admin:       { bg: '#FEE2E2', text: '#991B1B' },
  prestataire: { bg: '#EDE9FE', text: '#7C3AED' },
  employe:     { bg: '#D1FAE5', text: '#065F46' },
  client:      { bg: '#DBEAFE', text: '#1E40AF' },
};
const FALLBACK_ROLE = { bg: '#F3F4F6', text: '#6B7280' };

const DATE_PRESETS: { shortKey: string; days: number | null }[] = [
  { shortKey: 'logs.short_all',   days: null },
  { shortKey: 'logs.short_today', days: 0    },
  { shortKey: 'logs.short_7d',    days: 7    },
  { shortKey: 'logs.short_30d',   days: 30   },
];

// ─── Utilitaires ─────────────────────────────────────────────────────────────

function getFromDate(days: number | null) {
  if (days === null) return undefined;
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function formatTime(iso: string | null | undefined) {
  if (!iso) return '--:--';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function getSectionKey(iso: string | null | undefined): string {
  if (!iso) return 'unknown';
  return iso.split('T')[0].slice(0, 10);
}

function getSectionLabel(key: string, t: (k: string) => string): { main: string; sub: string } {
  if (!key || key === 'unknown') return { main: t('logs.unknownDate'), sub: '' };
  const today     = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const d         = new Date(key + 'T00:00:00');
  if (isNaN(d.getTime())) return { main: t('logs.unknownDate'), sub: '' };
  if (d.getTime() === today.getTime())
    return { main: t('notifications.date_today'), sub: d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) };
  if (d.getTime() === yesterday.getTime())
    return { main: t('logs.yesterday'), sub: d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) };
  return {
    main: d.toLocaleDateString('fr-FR', { weekday: 'long' }),
    sub:  d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
  };
}

function initials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function AdminLogsScreen() {
  const { t } = useTranslation();
  const [logs,         setLogs]         = useState<Log[]>([]);
  const [search,       setSearch]       = useState('');
  const [actionFilter, setActionFilter] = useState('tous');
  const [datePreset,   setDatePreset]   = useState<number | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);

  const searchRef = useRef<TextInput>(null);

  const fetchLogs = useCallback(async () => {
    try {
      const params: any = {};
      if (actionFilter !== 'tous') params.action = actionFilter;
      const from = getFromDate(datePreset);
      if (from) params.from = from;
      const res = await adminApi.logs.list(params);
      setLogs(Array.isArray(res.data) ? res.data : (res.data?.data ?? []));
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [actionFilter, datePreset]);

  useEffect(() => { fetchLogs(); }, [actionFilter, datePreset]);

  const handleClear = () => {
    Alert.alert(
      t('admin.logs'),
      t('logs.clearConfirmMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'), style: 'destructive',
          onPress: async () => {
            try { await adminApi.logs.clear(); setLogs([]); }
            catch (e: any) { Alert.alert(t('common.error'), e.response?.data?.message ?? t('common.error')); }
          },
        },
      ]
    );
  };

  // ─── Données dérivées ─────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    if (!search) return logs;
    const q = search.toLowerCase();
    return logs.filter(l =>
      l.user_name?.toLowerCase().includes(q) ||
      l.description?.toLowerCase().includes(q) ||
      l.action?.toLowerCase().includes(q)
    );
  }, [logs, search]);

  const actionCounts = useMemo(() => {
    const map: Record<string, number> = {};
    logs.forEach(l => { map[l.action] = (map[l.action] ?? 0) + 1; });
    return map;
  }, [logs]);

  const uniqueUsers = useMemo(() => new Set(filtered.map(l => l.user_id)).size, [filtered]);

  const topAction = useMemo(() => {
    let best = { key: '', count: 0 };
    Object.entries(actionCounts).forEach(([k, n]) => { if (n > best.count) best = { key: k, count: n }; });
    return best.key ? { ...(ACTION_META[best.key] ?? FALLBACK_META), count: best.count } : null;
  }, [actionCounts]);

  const sections = useMemo(() => {
    const map = new Map<string, Log[]>();
    filtered.forEach(l => {
      const key = getSectionKey(l.created_at);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(l);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, data]) => ({ key, label: getSectionLabel(key, t), data }));
  }, [filtered, t]);

  const hasActiveFilters = actionFilter !== 'tous' || datePreset !== null || search.length > 0;

  // ─── Render item ──────────────────────────────────────────────────────────

  const renderItem = ({ item, index, section }: { item: Log; index: number; section: { data: Log[] } }) => {
    const meta      = ACTION_META[item.action] ?? FALLBACK_META;
    const roleStyle = ROLE_STYLE[item.user_role ?? ''] ?? FALLBACK_ROLE;
    const isLast    = index === section.data.length - 1;

    return (
      <View style={styles.timelineRow}>
        {/* Colonne timeline */}
        <View style={styles.timelineCol}>
          <View style={[styles.dot, { backgroundColor: meta.color }]}>
            <FontAwesome5 name={meta.icon} size={8} color="#fff" solid />
          </View>
          {!isLast && <View style={[styles.connector, { backgroundColor: meta.color + '28' }]} />}
        </View>

        {/* Carte */}
        <View style={[styles.card, { borderLeftColor: meta.color }, isLast && { marginBottom: 4 }]}>
          {/* Ligne 1 : avatar + nom + rôle + heure */}
          <View style={styles.cardRow1}>
            <View style={[styles.avatar, { backgroundColor: meta.color + '20' }]}>
              <Text style={[styles.avatarText, { color: meta.color }]}>{initials(item.user_name)}</Text>
            </View>
            <View style={styles.cardNameBlock}>
              <Text style={styles.userName} numberOfLines={1}>{item.user_name ?? t('logs.systemUser')}</Text>
              {item.user_role ? (
                <View style={[styles.roleBadge, { backgroundColor: roleStyle.bg }]}>
                  <Text style={[styles.roleText, { color: roleStyle.text }]}>{t(ROLE_LABEL_KEYS[item.user_role] ?? item.user_role)}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.timeText}>{formatTime(item.created_at)}</Text>
          </View>

          {/* Ligne 2 : description */}
          {item.description ? (
            <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>
          ) : null}

          {/* Ligne 3 : action pill + IP */}
          <View style={styles.cardRow3}>
            <View style={[styles.actionPill, { backgroundColor: meta.color + '15' }]}>
              <FontAwesome5 name={meta.icon} size={9} color={meta.color} solid />
              <Text style={[styles.actionPillText, { color: meta.color }]}>{t(meta.labelKey)}</Text>
            </View>
            {item.ip_address ? (
              <View style={styles.ipChip}>
                <FontAwesome5 name="map-marker-alt" size={8} color={COLORS.textMuted} />
                <Text style={styles.ipText}>{item.ip_address}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    );
  };

  // ─── Section header ───────────────────────────────────────────────────────

  const renderSectionHeader = ({ section }: { section: { label: { main: string; sub: string }; data: Log[] } }) => (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionDateBlock}>
        <Text style={styles.sectionMain}>{section.label.main}</Text>
        {section.label.sub ? <Text style={styles.sectionSub}>{section.label.sub}</Text> : null}
      </View>
      <View style={styles.sectionSep} />
      <View style={styles.sectionCountBadge}>
        <Text style={styles.sectionCountText}>{section.data.length}</Text>
      </View>
    </View>
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <Stack.Screen
        options={{
          title: t('admin.logs'),
          headerRight: () => (
            <TouchableOpacity onPress={handleClear} style={{ marginRight: 14 }}>
              <FontAwesome5 name="trash-alt" size={17} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          ),
        }}
      />

      <View style={styles.container}>

        {/* ── Carte de synthèse ── */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryLeft}>
            <Text style={styles.summaryBig}>{filtered.length}</Text>
            <Text style={styles.summaryLabel}>{filtered.length !== 1 ? t('logs.events') : t('logs.event')}</Text>
          </View>
          <View style={styles.summarySep} />
          <View style={styles.summaryMid}>
            <FontAwesome5 name="users" size={14} color="rgba(255,255,255,0.7)" />
            <Text style={styles.summaryStatNum}>{uniqueUsers}</Text>
            <Text style={styles.summaryStatLabel}>{t('logs.usersLabel')}</Text>
          </View>
          {topAction && (
            <>
              <View style={styles.summarySep} />
              <View style={styles.summaryRight}>
                <FontAwesome5 name={topAction.icon} size={14} color="rgba(255,255,255,0.7)" />
                <Text style={styles.summaryStatNum}>{topAction.count}</Text>
                <Text style={styles.summaryStatLabel} numberOfLines={1}>{t(topAction.labelKey)}</Text>
              </View>
            </>
          )}
          {hasActiveFilters && (
            <TouchableOpacity
              style={styles.clearAllBtn}
              onPress={() => { setSearch(''); setActionFilter('tous'); setDatePreset(null); }}
            >
              <FontAwesome5 name="times" size={10} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Recherche ── */}
        <View style={styles.searchBox}>
          <FontAwesome5 name="search" size={13} color={COLORS.textMuted} />
          <TextInput
            ref={searchRef}
            style={styles.searchInput}
            placeholder={t('logs.searchPlaceholder')}
            value={search}
            onChangeText={setSearch}
            placeholderTextColor={COLORS.textMuted}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <FontAwesome5 name="times-circle" size={14} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Filtres ── */}
        <View style={styles.filtersCard}>
          {/* Période — segmented */}
          <View style={styles.segmented}>
            {DATE_PRESETS.map(p => {
              const active = datePreset === p.days;
              return (
                <TouchableOpacity
                  key={String(p.days)}
                  style={[styles.segment, active && styles.segmentActive]}
                  onPress={() => setDatePreset(p.days)}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{t(p.shortKey)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.filterDivider} />

          {/* Actions — chips avec compteurs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            <TouchableOpacity
              style={[styles.chip, actionFilter === 'tous' && styles.chipActive]}
              onPress={() => setActionFilter('tous')}
            >
              <Text style={[styles.chipLabel, actionFilter === 'tous' && { color: '#fff' }]}>{t('notifications.tab_all')}</Text>
              <View style={[styles.chipCount, actionFilter === 'tous' ? styles.chipCountActive : {}]}>
                <Text style={[styles.chipCountText, actionFilter === 'tous' && { color: COLORS.dark }]}>{logs.length}</Text>
              </View>
            </TouchableOpacity>

            {Object.entries(ACTION_META).filter(([k]) => actionCounts[k]).map(([key, m]) => {
              const active = actionFilter === key;
              const count  = actionCounts[key] ?? 0;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.chip, active && { backgroundColor: m.color, borderColor: m.color }]}
                  onPress={() => setActionFilter(key)}
                >
                  <FontAwesome5 name={m.icon} size={10} color={active ? '#fff' : m.color} solid />
                  <Text style={[styles.chipLabel, { color: active ? '#fff' : m.color }]}>{t(m.labelKey)}</Text>
                  <View style={[styles.chipCount, active ? styles.chipCountActive : { backgroundColor: m.color + '20' }]}>
                    <Text style={[styles.chipCountText, { color: active ? COLORS.dark : m.color }]}>{count}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ── Contenu ── */}
        {loading ? (
          <View style={styles.skeletonWrap}>
            {[80, 60, 80, 50, 70].map((w, i) => (
              <View key={i} style={[styles.skeletonItem, { opacity: 1 - i * 0.15 }]}>
                <View style={styles.skeletonDot} />
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={[styles.skeletonLine, { width: `${w}%` }]} />
                  <View style={[styles.skeletonLine, { width: '45%', height: 8 }]} />
                </View>
              </View>
            ))}
          </View>
        ) : sections.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyCircle}>
              <FontAwesome5 name="clipboard-list" size={36} color={COLORS.grayLight} />
            </View>
            <Text style={styles.emptyTitle}>{t('logs.noEntries')}</Text>
            <Text style={styles.emptySub}>
              {search ? t('logs.noResultsFor', { query: search }) : t('logs.noEventsFiltered')}
            </Text>
            {hasActiveFilters && (
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => { setSearch(''); setActionFilter('tous'); setDatePreset(null); }}
              >
                <Text style={styles.emptyBtnText}>{t('common.seeAll')}</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={l => String(l.id)}
            renderItem={renderItem}
            renderSectionHeader={renderSectionHeader}
            contentContainerStyle={styles.listContent}
            stickySectionHeadersEnabled={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); fetchLogs(); }}
                colors={[COLORS.primary]}
              />
            }
          />
        )}
      </View>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: '#EEF1F7' },

  /* Synthèse */
  summaryCard:       { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, marginHorizontal: 12, marginTop: 4, marginBottom: 6, borderRadius: 16, padding: 16, shadowColor: COLORS.primary, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6 },
  summaryLeft:       { alignItems: 'center', minWidth: 60 },
  summaryBig:        { fontSize: 28, fontWeight: '800', color: '#fff', lineHeight: 32 },
  summaryLabel:      { fontSize: 10, color: 'rgba(255,255,255,0.65)', fontWeight: '600', marginTop: 1 },
  summarySep:        { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 14 },
  summaryMid:        { alignItems: 'center', gap: 2, flex: 1 },
  summaryRight:      { alignItems: 'center', gap: 2, flex: 1 },
  summaryStatNum:    { fontSize: 18, fontWeight: '800', color: '#fff' },
  summaryStatLabel:  { fontSize: 10, color: 'rgba(255,255,255,0.65)', fontWeight: '600' },
  clearAllBtn:       { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },

  /* Recherche */
  searchBox:         { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', marginHorizontal: 12, marginBottom: 6, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  searchInput:       { flex: 1, fontSize: 14, color: COLORS.dark, padding: 0 },

  /* Filtres */
  filtersCard:       { backgroundColor: '#fff', marginHorizontal: 12, marginBottom: 8, borderRadius: 14, paddingVertical: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },

  segmented:         { flexDirection: 'row', marginHorizontal: 10, backgroundColor: '#EEF1F7', borderRadius: 10, padding: 3, gap: 2 },
  segment:           { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 8 },
  segmentActive:     { backgroundColor: COLORS.primary },
  segmentText:       { fontSize: 12, fontWeight: '700', color: COLORS.textMuted },
  segmentTextActive: { color: '#fff' },

  filterDivider:     { height: 1, backgroundColor: '#EEF1F7', marginVertical: 8 },

  chipsRow:          { flexDirection: 'row', gap: 6, paddingHorizontal: 10 },
  chip:              { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F5F6FA', borderWidth: 1.5, borderColor: '#E2E6EF' },
  chipActive:        { backgroundColor: COLORS.dark, borderColor: COLORS.dark },
  chipLabel:         { fontSize: 12, fontWeight: '700', color: COLORS.textMuted },
  chipCount:         { backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  chipCountActive:   { backgroundColor: '#fff' },
  chipCountText:     { fontSize: 10, fontWeight: '800', color: '#fff' },

  /* Section header */
  sectionHeader:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 14, paddingBottom: 6, gap: 8 },
  sectionDateBlock:  { minWidth: 90 },
  sectionMain:       { fontSize: 14, fontWeight: '800', color: COLORS.dark, textTransform: 'capitalize' },
  sectionSub:        { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  sectionSep:        { flex: 1, height: 1, backgroundColor: '#D8DCE6' },
  sectionCountBadge: { backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  sectionCountText:  { fontSize: 11, color: '#fff', fontWeight: '800' },

  /* Timeline */
  timelineRow:       { flexDirection: 'row', paddingHorizontal: 12, marginBottom: 2 },
  timelineCol:       { width: 28, alignItems: 'center', paddingTop: 12 },
  dot:               { width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  connector:         { width: 2, flex: 1, marginTop: 4, borderRadius: 1 },

  /* Carte */
  card:              { flex: 1, marginLeft: 8, backgroundColor: '#fff', borderRadius: 12, marginBottom: 6, borderLeftWidth: 3, padding: 11, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardRow1:          { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  avatar:            { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  avatarText:        { fontSize: 11, fontWeight: '800' },
  cardNameBlock:     { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  userName:          { fontSize: 13, fontWeight: '700', color: COLORS.dark },
  roleBadge:         { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  roleText:          { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },
  timeText:          { fontSize: 11, color: COLORS.textMuted, fontWeight: '600' },
  desc:              { fontSize: 13, color: '#4B5563', lineHeight: 18, marginBottom: 7 },
  cardRow3:          { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  actionPill:        { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  actionPillText:    { fontSize: 11, fontWeight: '700' },
  ipChip:            { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ipText:            { fontSize: 11, color: COLORS.textMuted, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },

  /* Liste */
  listContent:       { paddingBottom: 30, paddingTop: 4 },

  /* Skeleton */
  skeletonWrap:      { padding: 12, gap: 10 },
  skeletonItem:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  skeletonDot:       { width: 20, height: 20, borderRadius: 10, backgroundColor: '#D1D5DB', marginTop: 2 },
  skeletonLine:      { height: 12, borderRadius: 6, backgroundColor: '#D1D5DB' },

  /* Empty */
  empty:             { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32 },
  emptyCircle:       { width: 80, height: 80, borderRadius: 40, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginBottom: 4, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  emptyTitle:        { fontSize: 17, fontWeight: '800', color: COLORS.dark },
  emptySub:          { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },
  emptyBtn:          { marginTop: 12, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10, backgroundColor: COLORS.primary },
  emptyBtnText:      { fontSize: 13, fontWeight: '700', color: '#fff' },
});
