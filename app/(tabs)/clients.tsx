import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, Modal, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { clientApi } from '@/services/api';
import { Client } from '@/types';
import { COLORS } from '@/constants';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

// ─── Paliers de fidélité ──────────────────────────────────────────────────────

export const LOYALTY_TIERS = [
  { name: 'Bronze',   min: 0,    max: 499,   color: '#CD7F32', bg: '#FDF2E9', icon: '🥉', perk: '5% de réduction' },
  { name: 'Silver',   min: 500,  max: 999,   color: '#94A3B8', bg: '#F1F5F9', icon: '🥈', perk: '10% de réduction + cadeau de bienvenue' },
  { name: 'Gold',     min: 1000, max: 2499,  color: '#F59E0B', bg: '#FFFBEB', icon: '🥇', perk: '15% de réduction + 1 nuit offerte / 5 séjours' },
  { name: 'Platinum', min: 2500, max: Infinity, color: '#6366F1', bg: '#EEF2FF', icon: '💎', perk: '20% de réduction + accès VIP + 1 nuit / 3 séjours' },
];

export function getTier(pts: number) {
  return LOYALTY_TIERS.find(t => pts >= t.min && pts <= t.max) ?? LOYALTY_TIERS[0];
}

// ─── Écran principal ──────────────────────────────────────────────────────────

type TopClient = Client & {
  total_spend: number;
  total_stays: number;
  last_visit: string | null;
  hotels_visited: string | null;
};

export default function TopClientsScreen() {
  const { t } = useTranslation();
  const [clients,    setClients]    = useState<TopClient[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected,   setSelected]   = useState<TopClient | null>(null);
  const [pointsInput, setPointsInput] = useState('');
  const [reason,      setReason]     = useState('');
  const [saving,      setSaving]     = useState(false);

  const load = async () => {
    try {
      const res = await clientApi.top({ limit: 30 });
      setClients(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  const openPoints = (c: TopClient) => {
    setSelected(c);
    setPointsInput('');
    setReason('');
  };

  const handleAddPoints = async () => {
    const pts = parseInt(pointsInput);
    if (!pointsInput || isNaN(pts)) {
      Alert.alert(t('common.error'), t('clients.invalidPoints'));
      return;
    }
    setSaving(true);
    try {
      await clientApi.addPoints(selected!.id, { points: pts, reason });
      setSelected(null);
      load();
      Alert.alert(t('clients.pointsUpdated'), t('clients.pointsUpdatedMsg', { pts: `${pts > 0 ? '+' : ''}${pts}`, name: `${selected!.first_name} ${selected!.last_name}` }));
    } catch (e: any) {
      Alert.alert(t('common.error'), e.response?.data?.message ?? t('clients.cannotUpdatePoints'));
    } finally { setSaving(false); }
  };

  const renderItem = ({ item, index }: { item: TopClient; index: number }) => {
    const tier   = getTier(item.points_fidelite ?? 0);
    const pts    = item.points_fidelite ?? 0;
    const medal  = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : null;

    return (
      <View style={styles.card}>
        {/* Rang + avatar */}
        <View style={styles.cardLeft}>
          <View style={[styles.avatarCircle, { backgroundColor: tier.bg, borderColor: tier.color }]}>
            <Text style={styles.avatarText}>
              {item.first_name[0]}{item.last_name[0]}
            </Text>
          </View>
          {medal && <Text style={styles.medal}>{medal}</Text>}
        </View>

        {/* Infos */}
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.clientName} numberOfLines={1}>
              {item.first_name} {item.last_name}
            </Text>
            <View style={[styles.tierBadge, { backgroundColor: tier.bg, borderColor: tier.color }]}>
              <Text style={styles.tierIcon}>{tier.icon}</Text>
              <Text style={[styles.tierLabel, { color: tier.color }]}>{tier.name}</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <FontAwesome5 name="wallet" size={10} color={COLORS.textMuted} />
              <Text style={styles.statValue}>{Number(item.total_spend).toLocaleString()} FCFA</Text>
            </View>
            <View style={styles.statItem}>
              <FontAwesome5 name="bed" size={10} color={COLORS.textMuted} />
              <Text style={styles.statValue}>{item.total_stays} {item.total_stays > 1 ? t('clients.stays') : t('clients.stay')}</Text>
            </View>
          </View>

          {item.hotels_visited && (
            <Text style={styles.hotelsVisited} numberOfLines={1}>
              🏨 {item.hotels_visited}
            </Text>
          )}

          {/* Barre de points */}
          <View style={styles.pointsRow}>
            <Text style={[styles.ptsValue, { color: tier.color }]}>{pts} pts</Text>
            <PointsBar pts={pts} tier={tier} />
          </View>
        </View>

        {/* Bouton points */}
        <TouchableOpacity style={[styles.ptsBtn, { borderColor: tier.color }]} onPress={() => openPoints(item)}>
          <FontAwesome5 name="star" size={11} color={tier.color} solid />
          <Text style={[styles.ptsBtnText, { color: tier.color }]}>{t('clients.pointsBtn')}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* En-tête */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('profile.nav_topClients')}</Text>
        <Text style={styles.headerSub}>{t('clients.subtitle')}</Text>

        {/* Légende paliers */}
        <View style={styles.tiersRow}>
          {LOYALTY_TIERS.map(t => (
            <View key={t.name} style={[styles.tierChip, { backgroundColor: t.bg }]}>
              <Text style={styles.tierChipIcon}>{t.icon}</Text>
              <Text style={[styles.tierChipLabel, { color: t.color }]}>{t.name}</Text>
              <Text style={[styles.tierChipPts, { color: t.color }]}>{t.min}+</Text>
            </View>
          ))}
        </View>
      </View>

      <FlatList
        data={clients}
        keyExtractor={c => String(c.id)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[COLORS.primary]} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <FontAwesome5 name="users" size={48} color={COLORS.grayLight} />
              <Text style={styles.emptyText}>{t('clients.empty')}</Text>
              <Text style={styles.emptySub}>{t('clients.emptyHint')}</Text>
            </View>
          ) : <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
        }
      />

      {/* Modal attribution de points */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            {selected && (() => {
              const tier = getTier(selected.points_fidelite ?? 0);
              return (
                <>
                  <View style={styles.sheetHeader}>
                    <View>
                      <Text style={styles.sheetTitle}>{selected.first_name} {selected.last_name}</Text>
                      <Text style={styles.sheetSub}>
                        {tier.icon} {tier.name} · {t('clients.currentPoints', { points: selected.points_fidelite ?? 0 })}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => setSelected(null)}>
                      <FontAwesome5 name="times" size={18} color={COLORS.textMuted} />
                    </TouchableOpacity>
                  </View>

                  {/* Avantages du palier */}
                  <View style={[styles.perkBox, { backgroundColor: tier.bg, borderColor: tier.color }]}>
                    <FontAwesome5 name="gift" size={13} color={tier.color} />
                    <Text style={[styles.perkText, { color: tier.color }]}>{tier.perk}</Text>
                  </View>

                  <Text style={styles.fieldLabel}>{t('clients.pointsToAward')}</Text>
                  <View style={styles.inputRow}>
                    <TouchableOpacity style={styles.quickBtn} onPress={() => setPointsInput(p => String((parseInt(p) || 0) - 50))}>
                      <Text style={styles.quickBtnText}>−50</Text>
                    </TouchableOpacity>
                    <TextInput
                      style={styles.input}
                      value={pointsInput}
                      onChangeText={setPointsInput}
                      keyboardType="number-pad"
                      placeholder={t('clients.pointsPlaceholder')}
                      placeholderTextColor={COLORS.textMuted}
                    />
                    <TouchableOpacity style={[styles.quickBtn, styles.quickBtnPos]} onPress={() => setPointsInput(p => String((parseInt(p) || 0) + 50))}>
                      <Text style={[styles.quickBtnText, { color: COLORS.white }]}>+50</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.quickRow}>
                    {[100, 250, 500].map(v => (
                      <TouchableOpacity key={v} style={styles.presetBtn} onPress={() => setPointsInput(String(v))}>
                        <Text style={styles.presetBtnText}>+{v}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.fieldLabel}>{t('clients.reasonLabel')}</Text>
                  <TextInput
                    style={[styles.input, { marginTop: 0 }]}
                    value={reason}
                    onChangeText={setReason}
                    placeholder={t('clients.reasonPlaceholder')}
                    placeholderTextColor={COLORS.textMuted}
                  />

                  {/* Aperçu nouveau total */}
                  {pointsInput && !isNaN(parseInt(pointsInput)) && (
                    <View style={styles.previewRow}>
                      <Text style={styles.previewLabel}>{t('clients.newTotal')}</Text>
                      <Text style={[styles.previewValue, { color: getTier(Math.max(0, (selected.points_fidelite ?? 0) + parseInt(pointsInput))).color }]}>
                        {Math.max(0, (selected.points_fidelite ?? 0) + parseInt(pointsInput))} pts
                        {' '}{getTier(Math.max(0, (selected.points_fidelite ?? 0) + parseInt(pointsInput))).icon}
                      </Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={[styles.confirmBtn, saving && { opacity: 0.6 }]}
                    onPress={handleAddPoints}
                    disabled={saving}
                  >
                    {saving
                      ? <ActivityIndicator color={COLORS.white} />
                      : <>
                          <FontAwesome5 name="star" size={14} color={COLORS.white} solid />
                          <Text style={styles.confirmBtnText}>{t('common.confirm')}</Text>
                        </>
                    }
                  </TouchableOpacity>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Barre de progression vers le prochain palier ────────────────────────────

function PointsBar({ pts, tier }: { pts: number; tier: typeof LOYALTY_TIERS[0] }) {
  const { t } = useTranslation();
  const nextTier = LOYALTY_TIERS.find(t => t.min > tier.min);
  if (!nextTier) return (
    <View style={styles.progressWrap}>
      <View style={[styles.progressBar, { backgroundColor: tier.color, width: '100%' }]} />
      <Text style={[styles.progressLabel, { color: tier.color }]}>{t('clients.maxTierShort')}</Text>
    </View>
  );
  const progress = Math.min(1, (pts - tier.min) / (nextTier.min - tier.min));
  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressBar, { backgroundColor: tier.color, width: `${Math.round(progress * 100)}%` }]} />
      </View>
      <Text style={styles.progressLabel}>{t('clients.nextTier', { count: nextTier.min - pts, name: nextTier.name, icon: nextTier.icon })}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.background },

  header:       { backgroundColor: COLORS.primary, padding: 16, paddingBottom: 12 },
  headerTitle:  { fontSize: 20, fontWeight: '800', color: COLORS.white },
  headerSub:    { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 12 },
  tiersRow:     { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  tierChip:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  tierChipIcon: { fontSize: 12 },
  tierChipLabel:{ fontSize: 10, fontWeight: '700' },
  tierChipPts:  { fontSize: 9, fontWeight: '500', opacity: 0.8 },

  card:         { backgroundColor: COLORS.white, borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardLeft:     { alignItems: 'center', gap: 4 },
  avatarCircle: { width: 46, height: 46, borderRadius: 23, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  avatarText:   { fontSize: 14, fontWeight: '800', color: COLORS.dark },
  medal:        { fontSize: 14 },

  nameRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  clientName:   { fontSize: 14, fontWeight: '700', color: COLORS.dark, flex: 1, marginRight: 8 },
  tierBadge:    { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  tierIcon:     { fontSize: 11 },
  tierLabel:    { fontSize: 10, fontWeight: '700' },

  statsRow:     { flexDirection: 'row', gap: 12, marginBottom: 3 },
  statItem:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statValue:    { fontSize: 11, color: COLORS.textMuted },
  hotelsVisited:{ fontSize: 10, color: COLORS.textMuted, marginBottom: 4 },

  pointsRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  ptsValue:     { fontSize: 13, fontWeight: '800', minWidth: 55 },
  progressWrap: { flex: 1, gap: 2 },
  progressTrack:{ height: 5, backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden' },
  progressBar:  { height: 5, borderRadius: 3 },
  progressLabel:{ fontSize: 9, color: COLORS.textMuted },

  ptsBtn:       { alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 7, borderRadius: 10, borderWidth: 1.5, backgroundColor: COLORS.white },
  ptsBtnText:   { fontSize: 10, fontWeight: '700' },

  empty:        { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText:    { fontSize: 16, color: COLORS.textMuted },
  emptySub:     { fontSize: 12, color: COLORS.grayLight, textAlign: 'center', maxWidth: 250 },

  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:        { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36 },
  sheetHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  sheetTitle:   { fontSize: 17, fontWeight: '700', color: COLORS.dark },
  sheetSub:     { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },

  perkBox:      { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, borderWidth: 1, marginBottom: 16 },
  perkText:     { fontSize: 13, fontWeight: '600', flex: 1 },

  fieldLabel:   { fontSize: 13, fontWeight: '600', color: COLORS.dark, marginBottom: 8, marginTop: 12 },
  inputRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input:        { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: COLORS.dark, backgroundColor: COLORS.background, textAlign: 'center', fontWeight: '700' },
  quickBtn:     { width: 44, height: 44, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.border, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  quickBtnPos:  { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  quickBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.dark },

  quickRow:     { flexDirection: 'row', gap: 8, marginTop: 8 },
  presetBtn:    { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: '#EEF2FF', alignItems: 'center' },
  presetBtnText:{ fontSize: 13, fontWeight: '700', color: COLORS.primary },

  previewRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.background, borderRadius: 10, padding: 12, marginTop: 12 },
  previewLabel: { fontSize: 14, color: COLORS.textMuted },
  previewValue: { fontSize: 18, fontWeight: '800' },

  confirmBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, marginTop: 16 },
  confirmBtnText:{ color: COLORS.white, fontSize: 15, fontWeight: '700' },
});
