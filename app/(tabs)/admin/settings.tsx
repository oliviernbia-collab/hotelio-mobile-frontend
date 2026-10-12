import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { settingsApi } from '@/services/api';
import { COLORS } from '@/constants';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

interface SettingsData {
  platform: { name: string; apiVersion: string; environment: string };
  preferences: { defaultLanguage: string; timezone: string; currency: string; country: string; dateFormat: string };
  database: { hotels: number; reservations: number; users: number; reviews: number };
  security: { httpsEncryption: boolean; jwtAuth: boolean; bcryptHashing: boolean };
  stats: { activeHotels: number; confirmedReservations: number; availableRooms: number; vipClients: number };
}

export default function AdminSettingsScreen() {
  const { t } = useTranslation();
  const [data,    setData]    = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    settingsApi.get()
      .then((res) => setData(res.data))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <>
        <Stack.Screen options={{ title: t('admin.settings') }} />
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t('admin.settings') }} />
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 12, paddingBottom: 40 }}>
        <View style={styles.banner}>
          <FontAwesome5 name="cog" size={24} color={COLORS.white} />
          <View style={{ marginLeft: 12 }}>
            <Text style={styles.bannerTitle}>{t('settings.platformInfo')}</Text>
            <Text style={styles.bannerSub}>{data.platform.name} · API v{data.platform.apiVersion}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.preferences')}</Text>
          <MetaLine label={t('settings.language')}  value={data.preferences.defaultLanguage} />
          <MetaLine label={t('settings.timezone')}   value={data.preferences.timezone} />
          <MetaLine label={t('settings.currency')}   value={data.preferences.currency} />
          <MetaLine label={t('settings.country')}    value={data.preferences.country} />
          <MetaLine label={t('settings.dateFormat')} value={data.preferences.dateFormat} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.database')}</Text>
          <MetaLine label={t('settings.hotels')}       value={String(data.database.hotels)} />
          <MetaLine label={t('settings.reservations')} value={String(data.database.reservations)} />
          <MetaLine label={t('settings.users')}        value={String(data.database.users)} />
          <MetaLine label={t('settings.reviews')}      value={String(data.database.reviews)} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.security')}</Text>
          <View style={styles.securityGrid}>
            <SecurityBadge icon="lock" label={t('settings.https')} />
            <SecurityBadge icon="shield-alt" label={t('settings.jwt')} />
            <SecurityBadge icon="key" label={t('settings.bcrypt')} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.stats')}</Text>
          <View style={styles.statsGrid}>
            <StatTile icon="hotel" color="#f59e0b" value={data.stats.activeHotels} label={t('settings.activeHotels')} />
            <StatTile icon="calendar-check" color="#10b981" value={data.stats.confirmedReservations} label={t('settings.confirmedReservations')} />
            <StatTile icon="bed" color="#3b82f6" value={data.stats.availableRooms} label={t('settings.availableRooms')} />
            <StatTile icon="crown" color="#a855f7" value={data.stats.vipClients} label={t('settings.vipClients')} />
          </View>
        </View>
      </ScrollView>
    </>
  );
}

function MetaLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaLine}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function SecurityBadge({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.securityBadge}>
      <Text style={{ fontSize: 20 }}>{icon === 'lock' ? '🔒' : icon === 'shield-alt' ? '🛡️' : '🔑'}</Text>
      <Text style={styles.securityLabel}>{label}</Text>
    </View>
  );
}

function StatTile({ icon, color, value, label }: { icon: string; color: string; value: number; label: string }) {
  return (
    <View style={styles.statTile}>
      <FontAwesome5 name={icon as any} size={18} color={color} />
      <Text style={styles.statTileValue}>{value}</Text>
      <Text style={styles.statTileLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.background },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
  banner:       { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, borderRadius: 16, padding: 18, marginBottom: 14 },
  bannerTitle:  { fontSize: 15, fontWeight: '700', color: COLORS.white },
  bannerSub:    { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  section:      { backgroundColor: COLORS.white, borderRadius: 14, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.dark, marginBottom: 8 },
  metaLine:     { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  metaLabel:    { fontSize: 12, color: COLORS.textMuted },
  metaValue:    { fontSize: 12, fontWeight: '700', color: COLORS.dark },
  securityGrid: { flexDirection: 'row', gap: 8 },
  securityBadge:{ flex: 1, alignItems: 'center', backgroundColor: 'rgba(16,185,129,0.08)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)', borderRadius: 12, paddingVertical: 12, gap: 6 },
  securityLabel:{ fontSize: 10, fontWeight: '700', color: COLORS.dark, textAlign: 'center' },
  statsGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statTile:     { width: '47%', alignItems: 'center', backgroundColor: COLORS.background, borderRadius: 12, paddingVertical: 14, gap: 4 },
  statTileValue:{ fontSize: 18, fontWeight: '800', color: COLORS.dark },
  statTileLabel:{ fontSize: 10, color: COLORS.textMuted, textAlign: 'center' },
});
