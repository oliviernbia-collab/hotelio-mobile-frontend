import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, RefreshControl, ActivityIndicator, Modal, TextInput,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Stack } from 'expo-router';
import { adminApi } from '@/services/api';
import { COLORS } from '@/constants';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { PayoutBalance, FailedPayout } from '@/types';

const TYPES = ['tous', 'reservations', 'achats'] as const;
type PayoutType = typeof TYPES[number];

export default function AdminPayoutsScreen() {
  const { t } = useTranslation();
  const [type,       setType]       = useState<PayoutType>('tous');
  const [owners,     setOwners]     = useState<PayoutBalance[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOwner, setModalOwner] = useState<PayoutBalance | null>(null);
  const [amount,     setAmount]     = useState('');
  const [notes,      setNotes]      = useState('');
  const [saving,     setSaving]     = useState(false);

  const [failed,     setFailed]     = useState<{ reservations: FailedPayout[]; lignes: FailedPayout[] }>({ reservations: [], lignes: [] });
  const [retrying,   setRetrying]   = useState<string | null>(null);

  const fetchOwners = useCallback(async () => {
    try {
      const [res, fail] = await Promise.all([adminApi.payouts.list({ type }), adminApi.payouts.failed()]);
      setOwners(res.data);
      setFailed(fail.data);
    } catch (e) { console.error(e?.message || e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [type]);

  // Relance d'un virement Jèko en échec (comme le bouton « Relancer » de la page admin web)
  const handleRetry = async (kind: 'reservation' | 'ligne', id: number) => {
    setRetrying(`${kind}-${id}`);
    try {
      const res = kind === 'reservation' ? await adminApi.payouts.retry(id) : await adminApi.payouts.retryCommande(id);
      Alert.alert(t('common.success'), res.data?.message ?? t('payoutsAdmin.retried'));
      fetchOwners();
    } catch (e: any) {
      Alert.alert(t('common.error'), e.response?.data?.message ?? t('common.error'));
    } finally {
      setRetrying(null);
    }
  };

  const failedRows = [
    ...failed.reservations.map((r) => ({ ...r, kind: 'reservation' as const, label: `${t('payoutsAdmin.sourceReservation')} ${r.code} · ${r.hotel_name ?? ''}` })),
    ...failed.lignes.map((l) => ({ ...l, kind: 'ligne' as const, label: `${t('payoutsAdmin.sourcePurchase')} #${l.commande_id} · ${l.product_name ?? ''}` })),
  ];

  const failedSection = failedRows.length > 0 ? (
    <View style={styles.failedBox}>
      <Text style={styles.failedTitle}>
        <FontAwesome5 name="exclamation-triangle" size={13} color={COLORS.danger} />  {t('payoutsAdmin.failedTitle')}
      </Text>
      <Text style={styles.failedHint}>{t('payoutsAdmin.failedHint')}</Text>
      {failedRows.map((f) => {
        const key = `${f.kind}-${f.id}`;
        return (
          <View key={key} style={styles.failedRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.failedLabel}>{f.label}</Text>
              <Text style={styles.failedMeta}>{f.owner_name ?? '—'} · {Number(f.net_amount).toLocaleString()} FCFA</Text>
              {f.reason ? <Text style={styles.failedReason}>{f.reason}</Text> : null}
            </View>
            <TouchableOpacity style={styles.retryBtn} onPress={() => handleRetry(f.kind, f.id)} disabled={retrying === key}>
              {retrying === key
                ? <ActivityIndicator size="small" color={COLORS.white} />
                : <Text style={styles.retryBtnText}>{t('payoutsAdmin.retry')}</Text>}
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  ) : null;

  useEffect(() => { fetchOwners(); }, [fetchOwners]);

  const openPayoutModal = (owner: PayoutBalance) => {
    setModalOwner(owner);
    setAmount(String(owner.balance));
    setNotes('');
  };

  const handleRecordPayout = async () => {
    if (!modalOwner) return;
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      Alert.alert(t('common.error'), t('payoutsAdmin.invalidAmount'));
      return;
    }
    setSaving(true);
    try {
      await adminApi.payouts.record(modalOwner.id, { amount: amt, notes: notes.trim() || undefined });
      setModalOwner(null);
      fetchOwners();
    } catch (e: any) {
      Alert.alert(t('common.error'), e.response?.data?.message ?? t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const renderItem = ({ item }: { item: PayoutBalance }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.ownerName}>{item.name}</Text>
          <Text style={styles.ownerEmail}>{item.email}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: item.balance > 0 ? '#FEF3C7' : '#D1FAE5' }]}>
          <Text style={[styles.badgeText, { color: item.balance > 0 ? '#92400E' : '#065F46' }]}>
            {item.balance.toLocaleString()} FCFA
          </Text>
        </View>
      </View>
      <View style={styles.statsRow}>
        <Text style={styles.statText}>{t('payoutsAdmin.owed')}: {item.owed.toLocaleString()} FCFA</Text>
        <Text style={styles.statText}>{t('payoutsAdmin.alreadyPaid')}: {item.already_paid.toLocaleString()} FCFA</Text>
      </View>
      {type === 'tous' && (
        <Text style={styles.breakdownText}>
          {t('payoutsAdmin.reservations')}: {item.owed_reservations.toLocaleString()} · {t('payoutsAdmin.purchases')}: {item.owed_commandes.toLocaleString()} FCFA
        </Text>
      )}
      {item.last_payout_at && (
        <Text style={styles.lastPayout}>{t('payoutsAdmin.lastPayout')}: {item.last_payout_at}</Text>
      )}
      {item.balance > 0 && item.has_failed_payout ? (
        <TouchableOpacity style={styles.payBtn} onPress={() => openPayoutModal(item)}>
          <FontAwesome5 name="money-check-alt" size={13} color="#065F46" />
          <Text style={styles.payBtnText}>{t('payoutsAdmin.recordPayout')}</Text>
        </TouchableOpacity>
      ) : item.balance > 0 ? (
        <Text style={styles.autoPending}><FontAwesome5 name="clock" size={11} /> {t('payoutsAdmin.autoPending')}</Text>
      ) : (
        <Text style={styles.upToDate}>{t('payoutsAdmin.upToDate')}</Text>
      )}
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title: t('payoutsAdmin.screenTitle') }} />
      <View style={styles.container}>
        <View style={styles.typeRow}>
          {TYPES.map((v) => (
            <TouchableOpacity
              key={v}
              style={[styles.typeChip, type === v && styles.typeChipActive]}
              onPress={() => { setLoading(true); setType(v); }}
            >
              <Text style={[styles.typeChipText, type === v && styles.typeChipTextActive]}>
                {t(`payoutsAdmin.filter_${v}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
        ) : (
          <FlatList
            data={owners}
            keyExtractor={(o) => String(o.id)}
            renderItem={renderItem}
            contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
            ListHeaderComponent={failedSection ?? undefined}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchOwners(); }} colors={[COLORS.primary]} />}
            ListEmptyComponent={
              <View style={styles.empty}>
                <FontAwesome5 name="hand-holding-usd" size={42} color={COLORS.grayLight} />
                <Text style={styles.emptyText}>{t('payoutsAdmin.noOwners')}</Text>
              </View>
            }
          />
        )}
      </View>

      <Modal visible={!!modalOwner} transparent animationType="slide" onRequestClose={() => setModalOwner(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('payoutsAdmin.recordPayout')}</Text>
              <TouchableOpacity onPress={() => setModalOwner(null)}>
                <FontAwesome5 name="times" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.ownerModalName}>{modalOwner?.name}</Text>
              <Text style={styles.label}>{t('payoutsAdmin.amountLabel')}</Text>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder="0"
              />
              <Text style={styles.label}>{t('payoutsAdmin.notesLabel')}</Text>
              <TextInput
                style={styles.input}
                value={notes}
                onChangeText={setNotes}
                placeholder={t('payoutsAdmin.notesPlaceholder')}
              />
              <TouchableOpacity style={[styles.confirmBtn, saving && { opacity: 0.6 }]} onPress={handleRecordPayout} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color={COLORS.white} /> : <Text style={styles.confirmBtnText}>{t('common.ok')}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  failedBox:    { backgroundColor: '#FEF2F2', borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#FECACA' },
  failedTitle:  { fontSize: 15, fontWeight: '800', color: COLORS.danger, marginBottom: 4 },
  failedHint:   { fontSize: 12, color: COLORS.textMuted, marginBottom: 10, lineHeight: 17 },
  failedRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#FECACA' },
  failedLabel:  { fontSize: 13, fontWeight: '700', color: COLORS.dark },
  failedMeta:   { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  failedReason: { fontSize: 11, color: COLORS.danger, marginTop: 2 },
  retryBtn:     { backgroundColor: COLORS.danger, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, minWidth: 80, alignItems: 'center' },
  retryBtnText: { color: COLORS.white, fontSize: 12, fontWeight: '700' },
  container:   { flex: 1, backgroundColor: COLORS.background },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card:        { backgroundColor: COLORS.white, borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardHeader:  { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  ownerName:   { fontSize: 14, fontWeight: '700', color: COLORS.dark },
  ownerEmail:  { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
  badge:       { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText:   { fontSize: 12, fontWeight: '800' },
  statsRow:    { flexDirection: 'row', gap: 16, marginBottom: 4 },
  breakdownText: { fontSize: 11, color: COLORS.textMuted, marginBottom: 6 },
  typeRow:     { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4 },
  typeChip:    { flex: 1, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  typeChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeChipText:   { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },
  typeChipTextActive: { color: COLORS.white },
  autoPending: { fontSize: 12, color: '#92400E', fontWeight: '600', marginTop: 8 },
  statText:    { fontSize: 12, color: COLORS.textMuted },
  lastPayout:  { fontSize: 11, color: COLORS.textMuted, marginBottom: 10 },
  payBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#D1FAE5', borderRadius: 10, paddingVertical: 8, marginTop: 8 },
  payBtnText:  { fontSize: 12, fontWeight: '700', color: '#065F46' },
  upToDate:    { fontSize: 12, color: COLORS.success, fontWeight: '600', marginTop: 8 },
  empty:       { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText:   { fontSize: 15, color: COLORS.textMuted },
  modalOverlay:{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet:  { backgroundColor: COLORS.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle:  { fontSize: 16, fontWeight: '700', color: COLORS.dark },
  modalBody:   { padding: 18, paddingBottom: 40 },
  ownerModalName: { fontSize: 14, fontWeight: '700', color: COLORS.primary, marginBottom: 12 },
  label:       { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 6, marginTop: 10 },
  input:       { backgroundColor: COLORS.background, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border },
  confirmBtn:  { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  confirmBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
});
