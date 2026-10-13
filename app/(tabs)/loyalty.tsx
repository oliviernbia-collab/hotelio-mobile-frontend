import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { LOYALTY_TIERS, getTier } from '@/app/(tabs)/clients';
import { COLORS } from '@/constants';
import { FontAwesome5 } from '@expo/vector-icons';

export default function LoyaltyScreen() {
  const { t } = useTranslation();
  const { user } = useAuthStore();

  const pts  = (user as any)?.points_fidelite ?? 0;
  const tier = getTier(pts);
  const next = LOYALTY_TIERS.find(ti => ti.min > tier.min);
  const progress = next ? Math.min(1, (pts - tier.min) / (next.min - tier.min)) : 1;

  return (
    <ScrollView style={styles.container}>
      <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: tier.color }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.loyaltyBadge, { backgroundColor: tier.bg }]}>
            <Text style={styles.loyaltyBadgeIcon}>{tier.icon}</Text>
            <Text style={[styles.loyaltyBadgeName, { color: tier.color }]}>{tier.name}</Text>
          </View>
        </View>

        <View style={styles.ptsDisplay}>
          <Text style={[styles.ptsNumber, { color: tier.color }]}>{pts}</Text>
          <Text style={styles.ptsSuffix}>{t('profile.points')}</Text>
        </View>

        <View style={styles.progressTrackFull}>
          <View style={[styles.progressFill, { backgroundColor: tier.color, width: `${Math.round(progress * 100)}%` as any }]} />
        </View>

        {next ? (
          <Text style={styles.progressHint}>
            {t('profile.nextLevel', { count: next.min - pts, name: next.name, icon: next.icon })}
          </Text>
        ) : (
          <Text style={[styles.progressHint, { color: tier.color, fontWeight: '700' }]}>
            {t('profile.maxLevel')}
          </Text>
        )}

        <View style={[styles.perkRow, { backgroundColor: tier.bg }]}>
          <FontAwesome5 name="gift" size={13} color={tier.color} />
          <Text style={[styles.perkRowText, { color: tier.color }]}>{tier.perk}</Text>
        </View>

        <Text style={styles.tiersTitle}>{t('profile.allTiers')}</Text>
        {LOYALTY_TIERS.map(ti => (
          <View key={ti.name} style={[styles.tierRow, pts >= ti.min && { opacity: 1 }, pts < ti.min && { opacity: 0.45 }]}>
            <Text style={styles.tierRowIcon}>{ti.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.tierRowName, { color: ti.color }]}>{ti.name} — {ti.min}+ pts</Text>
              <Text style={styles.tierRowPerk}>{ti.perk}</Text>
            </View>
            {pts >= ti.min && <FontAwesome5 name="check-circle" size={14} color={ti.color} solid />}
          </View>
        ))}
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: COLORS.background },
  card:             { backgroundColor: COLORS.white, margin: 12, borderRadius: 14, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardHeader:       { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 12 },
  loyaltyBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  loyaltyBadgeIcon: { fontSize: 14 },
  loyaltyBadgeName: { fontSize: 12, fontWeight: '700' },
  ptsDisplay:       { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginVertical: 8 },
  ptsNumber:        { fontSize: 42, fontWeight: '900' },
  ptsSuffix:        { fontSize: 16, color: COLORS.textMuted, fontWeight: '500' },
  progressTrackFull:{ height: 8, backgroundColor: '#E2E8F0', borderRadius: 4, overflow: 'hidden', marginBottom: 6 },
  progressFill:     { height: 8, borderRadius: 4 },
  progressHint:     { fontSize: 12, color: COLORS.textMuted, marginBottom: 10 },
  perkRow:          { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, marginBottom: 14 },
  perkRowText:      { fontSize: 13, fontWeight: '600', flex: 1 },
  tiersTitle:       { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 },
  tierRow:          { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tierRowIcon:      { fontSize: 18, width: 24, textAlign: 'center' },
  tierRowName:      { fontSize: 13, fontWeight: '700' },
  tierRowPerk:      { fontSize: 11, color: COLORS.textMuted },
});
