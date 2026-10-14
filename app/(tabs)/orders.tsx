import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Modal, TextInput,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { orderApi, menuApi, hotelApi, staffApi } from '@/services/api';
import { COLORS } from '@/constants';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { useTranslation } from 'react-i18next';
import { Order, MenuItem, Hotel } from '@/types';
import DateRangeFilter from '@/components/DateRangeFilter';

const STATUSES = ['en préparation', 'prêt', 'livré', 'annulé'];

const STATUS_COLORS: Record<string, string> = {
  'en préparation': '#f59e0b',
  'prêt':           '#3b82f6',
  'livré':          '#10b981',
  'annulé':         '#ef4444',
};

const NEXT_STATUS: Record<string, string | null> = {
  'en préparation': 'prêt',
  'prêt':           'livré',
  'livré':          null,
  'annulé':         null,
};

export default function OrdersScreen() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const isPrestataire = user?.role === 'prestataire';

  const [orders,     setOrders]     = useState<Order[]>([]);
  const [menuItems,  setMenuItems]  = useState<MenuItem[]>([]);
  const [hotels,     setHotels]     = useState<Hotel[]>([]);
  const [myHotelId,  setMyHotelId]  = useState<number | null>(null);
  const [filter,     setFilter]     = useState('');
  const [dateFrom,   setDateFrom]   = useState('');
  const [dateTo,     setDateTo]     = useState('');
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId,     setBusyId]     = useState<number | null>(null);
  const [showModal,  setShowModal]  = useState(false);
  const [newHotelId, setNewHotelId] = useState<string>('');
  const [newItemId,  setNewItemId]  = useState<string>('');
  const [newQty,     setNewQty]     = useState('1');
  const [newNotes,   setNewNotes]   = useState('');
  const [saving,     setSaving]     = useState(false);

  useEffect(() => {
    if (user?.role === 'employe') {
      staffApi.me().then((res) => setMyHotelId(res.data?.hotel_id ?? null)).catch(() => {});
    } else if (isAdmin || isPrestataire) {
      (isAdmin ? hotelApi.list() : hotelApi.mine()).then((res) => {
        const raw = res.data;
        setHotels(Array.isArray(raw) ? raw : (raw?.data ?? []));
      }).catch(() => {});
    }
  }, [user?.role]);

  const load = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (filter)   params.status = filter;
      if (dateFrom) params.from   = dateFrom;
      if (dateTo)   params.to     = dateTo;
      const res = await orderApi.list(Object.keys(params).length ? params : undefined);
      setOrders(Array.isArray(res.data) ? res.data : (res.data?.data ?? []));
    } catch (e) { console.error(e?.message || e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [filter, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setNewHotelId(hotels[0]?.id ? String(hotels[0].id) : '');
    setNewItemId('');
    setNewQty('1');
    setNewNotes('');
    setShowModal(true);
    const hid = user?.role === 'employe' ? myHotelId : (hotels[0]?.id ?? null);
    if (hid) {
      menuApi.list({ hotel_id: hid, available: true }).then((res) => setMenuItems(res.data)).catch(() => {});
    }
  };

  const handleHotelPick = (id: number) => {
    setNewHotelId(String(id));
    setNewItemId('');
    menuApi.list({ hotel_id: id, available: true }).then((res) => setMenuItems(res.data)).catch(() => {});
  };

  const selectedItem = menuItems.find((m) => String(m.id) === newItemId);
  const estimatedTotal = selectedItem ? selectedItem.price * (Number(newQty) || 1) : 0;

  const handleCreate = async () => {
    const hotelId = user?.role === 'employe' ? myHotelId : Number(newHotelId);
    if (!hotelId || !newItemId) {
      Alert.alert(t('common.required'), t('restaurantOrders.selectMenuItem'));
      return;
    }
    setSaving(true);
    try {
      await orderApi.create({
        hotel_id: hotelId,
        menu_item_id: Number(newItemId),
        quantity: Number(newQty) || 1,
        notes: newNotes.trim() || undefined,
      });
      setShowModal(false);
      load();
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.response?.data?.message ?? t('auth.genericError'));
    } finally {
      setSaving(false);
    }
  };

  const handleAdvance = async (order: Order) => {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    setBusyId(order.id);
    try {
      await orderApi.update(order.id, { status: next });
      load();
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.response?.data?.message ?? t('common.error'));
    } finally { setBusyId(null); }
  };

  const handleCancel = (order: Order) => {
    Alert.alert(t('restaurantOrders.cancelTitle'), t('restaurantOrders.cancelMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.ok'), style: 'destructive',
        onPress: async () => {
          try { await orderApi.update(order.id, { status: 'annulé' }); load(); }
          catch { Alert.alert(t('common.error'), t('common.error')); }
        },
      },
    ]);
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        <TouchableOpacity style={[styles.filterPill, !filter && styles.filterPillActive]} onPress={() => setFilter('')}>
          <Text style={[styles.filterPillText, !filter && styles.filterPillTextActive]}>{t('hotels.tab_all')}</Text>
        </TouchableOpacity>
        {STATUSES.map((s) => (
          <TouchableOpacity key={s} style={[styles.filterPill, filter === s && styles.filterPillActive]} onPress={() => setFilter(filter === s ? '' : s)}>
            <Text style={[styles.filterPillText, filter === s && styles.filterPillTextActive]}>{t(`restaurantOrders.status_${s}`)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <DateRangeFilter
        from={dateFrom}
        to={dateTo}
        onChange={(f, tDate) => { setDateFrom(f); setDateTo(tDate); }}
      />

      <FlatList
        data={orders}
        keyExtractor={(o) => `order-${o.id}`}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[COLORS.primary]} />}
        renderItem={({ item }) => {
          const color = STATUS_COLORS[item.status] ?? COLORS.textMuted;
          const next = NEXT_STATUS[item.status];
          return (
            <View style={styles.card}>
              <Text style={styles.emoji}>{item.menu_item?.emoji ?? '🍽'}</Text>
              <View style={styles.cardBody}>
                <View style={styles.cardRow}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.quantity}× {item.menu_item?.name ?? t('restaurantOrders.itemFallback')}
                  </Text>
                  <Text style={styles.cardAmount}>{Number(item.total).toLocaleString()} FCFA</Text>
                </View>
                {item.client ? (
                  <Text style={styles.cardSub}>{item.client.first_name} {item.client.last_name}</Text>
                ) : null}
                {item.notes ? <Text style={styles.cardNote}>{item.notes}</Text> : null}
                <View style={styles.cardFooterRow}>
                  <View style={[styles.badge, { backgroundColor: color + '20' }]}>
                    <Text style={[styles.badgeText, { color }]}>{t(`restaurantOrders.status_${item.status}`)}</Text>
                  </View>
                  {next && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: STATUS_COLORS[next] + '20' }]}
                      onPress={() => handleAdvance(item)}
                      disabled={busyId === item.id}
                    >
                      <Text style={[styles.actionText, { color: STATUS_COLORS[next] }]}>→ {t(`restaurantOrders.status_${next}`)}</Text>
                    </TouchableOpacity>
                  )}
                  {item.status !== 'annulé' && item.status !== 'livré' && (
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#fef2f2' }]} onPress={() => handleCancel(item)}>
                      <FontAwesome5 name="times" size={11} color={COLORS.danger} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <FontAwesome5 name="utensils" size={40} color={COLORS.grayLight} />
            <Text style={styles.emptyText}>{t('restaurantOrders.noOrders')}</Text>
          </View>
        }
      />

      <TouchableOpacity style={styles.fab} onPress={openCreate} activeOpacity={0.85}>
        <FontAwesome5 name="plus" size={18} color={COLORS.white} />
      </TouchableOpacity>

      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('restaurantOrders.newOrder')}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <FontAwesome5 name="times" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
              {(isAdmin || isPrestataire) && hotels.length > 0 && (
                <>
                  <Text style={styles.label}>{t('expenses.hotelLabel')}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
                    {hotels.map((h) => (
                      <TouchableOpacity
                        key={h.id}
                        style={[styles.pill, newHotelId === String(h.id) && styles.pillActive]}
                        onPress={() => handleHotelPick(h.id)}
                      >
                        <Text style={[styles.pillText, newHotelId === String(h.id) && styles.pillTextActive]}>{h.short_name ?? h.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}

              <Text style={styles.label}>{t('restaurantOrders.selectMenuItem')}</Text>
              {menuItems.length === 0 ? (
                <Text style={styles.noHotelHint}>{t('restaurantOrders.noMenuItems')}</Text>
              ) : (
                <View style={styles.typeGrid}>
                  {menuItems.map((m) => (
                    <TouchableOpacity
                      key={m.id}
                      style={[styles.typeChip, newItemId === String(m.id) && { backgroundColor: COLORS.primary + '20', borderColor: COLORS.primary }]}
                      onPress={() => setNewItemId(String(m.id))}
                    >
                      <Text style={styles.typeChipText}>{m.emoji ?? '🍽'} {m.name} — {m.price.toLocaleString()} FCFA</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={styles.label}>{t('restaurantOrders.quantity')}</Text>
              <View style={styles.qtyRow}>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => setNewQty(String(Math.max(1, (Number(newQty) || 1) - 1)))}>
                  <FontAwesome5 name="minus" size={12} color={COLORS.primary} />
                </TouchableOpacity>
                <TextInput
                  style={styles.qtyInput}
                  value={newQty}
                  onChangeText={(v) => setNewQty(v.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  textAlign="center"
                />
                <TouchableOpacity style={styles.qtyBtn} onPress={() => setNewQty(String((Number(newQty) || 1) + 1))}>
                  <FontAwesome5 name="plus" size={12} color={COLORS.primary} />
                </TouchableOpacity>
              </View>

              {selectedItem && (
                <Text style={styles.totalHint}>{t('restaurantOrders.estimatedTotal')}: {estimatedTotal.toLocaleString()} FCFA</Text>
              )}

              <Text style={styles.label}>{t('restaurantOrders.notes')}</Text>
              <TextInput
                style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
                value={newNotes}
                onChangeText={setNewNotes}
                placeholder={t('expenses.notesPlaceholder')}
                placeholderTextColor={COLORS.grayLight}
                multiline
              />

              <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleCreate} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color={COLORS.white} /> : <Text style={styles.saveBtnText}>{t('common.save')}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  filterRow: { paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  filterPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border },
  filterPillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterPillText: { fontSize: 12, color: COLORS.textMuted, fontWeight: '500' },
  filterPillTextActive: { color: COLORS.white, fontWeight: '700' },
  list: { padding: 12, paddingTop: 4, paddingBottom: 90 },
  card: { backgroundColor: COLORS.white, borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', gap: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4 },
  emoji: { fontSize: 28, width: 40, textAlign: 'center' },
  cardBody: { flex: 1, gap: 4 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: COLORS.dark, flex: 1 },
  cardAmount: { fontSize: 14, fontWeight: '800', color: COLORS.dark },
  cardSub: { fontSize: 12, color: COLORS.textMuted },
  cardNote: { fontSize: 12, color: COLORS.textMuted, fontStyle: 'italic' },
  cardFooterRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4, alignItems: 'center' },
  badge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  actionBtn: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  actionText: { fontSize: 11, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, color: COLORS.textMuted },
  fab: { position: 'absolute', right: 20, bottom: 28, width: 54, height: 54, borderRadius: 27, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: COLORS.primary, shadowOpacity: 0.4, shadowRadius: 8 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: { backgroundColor: COLORS.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '92%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle: { fontSize: 16, fontWeight: '700', color: COLORS.dark },
  modalBody: { padding: 18, gap: 4, paddingBottom: 40 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginTop: 12, marginBottom: 4 },
  input: { backgroundColor: COLORS.background, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border },
  noHotelHint: { fontSize: 13, color: COLORS.textMuted, fontStyle: 'italic', marginBottom: 4 },
  pillRow: { marginBottom: 4 },
  pill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border, marginRight: 8 },
  pillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pillText: { fontSize: 13, color: COLORS.textMuted },
  pillTextActive: { color: COLORS.white, fontWeight: '600' },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border },
  typeChipText: { fontSize: 12, color: COLORS.textMuted },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qtyBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border, justifyContent: 'center', alignItems: 'center' },
  qtyInput: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingVertical: 10, fontSize: 16, fontWeight: '700', color: COLORS.dark, backgroundColor: COLORS.white },
  totalHint: { fontSize: 13, fontWeight: '700', color: COLORS.primary, marginTop: 10 },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 18 },
  saveBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
});
