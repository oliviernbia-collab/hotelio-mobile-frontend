import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, Alert,
  RefreshControl, Modal, ScrollView, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { roomApi, hotelApi } from '@/services/api';
import { Room, Hotel } from '@/types';
import { COLORS, ROOM_STATUS_COLORS } from '@/constants';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { useTranslation } from 'react-i18next';

const STATUSES   = ['tous', 'disponible', 'occupée', 'en_nettoyage', 'réservée', 'hors_service'];
const ROOM_TYPES = ['Simple', 'Double', 'Twin', 'Suite', 'Deluxe', 'Familiale', 'Présidentielle'];

const ROOM_STATUS_KEYS: Record<string, string> = {
  disponible:   'rooms.status_disponible',
  occupée:      'rooms.status_occupée',
  réservée:     'rooms.status_réservée',
  en_nettoyage: 'rooms.status_en_nettoyage',
  hors_service: 'rooms.status_hors_service',
};

const ROOM_TYPE_KEYS: Record<string, string> = {
  Simple: 'rooms.type_Simple', Double: 'rooms.type_Double', Twin: 'rooms.type_Twin',
  Suite: 'rooms.type_Suite', Deluxe: 'rooms.type_Deluxe', Familiale: 'rooms.type_Familiale',
  Présidentielle: 'rooms.type_Présidentielle',
};

const ROOM_STATUSES: { value: string; labelKey: string }[] = [
  { value: 'disponible',   labelKey: 'rooms.status_disponible'   },
  { value: 'occupée',      labelKey: 'rooms.status_occupée'      },
  { value: 'réservée',     labelKey: 'rooms.status_réservée'     },
  { value: 'en_nettoyage', labelKey: 'rooms.status_en_nettoyage' },
  { value: 'hors_service', labelKey: 'rooms.status_hors_service' },
];

const EMPTY_FORM = {
  hotel_id:    '' as string | number,
  number:      '',
  type:        'Double',
  floor:       '1',
  capacity:    '2',
  price:       '',
  vue:         '',
  description: '',
  status:      'disponible',
};

export default function RoomsScreen() {
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const isManager = user?.role === 'admin' || user?.role === 'prestataire';

  const [rooms,      setRooms]      = useState<Room[]>([]);
  const [hotels,     setHotels]     = useState<Hotel[]>([]);
  const [filter,     setFilter]     = useState('tous');
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal,  setShowModal]  = useState(false);
  const [editing,    setEditing]    = useState<Room | null>(null);
  const [saving,     setSaving]     = useState(false);
  const [form,       setForm]       = useState({ ...EMPTY_FORM });
  const [showTypes,  setShowTypes]  = useState(false);

  const loadData = async () => {
    try {
      const params = filter !== 'tous' ? { status: filter } : {};
      // Prestataire : uniquement les chambres de ses hôtels
      const roomsRes = user?.role === 'prestataire'
        ? await roomApi.mine(params)
        : await roomApi.list(params);
      setRooms(roomsRes.data);
      if (isManager) {
        const hotelsRes = user?.role === 'prestataire'
          ? await hotelApi.mine()
          : await hotelApi.list();
        const list = Array.isArray(hotelsRes.data) ? hotelsRes.data : (hotelsRes.data?.data ?? []);
        setHotels(list);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, [filter]);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, hotel_id: hotels[0]?.id ?? '' });
    setEditing(null);
    setShowModal(true);
  };

  const openEdit = (r: Room) => {
    setForm({
      hotel_id:    r.hotel_id,
      number:      r.number ?? '',
      type:        r.type ?? 'Double',
      floor:       String(r.floor ?? 1),
      capacity:    String(r.capacity ?? 2),
      price:       r.price ? String(r.price) : '',
      vue:         (r as any).vue ?? '',
      description: r.description ?? '',
      status:      r.status ?? 'disponible',
    });
    setEditing(r);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.hotel_id) { Alert.alert(t('common.required'), t('rooms.selectHotelMsg')); return; }
    if (!form.number.trim()) { Alert.alert(t('common.required'), t('rooms.numberRequiredMsg')); return; }
    setSaving(true);
    try {
      const payload = {
        hotel_id:    Number(form.hotel_id),
        number:      form.number.trim(),
        type:        form.type,
        floor:       Number(form.floor) || 1,
        capacity:    Number(form.capacity) || 1,
        price:       form.price ? Number(form.price) : 0,
        vue:         form.vue.trim() || undefined,
        description: form.description.trim() || undefined,
        status:      form.status,
      };
      if (editing) {
        await roomApi.update(editing.id, payload);
      } else {
        await roomApi.create(payload);
      }
      setShowModal(false);
      loadData();
    } catch (e: any) {
      Alert.alert(t('common.error'), e.response?.data?.message ?? t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (r: Room) => {
    Alert.alert(
      t('common.delete'),
      t('rooms.deleteMsg', { number: r.number }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'), style: 'destructive',
          onPress: async () => {
            try {
              await roomApi.delete(r.id);
              loadData();
            } catch (e: any) {
              Alert.alert(t('common.error'), e.response?.data?.message ?? t('common.error'));
            }
          },
        },
      ]
    );
  };

  const changeStatus = async (room: Room, status: string) => {
    try {
      await roomApi.updateStatus(room.id, status);
      loadData();
    } catch (e: any) {
      Alert.alert(t('common.error'), e.response?.data?.message ?? t('common.error'));
    }
  };

  const markCleaned = async (room: Room) => {
    try { await roomApi.markCleaned(room.id); loadData(); } catch {}
  };

  const renderItem = ({ item }: { item: Room }) => {
    const color = (ROOM_STATUS_COLORS as any)[item.status] ?? COLORS.gray;
    return (
      <View style={styles.card}>
        <View style={styles.cardLeft}>
          <Text style={styles.roomNumber}>{t('rooms.roomNumberLabel', { number: item.number })}</Text>
          <Text style={styles.roomMeta}>{t('rooms.floorTypeMeta', { floor: item.floor, type: t(ROOM_TYPE_KEYS[item.type ?? ''] ?? item.type) })}</Text>
          <Text style={styles.roomMeta}>{t('rooms.capacityPriceMeta', { capacity: item.capacity, price: item.price?.toLocaleString() })}</Text>
          {item.hotel && <Text style={styles.hotelName}>{(item.hotel as any).short_name}</Text>}
        </View>

        <View style={{ alignItems: 'flex-end', gap: 8 }}>
          <View style={[styles.statusBadge, { backgroundColor: color + '22' }]}>
            <Text style={[styles.statusText, { color }]}>{t(ROOM_STATUS_KEYS[item.status] ?? item.status)}</Text>
          </View>

          {item.status === 'en_nettoyage' && (
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.success }]} onPress={() => markCleaned(item)}>
              <Text style={styles.actionBtnText}>{t('rooms.markClean')}</Text>
            </TouchableOpacity>
          )}
          {item.status === 'disponible' && (
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.gray }]} onPress={() => changeStatus(item, 'hors_service')}>
              <Text style={styles.actionBtnText}>{t('rooms.status_hors_service')}</Text>
            </TouchableOpacity>
          )}
          {item.status === 'hors_service' && (
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.success }]} onPress={() => changeStatus(item, 'disponible')}>
              <Text style={styles.actionBtnText}>{t('rooms.markAvailable')}</Text>
            </TouchableOpacity>
          )}

          {isManager && (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity onPress={() => openEdit(item)}>
                <FontAwesome5 name="pen" size={15} color={COLORS.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item)}>
                <FontAwesome5 name="trash-alt" size={15} color={COLORS.danger} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={{ gap: 6, paddingHorizontal: 8, paddingVertical: 8 }}
      >
        {STATUSES.map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.filterBtn, filter === s && styles.filterBtnActive]}
            onPress={() => setFilter(s)}
          >
            <Text style={[styles.filterText, filter === s && styles.filterTextActive]}>
              {s === 'tous' ? t('hotels.tab_all') : t(ROOM_STATUS_KEYS[s] ?? s)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={rooms}
        keyExtractor={(r) => String(r.id)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadData(); }}
            colors={[COLORS.primary]}
          />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <FontAwesome5 name="bed" size={48} color={COLORS.grayLight} />
              <Text style={styles.emptyText}>{t('dashboard.noRoomsAvailable')}</Text>
            </View>
          ) : null
        }
      />

      {isManager && (
        <TouchableOpacity style={styles.fab} onPress={openCreate}>
          <FontAwesome5 name="plus" size={22} color={COLORS.white} />
        </TouchableOpacity>
      )}

      {/* ── Modal chambre ── */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{editing ? t('rooms.editRoom') : t('rooms.newRoom')}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <FontAwesome5 name="times" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>{t('profile.hotelLabel')} *</Text>
              {hotels.length === 0 ? (
                <Text style={{ color: COLORS.textMuted, fontSize: 13, marginBottom: 12 }}>{t('services.noHotelAvailable')}</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                  <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 8 }}>
                    {hotels.map(h => (
                      <TouchableOpacity
                        key={h.id}
                        style={[styles.chip, String(form.hotel_id) === String(h.id) && styles.chipActive]}
                        onPress={() => setForm(f => ({ ...f, hotel_id: h.id }))}
                      >
                        <Text style={[styles.chipText, String(form.hotel_id) === String(h.id) && styles.chipTextActive]}>
                          {h.short_name || h.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              )}

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 2 }}>
                  <Text style={styles.label}>{t('rooms.numberLabel')}</Text>
                  <TextInput
                    style={styles.input}
                    value={form.number}
                    onChangeText={v => setForm(f => ({ ...f, number: v }))}
                    placeholder="101"
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>{t('common.floor')}</Text>
                  <TextInput
                    style={styles.input}
                    value={form.floor}
                    onChangeText={v => setForm(f => ({ ...f, floor: v.replace(/[^0-9]/g, '') }))}
                    placeholder="1"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="number-pad"
                  />
                </View>
              </View>

              <Text style={styles.label}>{t('rooms.roomTypeLabel')}</Text>
              <TouchableOpacity
                style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                onPress={() => setShowTypes(true)}
              >
                <Text style={{ color: COLORS.dark, fontSize: 14 }}>{t(ROOM_TYPE_KEYS[form.type] ?? form.type)}</Text>
                <FontAwesome5 name="chevron-down" size={12} color={COLORS.textMuted} />
              </TouchableOpacity>

              <Text style={styles.label}>{t('reservations.status')}</Text>
              <View style={styles.statusGrid}>
                {ROOM_STATUSES.map(s => {
                  const active = form.status === s.value;
                  const color  = (ROOM_STATUS_COLORS as any)[s.value] ?? COLORS.gray;
                  return (
                    <TouchableOpacity
                      key={s.value}
                      style={[styles.statusChip, active && { borderColor: color, backgroundColor: color + '18' }]}
                      onPress={() => setForm(f => ({ ...f, status: s.value }))}
                    >
                      <View style={[styles.statusDot, { backgroundColor: color }]} />
                      <Text style={[styles.statusChipText, active && { color, fontWeight: '700' }]}>
                        {t(s.labelKey)}
                      </Text>
                      {active && <FontAwesome5 name="check" size={11} color={color} style={{ marginLeft: 'auto' }} />}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>{t('rooms.capacityLabel')}</Text>
                  <TextInput
                    style={styles.input}
                    value={form.capacity}
                    onChangeText={v => setForm(f => ({ ...f, capacity: v.replace(/[^0-9]/g, '') }))}
                    placeholder="2"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={{ flex: 2 }}>
                  <Text style={styles.label}>{t('hotels.priceLabel')}</Text>
                  <TextInput
                    style={styles.input}
                    value={form.price}
                    onChangeText={v => setForm(f => ({ ...f, price: v.replace(/[^0-9]/g, '') }))}
                    placeholder="45 000"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="number-pad"
                  />
                </View>
              </View>

              <Text style={styles.label}>{t('rooms.viewLabel')}</Text>
              <TextInput
                style={styles.input}
                value={form.vue}
                onChangeText={v => setForm(f => ({ ...f, vue: v }))}
                placeholder={t('rooms.viewPlaceholder')}
                placeholderTextColor={COLORS.textMuted}
              />

              <Text style={styles.label}>{t('rooms.descLabel')}</Text>
              <TextInput
                style={[styles.input, { textAlignVertical: 'top', minHeight: 70 }]}
                value={form.description}
                onChangeText={v => setForm(f => ({ ...f, description: v }))}
                placeholder={t('rooms.descPlaceholder')}
                placeholderTextColor={COLORS.textMuted}
                multiline
                numberOfLines={3}
              />

              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color={COLORS.white} />
                  : <Text style={styles.saveBtnText}>
                      {editing ? t('common.save') : t('rooms.createRoom')}
                    </Text>
                }
              </TouchableOpacity>
              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal type chambre */}
      <Modal visible={showTypes} transparent animationType="fade" onRequestClose={() => setShowTypes(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowTypes(false)}>
          <View style={styles.typeSheet}>
            <Text style={[styles.sheetTitle, { marginBottom: 8 }]}>{t('rooms.roomTypeLabel')}</Text>
            {ROOM_TYPES.map(rt => (
              <TouchableOpacity
                key={rt}
                style={[styles.typeItem, form.type === rt && styles.typeItemActive]}
                onPress={() => { setForm(f => ({ ...f, type: rt })); setShowTypes(false); }}
              >
                <Text style={[styles.typeItemText, form.type === rt && styles.typeItemTextActive]}>{t(ROOM_TYPE_KEYS[rt] ?? rt)}</Text>
                {form.type === rt && <FontAwesome5 name="check" size={14} color={COLORS.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: COLORS.background },
  filterRow:          { backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  filterBtn:          { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: COLORS.background },
  filterBtnActive:    { backgroundColor: COLORS.primary },
  filterText:         { fontSize: 12, color: COLORS.textMuted },
  filterTextActive:   { color: COLORS.white, fontWeight: '700' },
  card:               { backgroundColor: COLORS.white, borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 5, elevation: 2 },
  cardLeft:           { flex: 1 },
  roomNumber:         { fontSize: 16, fontWeight: '700', color: COLORS.dark },
  roomMeta:           { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  hotelName:          { fontSize: 12, color: COLORS.primary, marginTop: 4, fontWeight: '600' },
  statusBadge:        { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText:         { fontSize: 11, fontWeight: '700' },
  actionBtn:          { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  actionBtnText:      { color: COLORS.white, fontSize: 12, fontWeight: '700' },
  empty:              { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText:          { fontSize: 16, color: COLORS.textMuted },
  fab:                { position: 'absolute', bottom: 20, right: 20, backgroundColor: COLORS.primary, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 8 },
  overlay:            { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:              { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '90%' },
  sheetHeader:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetTitle:         { fontSize: 18, fontWeight: '700', color: COLORS.dark },
  label:              { fontSize: 13, fontWeight: '600', color: COLORS.dark, marginBottom: 6, marginTop: 12 },
  input:              { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: COLORS.background, fontSize: 14, color: COLORS.dark },
  chip:               { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.white },
  chipActive:         { borderColor: COLORS.primary, backgroundColor: '#EEF2FF' },
  chipText:           { fontSize: 13, color: COLORS.textMuted },
  chipTextActive:     { color: COLORS.primary, fontWeight: '700' },
  saveBtn:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 15, marginTop: 20 },
  saveBtnText:        { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  typeSheet:          { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, position: 'absolute', bottom: 0, left: 0, right: 0 },
  typeItem:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  typeItemActive:     { backgroundColor: '#EEF2FF', marginHorizontal: -20, paddingHorizontal: 20 },
  typeItemText:       { fontSize: 15, color: COLORS.dark },
  typeItemTextActive: { color: COLORS.primary, fontWeight: '700' },
  statusGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusChip:         { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.background },
  statusDot:          { width: 9, height: 9, borderRadius: 5 },
  statusChipText:     { fontSize: 13, color: COLORS.textMuted },
});
