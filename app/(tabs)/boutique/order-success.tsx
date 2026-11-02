import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, AppState, Linking } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FontAwesome5 } from '@expo/vector-icons';
import { boutiqueApi } from '@/services/api';
import { openReceipt } from '@/services/receipt';
import { COLORS, PAYMENT_METHODS } from '@/constants';

/* Confirmation d'achat boutique — équivalent mobile de commande/success côté web. Pour un
   paiement Jèko, la page attend la confirmation (vérifiée par le serveur auprès de Jèko). */

const PAID = ['payé', 'payée', 'confirmée', 'livrée'];

type Order = { id: number; statut: string; total: number; mode_paiement: string | null; created_at: string | null; transaction_id?: string | null; jeko_reference?: string | null };
type Item = { id: number; name: string; emoji?: string | null; quantite: number; prix: number; sous_total: number };

export default function OrderSuccessScreen() {
  const { t } = useTranslation();
  const { id, redirect } = useLocalSearchParams<{ id: string; redirect?: string }>();
  const [order,   setOrder]   = useState<Order | null>(null);
  const [items,   setItems]   = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const loadedItems = useRef(false);

  // « Mes commandes » vérifie aussi auprès de Jèko les commandes en attente de paiement.
  const load = useCallback(async () => {
    try {
      const res = await boutiqueApi.myOrders();
      const list: Order[] = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
      setOrder(list.find((o) => o.id === Number(id)) ?? null);
      if (!loadedItems.current) {
        const it = await boutiqueApi.orderItems(Number(id));
        setItems(it.data ?? []);
        loadedItems.current = true;
      }
    } catch {
      // nouvel essai au prochain rafraîchissement
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const pending = order?.statut === 'en_cours';
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(load, 5000);
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') load(); });
    return () => { clearInterval(timer); sub.remove(); };
  }, [pending, load]);

  const handleReceipt = async () => {
    try {
      await openReceipt(() => boutiqueApi.receiptToken(Number(id)), (token) => boutiqueApi.receiptUrl(Number(id), token));
    } catch (e: any) {
      Alert.alert(t('common.error'), e.response?.data?.message ?? t('receipt.error'));
    }
  };

  if (loading) return <View style={s.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  if (!order) {
    return (
      <View style={s.centered}>
        <Text style={s.muted}>{t('myOrders.noOrders')}</Text>
      </View>
    );
  }

  const paid = PAID.includes(order.statut);
  const pm = PAYMENT_METHODS.find((p) => p.value === order.mode_paiement);
  const date = order.created_at ? new Date(order.created_at) : null;

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Stack.Screen options={{ title: t('orderSuccess.screenTitle'), headerLeft: () => null }} />

      <View style={[s.hero, !paid && { backgroundColor: '#92400E' }]}>
        <View style={[s.heroIcon, !paid && { backgroundColor: '#F59E0B' }]}>
          {pending ? <ActivityIndicator color={COLORS.white} /> : <FontAwesome5 name={paid ? 'check' : 'times'} size={26} color={COLORS.white} />}
        </View>
        <Text style={s.heroTitle}>{paid ? t('orderSuccess.title') : pending ? t('orderSuccess.pendingTitle') : t('orderSuccess.cancelledTitle')}</Text>
        <Text style={s.heroSub}>{paid ? t('orderSuccess.subtitle') : pending ? t('orderSuccess.pendingSub') : ''}</Text>
        {pending && redirect ? (
          <TouchableOpacity style={s.reopenBtn} onPress={() => Linking.openURL(redirect)}>
            <Text style={s.reopenText}>{t('reservations.reopenPayment')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Détails, comme la page web */}
      <View style={s.card}>
        <Row label={t('orderSuccess.order')} value={`#${order.id}`} />
        <Row label={t('orderSuccess.date')} value={date ? `${date.toLocaleDateString('fr-FR')} ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : '—'} />
        <Row label={t('orderSuccess.method')} value={pm?.label ?? order.mode_paiement ?? '—'} />
        {(order.jeko_reference || order.transaction_id) ? <Row label={t('orderSuccess.reference')} value={String(order.jeko_reference || order.transaction_id)} /> : null}
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>{t('orderSuccess.items')}</Text>
        {items.map((it) => (
          <View key={it.id} style={s.itemRow}>
            <Text style={s.itemName} numberOfLines={2}>{it.emoji ? `${it.emoji} ` : ''}{it.name}</Text>
            <Text style={s.itemQty}>× {it.quantite}</Text>
            <Text style={s.itemTotal}>{Number(it.sous_total).toLocaleString()} FCFA</Text>
          </View>
        ))}
        <View style={s.totalRow}>
          <Text style={s.totalLabel}>{paid ? t('orderSuccess.amountPaid') : t('reservations.total')}</Text>
          <Text style={s.totalValue}>{Number(order.total).toLocaleString()} FCFA</Text>
        </View>
      </View>

      {paid && (
        <TouchableOpacity style={s.primaryBtn} onPress={handleReceipt}>
          <FontAwesome5 name="file-pdf" size={15} color={COLORS.white} />
          <Text style={s.primaryText}>{t('receipt.download')}</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity style={s.secondaryBtn} onPress={() => router.replace('/(tabs)/boutique/my-orders' as any)}>
        <FontAwesome5 name="list" size={14} color={COLORS.primary} />
        <Text style={s.secondaryText}>{t('orderSuccess.myOrders')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.secondaryBtn} onPress={() => router.replace('/(tabs)/boutique' as any)}>
        <FontAwesome5 name="store" size={14} color={COLORS.primary} />
        <Text style={s.secondaryText}>{t('orderSuccess.backToShop')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.background },
  centered:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  muted:       { color: COLORS.textMuted },
  hero:        { backgroundColor: COLORS.primary, borderRadius: 18, padding: 22, alignItems: 'center', marginBottom: 14 },
  heroIcon:    { width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.success, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  heroTitle:   { fontSize: 21, fontWeight: '800', color: COLORS.white, textAlign: 'center' },
  heroSub:     { fontSize: 13, color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginTop: 6, lineHeight: 19 },
  reopenBtn:   { marginTop: 12, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)' },
  reopenText:  { color: COLORS.white, fontWeight: '700' },
  card:        { backgroundColor: COLORS.white, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  cardTitle:   { fontSize: 15, fontWeight: '700', color: COLORS.dark, marginBottom: 8 },
  row:         { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  rowLabel:    { fontSize: 13, color: COLORS.textMuted },
  rowValue:    { fontSize: 13, fontWeight: '700', color: COLORS.dark, flexShrink: 1, textAlign: 'right', marginLeft: 12 },
  itemRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  itemName:    { flex: 1, fontSize: 14, color: COLORS.dark },
  itemQty:     { fontSize: 13, color: COLORS.textMuted },
  itemTotal:   { fontSize: 13, fontWeight: '700', color: COLORS.dark, minWidth: 80, textAlign: 'right' },
  totalRow:    { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12 },
  totalLabel:  { fontSize: 15, fontWeight: '700', color: COLORS.dark },
  totalValue:  { fontSize: 18, fontWeight: '800', color: COLORS.success },
  primaryBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: 12, marginTop: 4 },
  primaryText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  secondaryBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 12, marginTop: 10, borderWidth: 1, borderColor: COLORS.primary + '44', backgroundColor: COLORS.white },
  secondaryText: { color: COLORS.primary, fontSize: 14, fontWeight: '700' },
});
