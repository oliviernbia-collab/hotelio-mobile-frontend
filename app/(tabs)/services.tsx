import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, Alert,
  RefreshControl, Modal, ScrollView, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator, Switch,
} from 'react-native';
import { serviceApi, hotelApi } from '@/services/api';
import { Hotel } from '@/types';
import { COLORS } from '@/constants';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { EmojiPicker } from '@/components/EmojiPicker';
import { useTranslation } from 'react-i18next';

const SERVICE_CATS = ['Bien-être', 'Transport', 'Restauration', 'Loisirs', 'Business', 'Ménage', 'Général'];

const SERVICE_CAT_KEYS: Record<string, string> = {
  'Bien-être':     'services.cat_bien_etre',
  'Transport':     'services.cat_transport',
  'Restauration':  'services.cat_restauration',
  'Loisirs':       'services.cat_loisirs',
  'Business':      'services.cat_business',
  'Ménage':        'services.cat_menage',
  'Général':       'services.cat_general',
  'Autre':         'services.cat_autre',
};

const EMPTY_FORM = {
  hotel_id:    '' as string | number,
  name:        '',
  category:    'Général',
  description: '',
  price:       '',
  emoji:       '✨',
};

interface ServiceItem {
  id: number;
  hotel_id: number;
  name: string;
  category: string;
  description?: string;
  price: number;
  emoji: string;
  available: number;
  hotel_name?: string;
  hotel_short_name?: string;
}

export default function ServicesScreen() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const isManager = user?.role === 'admin' || user?.role === 'prestataire';

  const [services,   setServices]   = useState<ServiceItem[]>([]);
  const [hotels,     setHotels]     = useState<Hotel[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal,  setShowModal]  = useState(false);
  const [editing,    setEditing]    = useState<ServiceItem | null>(null);
  const [saving,     setSaving]     = useState(false);
  const [form,       setForm]       = useState({ ...EMPTY_FORM });
  const [showCats, setShowCats] = useState(false);

  const loadData = async () => {
    try {
      const [svcRes, hotelsRes] = await Promise.all([
        serviceApi.list(),
        user?.role === 'prestataire' ? hotelApi.mine() : hotelApi.list(),
      ]);
      setServices(svcRes.data);
      const list = Array.isArray(hotelsRes.data) ? hotelsRes.data : (hotelsRes.data?.data ?? []);
      setHotels(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, hotel_id: hotels[0]?.id ?? '' });
    setEditing(null);
    setShowModal(true);
  };

  const openEdit = (s: ServiceItem) => {
    setForm({
      hotel_id:    s.hotel_id,
      name:        s.name,
      category:    s.category,
      description: s.description ?? '',
      price:       s.price ? String(s.price) : '',
      emoji:       s.emoji ?? '✨',
    });
    setEditing(s);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.hotel_id) { Alert.alert(t('services.hotelRequired'), t('services.hotelRequiredMsg')); return; }
    if (!form.name.trim()) { Alert.alert(t('services.nameRequired'), t('services.nameRequiredMsg')); return; }
    setSaving(true);
    try {
      const payload = {
        hotel_id:    Number(form.hotel_id),
        name:        form.name.trim(),
        category:    form.category,
        description: form.description.trim() || undefined,
        price:       form.price ? Number(form.price) : 0,
        emoji:       form.emoji,
      };
      if (editing) {
        await serviceApi.update(editing.id, payload);
      } else {
        await serviceApi.create(payload);
      }
      setShowModal(false);
      loadData();
    } catch (e: any) {
      Alert.alert(t('common.error'), e.response?.data?.message ?? t('hotels.cannotSave'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (s: ServiceItem) => {
    Alert.alert(t('common.delete'), t('services.deleteMsg', { name: s.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'), style: 'destructive',
        onPress: async () => {
          try {
            await serviceApi.delete(s.id);
            loadData();
          } catch (e: any) {
            Alert.alert(t('common.error'), e.response?.data?.message ?? t('hotels.cannotDelete'));
          }
        },
      },
    ]);
  };

  const toggleAvailable = async (s: ServiceItem) => {
    try {
      await serviceApi.toggle(s.id, !s.available);
      setServices(prev => prev.map(x => x.id === s.id ? { ...x, available: x.available ? 0 : 1 } : x));
    } catch {}
  };

  const grouped = SERVICE_CATS.reduce((acc, cat) => {
    const items = services.filter(s => s.category === cat);
    if (items.length) acc.push({ category: cat, items });
    return acc;
  }, [] as { category: string; items: ServiceItem[] }[]);
  const uncategorized = services.filter(s => !SERVICE_CATS.includes(s.category));
  if (uncategorized.length) grouped.push({ category: 'Autre', items: uncategorized });

  const renderService = (s: ServiceItem) => (
    <View key={s.id} style={[styles.serviceCard, !s.available && styles.serviceCardOff]}>
      <View style={styles.emojiBox}>
        <Text style={styles.emoji}>{s.emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.serviceName, !s.available && { color: COLORS.textMuted }]}>{s.name}</Text>
        {s.description ? <Text style={styles.servicedesc} numberOfLines={1}>{s.description}</Text> : null}
        <Text style={styles.servicePrice}>
          {Number(s.price) > 0 ? `${Number(s.price).toLocaleString()} FCFA` : t('services.freeIncluded')}
        </Text>
        {s.hotel_short_name && <Text style={styles.hotelTag}>🏨 {s.hotel_short_name}</Text>}
      </View>
      <View style={{ alignItems: 'center', gap: 10 }}>
        <Switch
          value={!!s.available}
          onValueChange={() => toggleAvailable(s)}
          trackColor={{ false: COLORS.border, true: COLORS.success + '80' }}
          thumbColor={s.available ? COLORS.success : COLORS.gray}
        />
        {isManager && (
          <>
            <TouchableOpacity onPress={() => openEdit(s)}>
              <FontAwesome5 name="pen" size={14} color={COLORS.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDelete(s)}>
              <FontAwesome5 name="trash-alt" size={14} color={COLORS.danger} />
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadData(); }}
            colors={[COLORS.primary]}
          />
        }
        contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
      >
        {/* En-tête stats */}
        <View style={styles.headerCard}>
          <FontAwesome5 name="concierge-bell" size={28} color={COLORS.secondary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{t('services.myServices')}</Text>
            <Text style={styles.headerSub}>
              {services.length} {services.length !== 1 ? t('services.servicesPlural') : t('services.service')} · {services.filter(s => s.available).length} {services.filter(s => s.available).length !== 1 ? t('services.activePlural') : t('services.active')}
            </Text>
          </View>
        </View>

        {grouped.length === 0 && !loading ? (
          <View style={styles.empty}>
            <FontAwesome5 name="concierge-bell" size={48} color={COLORS.grayLight} />
            <Text style={styles.emptyText}>{t('services.empty')}</Text>
            <Text style={styles.emptySub}>{t('services.emptyHint')}</Text>
          </View>
        ) : (
          grouped.map(group => (
            <View key={group.category}>
              <Text style={styles.groupLabel}>{t(SERVICE_CAT_KEYS[group.category] ?? group.category)}</Text>
              {group.items.map(renderService)}
            </View>
          ))
        )}
      </ScrollView>

      {isManager && (
        <TouchableOpacity style={styles.fab} onPress={openCreate}>
          <FontAwesome5 name="plus" size={22} color={COLORS.white} />
        </TouchableOpacity>
      )}

      {/* ── Modal service ── */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{editing ? t('services.editTitle') : t('services.newTitle')}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <FontAwesome5 name="times" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Hôtel */}
              <Text style={styles.label}>{t('facturations.hotelLabel')}</Text>
              {hotels.length === 0 ? (
                <View style={styles.noHotelBox}>
                  <FontAwesome5 name="building" size={22} color={COLORS.textMuted} />
                  <Text style={styles.noHotelText}>{t('services.noHotelAvailable')}</Text>
                  <Text style={styles.noHotelSub}>{t('services.createHotelFirst')}</Text>
                </View>
              ) : (
                <View style={styles.hotelGrid}>
                  {hotels.map(h => {
                    const sel = String(form.hotel_id) === String(h.id);
                    return (
                      <TouchableOpacity
                        key={h.id}
                        style={[styles.hotelCard, sel && styles.hotelCardSel]}
                        onPress={() => setForm(f => ({ ...f, hotel_id: h.id }))}
                        activeOpacity={0.75}
                      >
                        <View style={[styles.hotelIconBox, sel && { backgroundColor: COLORS.primary }]}>
                          <FontAwesome5 name="hotel" size={18} color={sel ? COLORS.white : COLORS.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.hotelCardName, sel && { color: COLORS.primary }]} numberOfLines={1}>
                            {h.short_name || h.name}
                          </Text>
                          {h.city ? (
                            <Text style={styles.hotelCardCity} numberOfLines={1}>
                              <FontAwesome5 name="map-marker-alt" size={10} color={COLORS.textMuted} />
                              {'  '}{h.city}{h.quartier ? ` · ${h.quartier}` : ''}
                            </Text>
                          ) : null}
                        </View>
                        {sel && (
                          <View style={styles.hotelCheckBadge}>
                            <FontAwesome5 name="check" size={10} color={COLORS.white} />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Emoji + Nom */}
              <Text style={styles.label}>{t('services.serviceLabel')}</Text>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <EmojiPicker
                  value={form.emoji}
                  onChange={v => setForm(f => ({ ...f, emoji: v }))}
                  placeholder="✨"
                  categories={['Services', 'Hôtel', 'Plats', 'Nature']}
                  buttonSize={52}
                />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={form.name}
                  onChangeText={v => setForm(f => ({ ...f, name: v }))}
                  placeholder={t('services.namePlaceholder')}
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>

              {/* Catégorie */}
              <Text style={styles.label}>{t('hotels.categoryLabel')}</Text>
              <TouchableOpacity
                style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                onPress={() => setShowCats(true)}
              >
                <Text style={{ color: COLORS.dark, fontSize: 14 }}>{t(SERVICE_CAT_KEYS[form.category] ?? form.category)}</Text>
                <FontAwesome5 name="chevron-down" size={12} color={COLORS.textMuted} />
              </TouchableOpacity>

              {/* Prix */}
              <Text style={styles.label}>{t('services.priceLabel')}</Text>
              <TextInput
                style={styles.input}
                value={form.price}
                onChangeText={v => setForm(f => ({ ...f, price: v.replace(/[^0-9]/g, '') }))}
                placeholder={t('services.pricePlaceholder')}
                placeholderTextColor={COLORS.textMuted}
                keyboardType="number-pad"
              />

              {/* Description */}
              <Text style={styles.label}>{t('hotels.descSection')}</Text>
              <TextInput
                style={[styles.input, { textAlignVertical: 'top', minHeight: 80 }]}
                value={form.description}
                onChangeText={v => setForm(f => ({ ...f, description: v }))}
                placeholder={t('services.descPlaceholder')}
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
                      {editing ? t('facturations.saveEdit') : t('services.addService')}
                    </Text>
                }
              </TouchableOpacity>
              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal catégorie */}
      <Modal visible={showCats} transparent animationType="fade" onRequestClose={() => setShowCats(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowCats(false)}>
          <View style={styles.pickerSheet}>
            <Text style={[styles.sheetTitle, { marginBottom: 8 }]}>{t('hotels.categoryLabel')}</Text>
            {SERVICE_CATS.map(c => (
              <TouchableOpacity
                key={c}
                style={[styles.pickerItem, form.category === c && styles.pickerItemActive]}
                onPress={() => { setForm(f => ({ ...f, category: c })); setShowCats(false); }}
              >
                <Text style={[styles.pickerItemText, form.category === c && styles.pickerItemTextActive]}>{t(SERVICE_CAT_KEYS[c] ?? c)}</Text>
                {form.category === c && <FontAwesome5 name="check" size={14} color={COLORS.primary} />}
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
  headerCard:         { backgroundColor: COLORS.primary, borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 },
  headerTitle:        { fontSize: 16, fontWeight: '700', color: COLORS.white },
  headerSub:          { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  groupLabel:         { fontSize: 13, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 16 },
  serviceCard:        { backgroundColor: COLORS.white, borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 5, elevation: 2 },
  serviceCardOff:     { opacity: 0.55 },
  emojiBox:           { width: 48, height: 48, borderRadius: 14, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center' },
  emoji:              { fontSize: 24 },
  serviceName:        { fontSize: 15, fontWeight: '700', color: COLORS.dark },
  servicedesc:        { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  servicePrice:       { fontSize: 13, fontWeight: '600', color: COLORS.primary, marginTop: 3 },
  hotelTag:           { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  empty:              { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText:          { fontSize: 17, fontWeight: '700', color: COLORS.dark },
  emptySub:           { fontSize: 14, color: COLORS.textMuted, textAlign: 'center' },
  fab:                { position: 'absolute', bottom: 20, right: 20, backgroundColor: COLORS.primary, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 8 },
  overlay:            { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:              { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '90%' },
  sheetHeader:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetTitle:         { fontSize: 18, fontWeight: '700', color: COLORS.dark },
  label:              { fontSize: 13, fontWeight: '600', color: COLORS.dark, marginBottom: 6, marginTop: 12 },
  input:              { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: COLORS.background, fontSize: 14, color: COLORS.dark },
  noHotelBox:         { backgroundColor: '#FFF7ED', borderRadius: 12, padding: 16, alignItems: 'center', gap: 6, marginBottom: 4 },
  noHotelText:        { fontSize: 14, fontWeight: '700', color: COLORS.dark },
  noHotelSub:         { fontSize: 12, color: COLORS.textMuted, textAlign: 'center' },
  hotelGrid:          { gap: 8, marginBottom: 4 },
  hotelCard:          { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12, padding: 12, backgroundColor: COLORS.background },
  hotelCardSel:       { borderColor: COLORS.primary, backgroundColor: '#EEF2FF' },
  hotelIconBox:       { width: 40, height: 40, borderRadius: 10, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center' },
  hotelCardName:      { fontSize: 14, fontWeight: '700', color: COLORS.dark },
  hotelCardCity:      { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  hotelCheckBadge:    { width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  emojiPicker:        { width: 52, height: 52, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' },
  saveBtn:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 15, marginTop: 20 },
  saveBtnText:        { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  pickerSheet:        { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, position: 'absolute', bottom: 0, left: 0, right: 0 },
  pickerItem:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  pickerItemActive:   { backgroundColor: '#EEF2FF', marginHorizontal: -20, paddingHorizontal: 20 },
  pickerItemText:     { fontSize: 15, color: COLORS.dark },
  pickerItemTextActive: { color: COLORS.primary, fontWeight: '700' },
  emojiOption:        { width: 52, height: 52, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.border },
  emojiOptionActive:  { borderColor: COLORS.primary, backgroundColor: '#EEF2FF' },
});
