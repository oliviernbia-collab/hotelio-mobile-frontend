import { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Linking, AppState } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { reservationApi } from '@/services/api';
import { Reservation } from '@/types';
import { COLORS, PAYMENT_METHODS } from '@/constants';
import PaymentMethodIcon from '@/components/PaymentMethodIcon';

// Les dates arrivent en ISO complet (« 2026-11-02T00:00:00.000Z ») : on affiche JJ/MM/AAAA.
function fmtDate(value?: string) {
  if (!value) return '—';
  const [y, m, d] = String(value).slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export default function PaymentScreen() {
  const { t } = useTranslation();
  // `redirect` : page Jèko déjà ouverte par l'écran de réservation (pour pouvoir la rouvrir)
  const { id, redirect } = useLocalSearchParams<{ id: string; redirect?: string }>();
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [payment,     setPayment]     = useState('');
  const [loading,     setLoading]     = useState(true);
  const [processing,  setProcessing]  = useState(false);
  const [checking,    setChecking]    = useState(false);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(redirect ?? null);
  // Paiement refusé ou abandonné chez Jèko : comme la page de paiement du web, on affiche
  // l'échec et on repropose les moyens de paiement.
  const [failed,      setFailed]      = useState(false);

  const confirmedRef = useRef(false);

  useEffect(() => {
    reservationApi.get(Number(id))
      .then((res) => {
        setReservation(res.data);
        if (res.data?.paid) goConfirmed();
        else if (res.data?.status === 'paiement_échoué' && !redirect) setFailed(true);
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Un paiement Jèko déjà lancé (ex. depuis l'écran de réservation) : on reste en attente de
  // confirmation au lieu de reproposer « Payer », pour éviter un double débit.
  const pending = !failed && (!!redirectUrl || (!!reservation?.jeko_reference && !reservation?.paid));

  // Comme le retour de paiement du web : une réservation payée mène à la page de confirmation.
  const goConfirmed = () => {
    if (confirmedRef.current) return;
    confirmedRef.current = true;
    router.replace({ pathname: '/(tabs)/reservations/success', params: { id } } as any);
  };

  // Le serveur interroge Jèko directement et confirme la réservation si le paiement a abouti.
  const verify = async () => {
    const res = await reservationApi.verifyPayment(Number(id));
    if (res.data?.paid) goConfirmed();
    else if (res.data?.status === 'error') { setFailed(true); setRedirectUrl(null); }
    return !!res.data?.paid;
  };

  // Vérification automatique : au retour dans l'app (après le navigateur Jèko) puis toutes les 5 s.
  useEffect(() => {
    if (!pending) return;
    const check = () => { verify().catch(() => {}); };
    check();
    const timer = setInterval(check, 5000);
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') check(); });
    return () => { clearInterval(timer); sub.remove(); };
  }, [pending, id]);

  const handlePay = async () => {
    if (!payment) {
      Alert.alert(t('common.error'), t('hotels.paymentRequired'));
      return;
    }
    setProcessing(true);
    setFailed(false);
    try {
      const res = await reservationApi.processPayment(Number(id), { payment_method: payment });
      if (res.data?.paid) {
        goConfirmed();
        return;
      }
      if (res.data?.redirectUrl) {
        setRedirectUrl(res.data.redirectUrl);
        Linking.openURL(res.data.redirectUrl);
      }
    } catch (e: any) {
      Alert.alert(t('common.error'), e.response?.data?.message ?? t('reservations.paymentFailed'));
    } finally {
      setProcessing(false);
    }
  };

  // La redirection n'est pas une preuve de paiement : on fait vérifier le statut auprès de Jèko.
  const handleCheckStatus = async () => {
    setChecking(true);
    try {
      if (!(await verify())) {
        Alert.alert(t('common.info'), t('reservations.paymentPending'));
      }
    } catch (e: any) {
      Alert.alert(t('common.error'), e.response?.data?.message ?? t('reservations.paymentFailed'));
    } finally {
      setChecking(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!reservation) return null;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{t('reservations.paymentMethod')}</Text>

      {/* Récapitulatif */}
      <View style={styles.card}>
        <Text style={styles.code}>{reservation.code}</Text>
        <View style={styles.row}>
          <Text style={styles.label}>{t('reservations.hotel')}</Text>
          {/* L'API renvoie la réservation à plat (hotel_name, room_number…), pas d'objets imbriqués */}
          <Text style={styles.value}>{(reservation as any).hotel_name ?? '—'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>{t('reservations.room')}</Text>
          <Text style={styles.value}>{t('createRes.noLabel')}{(reservation as any).room_number ?? reservation.room ?? '—'}{(reservation as any).room_type ? ` · ${(reservation as any).room_type}` : ''}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>{t('reservations.checkin')} / {t('reservations.checkout')}</Text>
          <Text style={styles.value}>{fmtDate(reservation.checkin)} → {fmtDate(reservation.checkout)} ({reservation.nights} {reservation.nights > 1 ? t('common.nights') : t('common.night')})</Text>
        </View>
        <View style={[styles.row, { borderBottomWidth: 0 }]}>
          <Text style={[styles.label, { fontWeight: '700' }]}>{t('reservations.total')}</Text>
          <Text style={styles.total}>{reservation.total?.toLocaleString()} FCFA</Text>
        </View>
      </View>

      {failed && (
        <View style={styles.failedBox}>
          <Text style={styles.failedText}>{t('reservations.paymentFailedRetry')}</Text>
        </View>
      )}

      {/* Modes de paiement */}
      <Text style={styles.sectionTitle}>{t('hotels.paymentMethod')}</Text>
      {PAYMENT_METHODS.map((pm) => (
        <TouchableOpacity
          key={pm.value}
          style={[styles.paymentOption, payment === pm.value && styles.paymentOptionActive]}
          onPress={() => setPayment(pm.value)}
        >
          <PaymentMethodIcon method={pm} />
          <Text style={[styles.paymentLabel, payment === pm.value && { color: COLORS.primary, fontWeight: '700' }]}>
            {pm.label}
          </Text>
          {payment === pm.value && (
            <View style={styles.check}>
              <Text style={{ color: COLORS.white, fontSize: 12 }}>✓</Text>
            </View>
          )}
        </TouchableOpacity>
      ))}

      {!pending && (
        <TouchableOpacity
          style={[styles.payBtn, (!payment || processing) && { opacity: 0.6 }]}
          onPress={handlePay}
          disabled={!payment || processing}
        >
          <Text style={styles.payBtnText}>
            {processing ? t('common.saving') : `${t('hotels.bookBtn')} ${reservation.total?.toLocaleString()} FCFA`}
          </Text>
        </TouchableOpacity>
      )}

      {pending && (
        <View style={styles.pendingBox}>
          <Text style={styles.pendingText}>{t('reservations.paymentPending')}</Text>

          {redirectUrl && (
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => Linking.openURL(redirectUrl)}>
              <Text style={styles.secondaryBtnText}>{t('reservations.reopenPayment')}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.payBtn, checking && { opacity: 0.6 }]}
            onPress={handleCheckStatus}
            disabled={checking}
          >
            <Text style={styles.payBtnText}>
              {checking ? t('reservations.checking') : t('reservations.paymentDone')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:           { flex: 1, backgroundColor: COLORS.background, padding: 16 },
  centered:            { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title:               { fontSize: 22, fontWeight: 'bold', color: COLORS.dark, marginBottom: 16 },
  card:                { backgroundColor: COLORS.white, borderRadius: 14, padding: 16, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 5, elevation: 2 },
  code:                { fontSize: 13, color: COLORS.primary, fontWeight: '700', marginBottom: 12 },
  row:                 { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  label:               { fontSize: 14, color: COLORS.textMuted },
  value:               { fontSize: 14, color: COLORS.dark, fontWeight: '500', maxWidth: '55%', textAlign: 'right' },
  total:               { fontSize: 18, color: COLORS.primary, fontWeight: '700' },
  sectionTitle:        { fontSize: 16, fontWeight: '700', color: COLORS.dark, marginBottom: 12 },
  paymentOption:       { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 2, borderColor: 'transparent', gap: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  paymentOptionActive: { borderColor: COLORS.primary },
  paymentLabel:        { flex: 1, fontSize: 15, color: COLORS.dark },
  check:               { width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  payBtn:              { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  payBtnText:          { color: COLORS.white, fontSize: 17, fontWeight: '700' },
  failedBox:           { backgroundColor: '#FEE2E2', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#FECACA', marginBottom: 12 },
  failedText:          { color: COLORS.danger, fontSize: 14, fontWeight: '600' },
  pendingBox:          { backgroundColor: '#FFF7E6', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#FDE4A8', gap: 10 },
  pendingText:         { fontSize: 13, color: COLORS.dark, lineHeight: 19, marginBottom: 4 },
  secondaryBtn:        { borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.primary },
  secondaryBtnText:    { color: COLORS.primary, fontSize: 15, fontWeight: '700' },
});
