import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, Alert, ActivityIndicator,
} from 'react-native';
import { Stack } from 'expo-router';
import { boutiqueApi } from '@/services/api';
import { COLORS, PAYMENT_METHODS } from '@/constants';
import { FontAwesome5 } from '@expo/vector-icons';
import PaymentMethodIcon from '@/components/PaymentMethodIcon';

/* ── Types ─────────────────────────────────────────────────────────────── */
interface Order {
  id:             number;
  statut:         string;
  total:          number;
  mode_paiement?: string;
  nb_items:       number;
  created_at:     string;
}

interface OrderItem {
  id:          number;
  product_id:  number;
  name:        string;
  emoji?:      string;
  category?:   string;
  quantite:    number;
  prix:        number;
  sous_total:  number;
  image_url?:  string;
}

/* ── Constantes ────────────────────────────────────────────────────────── */
const STATUS_COLORS: Record<string, string> = {
  confirmée: '#10b981',
  annulée:   '#E74C3C',
  en_cours:  '#f59e0b',
  livrée:    '#6366f1',
};

const STATUS_ICONS: Record<string, string> = {
  confirmée: 'check-circle',
  annulée:   'times-circle',
  en_cours:  'clock',
  livrée:    'box-open',
};

const STATUS_LABEL_KEYS: Record<string, string> = {
  confirmée: 'myOrders.status_confirmee',
  annulée:   'reservations.status_annulee',
  en_cours:  'myOrders.status_en_cours',
  livrée:    'myOrders.status_livree',
};

const PM_MAP: Record<string, typeof PAYMENT_METHODS[number]> = Object.fromEntries(
  PAYMENT_METHODS.map(p => [p.value, p])
);

/* ══════════════════════════════════════════════════════════════════════════ */
export default function MyOrdersScreen() {
  const { t } = useTranslation();
  const [orders,        setOrders]        = useState<Order[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [expandedId,    setExpandedId]    = useState<number | null>(null);
  const [itemsCache,    setItemsCache]    = useState<Record<number, OrderItem[]>>({});
  const [loadingItems,  setLoadingItems]  = useState<number | null>(null);

  /* ── Total dépensé ────────────────────────────────────────────────────── */
  const totalSpent = orders
    .filter(o => o.statut !== 'annulée')
    .reduce((s, o) => s + (Number(o.total) || 0), 0);

  const fetchOrders = async () => {
    try {
      const res = await boutiqueApi.myOrders();
      setOrders(Array.isArray(res.data) ? res.data : (res.data?.data ?? []));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchOrders(); }, []);

  /* ── Toggle détail articles ───────────────────────────────────────────── */
  const toggleDetail = async (orderId: number) => {
    if (expandedId === orderId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(orderId);
    if (itemsCache[orderId]) return; // déjà chargé

    setLoadingItems(orderId);
    try {
      const res = await boutiqueApi.orderItems(orderId);
      const items = Array.isArray(res.data) ? res.data : [];
      setItemsCache(prev => ({ ...prev, [orderId]: items }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingItems(null);
    }
  };

  /* ── Annulation ───────────────────────────────────────────────────────── */
  const handleCancel = (item: Order) => {
    Alert.alert(
      t('myOrders.cancelOrderTitle'),
      t('myOrders.cancelOrderMsg', { id: item.id, total: Number(item.total).toLocaleString(), fcfa: t('common.fcfa') }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              await boutiqueApi.cancelOrder(item.id);
              fetchOrders();
              // Invalider le cache des articles de cette commande
              setItemsCache(prev => { const n = { ...prev }; delete n[item.id]; return n; });
              Alert.alert(t('common.success'), t('myOrders.cancelSuccess'));
            } catch (e: any) {
              Alert.alert(t('common.error'), e.response?.data?.message ?? t('myOrders.cannotCancelOrder'));
            }
          },
        },
      ]
    );
  };

  const formatDate = (iso: string) => {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  /* ── Rendu d'une commande ─────────────────────────────────────────────── */
  const renderOrder = ({ item }: { item: Order }) => {
    const color       = STATUS_COLORS[item.statut]  ?? COLORS.gray;
    const icon        = STATUS_ICONS[item.statut]   ?? 'shopping-bag';
    const statusLabel = t(STATUS_LABEL_KEYS[item.statut] ?? item.statut, item.statut);
    const pm          = item.mode_paiement ? PM_MAP[item.mode_paiement] : null;
    const canCancel   = item.statut === 'confirmée' || item.statut === 'en_cours';
    const isExpanded  = expandedId === item.id;
    const isLoadingThis = loadingItems === item.id;
    const orderItems  = itemsCache[item.id] ?? [];

    return (
      <View style={styles.card}>
        {/* Ligne principale */}
        <View style={styles.cardTop}>
          <View style={[styles.statusIcon, { backgroundColor: color + '22' }]}>
            <FontAwesome5 name={icon as any} size={20} color={color} solid />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.orderId}>{t('expenses.orderFallback', { id: item.id })}</Text>
            <Text style={styles.meta}>
              {item.nb_items} {item.nb_items > 1 ? t('expenses.articles') : t('expenses.article')} · {formatDate(item.created_at)}
            </Text>
            {pm ? (
              <View style={styles.pmRow}>
                <PaymentMethodIcon method={pm} size={18} />
                <Text style={styles.pmLabel}>{pm.label}</Text>
              </View>
            ) : item.mode_paiement ? (
              <View style={styles.pmRow}>
                <FontAwesome5 name="credit-card" size={11} color={COLORS.textMuted} />
                <Text style={styles.pmLabel}>{item.mode_paiement.replace(/_/g, ' ')}</Text>
              </View>
            ) : null}
          </View>

          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <Text style={styles.total}>{Number(item.total).toLocaleString()} {t('common.fcfa')}</Text>
            <View style={[styles.statusBadge, { backgroundColor: color + '22' }]}>
              <Text style={[styles.statusText, { color }]}>{statusLabel}</Text>
            </View>
          </View>
        </View>

        {/* Bouton "Voir les articles" */}
        <TouchableOpacity style={styles.expandBtn} onPress={() => toggleDetail(item.id)}>
          {isLoadingThis ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <>
              <FontAwesome5
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={11}
                color={COLORS.primary}
              />
              <Text style={styles.expandBtnText}>
                {isExpanded ? t('myOrders.hideItems') : t('myOrders.showItems')}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Articles détaillés */}
        {isExpanded && !isLoadingThis && (
          <View style={styles.itemsWrap}>
            {orderItems.length === 0 ? (
              <Text style={styles.noItems}>{t('myOrders.noItemsFound')}</Text>
            ) : (
              <>
                {orderItems.map(oi => (
                  <View key={oi.id} style={styles.itemRow}>
                    <Text style={styles.itemEmoji}>{oi.emoji ?? '📦'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName}>{oi.name}</Text>
                      {oi.category ? (
                        <Text style={styles.itemCategory}>{oi.category}</Text>
                      ) : null}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.itemQty}>×{oi.quantite}</Text>
                      <Text style={styles.itemPrice}>{Number(oi.sous_total).toLocaleString()} {t('common.fcfa')}</Text>
                    </View>
                  </View>
                ))}
                {/* Sous-total récapitulatif */}
                <View style={styles.itemsTotalRow}>
                  <Text style={styles.itemsTotalLabel}>{t('myOrders.totalPaid')}</Text>
                  <Text style={styles.itemsTotalValue}>
                    {Number(item.total).toLocaleString()} {t('common.fcfa')}
                  </Text>
                </View>
              </>
            )}
          </View>
        )}

        {/* Bouton annulation */}
        {canCancel && (
          <TouchableOpacity style={styles.cancelBtn} onPress={() => handleCancel(item)}>
            <FontAwesome5 name="times-circle" size={13} color={COLORS.danger} />
            <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  /* ══════════════════════════════════════════════════════════════════════════
     RENDU
  ══════════════════════════════════════════════════════════════════════════ */
  return (
    <>
      <Stack.Screen options={{ title: t('profile.nav_orders') }} />
      <View style={styles.container}>
        {/* Carte récapitulatif dépenses */}
        {orders.length > 0 && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryItem}>
              <FontAwesome5 name="shopping-bag" size={16} color="rgba(255,255,255,0.75)" />
              <Text style={styles.summaryLabel}>{t('notifications.tab_orders')}</Text>
              <Text style={styles.summaryValue}>{orders.length}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <FontAwesome5 name="wallet" size={16} color="rgba(255,255,255,0.75)" />
              <Text style={styles.summaryLabel}>{t('dashboard.totalSpent')}</Text>
              <Text style={styles.summaryValue}>{totalSpent.toLocaleString()} {t('common.fcfa')}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <FontAwesome5 name="times-circle" size={16} color="rgba(255,255,255,0.75)" />
              <Text style={styles.summaryLabel}>{t('reservations.status_annulee')}</Text>
              <Text style={styles.summaryValue}>
                {orders.filter(o => o.statut === 'annulée').length}
              </Text>
            </View>
          </View>
        )}

        <FlatList
          data={orders}
          keyExtractor={o => String(o.id)}
          renderItem={renderOrder}
          contentContainerStyle={{ padding: 12 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchOrders(); }}
              colors={[COLORS.primary]}
            />
          }
          ListEmptyComponent={
            !loading ? (
              <View style={styles.empty}>
                <FontAwesome5 name="receipt" size={52} color={COLORS.grayLight} />
                <Text style={styles.emptyTitle}>{t('myOrders.noOrders')}</Text>
                <Text style={styles.emptyText}>
                  {t('myOrders.noOrdersHint')}
                </Text>
              </View>
            ) : null
          }
        />
      </View>
    </>
  );
}

/* ── Styles ─────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: COLORS.background },

  /* Carte récapitulatif */
  summaryCard:    { backgroundColor: COLORS.primary, margin: 12, borderRadius: 14, padding: 16, flexDirection: 'row' },
  summaryItem:    { flex: 1, alignItems: 'center', gap: 4 },
  summaryDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.25)', marginVertical: 4 },
  summaryLabel:   { color: 'rgba(255,255,255,0.7)', fontSize: 11, textAlign: 'center' },
  summaryValue:   { color: COLORS.white, fontSize: 14, fontWeight: '700', textAlign: 'center' },

  /* Carte commande */
  card:         { backgroundColor: COLORS.white, borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 5, elevation: 2 },
  cardTop:      { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  statusIcon:   { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  orderId:      { fontSize: 14, fontWeight: '700', color: COLORS.dark },
  meta:         { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  pmRow:        { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  pmIcon:       { fontSize: 14 },
  pmLabel:      { fontSize: 12, color: COLORS.textMuted, fontWeight: '500' },
  total:        { fontSize: 15, fontWeight: '700', color: COLORS.primary },
  statusBadge:  { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  statusText:   { fontSize: 11, fontWeight: '700' },

  /* Bouton expandable */
  expandBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, paddingVertical: 8, backgroundColor: '#EEF2FF', borderRadius: 8 },
  expandBtnText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },

  /* Articles */
  itemsWrap:      { marginTop: 8, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 8, gap: 6 },
  noItems:        { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', paddingVertical: 8 },
  itemRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  itemEmoji:      { fontSize: 22, width: 32, textAlign: 'center' },
  itemName:       { fontSize: 13, fontWeight: '600', color: COLORS.dark },
  itemCategory:   { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  itemQty:        { fontSize: 12, color: COLORS.textMuted },
  itemPrice:      { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  itemsTotalRow:  { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.border },
  itemsTotalLabel:{ fontSize: 13, fontWeight: '700', color: COLORS.dark },
  itemsTotalValue:{ fontSize: 14, fontWeight: '800', color: COLORS.primary },

  /* Annulation */
  cancelBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FECACA' },
  cancelBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.danger },

  /* Empty */
  empty:         { alignItems: 'center', paddingTop: 80, gap: 10, paddingHorizontal: 32 },
  emptyTitle:    { fontSize: 18, fontWeight: '700', color: COLORS.dark },
  emptyText:     { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },
});
