import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { router, Stack } from 'expo-router';
import { COLORS } from '@/constants';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { useTranslation } from 'react-i18next';

const SECTIONS = [
  {
    icon: 'users-cog',
    color: '#6366f1',
    route: '/(tabs)/admin/users' as const,
    titleKey: 'admin.users',
    descKey: 'admin.usersDesc',
  },
  {
    icon: 'clipboard-list',
    color: '#0ea5e9',
    route: '/(tabs)/admin/logs' as const,
    titleKey: 'admin.logs',
    descKey: 'admin.logsDesc',
  },
];

export default function AdminHomeScreen() {
  const { user } = useAuthStore();
  const { t } = useTranslation();

  return (
    <>
      <Stack.Screen options={{ title: t('admin.screenTitle') }} />
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
        <View style={styles.banner}>
          <FontAwesome5 name="shield-alt" size={28} color={COLORS.white} />
          <View style={{ marginLeft: 14 }}>
            <Text style={styles.bannerTitle}>{t('admin.title')}</Text>
            <Text style={styles.bannerSub}>{user?.name}</Text>
          </View>
        </View>

        {SECTIONS.map((s) => (
          <TouchableOpacity key={s.route} style={styles.card} onPress={() => router.push(s.route)}>
            <View style={[styles.iconBox, { backgroundColor: s.color + '22' }]}>
              <FontAwesome5 name={s.icon} size={26} color={s.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{t(s.titleKey)}</Text>
              <Text style={styles.cardDesc}>{t(s.descKey)}</Text>
            </View>
            <FontAwesome5 name="chevron-right" size={14} color={COLORS.grayLight} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.background },
  banner:      { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, borderRadius: 16, padding: 20, marginBottom: 20 },
  bannerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.white },
  bannerSub:   { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  card:        { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: COLORS.white, borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 3 },
  iconBox:     { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  cardTitle:   { fontSize: 15, fontWeight: '700', color: COLORS.dark },
  cardDesc:    { fontSize: 12, color: COLORS.textMuted, marginTop: 3, lineHeight: 17 },
});
