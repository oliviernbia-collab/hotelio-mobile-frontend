import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FontAwesome5 } from '@expo/vector-icons';
import { reservationApi } from '@/services/api';
import { openReceipt } from '@/services/receipt';
import HotelMap from '@/components/HotelMap';
import { COLORS, PAYMENT_METHODS } from '@/constants';

/* Page de confirmation après paiement — équivalent mobile de reservations/success.blade.php
   côté web : code de réservation, détails du séjour, montant payé, localisation de l'hôtel
   et téléchargement du reçu. */

function fmtDate(value?: string) {
  if (!value) return '—';
  const [y, m, d] = String(value).slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export default function ReservationSuccessScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [res, setRes] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    reservationApi.get(Number(id))
      .then((r) => setRes(r.data))
      .finally(() => setLoading(false));
  }, [id]);

  const handleReceipt = async () => {
    try {
      await openReceipt(
        () => reservationApi.receiptToken(Number(id)),
        (token) => reservationApi.receiptUrl(Number(id), token),
      );
    } catch (e: any) {
      Alert.alert(t('common.error'), e.response?.data?.message ?? t('receipt.error'));
    }
  };

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }
  if (!res) return null;

  const methodLabel = PAYMENT_METHODS.find((p) => p.value === res.payment_method)?.label ?? res.payment_method ?? '—';

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 32 }}>
      <Stack.Screen options={{ title: t('resSuccess.screenTitle'), headerLeft: () => null }} />

      {/* En-tête */}
      <View style={s.hero}>
        <View style={s.heroIcon}>
          <FontAwesome5 name="check" size={28} color={COLORS.white} />
        </View>
        <Text style={s.heroTitle}>{t('resSuccess.title')}</Text>
        <Text style={s.heroSub}>{t('resSuccess.subtitle', { hotel: res.hotel_name })}</Text>
        <Text style={s.heroSub}>{t('resSuccess.emailNote')}</Text>
        <View style={s.codeBox}>
          <Text style={s.codeLabel}>{t('resSuccess.code')}</Text>
          <Text style={s.code}>{res.code}</Text>
        </View>
      </View>

      {/* Détails du séjour */}
      <View style={s.card}>
        <Text style={s.cardTitle}>
          <FontAwesome5 name="calendar-check" size={14} color={COLORS.success} />  {t('resSuccess.details')}
        </Text>
        <View style={s.grid}>
          <View style={s.cell}>
            <Text style={s.cellLabel}>{t('reservations.hotel')}</Text>
            <Text style={s.cellValue}>{res.hotel_name}</Text>
            {res.hotel_city ? <Text style={s.cellSub}>{res.hotel_city}</Text> : null}
          </View>
          <View style={s.cell}>
            <Text style={s.cellLabel}>{t('reservations.room')}</Text>
            <Text style={s.cellValue}>{t('createRes.noLabel')}{res.room_number ?? res.room ?? '—'}</Text>
            <Text style={s.cellSub}>{res.nights} {res.nights > 1 ? t('common.nights') : t('common.night')}</Text>
          </View>
          <View style={s.cell}>
            <Text style={s.cellLabel}>{t('reservations.checkin')}</Text>
            <Text style={s.cellValue}>{fmtDate(res.checkin)}</Text>
            <Text style={s.cellSub}>{t('resSuccess.checkinHour')}</Text>
          </View>
          <View style={s.cell}>
            <Text style={s.cellLabel}>{t('reservations.checkout')}</Text>
            <Text style={s.cellValue}>{fmtDate(res.checkout)}</Text>
            <Text style={s.cellSub}>{t('resSuccess.checkoutHour')}</Text>
          </View>
        </View>
        <View style={s.amountRow}>
          <View>
            <Text style={s.cellSub}>{t('resSuccess.amountPaid')}</Text>
            <Text style={s.amount}>{Number(res.total).toLocaleString()} FCFA</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.cellSub}>{t('resSuccess.method')}</Text>
            <Text style={s.cellValue}>{methodLabel}</Text>
          </View>
        </View>
      </View>

      {/* Localisation (même carte que la page de confirmation du web) */}
      <HotelMap
        name={res.hotel_name}
        quartier={res.hotel_quartier}
        city={res.hotel_city}
        latitude={res.hotel_latitude}
        longitude={res.hotel_longitude}
      />

      {/* Actions */}
      <TouchableOpacity style={s.primaryBtn} onPress={handleReceipt}>
        <FontAwesome5 name="file-pdf" size={15} color={COLORS.white} />
        <Text style={s.primaryBtnText}>{t('resSuccess.downloadReceipt')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.secondaryBtn} onPress={() => router.replace('/(tabs)/reservations' as any)}>
        <FontAwesome5 name="list" size={14} color={COLORS.primary} />
        <Text style={s.secondaryBtnText}>{t('resSuccess.myReservations')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.secondaryBtn} onPress={() => router.replace('/(tabs)/hotels' as any)}>
        <FontAwesome5 name="search" size={14} color={COLORS.primary} />
        <Text style={s.secondaryBtnText}>{t('resSuccess.exploreHotels')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.background, padding: 16 },
  centered:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hero:        { backgroundColor: COLORS.primary, borderRadius: 18, padding: 22, alignItems: 'center', marginBottom: 14 },
  heroIcon:    { width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.success, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  heroTitle:   { fontSize: 22, fontWeight: '800', color: '#A7F3D0', marginBottom: 6, textAlign: 'center' },
  heroSub:     { fontSize: 13, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 19 },
  codeBox:     { marginTop: 14, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center' },
  codeLabel:   { fontSize: 11, color: 'rgba(255,255,255,0.7)' },
  code:        { fontSize: 20, fontWeight: '800', color: COLORS.white, letterSpacing: 1 },
  card:        { backgroundColor: COLORS.white, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  cardTitle:   { fontSize: 15, fontWeight: '700', color: COLORS.dark, marginBottom: 12 },
  grid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell:        { width: '48%', backgroundColor: COLORS.background, borderRadius: 12, padding: 12 },
  cellLabel:   { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, color: COLORS.textMuted, marginBottom: 4 },
  cellValue:   { fontSize: 15, fontWeight: '700', color: COLORS.dark },
  cellSub:     { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  amountRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  amount:      { fontSize: 22, fontWeight: '800', color: COLORS.success },
  primaryBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: 12, marginTop: 4 },
  primaryBtnText:   { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  secondaryBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 12, marginTop: 10, borderWidth: 1, borderColor: COLORS.primary + '44', backgroundColor: COLORS.white },
  secondaryBtnText: { color: COLORS.primary, fontSize: 14, fontWeight: '700' },
});
