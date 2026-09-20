import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, RefreshControl,
  Modal, ScrollView, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { menuApi, hotelApi } from '@/services/api';
import { MenuItem, Hotel } from '@/types';
import { COLORS } from '@/constants';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { EmojiPicker } from '@/components/EmojiPicker';
import React from 'react';

const EMPTY_FORM = {
  hotel_id:    '' as string | number,
  name:        '',
  item_type:   'plat' as 'plat' | 'boisson',
  category:    '',
  price:       '',
  stock:       '',
  emoji:       '',
  description: '',
};

// ─── Carte mémorisée ─────────────────────────────────────────────────────────
type CardProps = {
  item:      MenuItem;
  isManager: boolean;
  onToggle:  (item: MenuItem) => void;
  onEdit:    (item: MenuItem) => void;
  onDelete:  (item: MenuItem) => void;
};

const MenuCard = React.memo(({ item, isManager, onToggle, onEdit, onDelete }: CardProps) => {
  const { t } = useTranslation();
  return (
  <View style={styles.card}>
    <Text style={styles.emoji}>{item.emoji ?? (item.item_type === 'boisson' ? '🥤' : '🍽')}</Text>
    <View style={{ flex: 1 }}>
      <Text style={styles.name}>{item.name}</Text>
      <Text style={styles.category}>
        {item.category ? `${item.category} · ` : ''}{item.item_type}
      </Text>
      {item.stock != null && <Text style={styles.meta}>{t('boutique.stockCount', { count: item.stock })}</Text>}
    </View>
    <View style={{ alignItems: 'flex-end', gap: 8 }}>
      <Text style={styles.price}>{item.price?.toLocaleString()} {t('common.fcfa')}</Text>
      {isManager ? (
        <>
          <TouchableOpacity
            style={[styles.availBtn, { backgroundColor: item.available ? '#D1FAE5' : '#FEE2E2' }]}
            onPress={() => onToggle(item)}
          >
            <Text style={{ fontSize: 11, color: item.available ? '#065F46' : COLORS.danger, fontWeight: '700' }}>
              {item.available ? t('menu.available') : t('menu.unavailable')}
            </Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity onPress={() => onEdit(item)}>
              <FontAwesome5 name="pen" size={15} color={COLORS.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onDelete(item)}>
              <FontAwesome5 name="trash-alt" size={15} color={COLORS.danger} />
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <View style={[styles.availBtn, { backgroundColor: item.available ? '#D1FAE5' : '#FEE2E2' }]}>
          <Text style={{ fontSize: 11, color: item.available ? '#065F46' : COLORS.danger, fontWeight: '700' }}>
            {item.available ? t('menu.available') : t('menu.unavailable')}
          </Text>
        </View>
      )}
    </View>
  </View>
  );
});

// ─── Écran ───────────────────────────────────────────────────────────────────
export default function MenuScreen() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const isManager = user?.role === 'admin' || user?.role === 'prestataire';

  const [items,       setItems]       = useState<MenuItem[]>([]);
  const [hotels,      setHotels]      = useState<Hotel[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [showModal,   setShowModal]   = useState(false);
  const [editing,     setEditing]     = useState<MenuItem | null>(null);
  const [saving,      setSaving]      = useState(false);
  const [form,        setForm]        = useState({ ...EMPTY_FORM });

  // ── Filtres ──────────────────────────────────────────────────────────────
  const [search,      setSearch]      = useState('');
  const [typeFilter,  setTypeFilter]  = useState<'tous' | 'plat' | 'boisson'>('tous');
  const [hotelFilter, setHotelFilter] = useState<number | null>(null);
  const [availFilter, setAvailFilter] = useState<'tous' | 'dispo' | 'indispo'>('tous');
  const [showSearch,  setShowSearch]  = useState(false);

  const filtered = useMemo(() => items.filter(item => {
    if (typeFilter !== 'tous' && item.item_type !== typeFilter) return false;
    if (hotelFilter !== null && item.hotel_id !== hotelFilter) return false;
    if (availFilter === 'dispo'   && !item.available) return false;
    if (availFilter === 'indispo' &&  item.available) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!item.name.toLowerCase().includes(q) && !(item.category?.toLowerCase().includes(q) ?? false))
        return false;
    }
    return true;
  }), [items, typeFilter, hotelFilter, availFilter, search]);

  // ── Chargement ───────────────────────────────────────────────────────────
  const fetchItems = useCallback(async () => {
    try {
      const res = await menuApi.list();
      setItems(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchHotels = useCallback(async () => {
    if (!isManager) return;
    try {
      const res = user?.role === 'prestataire' ? await hotelApi.mine() : await hotelApi.list();
      const list = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
      setHotels(list);
    } catch {}
  }, [isManager, user?.role]);

  useEffect(() => { fetchItems(); fetchHotels(); }, [fetchItems, fetchHotels]);

  // ── Formulaire ───────────────────────────────────────────────────────────
  const openCreate = useCallback(() => {
    setForm(f => ({ ...EMPTY_FORM, hotel_id: hotels[0]?.id ?? '' }));
    setEditing(null);
    setShowModal(true);
  }, [hotels]);

  const openEdit = useCallback((item: MenuItem) => {
    setForm({
      hotel_id:    item.hotel_id,
      name:        item.name,
      item_type:   (item.item_type as 'plat' | 'boisson') ?? 'plat',
      category:    item.category ?? '',
      price:       item.price  != null ? String(item.price)  : '',
      stock:       item.stock  != null ? String(item.stock)  : '',
      emoji:       item.emoji  ?? '',
      description: item.description ?? '',
    });
    setEditing(item);
    setShowModal(true);
  }, []);

  const handleSave = async () => {
    if (!form.hotel_id)    { Alert.alert(t('common.required'), t('menu.selectHotelMsg')); return; }
    if (!form.name.trim()) { Alert.alert(t('common.required'), t('menu.nameRequiredMsg')); return; }
    setSaving(true);
    try {
      const payload = {
        hotel_id:    Number(form.hotel_id),
        name:        form.name.trim(),
        item_type:   form.item_type,
        category:    form.category.trim()    || undefined,
        price:       form.price              ? Number(form.price)  : 0,
        stock:       form.stock              ? Number(form.stock)  : 0,
        emoji:       form.emoji.trim()       || undefined,
        description: form.description.trim() || undefined,
      };
      if (editing) { await menuApi.update(editing.id, payload); }
      else         { await menuApi.create(payload); }
      setShowModal(false);
      fetchItems();
    } catch (e: any) {
      const msg = e.response?.data?.message ?? t('hotels.cannotSave');
      Alert.alert(t('common.error'), msg);
    } finally {
      setSaving(false);
    }
  };

  const toggleAvailability = useCallback(async (item: MenuItem) => {
    if (!isManager) return; // double-garde
    try {
      await menuApi.update(item.id, { available: !item.available });
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, available: !item.available } : i));
    } catch (e: any) {
      if (e.response?.status === 403) {
        Alert.alert(t('common.error'), t('menu.noPermissionEdit'));
      }
    }
  }, [isManager]);

  const handleDelete = useCallback((item: MenuItem) => {
    Alert.alert(t('common.delete'), t('services.deleteMsg', { name: item.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'), style: 'destructive',
        onPress: async () => {
          try {
            await menuApi.delete(item.id);
            setItems(prev => prev.filter(i => i.id !== item.id));
          } catch (e: any) {
            if (e.response?.status === 403) {
              Alert.alert(t('common.error'), t('menu.noPermissionDelete'));
            }
          }
        },
      },
    ]);
  }, [t]);

  const renderItem = useCallback(({ item }: { item: MenuItem }) => (
    <MenuCard
      item={item}
      isManager={isManager}
      onToggle={toggleAvailability}
      onEdit={openEdit}
      onDelete={handleDelete}
    />
  ), [isManager, toggleAvailability, openEdit, handleDelete]);

  const keyExtractor = useCallback((item: MenuItem) => String(item.id), []);

  const activeFilterCount =
    (typeFilter !== 'tous'  ? 1 : 0) +
    (hotelFilter !== null   ? 1 : 0) +
    (availFilter !== 'tous' ? 1 : 0) +
    (search.trim()          ? 1 : 0);

  return (
    <View style={styles.container}>
      {/* ── Barre principale ── */}
      <View style={styles.topBar}>
        <View style={styles.typeTabs}>
          {(['tous', 'plat', 'boisson'] as const).map(tf => (
            <TouchableOpacity
              key={tf}
              style={[styles.tab, typeFilter === tf && styles.tabActive]}
              onPress={() => setTypeFilter(tf)}
            >
              <Text style={[styles.tabText, typeFilter === tf && styles.tabTextActive]}>
                {tf === 'tous' ? t('menu.all') : tf === 'plat' ? t('menu.dishesTab') : t('menu.drinksTab')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <TouchableOpacity
            style={[styles.iconBtn, (showSearch || search.length > 0) && styles.iconBtnActive]}
            onPress={() => { setShowSearch(v => !v); if (showSearch) setSearch(''); }}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <FontAwesome5 name="search" size={14} color={(showSearch || search.length > 0) ? COLORS.primary : COLORS.dark} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => router.back()}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <FontAwesome5 name="times" size={14} color={COLORS.dark} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Barre de recherche ── */}
      {showSearch && (
        <View style={styles.searchBar}>
          <FontAwesome5 name="search" size={13} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder={t('menu.searchPlaceholder')}
            placeholderTextColor={COLORS.textMuted}
            autoFocus
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <FontAwesome5 name="times-circle" size={14} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Filtres secondaires ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.secondaryFilters}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 8, paddingVertical: 8 }}
      >
        {(['tous', 'dispo', 'indispo'] as const).map(a => (
          <TouchableOpacity
            key={a}
            style={[styles.filterChip, availFilter === a && styles.filterChipActive]}
            onPress={() => setAvailFilter(a)}
          >
            <Text style={[styles.filterChipText, availFilter === a && styles.filterChipTextActive]}>
              {a === 'tous' ? t('menu.all') : a === 'dispo' ? t('menu.available_filter') : t('menu.unavailable_filter')}
            </Text>
          </TouchableOpacity>
        ))}
        {hotels.length > 1 && <View style={styles.filterSep} />}
        {hotels.length > 1 && (
          <>
            <TouchableOpacity
              style={[styles.filterChip, hotelFilter === null && styles.filterChipActive]}
              onPress={() => setHotelFilter(null)}
            >
              <Text style={[styles.filterChipText, hotelFilter === null && styles.filterChipTextActive]}>
                {t('menu.allHotels')}
              </Text>
            </TouchableOpacity>
            {hotels.map(h => (
              <TouchableOpacity
                key={h.id}
                style={[styles.filterChip, hotelFilter === h.id && styles.filterChipActive]}
                onPress={() => setHotelFilter(hotelFilter === h.id ? null : h.id)}
              >
                <FontAwesome5 name="hotel" size={10} color={hotelFilter === h.id ? COLORS.primary : COLORS.textMuted} style={{ marginRight: 4 }} />
                <Text style={[styles.filterChipText, hotelFilter === h.id && styles.filterChipTextActive]}>
                  {h.short_name || h.name}
                </Text>
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>

      {/* ── Bandeau filtres actifs ── */}
      {activeFilterCount > 0 && (
        <View style={styles.activeFilterBanner}>
          <Text style={styles.activeFilterText}>
            {filtered.length} {filtered.length > 1 ? t('menu.results') : t('menu.result')} · {activeFilterCount} {activeFilterCount > 1 ? t('menu.filters') : t('menu.filter')} {activeFilterCount > 1 ? t('services.activePlural') : t('services.active')}
          </Text>
          <TouchableOpacity onPress={() => {
            setTypeFilter('tous'); setHotelFilter(null);
            setAvailFilter('tous'); setSearch(''); setShowSearch(false);
          }}>
            <Text style={styles.clearFilters}>{t('hotels.clearAll')}</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
        removeClippedSubviews
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        windowSize={10}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchItems(); }}
            colors={[COLORS.primary]}
          />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <FontAwesome5 name="utensils" size={48} color={COLORS.grayLight} />
              <Text style={styles.emptyText}>
                {activeFilterCount > 0 ? t('menu.noResultsFiltered') : t('menu.emptyMenu')}
              </Text>
            </View>
          ) : null
        }
      />

      {isManager && (
        <TouchableOpacity style={styles.fab} onPress={openCreate}>
          <FontAwesome5 name="plus" size={22} color={COLORS.white} />
        </TouchableOpacity>
      )}

      {/* ── Modal créer / modifier ── */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                {editing ? t('common.edit') : t('menu.newItem')}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <FontAwesome5 name="times" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {hotels.length > 0 && (
                <>
                  <Text style={styles.label}>{t('facturations.hotelLabel')}</Text>
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
                </>
              )}

              <Text style={styles.label}>{t('menu.typeLabel')}</Text>
              <View style={styles.row2}>
                {(['plat', 'boisson'] as const).map(it => (
                  <TouchableOpacity
                    key={it}
                    style={[styles.typeBtn, form.item_type === it && styles.typeBtnActive]}
                    onPress={() => setForm(f => ({ ...f, item_type: it }))}
                  >
                    <Text style={[styles.typeBtnText, form.item_type === it && styles.typeBtnTextActive]}>
                      {it === 'plat' ? t('menu.dishOption') : t('menu.drinkOption')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.row2}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={styles.label}>{t('boutique.iconLabel')}</Text>
                  <EmojiPicker
                    value={form.emoji}
                    onChange={v => setForm(f => ({ ...f, emoji: v }))}
                    placeholder="🍽️"
                    categories={['Plats', 'Boissons', 'Desserts']}
                    buttonSize={56}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>{t('boutique.nameLabel')}</Text>
                  <TextInput
                    style={styles.input}
                    value={form.name}
                    onChangeText={v => setForm(f => ({ ...f, name: v }))}
                    placeholder={t('menu.namePlaceholder')}
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>
              </View>

              <Text style={styles.label}>{t('hotels.categoryLabel')}</Text>
              <TextInput
                style={styles.input}
                value={form.category}
                onChangeText={v => setForm(f => ({ ...f, category: v }))}
                placeholder={t('menu.categoryPlaceholder')}
                placeholderTextColor={COLORS.textMuted}
              />

              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>{t('menu.priceLabel')}</Text>
                  <TextInput
                    style={styles.input}
                    value={form.price}
                    onChangeText={v => setForm(f => ({ ...f, price: v.replace(/[^0-9]/g, '') }))}
                    placeholder="5000"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>{t('boutique.stockLabel')}</Text>
                  <TextInput
                    style={styles.input}
                    value={form.stock}
                    onChangeText={v => setForm(f => ({ ...f, stock: v.replace(/[^0-9]/g, '') }))}
                    placeholder="0"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="number-pad"
                  />
                </View>
              </View>

              <Text style={styles.label}>{t('hotels.descSection')}</Text>
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                value={form.description}
                onChangeText={v => setForm(f => ({ ...f, description: v }))}
                placeholder={t('menu.descPlaceholder')}
                placeholderTextColor={COLORS.textMuted}
                multiline
              />

              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color={COLORS.white} />
                  : <Text style={styles.saveBtnText}>
                      {editing ? t('common.save') : t('menu.addItem')}
                    </Text>
                }
              </TouchableOpacity>
              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:           { flex: 1, backgroundColor: COLORS.background },
  topBar:              { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, paddingHorizontal: 10, paddingVertical: 8, gap: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  typeTabs:            { flex: 1, flexDirection: 'row', gap: 4 },
  tab:                 { flex: 1, paddingVertical: 7, borderRadius: 20, backgroundColor: COLORS.background, alignItems: 'center' },
  tabActive:           { backgroundColor: COLORS.primary },
  tabText:             { fontSize: 11, color: COLORS.textMuted },
  tabTextActive:       { color: COLORS.white, fontWeight: '700' },
  iconBtn:             { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border, justifyContent: 'center', alignItems: 'center' },
  iconBtnActive:       { backgroundColor: '#EEF2FF', borderColor: COLORS.primary },
  searchBar:           { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.white, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  searchInput:         { flex: 1, fontSize: 14, color: COLORS.dark },
  secondaryFilters:    { backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border, flexGrow: 0 },
  filterChip:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.background },
  filterChipActive:    { borderColor: COLORS.primary, backgroundColor: '#EEF2FF' },
  filterChipText:      { fontSize: 12, color: COLORS.textMuted },
  filterChipTextActive:{ color: COLORS.primary, fontWeight: '700' },
  filterSep:           { width: 1, backgroundColor: COLORS.border, marginVertical: 4 },
  activeFilterBanner:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 6, backgroundColor: '#EEF2FF' },
  activeFilterText:    { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  clearFilters:        { fontSize: 12, color: COLORS.danger, fontWeight: '600' },
  card:                { backgroundColor: COLORS.white, borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 5, elevation: 2 },
  emoji:               { fontSize: 28, width: 40, textAlign: 'center' },
  name:                { fontSize: 15, fontWeight: '700', color: COLORS.dark },
  category:            { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  meta:                { fontSize: 12, color: COLORS.textMuted },
  price:               { fontSize: 15, fontWeight: '700', color: COLORS.primary },
  availBtn:            { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  empty:               { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText:           { fontSize: 16, color: COLORS.textMuted, textAlign: 'center', paddingHorizontal: 20 },
  fab:                 { position: 'absolute', bottom: 20, right: 20, backgroundColor: COLORS.primary, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 8 },
  overlay:             { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:               { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '90%' },
  sheetHeader:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetTitle:          { fontSize: 18, fontWeight: '700', color: COLORS.dark },
  label:               { fontSize: 13, fontWeight: '600', color: COLORS.dark, marginBottom: 6, marginTop: 12 },
  input:               { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: COLORS.background, fontSize: 14, color: COLORS.dark },
  row2:                { flexDirection: 'row', gap: 10 },
  chip:                { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.white },
  chipActive:          { borderColor: COLORS.primary, backgroundColor: '#EEF2FF' },
  chipText:            { fontSize: 13, color: COLORS.textMuted },
  chipTextActive:      { color: COLORS.primary, fontWeight: '700' },
  typeBtn:             { flex: 1, paddingVertical: 11, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center', backgroundColor: COLORS.white },
  typeBtnActive:       { borderColor: COLORS.primary, backgroundColor: '#EEF2FF' },
  typeBtnText:         { fontSize: 14, color: COLORS.textMuted },
  typeBtnTextActive:   { color: COLORS.primary, fontWeight: '700' },
  saveBtn:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 15, marginTop: 20 },
  saveBtnText:         { color: COLORS.white, fontSize: 15, fontWeight: '700' },
});
