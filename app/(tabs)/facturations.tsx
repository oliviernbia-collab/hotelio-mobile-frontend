import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity,
  Modal, ScrollView, TextInput, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, Linking,
} from 'react-native';
import { facturationApi, clientApi, hotelApi } from '@/services/api';
import { Facturation, Client, Hotel } from '@/types';
import { COLORS } from '@/constants';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { useTranslation } from 'react-i18next';

// ─── Constantes ───────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  paid:    { bg: '#D1FAE5', text: '#065F46' },
  pending: { bg: '#FEF3C7', text: '#92400E' },
  overdue: { bg: '#FEE2E2', text: '#991B1B' },
  partial: { bg: '#DBEAFE', text: '#1E40AF' },
  draft:   { bg: '#F3F4F6', text: '#6B7280' },
};
const STATUS_KEYS: Record<string, string> = {
  paid: 'facturations.statusPaid', pending: 'facturations.statusPending',
  overdue: 'facturations.statusOverdue', partial: 'facturations.statusPartial', draft: 'facturations.statusDraft',
};
const STATUS_OPTS = [
  { value: 'pending', labelKey: 'facturations.statusPending' },
  { value: 'paid',    labelKey: 'facturations.statusPaid'    },
  { value: 'partial', labelKey: 'facturations.statusPartial' },
  { value: 'overdue', labelKey: 'facturations.statusOverdue' },
  { value: 'draft',   labelKey: 'facturations.statusDraft'   },
];
const PAYMENT_METHODS = ['Espèces', 'Orange Money', 'MTN MoMo', 'Wave', 'Carte'];
const STATUS_TABS     = ['tous', 'pending', 'paid', 'overdue', 'partial', 'draft'];

const EMPTY_FORM = {
  hotel_id:       '' as string | number,
  client:         '',
  prestation:     '',
  montant:        '',
  montant_paye:   '',
  statut:         'pending',
  date_echeance:  '',
  mode_paiement:  'Espèces',
  notes:          '',
  client_user_id: null as number | null,
};

// ─── Composant principal ──────────────────────────────────────────────────────

export default function FacturationsScreen() {
  const { t } = useTranslation();
  const { user, token } = useAuthStore();
  const isManager = user?.role === 'admin' || user?.role === 'prestataire';

  // Liste
  const [facturations, setFacturations] = useState<Facturation[]>([]);
  const [stats,        setStats]        = useState<Record<string, number>>({});
  const [activeTab,    setActiveTab]    = useState('tous');
  const [listSearch,   setListSearch]   = useState('');
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);

  // Formulaire création/édition
  const [showModal,    setShowModal]    = useState(false);
  const [editItem,     setEditItem]     = useState<Facturation | null>(null);
  const [saving,       setSaving]       = useState(false);
  const [form,         setForm]         = useState({ ...EMPTY_FORM });
  const [hotels,       setHotels]       = useState<Hotel[]>([]);
  const [clients,      setClients]      = useState<Client[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [showClients,  setShowClients]  = useState(false);
  const [showPayments, setShowPayments] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date(); d.setDate(1); return d;
  });
  const [selectedClientInfo, setSelectedClientInfo] = useState<Client | null>(null);

  // Modal paiement rapide
  const [showPayModal, setShowPayModal] = useState(false);
  const [payingItem,   setPayingItem]   = useState<Facturation | null>(null);
  const [payForm,      setPayForm]      = useState({ montant_paye: '', mode_paiement: 'Espèces' });
  const [paying,       setPaying]       = useState(false);
  const [showPayModeModal, setShowPayModeModal] = useState<'form' | 'pay' | null>(null);

  // ── Chargement données ──────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (activeTab !== 'tous') params.statut = activeTab;
      const res = await facturationApi.list(params);
      const payload = res.data;
      if (Array.isArray(payload)) {
        setFacturations(payload);
        setStats({});
      } else {
        setFacturations(payload.data ?? []);
        setStats(payload.stats ?? {});
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab]);

  useEffect(() => { loadData(); }, [loadData]);

  // Hôtels + clients pour le formulaire
  useEffect(() => {
    if (!isManager) return;
    hotelApi.mine().then(res => {
      const list = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
      setHotels(list);
      setForm(f => ({ ...f, hotel_id: list[0]?.id ?? '' }));
    }).catch(() => {});

    clientApi.list({ limit: 200 }).then(res => {
      const list = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
      setClients(list);
    }).catch(() => {});
  }, [isManager]);

  // ── Filtrage local par recherche ────────────────────────────────────────────

  const displayedFacturations = listSearch.trim()
    ? facturations.filter(f =>
        f.client.toLowerCase().includes(listSearch.toLowerCase()) ||
        f.numero.toLowerCase().includes(listSearch.toLowerCase())
      )
    : facturations;

  // ── Sélection client dans le formulaire ────────────────────────────────────

  const filteredClients = clients.filter(c => {
    const q = clientSearch.toLowerCase();
    return !q
      || `${c.first_name} ${c.last_name}`.toLowerCase().includes(q)
      || (c.email ?? '').toLowerCase().includes(q);
  });

  const selectClient = (c: Client) => {
    setSelectedClientInfo(c);
    setForm(f => ({
      ...f,
      client:         `${c.first_name} ${c.last_name}`,
      client_user_id: (c as any).user_id ?? null,
    }));
    setShowClients(false);
    setClientSearch('');
  };

  // ── Ouvrir édition ──────────────────────────────────────────────────────────

  const openEdit = (item: Facturation) => {
    setEditItem(item);
    setSelectedClientInfo(null);
    setForm({
      hotel_id:       (item as any).hotel_id ?? '',
      client:         item.client,
      prestation:     item.prestation ?? '',
      montant:        String(item.montant ?? ''),
      montant_paye:   String(item.montant_paye ?? ''),
      statut:         item.statut ?? 'pending',
      date_echeance:  item.date_echeance ?? '',
      mode_paiement:  item.mode_paiement ?? 'Espèces',
      notes:          item.notes ?? '',
      client_user_id: null,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditItem(null);
    setSelectedClientInfo(null);
  };

  // ── Sauvegarder facture ─────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.client.trim()) { Alert.alert(t('facturations.clientRequired'), t('facturations.clientRequiredMsg')); return; }
    if (!form.montant || isNaN(Number(form.montant))) { Alert.alert(t('facturations.amountRequired'), t('facturations.amountRequiredMsg')); return; }
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        client:        form.client.trim(),
        prestation:    form.prestation.trim() || undefined,
        montant:       Number(form.montant),
        date_echeance: form.date_echeance || undefined,
        mode_paiement: form.mode_paiement,
        notes:         form.notes.trim() || undefined,
      };
      if (form.hotel_id)       payload.hotel_id       = Number(form.hotel_id);
      if (form.client_user_id) payload.client_user_id = form.client_user_id;

      if (editItem) {
        payload.statut = form.statut;
        if (form.montant_paye !== '' && !isNaN(Number(form.montant_paye))) {
          payload.montant_paye = Number(form.montant_paye);
        }
        await facturationApi.update(editItem.id, payload);
      } else {
        await facturationApi.create(payload);
      }
      closeModal();
      setForm({ ...EMPTY_FORM, hotel_id: hotels[0]?.id ?? '' });
      loadData();
    } catch (e: any) {
      Alert.alert(t('common.error'), e.response?.data?.message ?? t('facturations.cannotSave'));
    } finally {
      setSaving(false);
    }
  };

  // ── Paiement rapide ─────────────────────────────────────────────────────────

  const openPayModal = (item: Facturation) => {
    setPayingItem(item);
    setPayForm({
      montant_paye:  String(item.montant_paye ?? ''),
      mode_paiement: item.mode_paiement ?? 'Espèces',
    });
    setShowPayModal(true);
  };

  const handlePay = async () => {
    if (!payingItem) return;
    const paye = Number(payForm.montant_paye);
    if (!payForm.montant_paye || isNaN(paye) || paye < 0) {
      Alert.alert(t('facturations.invalidAmount'), t('facturations.invalidAmountMsg'));
      return;
    }
    if (paye > Number(payingItem.montant)) {
      Alert.alert(t('facturations.amountTooHigh'), t('facturations.amountTooHighMsg', { amount: Number(payingItem.montant).toLocaleString() }));
      return;
    }
    setPaying(true);
    try {
      await facturationApi.pay(payingItem.id, {
        montant_paye:  paye,
        mode_paiement: payForm.mode_paiement,
      });
      setShowPayModal(false);
      setPayingItem(null);
      loadData();
    } catch (e: any) {
      Alert.alert(t('common.error'), e.response?.data?.message ?? t('facturations.cannotSavePayment'));
    } finally {
      setPaying(false);
    }
  };

  // ── Supprimer ───────────────────────────────────────────────────────────────

  const handleDelete = (item: Facturation) => {
    Alert.alert(
      t('facturations.deleteTitle'),
      t('facturations.deleteMsg', { numero: item.numero, client: item.client }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'), style: 'destructive',
          onPress: async () => {
            try {
              await facturationApi.delete(item.id);
              loadData();
            } catch (e: any) {
              Alert.alert(t('common.error'), e.response?.data?.message ?? t('facturations.cannotDelete'));
            }
          },
        },
      ]
    );
  };

  // ── Télécharger ─────────────────────────────────────────────────────────────

  const handleDownload = async (item: Facturation) => {
    if (!token) { Alert.alert(t('common.error'), t('facturations.sessionExpired')); return; }
    try {
      await Linking.openURL(facturationApi.downloadUrl(item.id, token));
    } catch {
      Alert.alert(t('common.error'), t('facturations.cannotOpen'));
    }
  };

  // ── Rendu carte ─────────────────────────────────────────────────────────────

  const renderItem = ({ item }: { item: Facturation }) => {
    const colors    = STATUS_COLORS[item.statut] ?? STATUS_COLORS.pending;
    const hotelName = (item as any).hotel_name as string | undefined;
    const pct       = item.montant > 0 ? Math.min(100, Math.round(((item.montant_paye ?? 0) / item.montant) * 100)) : 0;
    const reste     = (item.montant ?? 0) - (item.montant_paye ?? 0);

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.numero}>{item.numero}</Text>
            <Text style={styles.client} numberOfLines={1}>{item.client}</Text>
            {item.prestation ? <Text style={styles.prestation} numberOfLines={1}>{item.prestation}</Text> : null}
            {hotelName ? (
              <View style={styles.hotelTag}>
                <FontAwesome5 name="building" size={9} color={COLORS.primary} />
                <Text style={styles.hotelTagText}>{hotelName}</Text>
              </View>
            ) : null}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: colors.bg }]}>
            <Text style={[styles.statusText, { color: colors.text }]}>{STATUS_KEYS[item.statut] ? t(STATUS_KEYS[item.statut]) : item.statut}</Text>
          </View>
        </View>

        <View style={styles.cardBottom}>
          <FontAwesome5 name="calendar-alt" size={11} color={COLORS.textMuted} />
          <Text style={styles.dates}>
            {item.date_facture}{item.date_echeance ? ` → ${item.date_echeance}` : ''}
          </Text>
        </View>

        {/* Barre de progression paiement partiel */}
        {item.statut === 'partial' && item.montant > 0 && (
          <View style={styles.progressWrap}>
            <View style={[styles.progressFill, { width: `${pct}%` as any }]} />
          </View>
        )}
        {item.statut === 'partial' && (
          <Text style={styles.partialInfo}>
            {t('facturations.paidAmountLabel')} : {(item.montant_paye ?? 0).toLocaleString()} / {item.montant.toLocaleString()} FCFA ({pct}%)
          </Text>
        )}

        <View style={styles.cardFooter}>
          <View style={styles.amountBlock}>
            <Text style={styles.amountLabel}>
              {item.statut === 'paid' ? t('facturations.paidLabel') : item.statut === 'partial' ? t('facturations.remainingLabel') : t('facturations.totalDueLabel')}
            </Text>
            <Text style={[
              styles.amountValue,
              item.statut === 'paid'    && { color: COLORS.success },
              item.statut === 'overdue' && { color: COLORS.danger  },
            ]}>
              {item.statut === 'partial'
                ? reste.toLocaleString()
                : (item.montant ?? 0).toLocaleString()
              } FCFA
            </Text>
          </View>

          <View style={styles.cardActions}>
            {/* Bouton paiement rapide */}
            {isManager && item.statut !== 'paid' && item.statut !== 'draft' && (
              <TouchableOpacity
                style={[styles.iconBtn, styles.iconBtnPay]}
                onPress={() => openPayModal(item)}
              >
                <FontAwesome5 name="money-bill-wave" size={13} color={COLORS.success} />
              </TouchableOpacity>
            )}
            {isManager && (
              <>
                <TouchableOpacity style={styles.iconBtn} onPress={() => openEdit(item)}>
                  <FontAwesome5 name="edit" size={13} color={COLORS.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.iconBtn, styles.iconBtnDanger]} onPress={() => handleDelete(item)}>
                  <FontAwesome5 name="trash-alt" size={13} color={COLORS.danger} />
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity style={styles.downloadBtn} onPress={() => handleDownload(item)}>
              <FontAwesome5 name="download" size={12} color={COLORS.primary} />
              <Text style={styles.downloadBtnText}>{t('facturations.download')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  // ── Rendu principal ─────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>

      {/* ── Onglets statut — toujours visibles en haut ── */}
      <View style={styles.tabBarWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBarContent}
        >
          {STATUS_TABS.map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'tous' ? t('facturations.statusAll') : (STATUS_KEYS[tab] ? t(STATUS_KEYS[tab]) : tab)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── Barre de recherche ── */}
      <View style={styles.searchBar}>
        <FontAwesome5 name="search" size={13} color={COLORS.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={listSearch}
          onChangeText={setListSearch}
          placeholder={t('facturations.searchPlaceholder')}
          placeholderTextColor={COLORS.textMuted}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {listSearch.length > 0 && (
          <TouchableOpacity onPress={() => setListSearch('')}>
            <FontAwesome5 name="times-circle" size={14} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Liste ── */}
      <FlatList
        data={displayedFacturations}
        keyExtractor={f => String(f.id)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 12, paddingBottom: 90 }}
        ListHeaderComponent={(
          <View style={styles.statsRow}>
            <StatCard label={t('facturations.totalLabel')}     value={stats.total?.toLocaleString() ?? '0'}       color={COLORS.primary} />
            <StatCard label={t('facturations.collectedLabel')} value={stats.total_paye?.toLocaleString() ?? '0'}  color={COLORS.success} />
            <StatCard label={t('facturations.overdueLabel')}   value={String(stats.en_retard ?? 0)}               color={COLORS.danger} />
          </View>
        )}
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
              <FontAwesome5 name="file-alt" size={48} color={COLORS.grayLight} />
              <Text style={styles.emptyText}>
                {listSearch ? t('facturations.noResultsSearch') : t('facturations.noInvoices')}
              </Text>
            </View>
          ) : null
        }
      />

      {/* FAB */}
      {isManager && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => {
            setEditItem(null);
            setSelectedClientInfo(null);
            setForm({ ...EMPTY_FORM, hotel_id: hotels[0]?.id ?? '' });
            setShowModal(true);
          }}
        >
          <FontAwesome5 name="plus" size={22} color={COLORS.white} />
        </TouchableOpacity>
      )}

      {/* ─── Modal créer / modifier facture ─── */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={closeModal}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{editItem ? t('facturations.editTitle') : t('facturations.newTitle')}</Text>
              <TouchableOpacity onPress={closeModal}>
                <FontAwesome5 name="times" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {/* Sélection hôtel */}
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

              {/* Client */}
              <Text style={styles.label}>{t('facturations.clientLabel')}</Text>
              <View style={styles.clientRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={form.client}
                  onChangeText={v => setForm(f => ({ ...f, client: v, client_user_id: null }))}
                  placeholder={t('facturations.clientPlaceholder')}
                  placeholderTextColor={COLORS.textMuted}
                />
                <TouchableOpacity style={styles.selectClientBtn} onPress={() => setShowClients(true)}>
                  <FontAwesome5 name="user-friends" size={14} color={COLORS.primary} />
                </TouchableOpacity>
              </View>
              {form.client_user_id ? (
                <Text style={styles.notifHint}>{t('facturations.autoNotifyHint')}</Text>
              ) : null}

              {/* Infos client sélectionné */}
              {selectedClientInfo && (
                <View style={styles.clientInfoCard}>
                  {selectedClientInfo.phone ? (
                    <View style={styles.clientInfoRow}>
                      <FontAwesome5 name="phone-alt" size={11} color={COLORS.primary} />
                      <Text style={styles.clientInfoText}>{selectedClientInfo.phone}</Text>
                    </View>
                  ) : null}
                  {selectedClientInfo.email ? (
                    <View style={styles.clientInfoRow}>
                      <FontAwesome5 name="envelope" size={11} color={COLORS.primary} />
                      <Text style={styles.clientInfoText}>{selectedClientInfo.email}</Text>
                    </View>
                  ) : null}
                  {selectedClientInfo.city ? (
                    <View style={styles.clientInfoRow}>
                      <FontAwesome5 name="map-marker-alt" size={11} color={COLORS.primary} />
                      <Text style={styles.clientInfoText}>{selectedClientInfo.city}</Text>
                    </View>
                  ) : null}
                  <View style={styles.clientInfoRow}>
                    <FontAwesome5 name="star" size={11} color="#f59e0b" />
                    <Text style={styles.clientInfoText}>{selectedClientInfo.points_fidelite ?? 0} {t('facturations.loyaltyPtsShort')}</Text>
                  </View>
                </View>
              )}

              {/* Prestation */}
              <Text style={styles.label}>{t('facturations.prestationLabel')}</Text>
              <TextInput
                style={styles.input}
                value={form.prestation}
                onChangeText={v => setForm(f => ({ ...f, prestation: v }))}
                placeholder={t('facturations.prestationPlaceholder')}
                placeholderTextColor={COLORS.textMuted}
              />

              {/* Montant */}
              <Text style={styles.label}>{t('facturations.amountLabel')}</Text>
              <TextInput
                style={styles.input}
                value={form.montant}
                onChangeText={v => setForm(f => ({ ...f, montant: v.replace(/[^0-9]/g, '') }))}
                placeholder="150 000"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="number-pad"
              />

              {/* Montant payé (édition uniquement) */}
              {editItem && (
                <>
                  <Text style={styles.label}>{t('facturations.amountPaidLabel')}</Text>
                  <TextInput
                    style={styles.input}
                    value={form.montant_paye}
                    onChangeText={v => setForm(f => ({ ...f, montant_paye: v.replace(/[^0-9]/g, '') }))}
                    placeholder="0"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="number-pad"
                  />
                </>
              )}

              {/* Statut (édition uniquement) */}
              {editItem && (
                <>
                  <Text style={styles.label}>{t('facturations.statusLabel')}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                    <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 8 }}>
                      {STATUS_OPTS.map(opt => {
                        const sc = STATUS_COLORS[opt.value];
                        const active = form.statut === opt.value;
                        return (
                          <TouchableOpacity
                            key={opt.value}
                            style={[
                              styles.chip,
                              active && { backgroundColor: sc.bg, borderColor: sc.text },
                            ]}
                            onPress={() => setForm(f => ({ ...f, statut: opt.value }))}
                          >
                            <Text style={[styles.chipText, active && { color: sc.text, fontWeight: '700' }]}>
                              {t(opt.labelKey)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>
                </>
              )}

              {/* Échéance */}
              <Text style={styles.label}>{t('facturations.dueDateLabel')}</Text>
              <TouchableOpacity
                style={[styles.input, styles.dateBtn]}
                onPress={() => setShowCalendar(true)}
              >
                <FontAwesome5 name="calendar-alt" size={15} color={form.date_echeance ? COLORS.primary : COLORS.textMuted} />
                <Text style={[styles.dateBtnText, !form.date_echeance && { color: COLORS.textMuted }]}>
                  {form.date_echeance
                    ? new Date(form.date_echeance + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
                    : t('facturations.selectDate')}
                </Text>
                {form.date_echeance && (
                  <TouchableOpacity onPress={() => setForm(f => ({ ...f, date_echeance: '' }))}>
                    <FontAwesome5 name="times-circle" size={14} color={COLORS.textMuted} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>

              {/* Mode de paiement */}
              <Text style={styles.label}>{t('facturations.paymentMethodLabel')}</Text>
              <TouchableOpacity
                style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                onPress={() => setShowPayModeModal('form')}
              >
                <Text style={{ color: COLORS.dark, fontSize: 14 }}>{form.mode_paiement}</Text>
                <FontAwesome5 name="chevron-down" size={12} color={COLORS.textMuted} />
              </TouchableOpacity>

              {/* Notes */}
              <Text style={styles.label}>{t('facturations.notesLabel')}</Text>
              <TextInput
                style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
                value={form.notes}
                onChangeText={v => setForm(f => ({ ...f, notes: v }))}
                placeholder={t('facturations.notesPlaceholder')}
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
                  : <Text style={styles.saveBtnText}>{editItem ? t('facturations.saveEdit') : t('facturations.createInvoice')}</Text>
                }
              </TouchableOpacity>
              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── Modal paiement rapide ─── */}
      <Modal visible={showPayModal} transparent animationType="slide" onRequestClose={() => setShowPayModal(false)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.sheet, { maxHeight: '55%' }]}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>{t('facturations.recordPayment')}</Text>
                {payingItem && (
                  <Text style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 2 }}>
                    {payingItem.client} — {payingItem.numero}
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={() => setShowPayModal(false)}>
                <FontAwesome5 name="times" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
              {payingItem && (
                <View style={styles.payInfoBanner}>
                  <Text style={styles.payInfoLabel}>{t('facturations.totalAmount')}</Text>
                  <Text style={styles.payInfoAmount}>{Number(payingItem.montant).toLocaleString()} FCFA</Text>
                </View>
              )}

              <Text style={styles.label}>{t('facturations.amountPaidRequired')}</Text>
              <TextInput
                style={styles.input}
                value={payForm.montant_paye}
                onChangeText={v => setPayForm(f => ({ ...f, montant_paye: v.replace(/[^0-9]/g, '') }))}
                placeholder={payingItem ? String(payingItem.montant) : '0'}
                placeholderTextColor={COLORS.textMuted}
                keyboardType="number-pad"
                autoFocus
              />

              <Text style={styles.label}>{t('facturations.paymentMethodLabel')}</Text>
              <TouchableOpacity
                style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                onPress={() => setShowPayModeModal('pay')}
              >
                <Text style={{ color: COLORS.dark, fontSize: 14 }}>{payForm.mode_paiement}</Text>
                <FontAwesome5 name="chevron-down" size={12} color={COLORS.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: COLORS.success }, paying && { opacity: 0.6 }]}
                onPress={handlePay}
                disabled={paying}
              >
                {paying
                  ? <ActivityIndicator color={COLORS.white} />
                  : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <FontAwesome5 name="check-circle" size={16} color={COLORS.white} />
                      <Text style={styles.saveBtnText}>{t('facturations.validatePayment')}</Text>
                    </View>
                  )
                }
              </TouchableOpacity>
              <View style={{ height: 16 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── Modal sélection client ─── */}
      <Modal visible={showClients} transparent animationType="fade" onRequestClose={() => setShowClients(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowClients(false)}>
          <View style={[styles.sheet, { maxHeight: '70%' }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{t('facturations.chooseClient')}</Text>
              <TouchableOpacity onPress={() => setShowClients(false)}>
                <FontAwesome5 name="times" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.input, { marginBottom: 10 }]}
              value={clientSearch}
              onChangeText={setClientSearch}
              placeholder={t('facturations.searchEllipsis')}
              placeholderTextColor={COLORS.textMuted}
              autoFocus
            />
            <ScrollView keyboardShouldPersistTaps="handled">
              {filteredClients.slice(0, 40).map(c => (
                <TouchableOpacity key={c.id} style={styles.clientItem} onPress={() => selectClient(c)}>
                  <Text style={styles.clientItemName}>{c.first_name} {c.last_name}</Text>
                  {c.email ? <Text style={styles.clientItemEmail}>{c.email}</Text> : null}
                  {c.phone ? <Text style={styles.clientItemEmail}>{c.phone}</Text> : null}
                </TouchableOpacity>
              ))}
              {filteredClients.length === 0 && (
                <Text style={{ color: COLORS.textMuted, textAlign: 'center', padding: 20 }}>{t('facturations.noClientFound')}</Text>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ─── Modal mode paiement (partagé) ─── */}
      <Modal
        visible={showPayModeModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPayModeModal(null)}
      >
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowPayModeModal(null)}>
          <View style={[styles.sheet, { maxHeight: '55%' }]}>
            <Text style={[styles.sheetTitle, { marginBottom: 12 }]}>{t('facturations.paymentMethodTitle')}</Text>
            {PAYMENT_METHODS.map(m => {
              const active = showPayModeModal === 'pay'
                ? payForm.mode_paiement === m
                : form.mode_paiement === m;
              return (
                <TouchableOpacity
                  key={m}
                  style={[styles.typeItem, active && styles.typeItemActive]}
                  onPress={() => {
                    if (showPayModeModal === 'pay') setPayForm(f => ({ ...f, mode_paiement: m }));
                    else setForm(f => ({ ...f, mode_paiement: m }));
                    setShowPayModeModal(null);
                  }}
                >
                  <Text style={[styles.typeItemText, active && styles.typeItemTextActive]}>{m}</Text>
                  {active && <FontAwesome5 name="check" size={14} color={COLORS.primary} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ─── Modal calendrier ─── */}
      <Modal visible={showCalendar} transparent animationType="fade" onRequestClose={() => setShowCalendar(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowCalendar(false)}>
          <View style={styles.calendarSheet}>
            <CalendarPicker
              month={calendarMonth}
              selected={form.date_echeance}
              onPrevMonth={() => setCalendarMonth(m => { const d = new Date(m); d.setMonth(d.getMonth() - 1); return d; })}
              onNextMonth={() => setCalendarMonth(m => { const d = new Date(m); d.setMonth(d.getMonth() + 1); return d; })}
              onSelect={iso => { setForm(f => ({ ...f, date_echeance: iso })); setShowCalendar(false); }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ─── CalendarPicker ───────────────────────────────────────────────────────────

function CalendarPicker({
  month, selected, onPrevMonth, onNextMonth, onSelect,
}: {
  month: Date; selected: string;
  onPrevMonth: () => void; onNextMonth: () => void;
  onSelect: (iso: string) => void;
}) {
  const { t } = useTranslation();
  const weekDays = t('calendar.weekDaysShort', { returnObjects: true }) as string[];
  const months   = t('calendar.months', { returnObjects: true }) as string[];
  const today    = new Date(); today.setHours(0, 0, 0, 0);
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const startDow = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const toIso = (day: number) => {
    const m = String(month.getMonth() + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${month.getFullYear()}-${m}-${d}`;
  };

  return (
    <View>
      <View style={calStyles.header}>
        <TouchableOpacity onPress={onPrevMonth} style={calStyles.navBtn}>
          <FontAwesome5 name="chevron-left" size={14} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={calStyles.monthLabel}>{months[month.getMonth()]} {month.getFullYear()}</Text>
        <TouchableOpacity onPress={onNextMonth} style={calStyles.navBtn}>
          <FontAwesome5 name="chevron-right" size={14} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
      <View style={calStyles.weekRow}>
        {weekDays.map((d, i) => <Text key={i} style={calStyles.weekDay}>{d}</Text>)}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, row) => (
        <View key={row} style={calStyles.weekRow}>
          {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
            if (!day) return <View key={col} style={calStyles.cell} />;
            const iso      = toIso(day);
            const cellDate = new Date(month.getFullYear(), month.getMonth(), day);
            const isPast   = cellDate < today;
            const isToday  = cellDate.getTime() === today.getTime();
            const isSel    = iso === selected;
            return (
              <TouchableOpacity
                key={col}
                style={[calStyles.cell, isSel && calStyles.cellSelected, isToday && !isSel && calStyles.cellToday]}
                onPress={() => !isPast && onSelect(iso)}
                disabled={isPast}
              >
                <Text style={[
                  calStyles.cellText,
                  isPast  && calStyles.cellPast,
                  isToday && !isSel && calStyles.cellTodayText,
                  isSel   && calStyles.cellSelectedText,
                ]}>{day}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const calStyles = StyleSheet.create({
  header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  navBtn:           { width: 36, height: 36, borderRadius: 18, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center' },
  monthLabel:       { fontSize: 16, fontWeight: '700', color: COLORS.dark },
  weekRow:          { flexDirection: 'row' },
  weekDay:          { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: COLORS.textMuted, paddingVertical: 6 },
  cell:             { flex: 1, aspectRatio: 1, justifyContent: 'center', alignItems: 'center', margin: 2, borderRadius: 20 },
  cellSelected:     { backgroundColor: COLORS.primary },
  cellToday:        { borderWidth: 1.5, borderColor: COLORS.primary },
  cellText:         { fontSize: 13, fontWeight: '600', color: COLORS.dark },
  cellPast:         { color: COLORS.grayLight },
  cellTodayText:    { color: COLORS.primary, fontWeight: '800' },
  cellSelectedText: { color: '#fff', fontWeight: '800' },
});

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[styles.statCard, { borderTopColor: color }]}>
      <Text style={[styles.statValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: COLORS.background },

  /* Stats (ListHeaderComponent — défile avec la liste) */
  statsRow:         { flexDirection: 'row', gap: 8, marginBottom: 8 },
  statCard:         { flex: 1, backgroundColor: COLORS.white, borderRadius: 10, padding: 12, alignItems: 'center', borderTopWidth: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  statValue:        { fontSize: 14, fontWeight: '700' },
  statLabel:        { fontSize: 10, color: COLORS.textMuted, marginTop: 2, textAlign: 'center' },

  /* Tabs — wrapper View garantit une hauteur fiable */
  tabBarWrap:       { backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tabBarContent:    { paddingHorizontal: 8, gap: 6, paddingVertical: 10, alignItems: 'center' },
  tab:              { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  tabActive:        { backgroundColor: COLORS.primary },
  tabText:          { fontSize: 12, color: COLORS.textMuted },
  tabTextActive:    { color: COLORS.white, fontWeight: '700' },

  /* Search bar */
  searchBar:        { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, marginHorizontal: 12, marginTop: 8, marginBottom: 4, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, gap: 8, borderWidth: 1, borderColor: COLORS.border },
  searchInput:      { flex: 1, fontSize: 14, color: COLORS.dark, paddingVertical: 0 },

  /* Cards */
  card:             { backgroundColor: COLORS.white, borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 5, elevation: 2 },
  cardTop:          { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  numero:           { fontSize: 12, color: COLORS.primary, fontWeight: '700' },
  client:           { fontSize: 15, fontWeight: '700', color: COLORS.dark, marginTop: 2 },
  prestation:       { fontSize: 13, color: COLORS.textMuted },
  hotelTag:         { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  hotelTagText:     { fontSize: 11, color: COLORS.primary, fontWeight: '600' },
  statusBadge:      { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, alignSelf: 'flex-start' },
  statusText:       { fontSize: 11, fontWeight: '700' },
  cardBottom:       { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  dates:            { fontSize: 12, color: COLORS.textMuted },

  /* Progress bar */
  progressWrap:     { height: 6, backgroundColor: '#E0E0E0', borderRadius: 4, marginBottom: 4, overflow: 'hidden' },
  progressFill:     { height: '100%', backgroundColor: COLORS.success, borderRadius: 4 },
  partialInfo:      { fontSize: 11, color: COLORS.info ?? '#06b6d4', marginBottom: 6 },

  /* Card footer */
  cardFooter:       { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10, marginTop: 2, gap: 8 },
  amountBlock:      { gap: 1 },
  amountLabel:      { fontSize: 11, color: COLORS.textMuted, fontWeight: '500' },
  amountValue:      { fontSize: 18, fontWeight: '800', color: COLORS.dark },
  cardActions:      { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'flex-end' },
  iconBtn:          { width: 36, height: 36, borderRadius: 10, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.primary },
  iconBtnDanger:    { backgroundColor: '#FEE2E2', borderColor: COLORS.danger },
  iconBtnPay:       { backgroundColor: '#D1FAE5', borderColor: '#059669' },
  downloadBtn:      { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#EEF2FF', borderWidth: 1.5, borderColor: COLORS.primary },
  downloadBtnText:  { fontSize: 12, color: COLORS.primary, fontWeight: '700' },

  /* Empty */
  empty:            { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText:        { fontSize: 16, color: COLORS.textMuted, textAlign: 'center' },

  /* FAB */
  fab:              { position: 'absolute', bottom: 20, right: 20, backgroundColor: COLORS.primary, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 8 },

  /* Modals */
  overlay:          { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:            { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '92%' },
  sheetHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetTitle:       { fontSize: 18, fontWeight: '700', color: COLORS.dark },

  /* Form */
  label:            { fontSize: 13, fontWeight: '600', color: COLORS.dark, marginBottom: 6, marginTop: 12 },
  input:            { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: COLORS.background, fontSize: 14, color: COLORS.dark },
  chip:             { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.white },
  chipActive:       { borderColor: COLORS.primary, backgroundColor: '#EEF2FF' },
  chipText:         { fontSize: 13, color: COLORS.textMuted },
  chipTextActive:   { color: COLORS.primary, fontWeight: '700' },

  /* Client */
  clientRow:        { flexDirection: 'row', gap: 8, alignItems: 'center' },
  selectClientBtn:  { width: 46, height: 46, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', backgroundColor: '#EEF2FF' },
  notifHint:        { fontSize: 11, color: COLORS.success, marginBottom: 4 },
  clientInfoCard:   { backgroundColor: '#EEF2FF', borderRadius: 10, padding: 12, marginTop: 6, marginBottom: 4, gap: 6, borderLeftWidth: 3, borderLeftColor: COLORS.primary },
  clientInfoRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  clientInfoText:   { fontSize: 12, color: COLORS.dark, flex: 1 },
  clientItem:       { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  clientItemName:   { fontSize: 15, fontWeight: '600', color: COLORS.dark },
  clientItemEmail:  { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

  /* Date picker */
  dateBtn:          { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dateBtnText:      { flex: 1, fontSize: 14, color: COLORS.dark },
  calendarSheet:    { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 30 },

  /* Boutons save */
  saveBtn:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 15, marginTop: 20 },
  saveBtnText:      { color: COLORS.white, fontSize: 15, fontWeight: '700' },

  /* Modal paiement */
  payInfoBanner:    { backgroundColor: '#EEF2FF', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 8, marginTop: 4 },
  payInfoLabel:     { fontSize: 12, color: COLORS.textMuted, marginBottom: 4 },
  payInfoAmount:    { fontSize: 22, fontWeight: '800', color: COLORS.primary },

  /* Mode paiement */
  typeItem:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  typeItemActive:   { backgroundColor: '#EEF2FF', marginHorizontal: -20, paddingHorizontal: 20 },
  typeItemText:     { fontSize: 15, color: COLORS.dark },
  typeItemTextActive: { color: COLORS.primary, fontWeight: '700' },
});
