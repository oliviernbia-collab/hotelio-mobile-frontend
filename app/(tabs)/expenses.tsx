import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Modal, TextInput,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { expenseApi, hotelApi, reservationApi, boutiqueApi } from '@/services/api';
import { COLORS } from '@/constants';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { Reservation } from '@/types';
import { useTranslation } from 'react-i18next';

/* ── Types ─────────────────────────────────────────────────────────────────── */
interface Expense {
  id:           number;
  hotel_id:     number;
  hotel_name?:  string;
  description:  string;
  amount:       number | string;
  expense_type?: string;
  occurred_at:  string;
  notes?:       string;
}

interface Hotel { id: number; name: string; short_name?: string; }

interface BoutiqueOrder {
  id:             number;
  statut:         string;
  total:          number | string;
  mode_paiement?: string;
  nb_items:       number;
  created_at:     string;
}

/* ── Constants ─────────────────────────────────────────────────────────────── */
const EXPENSE_TYPES = [
  { value: 'maintenance',     icon: 'tools'        },
  { value: 'salaires',        icon: 'user-friends' },
  { value: 'electricite_eau', icon: 'bolt'         },
  { value: 'fournitures',     icon: 'boxes'        },
  { value: 'marketing',       icon: 'bullhorn'     },
  { value: 'alimentaire',     icon: 'utensils'     },
  { value: 'autre',           icon: 'ellipsis-h'   },
];

const TYPE_COLORS: Record<string, string> = {
  maintenance:     '#f59e0b',
  salaires:        '#6366f1',
  electricite_eau: '#3b82f6',
  fournitures:     '#10b981',
  marketing:       '#ec4899',
  alimentaire:     '#ef4444',
  autre:           '#8b5cf6',
};

const RESV_STATUS_COLORS: Record<string, string> = {
  en_attente: '#F39C12',
  confirmée:  '#2ECC71',
  annulée:    '#E74C3C',
  terminée:   '#95A5A6',
};

const ORDER_STATUS_COLORS: Record<string, string> = {
  confirmée:        '#10b981',
  annulée:          '#E74C3C',
  en_cours:         '#f59e0b',
  livrée:           '#6366f1',
  'en préparation': '#f59e0b',
};

const EMPTY_FORM = {
  hotel_id:     '',
  description:  '',
  amount:       '',
  expense_type: 'autre',
  occurred_at:  new Date().toISOString().split('T')[0],
  notes:        '',
};

/* ── Helpers ────────────────────────────────────────────────────────────────── */
const typeIcon  = (t?: string) => (EXPENSE_TYPES.find(x => x.value === t)?.icon  ?? 'receipt') as any;
const typeColor = (t?: string) =>  TYPE_COLORS[t ?? ''] ?? COLORS.textMuted;

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function ExpensesScreen() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const isClient = user?.role === 'client';
  const isAdmin  = user?.role === 'admin';

  /* ── Admin / Prestataire states ─────────────────────────────────────────── */
  const [expenses,    setExpenses]    = useState<Expense[]>([]);
  const [hotels,      setHotels]      = useState<Hotel[]>([]);
  const [showModal,   setShowModal]   = useState(false);
  const [editItem,    setEditItem]    = useState<Expense | null>(null);
  const [form,        setForm]        = useState({ ...EMPTY_FORM });
  const [saving,      setSaving]      = useState(false);
  const [filterType,  setFilterType]  = useState('');

  /* ── Client states ──────────────────────────────────────────────────────── */
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [achats,       setAchats]       = useState<BoutiqueOrder[]>([]);
  const [tab,          setTab]          = useState<'reservations' | 'achats'>('reservations');

  /* ── Shared ─────────────────────────────────────────────────────────────── */
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      if (isClient) {
        const [resRes, ordersRes] = await Promise.all([
          reservationApi.mine(),
          boutiqueApi.myOrders(),
        ]);
        setReservations(resRes.data.data ?? resRes.data ?? []);
        const raw = ordersRes.data;
        setAchats(Array.isArray(raw) ? raw : (raw.data ?? []));
      } else {
        const [expRes, hotRes] = await Promise.all([
          expenseApi.list(filterType ? { expense_type: filterType } : undefined),
          isAdmin ? hotelApi.list() : hotelApi.mine(),
        ]);
        setExpenses(Array.isArray(expRes.data) ? expRes.data : (expRes.data?.data ?? []));
        const hotRaw = hotRes.data;
        setHotels(Array.isArray(hotRaw) ? hotRaw : (hotRaw?.data ?? hotRaw?.hotels ?? []));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isClient, isAdmin, filterType]);

  useEffect(() => { load(); }, [load]);

  /* ── Totals ─────────────────────────────────────────────────────────────── */
  const totalExpenses = useMemo(
    () => expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0),
    [expenses],
  );
  const totalResv = useMemo(
    () => reservations.reduce((s, r) => {
      const t = Number(r.total) || (Number((r as any).price || 0) * Number((r as any).nights || 0));
      return s + t;
    }, 0),
    [reservations],
  );
  const totalAchats = useMemo(
    () => achats.reduce((s, o) => s + (Number(o.total) || 0), 0),
    [achats],
  );

  /* ── CRUD handlers ──────────────────────────────────────────────────────── */
  const openCreate = () => {
    setEditItem(null);
    setForm({ ...EMPTY_FORM, hotel_id: hotels[0]?.id?.toString() ?? '' });
    setShowModal(true);
  };

  const openEdit = (item: Expense) => {
    setEditItem(item);
    setForm({
      hotel_id:     String(item.hotel_id),
      description:  item.description,
      amount:       String(item.amount),
      expense_type: item.expense_type ?? 'autre',
      occurred_at:  (item.occurred_at ?? '').split('T')[0] || new Date().toISOString().split('T')[0],
      notes:        item.notes ?? '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.description.trim() || !form.amount || !form.hotel_id) {
      Alert.alert(t('common.required'), t('expenses.requiredMsg'));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        hotel_id:     Number(form.hotel_id),
        description:  form.description.trim(),
        amount:       Number(form.amount),
        expense_type: form.expense_type,
        occurred_at:  form.occurred_at,
        notes:        form.notes.trim() || undefined,
      };
      if (editItem) {
        await expenseApi.update(editItem.id, payload);
      } else {
        await expenseApi.create(payload);
      }
      setShowModal(false);
      load();
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.response?.data?.message ?? t('auth.genericError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item: Expense) => {
    Alert.alert(t('expenses.deleteTitle'), t('expenses.deleteMsg', { description: item.description }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'), style: 'destructive',
        onPress: async () => {
          try {
            await expenseApi.delete(item.id);
            load();
          } catch {
            Alert.alert(t('common.error'), t('expenses.cannotDelete'));
          }
        },
      },
    ]);
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  /* ══════════════════════════════════════════════════════════════════════════
     CLIENT VIEW
  ══════════════════════════════════════════════════════════════════════════ */
  if (isClient) {
    return (
      <View style={styles.container}>
        {/* Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>{t('dashboard.totalSpent')}</Text>
          <Text style={styles.summaryGrand}>{(totalResv + totalAchats).toLocaleString()} FCFA</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <FontAwesome5 name="bed" size={13} color="rgba(255,255,255,0.75)" />
              <Text style={styles.summaryLabel}>{t('dashboard.reservations')}</Text>
              <Text style={styles.summaryValue}>{totalResv.toLocaleString()} FCFA</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <FontAwesome5 name="shopping-bag" size={13} color="rgba(255,255,255,0.75)" />
              <Text style={styles.summaryLabel}>{t('dashboard.action_orders')}</Text>
              <Text style={styles.summaryValue}>{totalAchats.toLocaleString()} FCFA</Text>
            </View>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          {(['reservations', 'achats'] as const).map((tabKey) => (
            <TouchableOpacity
              key={tabKey}
              style={[styles.tab, tab === tabKey && styles.tabActive]}
              onPress={() => setTab(tabKey)}
            >
              <FontAwesome5
                name={tabKey === 'reservations' ? 'bed' : 'shopping-bag'}
                size={13}
                color={tab === tabKey ? COLORS.primary : COLORS.textMuted}
              />
              <Text style={[styles.tabText, tab === tabKey && styles.tabTextActive]}>
                {tabKey === 'reservations'
                  ? t('expenses.reservationsCount', { count: reservations.length })
                  : t('expenses.ordersCount', { count: achats.length })}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* List */}
        <FlatList
          data={tab === 'reservations' ? (reservations as any[]) : (achats as any[])}
          keyExtractor={(x) => `${tab}-${x.id}`}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              colors={[COLORS.primary]}
            />
          }
          renderItem={tab === 'reservations'
            ? ({ item }) => {
                const sc  = RESV_STATUS_COLORS[item.status] ?? COLORS.textMuted;
                const amt = Number(item.total) || (Number(item.price || 0) * Number(item.nights || 0));
                return (
                  <View style={styles.card}>
                    <View style={[styles.iconWrap, { backgroundColor: sc + '20' }]}>
                      <FontAwesome5 name="bed" size={16} color={sc} />
                    </View>
                    <View style={styles.cardBody}>
                      <View style={styles.cardRow}>
                        <Text style={styles.cardTitle} numberOfLines={1}>
                          {item.hotel_name ?? t('expenses.hotelFallback', { id: item.hotel_id })}
                        </Text>
                        <Text style={styles.cardAmount}>{amt.toLocaleString()} FCFA</Text>
                      </View>
                      <Text style={styles.cardSub}>
                        {item.checkin?.split('T')[0]} → {item.checkout?.split('T')[0]}
                        {item.nights ? `  ·  ${item.nights === 1 ? t('common.night_count', { count: item.nights }) : t('common.nights_count', { count: item.nights })}` : ''}
                      </Text>
                      <View style={styles.cardFooterRow}>
                        <View style={[styles.badge, { backgroundColor: sc + '20' }]}>
                          <Text style={[styles.badgeText, { color: sc }]}>{item.status}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              }
            : ({ item }) => {
                const sc = ORDER_STATUS_COLORS[item.statut] ?? COLORS.textMuted;
                return (
                  <View style={styles.card}>
                    <View style={[styles.iconWrap, { backgroundColor: sc + '20' }]}>
                      <FontAwesome5 name="shopping-bag" size={16} color={sc} />
                    </View>
                    <View style={styles.cardBody}>
                      <View style={styles.cardRow}>
                        <Text style={styles.cardTitle}>{t('expenses.orderFallback', { id: item.id })}</Text>
                        <Text style={styles.cardAmount}>{Number(item.total || 0).toLocaleString()} FCFA</Text>
                      </View>
                      <Text style={styles.cardSub}>
                        {item.nb_items} {item.nb_items > 1 ? t('expenses.articles') : t('expenses.article')}
                        {item.created_at
                          ? `  ·  ${new Date(item.created_at).toLocaleDateString('fr-FR')}`
                          : ''}
                      </Text>
                      <View style={styles.cardFooterRow}>
                        <View style={[styles.badge, { backgroundColor: sc + '20' }]}>
                          <Text style={[styles.badgeText, { color: sc }]}>{item.statut}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              }
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <FontAwesome5
                name={tab === 'reservations' ? 'bed' : 'shopping-bag'}
                size={40}
                color={COLORS.grayLight}
              />
              <Text style={styles.emptyText}>
                {tab === 'reservations' ? t('reservations.noReservations') : t('expenses.noOrders')}
              </Text>
            </View>
          }
        />
      </View>
    );
  }

  /* ══════════════════════════════════════════════════════════════════════════
     ADMIN / PRESTATAIRE VIEW
  ══════════════════════════════════════════════════════════════════════════ */
  return (
    <View style={styles.container}>
      {/* Summary */}
      <View style={[styles.summaryCard, { backgroundColor: '#c0392b' }]}>
        <Text style={styles.summaryTitle}>{t('expenses.totalExpenses')}</Text>
        <Text style={styles.summaryGrand}>{totalExpenses.toLocaleString()} FCFA</Text>
        <Text style={[styles.summaryLabel, { textAlign: 'center', marginTop: 4 }]}>
          {expenses.length} {expenses.length !== 1 ? t('expenses.expenseWordPlural') : t('expenses.expenseWord')}
          {filterType ? ` · ${t(`expenses.type_${filterType}`)}` : ''}
        </Text>
      </View>

      {/* Filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        <TouchableOpacity
          style={[styles.filterPill, !filterType && styles.filterPillActive]}
          onPress={() => setFilterType('')}
        >
          <Text style={[styles.filterPillText, !filterType && styles.filterPillTextActive]}>{t('expenses.filterAll')}</Text>
        </TouchableOpacity>
        {EXPENSE_TYPES.map((et) => (
          <TouchableOpacity
            key={et.value}
            style={[styles.filterPill, filterType === et.value && styles.filterPillActive]}
            onPress={() => setFilterType(filterType === et.value ? '' : et.value)}
          >
            <Text style={[styles.filterPillText, filterType === et.value && styles.filterPillTextActive]}>
              {t(`expenses.type_${et.value}`)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Expense list */}
      <FlatList
        data={expenses}
        keyExtractor={(e) => `exp-${e.id}`}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            colors={[COLORS.primary]}
          />
        }
        renderItem={({ item }) => {
          const color = typeColor(item.expense_type);
          return (
            <View style={styles.card}>
              <View style={[styles.iconWrap, { backgroundColor: color + '20' }]}>
                <FontAwesome5 name={typeIcon(item.expense_type)} size={16} color={color} />
              </View>
              <View style={styles.cardBody}>
                <View style={styles.cardRow}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{item.description}</Text>
                  <Text style={[styles.cardAmount, { color: '#c0392b' }]}>
                    {Number(item.amount).toLocaleString()} FCFA
                  </Text>
                </View>
                <Text style={styles.cardSub}>
                  {item.hotel_name ?? t('expenses.hotelFallback', { id: item.hotel_id })}
                  {item.occurred_at
                    ? `  ·  ${new Date(item.occurred_at).toLocaleDateString('fr-FR')}`
                    : ''}
                </Text>
                {item.notes ? <Text style={styles.cardNote}>{item.notes}</Text> : null}
                <View style={styles.cardFooterRow}>
                  <View style={[styles.badge, { backgroundColor: color + '20' }]}>
                    <Text style={[styles.badgeText, { color }]}>{t(`expenses.type_${item.expense_type ?? 'autre'}`)}</Text>
                  </View>
                  <TouchableOpacity onPress={() => openEdit(item)} style={styles.actionBtn}>
                    <FontAwesome5 name="pen" size={11} color={COLORS.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDelete(item)}
                    style={[styles.actionBtn, { backgroundColor: '#fef2f2' }]}
                  >
                    <FontAwesome5 name="trash" size={11} color={COLORS.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <FontAwesome5 name="receipt" size={40} color={COLORS.grayLight} />
            <Text style={styles.emptyText}>{t('expenses.noExpenses')}</Text>
            <Text style={styles.emptyHint}>{t('expenses.addHint')}</Text>
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={openCreate} activeOpacity={0.85}>
        <FontAwesome5 name="plus" size={18} color={COLORS.white} />
      </TouchableOpacity>

      {/* ── Modal create / edit ──────────────────────────────────────────────── */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editItem ? t('expenses.modalTitleEdit') : t('expenses.modalTitleNew')}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <FontAwesome5 name="times" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.modalBody}
              showsVerticalScrollIndicator={false}
            >
              {/* Hôtel selector */}
              <Text style={styles.label}>{t('expenses.hotelLabel')}</Text>
              {hotels.length === 0 ? (
                <Text style={styles.noHotelHint}>{t('hotels.noResults')}</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
                  {hotels.map((h) => (
                    <TouchableOpacity
                      key={h.id}
                      style={[styles.pill, form.hotel_id === String(h.id) && styles.pillActive]}
                      onPress={() => setForm((f) => ({ ...f, hotel_id: String(h.id) }))}
                    >
                      <Text
                        style={[
                          styles.pillText,
                          form.hotel_id === String(h.id) && styles.pillTextActive,
                        ]}
                      >
                        {h.short_name ?? h.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {/* Description */}
              <Text style={styles.label}>{t('expenses.descriptionLabel')}</Text>
              <TextInput
                style={styles.input}
                value={form.description}
                onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
                placeholder={t('expenses.descriptionPlaceholder')}
                placeholderTextColor={COLORS.grayLight}
              />

              {/* Montant */}
              <Text style={styles.label}>{t('expenses.amountLabel')}</Text>
              <TextInput
                style={styles.input}
                value={form.amount}
                onChangeText={(v) => setForm((f) => ({ ...f, amount: v.replace(/[^0-9.]/g, '') }))}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={COLORS.grayLight}
              />

              {/* Catégorie */}
              <Text style={styles.label}>{t('hotels.categoryLabel')}</Text>
              <View style={styles.typeGrid}>
                {EXPENSE_TYPES.map((et) => {
                  const active = form.expense_type === et.value;
                  const col    = TYPE_COLORS[et.value] ?? COLORS.primary;
                  return (
                    <TouchableOpacity
                      key={et.value}
                      style={[
                        styles.typeChip,
                        active && { backgroundColor: col + '20', borderColor: col },
                      ]}
                      onPress={() => setForm((f) => ({ ...f, expense_type: et.value }))}
                    >
                      <FontAwesome5
                        name={et.icon as any}
                        size={12}
                        color={active ? col : COLORS.textMuted}
                      />
                      <Text style={[styles.typeChipText, active && { color: col, fontWeight: '700' }]}>
                        {t(`expenses.type_${et.value}`)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Date */}
              <Text style={styles.label}>{t('expenses.dateLabel')}</Text>
              <TextInput
                style={styles.input}
                value={form.occurred_at}
                onChangeText={(v) => setForm((f) => ({ ...f, occurred_at: v }))}
                placeholder={new Date().toISOString().split('T')[0]}
                placeholderTextColor={COLORS.grayLight}
              />

              {/* Notes */}
              <Text style={styles.label}>{t('expenses.notesLabel')}</Text>
              <TextInput
                style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
                value={form.notes}
                onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))}
                placeholder={t('expenses.notesPlaceholder')}
                placeholderTextColor={COLORS.grayLight}
                multiline
              />

              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator size="small" color={COLORS.white} />
                  : <Text style={styles.saveBtnText}>{editItem ? t('expenses.updateBtn') : t('common.save')}</Text>
                }
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

/* ── Styles ─────────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.background },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center' },

  /* Summary card */
  summaryCard:    { backgroundColor: COLORS.primary, margin: 12, borderRadius: 16, padding: 18 },
  summaryTitle:   { color: 'rgba(255,255,255,0.7)', fontSize: 13, textAlign: 'center' },
  summaryGrand:   { color: COLORS.white, fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginVertical: 6 },
  summaryRow:     { flexDirection: 'row', marginTop: 10 },
  summaryItem:    { flex: 1, alignItems: 'center', gap: 3 },
  summaryDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.25)', marginVertical: 4 },
  summaryLabel:   { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 },
  summaryValue:   { color: COLORS.white, fontSize: 13, fontWeight: '700' },

  /* Client tabs */
  tabs:          { flexDirection: 'row', marginHorizontal: 12, marginBottom: 4, backgroundColor: COLORS.white, borderRadius: 12, padding: 4, elevation: 1 },
  tab:           { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 10 },
  tabActive:     { backgroundColor: COLORS.primary + '15' },
  tabText:       { fontSize: 13, color: COLORS.textMuted, fontWeight: '500' },
  tabTextActive: { color: COLORS.primary, fontWeight: '700' },

  /* Filter pills */
  filterRow:        { paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  filterPill:       { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border },
  filterPillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterPillText:   { fontSize: 12, color: COLORS.textMuted, fontWeight: '500' },
  filterPillTextActive: { color: COLORS.white, fontWeight: '700' },

  /* List */
  list: { padding: 12, paddingTop: 4, paddingBottom: 90 },

  /* Card */
  card:          { backgroundColor: COLORS.white, borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', gap: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4 },
  iconWrap:      { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  cardBody:      { flex: 1, gap: 4 },
  cardRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  cardTitle:     { fontSize: 14, fontWeight: '700', color: COLORS.dark, flex: 1 },
  cardAmount:    { fontSize: 15, fontWeight: '800', color: COLORS.danger, flexShrink: 0 },
  cardSub:       { fontSize: 12, color: COLORS.textMuted },
  cardNote:      { fontSize: 12, color: COLORS.textMuted, fontStyle: 'italic' },
  cardFooterRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 2, alignItems: 'center' },

  badge:         { flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:     { fontSize: 11, fontWeight: '600' },
  actionBtn:     { backgroundColor: '#eff6ff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },

  /* Empty */
  empty:         { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText:     { fontSize: 15, color: COLORS.textMuted },
  emptyHint:     { fontSize: 13, color: COLORS.grayLight },

  /* FAB */
  fab: { position: 'absolute', right: 20, bottom: 28, width: 54, height: 54, borderRadius: 27, backgroundColor: '#c0392b', justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#c0392b', shadowOpacity: 0.4, shadowRadius: 8 },

  /* Modal */
  modalOverlay:  { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet:    { backgroundColor: COLORS.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '92%' },
  modalHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle:    { fontSize: 16, fontWeight: '700', color: COLORS.dark },
  modalBody:     { padding: 18, gap: 4, paddingBottom: 40 },

  /* Form */
  label:         { fontSize: 13, fontWeight: '600', color: COLORS.text, marginTop: 12, marginBottom: 4 },
  input:         { backgroundColor: COLORS.background, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border },
  noHotelHint:   { fontSize: 13, color: COLORS.textMuted, fontStyle: 'italic', marginBottom: 4 },
  pillRow:       { marginBottom: 4 },
  pill:          { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border, marginRight: 8 },
  pillActive:    { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pillText:      { fontSize: 13, color: COLORS.textMuted },
  pillTextActive:{ color: COLORS.white, fontWeight: '600' },
  typeGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  typeChip:      { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border },
  typeChipText:  { fontSize: 12, color: COLORS.textMuted },
  saveBtn:       { backgroundColor: '#c0392b', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 18 },
  saveBtnText:   { color: COLORS.white, fontSize: 15, fontWeight: '700' },
});
