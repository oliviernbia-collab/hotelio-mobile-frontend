import { useEffect, useState, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { notificationApi } from '@/services/api';
import { Notification } from '@/types';
import { COLORS } from '@/constants';
import { FontAwesome5 } from '@expo/vector-icons';

/* ── Catégories de type ─────────────────────────────────────────────────── */
type TypeFilter = 'toutes' | 'commandes' | 'reservations' | 'factures';
type DateFilter = 'tout' | 'aujourd_hui' | 'semaine' | 'mois';

/* Mappe un type de notification sur une catégorie */
function getCategory(type: string): TypeFilter {
  if (/order|commande/i.test(type))       return 'commandes';
  if (/reserv|booking|checkin|checkout/i.test(type)) return 'reservations';
  if (/factur|invoice|payment|pay/i.test(type))      return 'factures';
  return 'toutes';
}

/* Retourne icône + couleur selon la catégorie */
function getVisual(type: string): { icon: string; color: string } {
  const cat = getCategory(type);
  switch (cat) {
    case 'commandes':    return { icon: 'shopping-bag', color: '#6366f1' };
    case 'reservations': return { icon: 'bed',          color: COLORS.primary };
    case 'factures':     return { icon: 'file-invoice', color: '#f59e0b' };
    default:             return { icon: 'bell',         color: COLORS.primary };
  }
}

/* Vérifie si une date ISO est dans la fenêtre choisie */
function inDateWindow(iso: string, filter: DateFilter): boolean {
  if (filter === 'tout') return true;
  const d   = new Date(iso);
  const now = new Date();
  if (filter === 'aujourd_hui') {
    return d.toDateString() === now.toDateString();
  }
  if (filter === 'semaine') {
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);
    return d >= weekAgo;
  }
  if (filter === 'mois') {
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }
  return true;
}

/* Formate une date lisible avec heure */
function formatDate(iso: string, t: (k: string) => string) {
  if (!iso) return '';
  const d = new Date(iso);
  const today     = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === today.toDateString())     return `${t('notifications.date_today')} · ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `${t('notifications.yesterday')} · ${time}`;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) + ` · ${time}`;
}

/* ══════════════════════════════════════════════════════════════════════════ */
export default function NotificationsScreen() {
  const { t } = useTranslation();

  const TYPE_TABS: { key: TypeFilter; label: string; icon: string }[] = [
    { key: 'toutes',       label: t('notifications.tab_all'),          icon: 'bell'         },
    { key: 'commandes',    label: t('notifications.tab_orders'),       icon: 'shopping-bag' },
    { key: 'reservations', label: t('notifications.tab_reservations'), icon: 'bed'          },
    { key: 'factures',     label: t('notifications.tab_invoices'),     icon: 'file-invoice' },
  ];

  const DATE_TABS: { key: DateFilter; label: string }[] = [
    { key: 'tout',         label: t('notifications.date_all')   },
    { key: 'aujourd_hui',  label: t('notifications.date_today') },
    { key: 'semaine',      label: t('notifications.date_week')  },
    { key: 'mois',         label: t('notifications.date_month') },
  ];

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread,        setUnread]        = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [typeFilter,    setTypeFilter]    = useState<TypeFilter>('toutes');
  const [dateFilter,    setDateFilter]    = useState<DateFilter>('tout');

  const load = async () => {
    try {
      const res = await notificationApi.list();
      setNotifications(res.data.data?.data ?? res.data.data ?? []);
      setUnread(res.data.unread_count ?? 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const markRead = async (id: string) => {
    try { await notificationApi.markRead(id); load(); } catch {}
  };

  const markAllRead = async () => {
    try { await notificationApi.markAllRead(); load(); } catch {}
  };

  const deleteNotif = async (id: string) => {
    try { await notificationApi.delete(id); load(); } catch {}
  };

  /* ── Filtrage local ─────────────────────────────────────────────────── */
  const displayed = useMemo(() => {
    return notifications.filter(n => {
      const catOk  = typeFilter === 'toutes' || getCategory(n.type) === typeFilter;
      const dateOk = inDateWindow(n.created_at, dateFilter);
      return catOk && dateOk;
    });
  }, [notifications, typeFilter, dateFilter]);

  /* Compteurs par catégorie pour les badges */
  const counts = useMemo(() => {
    const c: Record<TypeFilter, number> = { toutes: 0, commandes: 0, reservations: 0, factures: 0 };
    notifications.forEach(n => {
      c.toutes++;
      const cat = getCategory(n.type);
      if (cat !== 'toutes') c[cat]++;
    });
    return c;
  }, [notifications]);

  /* ── Rendu d'une notification ─────────────────────────────────────────── */
  const renderItem = ({ item }: { item: Notification }) => {
    const { icon, color } = getVisual(item.type);
    const isUnread = !item.read_at;

    return (
      <TouchableOpacity
        style={[styles.card, isUnread && styles.cardUnread]}
        onPress={() => isUnread && markRead(item.id)}
        activeOpacity={0.8}
      >
        {/* Icône catégorie */}
        <View style={[styles.iconWrap, { backgroundColor: color + '18' }]}>
          <FontAwesome5 name={icon as any} size={18} color={color} solid={isUnread} />
          {isUnread && <View style={styles.dot} />}
        </View>

        {/* Contenu */}
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.notifTitle, isUnread && { color: COLORS.dark }]} numberOfLines={2}>
            {item.data?.title ?? t('notifications.fallbackTitle')}
          </Text>
          {item.data?.body ? (
            <Text style={styles.notifBody} numberOfLines={3}>{item.data.body}</Text>
          ) : null}
          <View style={styles.metaRow}>
            <Text style={styles.notifTime}>{formatDate(item.created_at, t)}</Text>
            {isUnread && (
              <View style={styles.unreadPill}>
                <Text style={styles.unreadPillText}>{t('notifications.unread')}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Supprimer */}
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => deleteNotif(item.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <FontAwesome5 name="times" size={14} color={COLORS.grayLight} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  /* ══════════════════════════════════════════════════════════════════════════
     RENDU
  ══════════════════════════════════════════════════════════════════════════ */
  return (
    <View style={styles.container}>

      {/* ── Filtres par type ────────────────────────────────────────────── */}
      <View style={styles.typeBarWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.typeBarContent}
        >
          {TYPE_TABS.map(tab => {
            const active = typeFilter === tab.key;
            const count  = counts[tab.key];
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.typeTab, active && styles.typeTabActive]}
                onPress={() => setTypeFilter(tab.key)}
              >
                <FontAwesome5
                  name={tab.icon as any}
                  size={12}
                  color={active ? COLORS.white : COLORS.textMuted}
                />
                <Text style={[styles.typeTabText, active && styles.typeTabTextActive]}>
                  {tab.label}
                </Text>
                {count > 0 && (
                  <View style={[styles.typeCount, active && styles.typeCountActive]}>
                    <Text style={[styles.typeCountText, active && { color: COLORS.primary }]}>
                      {count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Filtres par date ────────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dateBarContent}
      >
        {DATE_TABS.map(tab => {
          const active = dateFilter === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.datePill, active && styles.datePillActive]}
              onPress={() => setDateFilter(tab.key)}
            >
              <Text style={[styles.datePillText, active && styles.datePillTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Barre "Tout marquer lu" ──────────────────────────────────────── */}
      {unread > 0 && (
        <TouchableOpacity style={styles.markAllBtn} onPress={markAllRead}>
          <FontAwesome5 name="check-double" size={13} color={COLORS.primary} />
          <Text style={styles.markAllText}>{t('notifications.markAll')} ({unread})</Text>
        </TouchableOpacity>
      )}

      {/* ── Résumé filtre actif ──────────────────────────────────────────── */}
      {(typeFilter !== 'toutes' || dateFilter !== 'tout') && (
        <View style={styles.filterSummaryBar}>
          <Text style={styles.filterSummaryText}>
            {displayed.length} {displayed.length !== 1 ? t('notifications.itemWordPlural') : t('notifications.itemWord')}
            {typeFilter !== 'toutes' ? ` · ${TYPE_TABS.find(tt => tt.key === typeFilter)?.label}` : ''}
            {dateFilter !== 'tout' ? ` · ${DATE_TABS.find(dt => dt.key === dateFilter)?.label}` : ''}
          </Text>
          <TouchableOpacity
            onPress={() => { setTypeFilter('toutes'); setDateFilter('tout'); }}
          >
            <Text style={styles.filterClearText}>{t('notifications.clear')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Liste ───────────────────────────────────────────────────────── */}
      <FlatList
        data={displayed}
        keyExtractor={n => n.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            colors={[COLORS.primary]}
          />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <FontAwesome5 name="bell-slash" size={48} color={COLORS.grayLight} />
              <Text style={styles.emptyText}>
                {typeFilter !== 'toutes' || dateFilter !== 'tout'
                  ? t('notifications.emptyFilter')
                  : t('notifications.empty')}
              </Text>
              {(typeFilter !== 'toutes' || dateFilter !== 'tout') && (
                <TouchableOpacity
                  style={styles.emptyResetBtn}
                  onPress={() => { setTypeFilter('toutes'); setDateFilter('tout'); }}
                >
                  <Text style={styles.emptyResetText}>{t('notifications.seeAll')}</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null
        }
      />
    </View>
  );
}

/* ── Styles ─────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  /* Filtres type */
  typeBarWrap:    { backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  typeBarContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  typeTab:        { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border },
  typeTabActive:  { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeTabText:    { fontSize: 13, color: COLORS.textMuted, fontWeight: '500' },
  typeTabTextActive: { color: COLORS.white, fontWeight: '700' },
  typeCount:      { backgroundColor: COLORS.border, borderRadius: 10, minWidth: 20, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  typeCountActive:{ backgroundColor: 'rgba(255,255,255,0.25)' },
  typeCountText:  { fontSize: 10, fontWeight: '700', color: COLORS.textMuted },

  /* Filtres date */
  dateBarContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  datePill:       { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border },
  datePillActive: { backgroundColor: COLORS.primary + '15', borderColor: COLORS.primary },
  datePillText:   { fontSize: 12, color: COLORS.textMuted, fontWeight: '500' },
  datePillTextActive: { color: COLORS.primary, fontWeight: '700' },

  /* Barre "Tout marquer lu" */
  markAllBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.primary + '11', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  markAllText: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },

  /* Résumé filtre */
  filterSummaryBar:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#fff7ed', borderBottomWidth: 1, borderBottomColor: '#fed7aa' },
  filterSummaryText: { fontSize: 12, color: '#9a3412', fontWeight: '500' },
  filterClearText:   { fontSize: 12, color: COLORS.primary, fontWeight: '700' },

  /* Liste */
  list: { padding: 12, paddingBottom: 30 },

  /* Carte notification */
  card:      { backgroundColor: COLORS.white, borderRadius: 13, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'flex-start', gap: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  cardUnread:{ borderLeftWidth: 3, borderLeftColor: COLORS.primary },
  iconWrap:  { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', flexShrink: 0, position: 'relative' },
  dot:       { position: 'absolute', top: 2, right: 2, width: 9, height: 9, borderRadius: 5, backgroundColor: COLORS.danger, borderWidth: 1.5, borderColor: COLORS.white },
  notifTitle:{ fontSize: 14, fontWeight: '600', color: COLORS.textMuted, lineHeight: 19 },
  notifBody: { fontSize: 13, color: COLORS.textMuted, lineHeight: 18 },
  metaRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  notifTime: { fontSize: 11, color: COLORS.grayLight },
  unreadPill:{ backgroundColor: COLORS.primary + '18', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  unreadPillText: { fontSize: 10, color: COLORS.primary, fontWeight: '700' },
  deleteBtn: { padding: 4 },

  /* Vide */
  empty:         { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText:     { fontSize: 15, color: COLORS.textMuted, textAlign: 'center' },
  emptyResetBtn: { marginTop: 4, backgroundColor: COLORS.primary + '18', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  emptyResetText:{ fontSize: 13, color: COLORS.primary, fontWeight: '700' },
});
