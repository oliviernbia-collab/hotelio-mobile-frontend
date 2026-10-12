import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { subscriptionApi } from '@/services/api';
import { SubscriptionPlan } from '@/types';
import { COLORS } from '@/constants';
import { FontAwesome5 } from '@expo/vector-icons';

export default function PricingScreen() {
  const { t } = useTranslation();
  const [plans,   setPlans]   = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    subscriptionApi.plans()
      .then((res) => setPlans(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={styles.title}>{t('pricing.title')}</Text>
      <Text style={styles.subtitle}>{t('pricing.subtitle')}</Text>

      {plans.map((plan) => (
        <View key={plan.slug} style={[styles.card, plan.slug === 'business' && styles.cardFeatured]}>
          {plan.slug === 'business' && (
            <View style={styles.badge}><Text style={styles.badgeText}>{t('pricing.popular')}</Text></View>
          )}
          <Text style={styles.planName}>{plan.name}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{plan.price_monthly.toLocaleString()}</Text>
            <Text style={styles.priceUnit}>FCFA/{t('auth.planMonth')}</Text>
          </View>
          {plan.features.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <FontAwesome5 name="check-circle" size={13} color={COLORS.success} solid />
              <Text style={styles.featureText}>{f}</Text>
            </View>
          ))}
          <View style={styles.featureRow}>
            <FontAwesome5 name="check-circle" size={13} color={COLORS.success} solid />
            <Text style={styles.featureText}>
              {t('pricing.commission', { rate: Number(plan.commission_rate).toFixed(0) })}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.cta}
            onPress={() => router.push({ pathname: '/(auth)/register', params: { role: 'prestataire', plan: plan.slug } })}
          >
            <Text style={styles.ctaText}>{t('pricing.choose', { name: plan.name })}</Text>
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.background },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title:        { fontSize: 22, fontWeight: 'bold', color: COLORS.dark, textAlign: 'center', marginBottom: 8 },
  subtitle:     { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', marginBottom: 20, lineHeight: 19 },
  card:         { backgroundColor: COLORS.white, borderRadius: 16, padding: 18, marginBottom: 14, borderWidth: 1.5, borderColor: COLORS.border },
  cardFeatured: { borderColor: COLORS.primary, backgroundColor: '#EEF2FF' },
  badge:        { alignSelf: 'flex-start', backgroundColor: COLORS.primary, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 8 },
  badgeText:    { color: COLORS.white, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  planName:     { fontSize: 17, fontWeight: '700', color: COLORS.dark },
  priceRow:     { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginVertical: 8 },
  price:        { fontSize: 26, fontWeight: '800', color: COLORS.primary },
  priceUnit:    { fontSize: 12, color: COLORS.textMuted },
  featureRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  featureText:  { flex: 1, fontSize: 13, color: COLORS.text, lineHeight: 18 },
  cta:          { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  ctaText:      { color: COLORS.white, fontSize: 14, fontWeight: '700' },
});
