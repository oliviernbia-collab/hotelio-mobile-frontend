import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { favoriteApi } from '@/services/api';
import { Hotel } from '@/types';
import { COLORS } from '@/constants';
import { FontAwesome5 } from '@expo/vector-icons';

export default function FavoritesScreen() {
  const { t } = useTranslation();
  const [hotels,     setHotels]     = useState<Hotel[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetch = async () => {
    try {
      const res = await favoriteApi.list();
      setHotels(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const removeFavorite = async (id: number) => {
    try {
      await favoriteApi.toggle(id);
      setHotels((prev) => prev.filter((h) => h.id !== id));
    } catch {}
  };

  useEffect(() => { fetch(); }, []);

  const renderItem = ({ item }: { item: Hotel }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push({ pathname: '/(tabs)/hotels/[id]', params: { id: item.id } })}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.location}>📍 {item.city}</Text>
        <Text style={styles.stars}>{'⭐'.repeat(item.stars)} · {item.price?.toLocaleString()} {t('common.fcfa')}/{t('common.night')}</Text>
      </View>
      <TouchableOpacity onPress={() => removeFavorite(item.id)}>
        <FontAwesome5 name="heart" size={24} color={COLORS.danger} solid />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={hotels}
        keyExtractor={(h) => String(h.id)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} colors={[COLORS.primary]} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <FontAwesome5 name="heart" size={48} color={COLORS.grayLight} />
              <Text style={styles.emptyText}>{t('favorites.empty')}</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  card:      { backgroundColor: COLORS.white, borderRadius: 14, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 5, elevation: 2 },
  name:      { fontSize: 15, fontWeight: '700', color: COLORS.dark },
  location:  { fontSize: 13, color: COLORS.textMuted, marginTop: 3 },
  stars:     { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  empty:     { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 16, color: COLORS.textMuted },
});
