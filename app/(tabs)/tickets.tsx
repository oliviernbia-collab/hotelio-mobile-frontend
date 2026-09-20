import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl,
  Modal, ScrollView, TextInput, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert,
} from 'react-native';
import { ticketApi, hotelApi } from '@/services/api';
import { Ticket, Hotel } from '@/types';
import { COLORS } from '@/constants';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';

const PRIORITY_COLORS: Record<string, string> = {
  urgent: COLORS.danger,
  normal: COLORS.warning,
  faible: COLORS.success,
};

const TICKET_TYPES = ['support', 'maintenance', 'réclamation', 'demande', 'autre'];
const PRIORITIES   = ['faible', 'normal', 'urgent'] as const;
const STATUS_TABS  = ['tous', 'ouvert', 'fermé'];

const TICKET_TYPE_KEYS: Record<string, string> = {
  support: 'tickets.type_support', maintenance: 'tickets.type_maintenance',
  réclamation: 'tickets.type_réclamation', demande: 'tickets.type_demande', autre: 'tickets.type_autre',
};
const PRIORITY_KEYS: Record<string, string> = {
  urgent: 'tickets.priority_urgent', normal: 'tickets.priority_normal', faible: 'tickets.priority_faible',
};
const STATUS_KEYS: Record<string, string> = {
  ouvert: 'tickets.status_ouvert', fermé: 'tickets.status_fermé',
};

const EMPTY_FORM = {
  hotel_id:    '' as string | number,
  title:       '',
  ticket_type: 'support',
  priority:    'normal' as 'faible' | 'normal' | 'urgent',
  description: '',
};

export default function TicketsScreen() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const isManager = user?.role === 'admin' || user?.role === 'prestataire';

  const [tickets,    setTickets]    = useState<Ticket[]>([]);
  const [hotels,     setHotels]     = useState<Hotel[]>([]);
  const [activeTab,  setActiveTab]  = useState('tous');
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal,  setShowModal]  = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [form,       setForm]       = useState({ ...EMPTY_FORM });

  const loadTickets = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (activeTab !== 'tous') params.status = activeTab;
      const res = await ticketApi.list(params);
      setTickets(res.data.data ?? res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab]);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  useEffect(() => {
    if (!isManager) return;
    hotelApi.mine().then(res => {
      const list = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
      setHotels(list);
      setForm(f => ({ ...f, hotel_id: list[0]?.id ?? '' }));
    }).catch(() => {});
  }, [isManager]);

  const closeTicket = async (id: number) => {
    try {
      await ticketApi.update(id, { status: 'fermé' });
      loadTickets();
    } catch {}
  };

  const handleCreate = async () => {
    if (!form.hotel_id) { Alert.alert(t('common.required'), t('menu.selectHotelMsg')); return; }
    if (!form.title.trim()) { Alert.alert(t('common.required'), t('tickets.titleRequiredMsg')); return; }
    setSaving(true);
    try {
      await ticketApi.create({
        hotel_id:    Number(form.hotel_id),
        title:       form.title.trim(),
        ticket_type: form.ticket_type,
        priority:    form.priority,
        description: form.description.trim() || undefined,
      });
      setShowModal(false);
      setForm({ ...EMPTY_FORM, hotel_id: hotels[0]?.id ?? '' });
      loadTickets();
    } catch (e: any) {
      Alert.alert(t('common.error'), e.response?.data?.message ?? t('tickets.cannotCreate'));
    } finally {
      setSaving(false);
    }
  };

  const renderItem = useCallback(({ item }: { item: Ticket }) => (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        <View style={[styles.priorityBadge, { backgroundColor: (PRIORITY_COLORS[item.priority] ?? COLORS.gray) + '22' }]}>
          <Text style={[styles.priorityText, { color: PRIORITY_COLORS[item.priority] ?? COLORS.gray }]}>{t(PRIORITY_KEYS[item.priority] ?? item.priority)}</Text>
        </View>
      </View>
      <Text style={styles.type}>{t(TICKET_TYPE_KEYS[item.ticket_type] ?? item.ticket_type)}</Text>
      {item.description ? <Text style={styles.desc} numberOfLines={2}>{item.description}</Text> : null}
      {(item as any).hotel_name ? <Text style={styles.hotelName}>🏨 {(item as any).hotel_name}</Text> : null}
      <View style={styles.footer}>
        <View style={[styles.statusBadge, { backgroundColor: item.status === 'fermé' ? '#D1FAE5' : '#FEF3C7' }]}>
          <Text style={[styles.statusText, { color: item.status === 'fermé' ? '#065F46' : '#92400E' }]}>
            {t(STATUS_KEYS[item.status] ?? item.status)}
          </Text>
        </View>
        {item.status !== 'fermé' && (
          <TouchableOpacity style={styles.closeBtn} onPress={() => closeTicket(item.id)}>
            <Text style={styles.closeBtnText}>{t('common.close')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  ), []);

  return (
    <View style={styles.container}>
      {/* Onglets statut */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={{ paddingHorizontal: 8, gap: 6, paddingVertical: 8 }}
      >
        {STATUS_TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'tous' ? t('hotels.tab_all') : t(STATUS_KEYS[tab] ?? tab)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={tickets}
        keyExtractor={(t) => String(t.id)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 12, paddingBottom: 90 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadTickets(); }}
            colors={[COLORS.primary]}
          />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <FontAwesome5 name="ticket-alt" size={48} color={COLORS.grayLight} />
              <Text style={styles.emptyText}>{t('tickets.noTickets')}</Text>
            </View>
          ) : null
        }
      />

      {/* FAB — prestataires seulement */}
      {isManager && (
        <TouchableOpacity style={styles.fab} onPress={() => setShowModal(true)}>
          <FontAwesome5 name="plus" size={22} color={COLORS.white} />
        </TouchableOpacity>
      )}

      {/* ── Modal création ticket ── */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{t('dashboard.action_tickets')}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <FontAwesome5 name="times" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Hôtel */}
              <Text style={styles.label}>{t('facturations.hotelLabel')}</Text>
              {hotels.length === 0 ? (
                <Text style={{ color: COLORS.textMuted, fontSize: 13, marginBottom: 12 }}>{t('hotels.noResults')}</Text>
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

              {/* Titre */}
              <Text style={styles.label}>{t('tickets.titleLabel')}</Text>
              <TextInput
                style={styles.input}
                value={form.title}
                onChangeText={v => setForm(f => ({ ...f, title: v }))}
                placeholder={t('tickets.titlePlaceholder')}
                placeholderTextColor={COLORS.textMuted}
              />

              {/* Type */}
              <Text style={styles.label}>{t('tickets.typeLabel')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 8 }}>
                  {TICKET_TYPES.map(tt => (
                    <TouchableOpacity
                      key={tt}
                      style={[styles.chip, form.ticket_type === tt && styles.chipActive]}
                      onPress={() => setForm(f => ({ ...f, ticket_type: tt }))}
                    >
                      <Text style={[styles.chipText, form.ticket_type === tt && styles.chipTextActive]}>{t(TICKET_TYPE_KEYS[tt] ?? tt)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* Priorité */}
              <Text style={styles.label}>{t('tickets.priorityLabel')}</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 4 }}>
                {PRIORITIES.map(p => (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.priorityBtn,
                      form.priority === p && { borderColor: PRIORITY_COLORS[p], backgroundColor: PRIORITY_COLORS[p] + '18' },
                    ]}
                    onPress={() => setForm(f => ({ ...f, priority: p }))}
                  >
                    <Text style={[styles.priorityBtnText, form.priority === p && { color: PRIORITY_COLORS[p], fontWeight: '700' }]}>{t(PRIORITY_KEYS[p] ?? p)}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Description */}
              <Text style={styles.label}>{t('hotels.descSection')}</Text>
              <TextInput
                style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
                value={form.description}
                onChangeText={v => setForm(f => ({ ...f, description: v }))}
                placeholder={t('tickets.descPlaceholder')}
                placeholderTextColor={COLORS.textMuted}
                multiline
                numberOfLines={3}
              />

              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleCreate}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color={COLORS.white} />
                  : <Text style={styles.saveBtnText}>{t('common.save')}</Text>
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
  container:       { flex: 1, backgroundColor: COLORS.background },
  tabBar:          { backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border, flexGrow: 0 },
  tab:             { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  tabActive:       { backgroundColor: COLORS.primary },
  tabText:         { fontSize: 12, color: COLORS.textMuted },
  tabTextActive:   { color: COLORS.white, fontWeight: '700' },
  card:            { backgroundColor: COLORS.white, borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 5, elevation: 2 },
  cardTop:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  title:           { fontSize: 15, fontWeight: '700', color: COLORS.dark, flex: 1, marginRight: 8 },
  priorityBadge:   { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  priorityText:    { fontSize: 11, fontWeight: '700' },
  type:            { fontSize: 12, color: COLORS.primary, fontWeight: '600', marginBottom: 4 },
  desc:            { fontSize: 13, color: COLORS.textMuted, marginBottom: 8, lineHeight: 18 },
  hotelName:       { fontSize: 12, color: COLORS.textMuted, marginBottom: 8 },
  footer:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusBadge:     { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  statusText:      { fontSize: 11, fontWeight: '700' },
  closeBtn:        { backgroundColor: COLORS.dark, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
  closeBtnText:    { color: COLORS.white, fontSize: 12, fontWeight: '700' },
  empty:           { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText:       { fontSize: 16, color: COLORS.textMuted },
  fab:             { position: 'absolute', bottom: 20, right: 20, backgroundColor: COLORS.primary, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 8 },
  overlay:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:           { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '90%' },
  sheetHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetTitle:      { fontSize: 18, fontWeight: '700', color: COLORS.dark },
  label:           { fontSize: 13, fontWeight: '600', color: COLORS.dark, marginBottom: 6, marginTop: 12 },
  input:           { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: COLORS.background, fontSize: 14, color: COLORS.dark },
  chip:            { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.white },
  chipActive:      { borderColor: COLORS.primary, backgroundColor: '#EEF2FF' },
  chipText:        { fontSize: 13, color: COLORS.textMuted },
  chipTextActive:  { color: COLORS.primary, fontWeight: '700' },
  priorityBtn:     { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center', backgroundColor: COLORS.white },
  priorityBtnText: { fontSize: 13, color: COLORS.textMuted, textTransform: 'capitalize' },
  saveBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 15, marginTop: 20 },
  saveBtnText:     { color: COLORS.white, fontSize: 15, fontWeight: '700' },
});
