import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Modal, TextInput,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { poolApi, hotelApi } from '@/services/api';
import { COLORS } from '@/constants';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { useTranslation } from 'react-i18next';
import { Pool, Hotel } from '@/types';

const STATUSES = ['ouverte', 'fermée', 'maintenance'];

const STATUS_COLORS: Record<string, string> = {
  ouverte:     '#10b981',
  fermée:      '#6b7280',
  maintenance: '#f59e0b',
};

const EMPTY_FORM = {
  hotel_id: '', name: '', status: 'ouverte', area: '', depth: '', temperature: '', description: '',
};

export default function PoolsScreen() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [pools,      setPools]      = useState<Pool[]>([]);
  const [hotels,     setHotels]     = useState<Hotel[]>([]);
  const [filter,     setFilter]     = useState('');
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal,  setShowModal]  = useState(false);
  const [editItem,   setEditItem]   = useState<Pool | null>(null);
  const [form,       setForm]       = useState({ ...EMPTY_FORM });
  const [saving,     setSaving]     = useState(false);

  const load = useCallback(async () => {
    try {
      const [poolsRes, hotelsRes] = await Promise.all([
        poolApi.list(filter ? { status: filter } : undefined),
        isAdmin ? hotelApi.list() : hotelApi.mine(),
      ]);
      setPools(Array.isArray(poolsRes.data) ? poolsRes.data : (poolsRes.data?.data ?? []));
      const hotRaw = hotelsRes.data;
      setHotels(Array.isArray(hotRaw) ? hotRaw : (hotRaw?.data ?? []));
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [filter, isAdmin]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditItem(null);
    setForm({ ...EMPTY_FORM, hotel_id: hotels[0]?.id?.toString() ?? '' });
    setShowModal(true);
  };

  const openEdit = (item: Pool) => {
    setEditItem(item);
    setForm({
      hotel_id: String(item.hotel_id),
      name: item.name,
      status: item.status,
      area: item.area != null ? String(item.area) : '',
      depth: item.depth != null ? String(item.depth) : '',
      temperature: item.temperature != null ? String(item.temperature) : '',
      description: item.description ?? '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.hotel_id || !form.name.trim()) {
      Alert.alert(t('common.required'), t('pools.requiredMsg'));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        hotel_id: Number(form.hotel_id),
        name: form.name.trim(),
        status: form.status,
        area: form.area ? Number(form.area) : undefined,
        depth: form.depth ? Number(form.depth) : undefined,
        temperature: form.temperature ? Number(form.temperature) : undefined,
        description: form.description.trim() || undefined,
      };
      if (editItem) {
        await poolApi.update(editItem.id, payload);
      } else {
        await poolApi.create(payload);
      }
      setShowModal(false);
      load();
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.response?.data?.message ?? t('auth.genericError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item: Pool) => {
    Alert.alert(t('pools.deleteTitle'), t('pools.deleteMsg', { name: item.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'), style: 'destructive',
        onPress: async () => {
          try {
            await poolApi.delete(item.id);
            load();
          } catch {
            Alert.alert(t('common.error'), t('pools.cannotDelete'));
          }
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
          <TouchableOpacity
            key={s}
            style={[styles.filterPill, filter === s && styles.filterPillActive]}
            onPress={() => setFilter(filter === s ? '' : s)}
          >
            <Text style={[styles.filterPillText, filter === s && styles.filterPillTextActive]}>{t(`pools.status_${s}`)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={pools}
        keyExtractor={(p) => `pool-${p.id}`}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[COLORS.primary]} />}
        renderItem={({ item }) => {
          const color = STATUS_COLORS[item.status] ?? COLORS.textMuted;
          return (
            <View style={styles.card}>
              <View style={[styles.iconWrap, { backgroundColor: color + '20' }]}>
                <FontAwesome5 name="water" size={16} color={color} />
              </View>
              <View style={styles.cardBody}>
                <View style={styles.cardRow}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
                  <View style={[styles.badge, { backgroundColor: color + '20' }]}>
                    <Text style={[styles.badgeText, { color }]}>{t(`pools.status_${item.status}`)}</Text>
                  </View>
                </View>
                <Text style={styles.cardSub}>
                  {item.area ? `${item.area} m²` : ''}
                  {item.depth ? ` · ${item.depth} m` : ''}
                  {item.temperature ? ` · ${item.temperature}°C` : ''}
                </Text>
                {item.description ? <Text style={styles.cardNote}>{item.description}</Text> : null}
                <View style={styles.cardFooterRow}>
                  <TouchableOpacity onPress={() => openEdit(item)} style={styles.actionBtn}>
                    <FontAwesome5 name="pen" size={11} color={COLORS.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(item)} style={[styles.actionBtn, { backgroundColor: '#fef2f2' }]}>
                    <FontAwesome5 name="trash" size={11} color={COLORS.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <FontAwesome5 name="water" size={40} color={COLORS.grayLight} />
            <Text style={styles.emptyText}>{t('pools.noPools')}</Text>
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
              <Text style={styles.modalTitle}>{editItem ? t('pools.modalTitleEdit') : t('pools.modalTitleNew')}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <FontAwesome5 name="times" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
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
                      <Text style={[styles.pillText, form.hotel_id === String(h.id) && styles.pillTextActive]}>
                        {h.short_name ?? h.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              <Text style={styles.label}>{t('pools.nameLabel')}</Text>
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                placeholder={t('pools.namePlaceholder')}
                placeholderTextColor={COLORS.grayLight}
              />

              <Text style={styles.label}>{t('reservations.status')}</Text>
              <View style={styles.typeGrid}>
                {STATUSES.map((s) => {
                  const active = form.status === s;
                  const col = STATUS_COLORS[s];
                  return (
                    <TouchableOpacity
                      key={s}
                      style={[styles.typeChip, active && { backgroundColor: col + '20', borderColor: col }]}
                      onPress={() => setForm((f) => ({ ...f, status: s }))}
                    >
                      <Text style={[styles.typeChipText, active && { color: col, fontWeight: '700' }]}>{t(`pools.status_${s}`)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.label}>{t('pools.area')}</Text>
              <TextInput
                style={styles.input}
                value={form.area}
                onChangeText={(v) => setForm((f) => ({ ...f, area: v.replace(/[^0-9]/g, '') }))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={COLORS.grayLight}
              />

              <Text style={styles.label}>{t('pools.depth')}</Text>
              <TextInput
                style={styles.input}
                value={form.depth}
                onChangeText={(v) => setForm((f) => ({ ...f, depth: v.replace(/[^0-9.]/g, '') }))}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={COLORS.grayLight}
              />

              <Text style={styles.label}>{t('pools.temperature')}</Text>
              <TextInput
                style={styles.input}
                value={form.temperature}
                onChangeText={(v) => setForm((f) => ({ ...f, temperature: v.replace(/[^0-9.]/g, '') }))}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={COLORS.grayLight}
              />

              <Text style={styles.label}>{t('expenses.notesLabel')}</Text>
              <TextInput
                style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
                value={form.description}
                onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
                placeholder={t('pools.descriptionPlaceholder')}
                placeholderTextColor={COLORS.grayLight}
                multiline
              />

              <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color={COLORS.white} /> : <Text style={styles.saveBtnText}>{editItem ? t('expenses.updateBtn') : t('common.save')}</Text>}
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
  iconWrap: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  cardBody: { flex: 1, gap: 4 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: COLORS.dark, flex: 1 },
  cardSub: { fontSize: 12, color: COLORS.textMuted },
  cardNote: { fontSize: 12, color: COLORS.textMuted, fontStyle: 'italic' },
  cardFooterRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  badge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  actionBtn: { backgroundColor: '#eff6ff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
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
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 18 },
  saveBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
});
