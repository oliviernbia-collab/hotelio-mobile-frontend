import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Image,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { hotelApi } from '@/services/api';
import { Hotel, Room, Review } from '@/types';
import { COLORS, ROOM_STATUS_COLORS } from '@/constants';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';

const AMENITY_KEYS: Record<string, string> = {
  wifi: 'hotels.wifi', piscine: 'hotels.piscine', parking: 'hotels.parking',
  restaurant: 'hotels.restaurant', bar: 'hotels.bar', spa: 'hotels.spa', gym: 'hotels.gym',
  room_service: 'hotels.roomService', clim: 'hotels.clim', petit_dej: 'hotels.breakfast',
  transfer: 'hotels.transfer', business: 'hotels.business', tv: 'hotels.tv', coffre: 'hotels.safe',
};

const DETAIL_ROOM_TYPE_KEYS: Record<string, string> = {
  Simple: 'rooms.type_Simple', Double: 'rooms.type_Double', Twin: 'rooms.type_Twin',
  Suite: 'rooms.type_Suite', Deluxe: 'rooms.type_Deluxe', Familiale: 'rooms.type_Familiale',
  Présidentielle: 'rooms.type_Présidentielle', 'Junior Suite': 'rooms.type_JuniorSuite',
};

const DETAIL_ROOM_STATUS_KEYS: Record<string, string> = {
  disponible:   'rooms.status_disponible',
  occupée:      'rooms.status_occupée',
  réservée:     'rooms.status_réservée',
  en_nettoyage: 'rooms.status_en_nettoyage',
  hors_service: 'rooms.status_hors_service',
};

export default function HotelDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const [hotel,   setHotel]   = useState<Hotel & { rooms: Room[]; reviews: Review[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    hotelApi.get(Number(id))
      .then((res) => setHotel(res.data))
      .catch(() => Alert.alert(t('common.error'), t('hotels.notFound')))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!hotel) return null;

  return (
    <ScrollView style={styles.container}>
      {/* Hero */}
      {hotel.image_url ? (
        <Image source={{ uri: hotel.image_url }} style={styles.heroImage} resizeMode="cover" />
      ) : null}
      <View style={styles.hero}>
        {!hotel.image_url && <Text style={styles.heroEmoji}>🏨</Text>}
        <Text style={styles.hotelName}>{hotel.name}</Text>
        <Text style={styles.location}>📍 {hotel.city}{hotel.quartier ? ` · ${hotel.quartier}` : ''}</Text>
        <Text style={styles.stars}>{'⭐'.repeat(hotel.stars)} {hotel.stars} {hotel.stars > 1 ? t('hotels.stars_plural') : t('hotels.stars')}</Text>
      </View>

      {/* Infos */}
      <View style={styles.section}>
        <View style={styles.row}>
          <InfoItem icon="dollar-sign" label={t('hotels.pricePerNight')} value={`${hotel.price?.toLocaleString()} FCFA`} />
          <InfoItem icon="star"        label={t('hotels.ratingLabel')}   value={`${hotel.rating ?? '—'} / 5`} />
          <InfoItem icon="bed"         label={t('hotels.roomsCount')}    value={String(hotel.rooms_count ?? hotel.rooms?.length ?? 0)} />
        </View>
        {hotel.description && <Text style={styles.description}>{hotel.description}</Text>}
        {hotel.phone && <Text style={styles.contact}>📞 {hotel.phone}</Text>}
        {hotel.email && <Text style={styles.contact}>✉️ {hotel.email}</Text>}
      </View>

      {/* Services */}
      {Array.isArray(hotel.services) && hotel.services.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('hotels.services')}</Text>
          <View style={styles.tagsRow}>
            {hotel.services.map((s, i) => (
              <View key={i} style={styles.tag}><Text style={styles.tagText}>{t(AMENITY_KEYS[s] ?? s)}</Text></View>
            ))}
          </View>
        </View>
      )}

      {/* Chambres disponibles */}
      {hotel.rooms?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('hotels.rooms')}</Text>
          {hotel.rooms.map((room) => (
            <View key={room.id} style={styles.roomCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.roomName}>{t('common.room')} {room.number} · {t(DETAIL_ROOM_TYPE_KEYS[room.type] ?? room.type)}</Text>
                <Text style={styles.roomInfo}>{t('common.floor')} {room.floor} · {room.capacity} {t('common.person')} · {room.price?.toLocaleString()} {t('createRes.fcfaPerNight')}</Text>
              </View>
              <View style={[styles.roomStatus, { backgroundColor: ROOM_STATUS_COLORS[room.status] + '22' }]}>
                <Text style={[styles.roomStatusText, { color: ROOM_STATUS_COLORS[room.status] }]}>
                  {t(DETAIL_ROOM_STATUS_KEYS[room.status] ?? room.status)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Avis */}
      {hotel.reviews?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('hotels.reviews')}</Text>
          {hotel.reviews.map((r: any) => (
            <View key={r.id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <Text style={styles.reviewAuthor}>{r.user?.name ?? t('hotels.anonymous')}</Text>
                <Text style={styles.reviewRating}>{'⭐'.repeat(r.rating)}</Text>
              </View>
              {r.title && <Text style={styles.reviewTitle}>{r.title}</Text>}
              {r.comment && <Text style={styles.reviewComment}>{r.comment}</Text>}
            </View>
          ))}
        </View>
      )}

      {/* CTA Réserver */}
      {user?.role === 'client' && (
        <TouchableOpacity
          style={styles.bookBtn}
          onPress={() => router.push({ pathname: '/(tabs)/reservations/create', params: { hotel_id: hotel.id } })}
        >
          <Text style={styles.bookBtnText}>{t('hotels.bookNow')}</Text>
        </TouchableOpacity>
      )}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

function InfoItem({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <FontAwesome5 name={icon} size={20} color={COLORS.primary} />
      <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.dark, marginTop: 4 }}>{value}</Text>
      <Text style={{ fontSize: 11, color: COLORS.textMuted }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: COLORS.background },
  centered:        { flex: 1, justifyContent: 'center', alignItems: 'center' },
  heroImage:       { width: '100%', height: 220 },
  hero:            { backgroundColor: COLORS.primary, padding: 24, alignItems: 'center' },
  heroEmoji:       { fontSize: 48, marginBottom: 8 },
  hotelName:       { fontSize: 22, fontWeight: 'bold', color: COLORS.white, textAlign: 'center' },
  location:        { color: 'rgba(255,255,255,0.8)', marginTop: 4, fontSize: 14 },
  stars:           { color: COLORS.secondary, marginTop: 6, fontSize: 14 },
  section:         { backgroundColor: COLORS.white, margin: 12, borderRadius: 14, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  sectionTitle:    { fontSize: 16, fontWeight: '700', color: COLORS.dark, marginBottom: 12 },
  row:             { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8 },
  description:     { fontSize: 14, color: COLORS.textMuted, lineHeight: 22, marginTop: 12 },
  contact:         { fontSize: 14, color: COLORS.dark, marginTop: 6 },
  tagsRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag:             { backgroundColor: COLORS.background, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  tagText:         { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  roomCard:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  roomName:        { fontSize: 14, fontWeight: '600', color: COLORS.dark },
  roomInfo:        { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  roomStatus:      { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  roomStatusText:  { fontSize: 11, fontWeight: '700' },
  reviewCard:      { backgroundColor: COLORS.background, borderRadius: 10, padding: 12, marginBottom: 8 },
  reviewHeader:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  reviewAuthor:    { fontWeight: '700', color: COLORS.dark },
  reviewRating:    { fontSize: 13 },
  reviewTitle:     { fontWeight: '600', color: COLORS.dark, marginBottom: 4 },
  reviewComment:   { fontSize: 13, color: COLORS.textMuted, lineHeight: 20 },
  bookBtn:         { backgroundColor: COLORS.secondary, margin: 16, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  bookBtnText:     { color: COLORS.white, fontSize: 17, fontWeight: '700' },
});
