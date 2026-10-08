import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, Dimensions, Image, Linking,
} from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { reservationApi, hotelApi, roomApi } from '@/services/api';
import { Hotel, Room } from '@/types';
import { COLORS, PAYMENT_METHODS } from '@/constants';
import { FontAwesome5 } from '@expo/vector-icons';
import DatePicker from '@/components/DatePicker';
import PaymentInfoFields, { PaymentInfo, EMPTY_PAYMENT_INFO, validatePaymentInfo } from '@/components/PaymentInfoFields';
import PaymentMethodIcon from '@/components/PaymentMethodIcon';

const { width: SW } = Dimensions.get('window');

// ─── Types & constantes ───────────────────────────────────────────────────────

const ROOM_TYPE_META: Record<string, { emoji: string; descKey: string; icon: string }> = {
  'Simple':         { emoji: '🛏️',  descKey: 'createRes.desc_Simple',         icon: 'bed'    },
  'Double':         { emoji: '🛌',  descKey: 'createRes.desc_Double',         icon: 'bed'    },
  'Twin':           { emoji: '🛏️',  descKey: 'createRes.desc_Twin',           icon: 'bed'    },
  'Deluxe':         { emoji: '⭐',  descKey: 'createRes.desc_Deluxe',         icon: 'star'   },
  'Suite':          { emoji: '👑',  descKey: 'createRes.desc_Suite',          icon: 'crown'  },
  'Junior Suite':   { emoji: '🌟',  descKey: 'createRes.desc_JuniorSuite',    icon: 'star'   },
  'Familiale':      { emoji: '👨‍👩‍👧', descKey: 'createRes.desc_Familiale',      icon: 'users' },
  'Présidentielle': { emoji: '💎',  descKey: 'createRes.desc_Presidentielle', icon: 'gem'    },
};

const ROOM_TYPE_KEYS: Record<string, string> = {
  Simple: 'rooms.type_Simple', Double: 'rooms.type_Double', Twin: 'rooms.type_Twin',
  Suite: 'rooms.type_Suite', Deluxe: 'rooms.type_Deluxe', Familiale: 'rooms.type_Familiale',
  Présidentielle: 'rooms.type_Présidentielle', 'Junior Suite': 'rooms.type_JuniorSuite',
};

function typeEmoji(type: string) {
  return ROOM_TYPE_META[type]?.emoji ?? '🏨';
}

function floorLabel(floor: number, t: (k: string, o?: any) => string) {
  if (floor === 0) return t('createRes.groundFloor');
  if (floor === 1) return t('createRes.firstFloor');
  return t('createRes.nthFloor', { floor });
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmtDisplay(iso: string, monthsShort: string[]) {
  const [y, m, d] = iso.split('-');
  return `${parseInt(d)} ${monthsShort[parseInt(m) - 1]} ${y}`;
}
function fmtLong(iso: string, months: string[]) {
  const [y, m, d] = iso.split('-');
  return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`;
}

// ─── Stepper ─────────────────────────────────────────────────────────────────

function Stepper({ step, steps }: { step: number; steps: string[] }) {
  return (
    <View style={ss.stepper}>
      {steps.map((label, i) => {
        const done    = i < step;
        const current = i === step;
        return (
          <View key={i} style={ss.stepWrap}>
            <View style={[ss.stepDot, done && ss.stepDone, current && ss.stepCurrent]}>
              {done
                ? <FontAwesome5 name="check" size={9} color="#fff" />
                : <Text style={[ss.stepNum, current && { color: '#fff' }]}>{i + 1}</Text>
              }
            </View>
            <Text style={[ss.stepLabel, current && ss.stepLabelCurrent]}>{label}</Text>
            {i < steps.length - 1 && (
              <View style={[ss.stepLine, done && ss.stepLineDone]} />
            )}
          </View>
        );
      })}
    </View>
  );
}

// ─── Écran principal ──────────────────────────────────────────────────────────

export default function CreateReservationScreen() {
  const { t } = useTranslation();
  const monthsShort = t('calendar.monthsShort', { returnObjects: true }) as string[];
  const monthsFull  = t('calendar.months', { returnObjects: true }) as string[];
  const { hotel_id } = useLocalSearchParams<{ hotel_id?: string }>();

  const [step,         setStep]         = useState(0);
  const [hotels,       setHotels]       = useState<Hotel[]>([]);
  const [rooms,        setRooms]        = useState<Room[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [loading,      setLoading]      = useState(false);

  const [selHotel,  setSelHotel]  = useState<number | null>(hotel_id ? Number(hotel_id) : null);
  const [selType,   setSelType]   = useState<string | null>(null);
  const [selRoom,   setSelRoom]   = useState<number | null>(null);
  const [checkin,   setCheckin]   = useState('');
  const [checkout,  setCheckout]  = useState('');
  const [datePick,  setDatePick]  = useState<'in' | 'out' | null>(null);
  const [payMethod, setPayMethod] = useState('');
  const [payInfo,   setPayInfo]   = useState<PaymentInfo>({ ...EMPTY_PAYMENT_INFO });
  const [notes,     setNotes]     = useState('');

  // ── Fetch hôtels ──────────────────────────────────────────────────────────
  useEffect(() => {
    hotelApi.list().then(res => {
      const list = res.data.data ?? res.data;
      setHotels(list);
      // Si hotel_id fourni en param : pré-sélectionner et sauter l'étape 0
      if (hotel_id) {
        setSelHotel(Number(hotel_id));
        setStep(1);
      }
    });
  }, []);

  // ── Fetch chambres disponibles quand hôtel sélectionné ───────────────────
  useEffect(() => {
    if (!selHotel) return;
    setRoomsLoading(true);
    setSelType(null);
    setSelRoom(null);
    roomApi.list({ hotel_id: selHotel, status: 'disponible' })
      .then(res => setRooms(res.data.data ?? res.data))
      .catch(() => setRooms([]))
      .finally(() => setRoomsLoading(false));
  }, [selHotel]);

  // ── Dérivés ───────────────────────────────────────────────────────────────
  const hotelData = hotels.find(h => h.id === selHotel);
  const roomData  = rooms.find(r => r.id === selRoom);

  // Grouper les chambres disponibles par type
  const typeGroups = useMemo(() => {
    const map: Record<string, Room[]> = {};
    rooms.forEach(r => {
      if (!map[r.type]) map[r.type] = [];
      map[r.type].push(r);
    });
    return Object.entries(map).map(([type, list]) => ({
      type,
      count: list.length,
      minPrice: Math.min(...list.map(r => Number(r.price) || Number(hotelData?.price) || 0)),
      maxPrice: Math.max(...list.map(r => Number(r.price) || Number(hotelData?.price) || 0)),
      capacity: list[0]?.capacity ?? 2,
    }));
  }, [rooms, hotelData]);

  const filteredRooms = selType ? rooms.filter(r => r.type === selType) : [];

  const nights = checkin && checkout
    ? Math.max(0, Math.round((new Date(checkout).getTime() - new Date(checkin).getTime()) / 86400000))
    : 0;
  const pricePerNight = Number(roomData?.price) || Number(hotelData?.price) || 0;
  const total         = nights * pricePerNight;

  // ── Navigation entre étapes ───────────────────────────────────────────────
  const goNext = () => setStep(s => Math.min(s + 1, 3));
  const goBack = () => setStep(s => Math.max(s - 1, 0));

  const canNext = [
    !!selHotel,
    !!selType,
    !!selRoom,
    !!checkin && !!checkout && nights > 0 && !!payMethod,
  ];

  // ── Soumission ────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const infoError = validatePaymentInfo(payMethod, payInfo, t);
    if (infoError) { Alert.alert(t('reservations.paymentMethod'), infoError); return; }
    setLoading(true);
    try {
      const res = await reservationApi.create({
        hotel_id:       selHotel,
        room_id:        selRoom,
        checkin,
        checkout,
        nights,
        price:          pricePerNight || undefined,
        total:          total || undefined,
        payment_method: payMethod,
        notes:          notes || undefined,
      });
      const newId = res.data?.id;
      const payRes = newId ? await reservationApi.processPayment(newId, { payment_method: payMethod }) : null;

      if (payRes?.data?.redirectUrl) {
        Linking.openURL(payRes.data.redirectUrl);
        Alert.alert(t('reservations.paymentPending'), undefined, [
          { text: t('common.ok'), onPress: () => router.replace(`/(tabs)/reservations/payment?id=${newId}` as any) },
        ]);
        return;
      }

      Alert.alert(
        t('reservations.confirmed'),
        t('reservations.confirmedMsg', { hotel: hotelData?.name, count: nights }),
        [{ text: t('common.ok'), onPress: () => router.replace('/(tabs)/reservations' as any) }]
      );
    } catch (e: any) {
      Alert.alert(t('common.error'), e.response?.data?.message ?? t('createRes.cannotCreate'));
    } finally { setLoading(false); }
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <View style={ss.root}>
      <Stack.Screen options={{
        title: t('reservations.new'),
        headerStyle: { backgroundColor: COLORS.primary },
        headerTintColor: COLORS.white,
        headerTitleStyle: { fontWeight: 'bold', fontSize: 17 },
        headerLeft: () => (
          <TouchableOpacity onPress={() => router.back()} style={{ paddingHorizontal: 4 }}>
            <FontAwesome5 name="arrow-left" size={16} color={COLORS.white} />
          </TouchableOpacity>
        ),
      }} />
      {/* Stepper fixe en haut */}
      <Stepper step={step} steps={[t('reservations.hotel'), t('createRes.typeStepLabel'), t('reservations.room'), t('reservations.checkin') + ' & ' + t('reservations.paymentMethod')]} />

      <ScrollView style={ss.scroll} contentContainerStyle={ss.scrollContent} keyboardShouldPersistTaps="handled">

        {/* ── Étape 0 : Choisir l'hôtel ── */}
        {step === 0 && (
          <View>
            <Text style={ss.stepTitle}>{t('hotels.bookTitle')}</Text>
            {hotels.map(h => {
              const active = selHotel === h.id;
              return (
                <TouchableOpacity
                  key={h.id}
                  style={[ss.hotelCard, active && ss.hotelCardActive]}
                  onPress={() => { setSelHotel(h.id); }}
                  activeOpacity={0.85}
                >
                  <View style={ss.hotelCardLeft}>
                    {h.image_url ? (
                      <Image source={{ uri: h.image_url }} style={ss.hotelImg} resizeMode="cover" />
                    ) : (
                      <View style={[ss.hotelImgFallback, active && { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                        <FontAwesome5 name="hotel" size={22} color={active ? COLORS.white : COLORS.primary} />
                      </View>
                    )}
                    {active && (
                      <View style={ss.hotelImgCheck}>
                        <FontAwesome5 name="check" size={9} color={COLORS.primary} />
                      </View>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={ss.hotelNameRow}>
                      <Text style={[ss.hotelName, active && { color: COLORS.white }]} numberOfLines={1}>
                        {h.name}
                      </Text>
                      {active && <FontAwesome5 name="check-circle" size={16} color={COLORS.white} solid />}
                    </View>
                    <View style={ss.hotelMeta}>
                      <FontAwesome5 name="map-marker-alt" size={10} color={active ? 'rgba(255,255,255,0.7)' : COLORS.textMuted} />
                      <Text style={[ss.hotelCity, active && { color: 'rgba(255,255,255,0.8)' }]}>
                        {h.city}{h.quartier ? `, ${h.quartier}` : ''}
                      </Text>
                    </View>
                    <View style={ss.hotelStarsRow}>
                      {Array.from({ length: h.stars ?? 0 }).map((_, i) => (
                        <FontAwesome5 key={i} name="star" size={9} color={active ? '#FCD34D' : '#F59E0B'} solid />
                      ))}
                      <Text style={[ss.hotelCat, active && { color: 'rgba(255,255,255,0.7)' }]}>{h.category}</Text>
                    </View>
                    <View style={ss.hotelPriceRow}>
                      <Text style={[ss.hotelPriceFrom, active && { color: 'rgba(255,255,255,0.7)' }]}>{t('createRes.startingFrom')}</Text>
                      <Text style={[ss.hotelPrice, active && { color: '#FCD34D' }]}>
                        {Number(h.price) > 0 ? `${Number(h.price).toLocaleString()} FCFA` : t('createRes.priceOnRequest')}
                      </Text>
                      {Number(h.price) > 0 && (
                        <Text style={[ss.hotelNight, active && { color: 'rgba(255,255,255,0.6)' }]}>{t('common.perNight')}</Text>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── Étape 1 : Choisir le type de chambre ── */}
        {step === 1 && (
          <View>
            <Text style={ss.stepTitle}>{t('reservations.room')}</Text>
            <Text style={ss.stepSub}>{hotelData?.name} · {rooms.length} {rooms.length > 1 ? t('createRes.rooms') : t('createRes.room')} {rooms.length > 1 ? t('createRes.availableWordPlural') : t('createRes.availableWord')}</Text>

            {roomsLoading ? (
              <View style={ss.centered}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={ss.loadingText}>{t('common.loading')}</Text>
              </View>
            ) : typeGroups.length === 0 ? (
              <View style={ss.centered}>
                <FontAwesome5 name="bed" size={48} color={COLORS.grayLight} />
                <Text style={ss.emptyText}>{t('dashboard.noRoomsAvailable')}</Text>
                <Text style={ss.emptySub}>{t('hotels.noResults')}</Text>
              </View>
            ) : (
              typeGroups.map(g => {
                const meta   = ROOM_TYPE_META[g.type];
                const active = selType === g.type;
                const samePrice = g.minPrice === g.maxPrice;
                return (
                  <TouchableOpacity
                    key={g.type}
                    style={[ss.typeCard, active && ss.typeCardActive]}
                    onPress={() => setSelType(g.type)}
                    activeOpacity={0.85}
                  >
                    {/* Emoji type */}
                    <View style={[ss.typeEmojiBox, active && { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                      <Text style={ss.typeEmoji}>{meta?.emoji ?? '🏨'}</Text>
                    </View>

                    <View style={{ flex: 1 }}>
                      <View style={ss.typeNameRow}>
                        <Text style={[ss.typeName, active && { color: COLORS.white }]}>{t(ROOM_TYPE_KEYS[g.type] ?? g.type)}</Text>
                        <View style={[ss.typeCountBadge, active && { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                          <Text style={[ss.typeCount, active && { color: COLORS.white }]}>
                            {g.count} {g.count > 1 ? t('createRes.freePlural') : t('createRes.free')}
                          </Text>
                        </View>
                      </View>
                      {meta?.descKey && (
                        <Text style={[ss.typeDesc, active && { color: 'rgba(255,255,255,0.8)' }]}>{t(meta.descKey)}</Text>
                      )}
                      <View style={ss.typeMeta}>
                        <View style={ss.typeMetaItem}>
                          <FontAwesome5 name="user" size={9} color={active ? 'rgba(255,255,255,0.7)' : COLORS.textMuted} />
                          <Text style={[ss.typeMetaText, active && { color: 'rgba(255,255,255,0.8)' }]}>
                            {g.capacity} {g.capacity > 1 ? t('createRes.personPlural') : t('createRes.person')}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Prix */}
                    <View style={[ss.typePriceBox, active && { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                      {g.minPrice > 0 ? (
                        <>
                          {!samePrice && <Text style={[ss.typePriceFrom, active && { color: 'rgba(255,255,255,0.7)' }]}>{t('createRes.startingFrom')}</Text>}
                          <Text style={[ss.typePrice, active && { color: '#FCD34D' }]}>
                            {g.minPrice.toLocaleString()}
                          </Text>
                          <Text style={[ss.typeCurrency, active && { color: 'rgba(255,255,255,0.7)' }]}>{t('createRes.fcfaPerNight')}</Text>
                          {!samePrice && (
                            <Text style={[ss.typePriceMax, active && { color: 'rgba(255,255,255,0.55)' }]}>
                              {t('createRes.upTo', { max: g.maxPrice.toLocaleString() })}
                            </Text>
                          )}
                        </>
                      ) : (
                        <Text style={[ss.typePriceSurDevis, active && { color: 'rgba(255,255,255,0.8)' }]}>{t('createRes.onRequest')}</Text>
                      )}
                    </View>

                    {active && (
                      <View style={ss.typeCheck}>
                        <FontAwesome5 name="check" size={10} color={COLORS.primary} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        {/* ── Étape 2 : Choisir la chambre spécifique ── */}
        {step === 2 && (
          <View>
            <Text style={ss.stepTitle}>{t('reservations.room')}</Text>
            <Text style={ss.stepSub}>{t(ROOM_TYPE_KEYS[selType ?? ''] ?? selType ?? '')} · {filteredRooms.length} {filteredRooms.length > 1 ? t('createRes.availableWordPlural') : t('createRes.availableWord')}</Text>

            {filteredRooms.map(r => {
              const active       = selRoom === r.id;
              const price        = Number(r.price) || Number(hotelData?.price) || 0;
              const situationTxt = (r as any).vue?.trim() || r.description?.trim() || '';
              const hasSituation = !!situationTxt;
              return (
                <TouchableOpacity
                  key={r.id}
                  style={[ss.roomCard, active && ss.roomCardActive]}
                  onPress={() => setSelRoom(r.id)}
                  activeOpacity={0.85}
                >
                  {/* Numéro + étage */}
                  <View style={[ss.roomNumBox, active && { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                    <Text style={[ss.roomNumLabel, active && { color: 'rgba(255,255,255,0.75)' }]}>{t('createRes.noLabel')}</Text>
                    <Text style={[ss.roomNum, active && { color: COLORS.white }]}>{r.number}</Text>
                    <Text style={[ss.roomFloor, active && { color: 'rgba(255,255,255,0.8)' }]}>
                      {floorLabel(r.floor ?? 0, t)}
                    </Text>
                  </View>

                  <View style={{ flex: 1, paddingHorizontal: 2 }}>
                    {/* Badges caractéristiques */}
                    <View style={ss.roomBadges}>
                      {r.capacity ? (
                        <View style={[ss.badge, active && ss.badgeActive]}>
                          <FontAwesome5 name="user" size={9} color={active ? COLORS.white : COLORS.primary} />
                          <Text style={[ss.badgeText, active && { color: COLORS.white }]}>{r.capacity} {t('common.person')}</Text>
                        </View>
                      ) : null}
                      {r.superficie_m2 ? (
                        <View style={[ss.badge, active && ss.badgeActive]}>
                          <FontAwesome5 name="vector-square" size={9} color={active ? COLORS.white : COLORS.primary} />
                          <Text style={[ss.badgeText, active && { color: COLORS.white }]}>{r.superficie_m2} m²</Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Situation / description */}
                    {hasSituation && (
                      <View style={[ss.situationBox, active && ss.situationBoxActive]}>
                        <FontAwesome5 name="eye" size={10} color={active ? '#FCD34D' : COLORS.primary} />
                        <Text style={[ss.situationText, active && { color: '#FCD34D' }]} numberOfLines={2}>
                          {situationTxt}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Prix */}
                  <View style={ss.roomPriceCol}>
                    <Text style={[ss.roomPrice, active && { color: '#FCD34D' }]}>
                      {price > 0 ? price.toLocaleString() : '—'}
                    </Text>
                    {price > 0 && (
                      <Text style={[ss.roomPriceUnit, active && { color: 'rgba(255,255,255,0.7)' }]}>{t('createRes.fcfaPerNight')}</Text>
                    )}
                    {active && (
                      <View style={ss.roomCheckBadge}>
                        <FontAwesome5 name="check" size={9} color={COLORS.primary} />
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── Étape 3 : Dates + Paiement ── */}
        {step === 3 && (
          <View>
            {/* Récap chambre sélectionnée */}
            <View style={ss.recapBanner}>
              <View style={ss.recapBannerLeft}>
                {hotelData?.image_url ? (
                  <Image source={{ uri: hotelData.image_url }} style={ss.recapBannerImg} resizeMode="cover" />
                ) : (
                  <Text style={ss.recapBannerEmoji}>{typeEmoji(selType ?? '')}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={ss.recapBannerTitle}>{t(ROOM_TYPE_KEYS[selType ?? ''] ?? selType ?? '')} · {hotelData?.name}</Text>
                <Text style={ss.recapBannerSub}>
                  {t('createRes.roomNumberFloor', { number: roomData?.number, floor: floorLabel(roomData?.floor ?? 0, t) })}
                  {((roomData as any)?.vue || roomData?.description) ? `\n👁 ${(roomData as any)?.vue || roomData?.description}` : ''}
                </Text>
              </View>
              <View>
                <Text style={ss.recapBannerPrice}>{pricePerNight > 0 ? `${pricePerNight.toLocaleString()} FCFA` : '—'}</Text>
                <Text style={ss.recapBannerNight}>{t('common.perNight')}</Text>
              </View>
            </View>

            {/* Dates */}
            <SectionTitle label={t('reservations.checkin') + ' / ' + t('reservations.checkout')} icon="calendar-alt" />
            <View style={ss.datesRow}>
              <TouchableOpacity style={[ss.dateBtn, { flex: 1 }]} onPress={() => setDatePick('in')}>
                <FontAwesome5 name="sign-in-alt" size={14} color={COLORS.primary} />
                <View>
                  <Text style={ss.dateBtnLabel}>{t('reservations.checkin')}</Text>
                  <Text style={[ss.dateBtnValue, !checkin && ss.placeholder]}>
                    {checkin ? fmtDisplay(checkin, monthsShort) : t('hotels.chooseDate')}
                  </Text>
                </View>
              </TouchableOpacity>
              <FontAwesome5 name="arrow-right" size={12} color={COLORS.textMuted} />
              <TouchableOpacity style={[ss.dateBtn, { flex: 1 }]} onPress={() => setDatePick('out')}>
                <FontAwesome5 name="sign-out-alt" size={14} color={COLORS.danger} />
                <View>
                  <Text style={ss.dateBtnLabel}>{t('reservations.checkout')}</Text>
                  <Text style={[ss.dateBtnValue, !checkout && ss.placeholder]}>
                    {checkout ? fmtDisplay(checkout, monthsShort) : t('hotels.chooseDate')}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Récap prix */}
            {nights > 0 && pricePerNight > 0 && (
              <View style={ss.priceRecap}>
                <View style={ss.priceRecapRow}>
                  <Text style={ss.priceRecapLabel}>
                    {pricePerNight.toLocaleString()} FCFA × {nights} {nights > 1 ? t('common.nights') : t('common.night')}
                  </Text>
                  <Text style={ss.priceRecapValue}>{(pricePerNight * nights).toLocaleString()} FCFA</Text>
                </View>
                <View style={ss.priceRecapDivider} />
                <View style={[ss.priceRecapRow, ss.priceTotal]}>
                  <Text style={ss.priceTotalLabel}>{t('reservations.total')}</Text>
                  <Text style={ss.priceTotalValue}>{total.toLocaleString()} FCFA</Text>
                </View>
              </View>
            )}

            {/* Mode de paiement */}
            <SectionTitle label={t('reservations.paymentMethod')} icon="credit-card" />
            {PAYMENT_METHODS.map(pm => (
              <TouchableOpacity
                key={pm.value}
                style={[ss.pmItem, payMethod === pm.value && ss.pmItemActive]}
                onPress={() => { setPayMethod(pm.value); setPayInfo({ ...EMPTY_PAYMENT_INFO }); }}
              >
                <PaymentMethodIcon method={pm} size={28} />
                <Text style={[ss.pmLabel, payMethod === pm.value && ss.pmLabelActive]}>{pm.label}</Text>
                {payMethod === pm.value && (
                  <View style={ss.pmCheck}>
                    <FontAwesome5 name="check" size={10} color={COLORS.white} />
                  </View>
                )}
              </TouchableOpacity>
            ))}
            <PaymentInfoFields method={payMethod} info={payInfo} onChange={setPayInfo} />

            {/* Notes */}
            <SectionTitle label={t('reservations.notes')} icon="comment-alt" />
            <View style={ss.notesBox}>
              <FontAwesome5 name="comment-dots" size={14} color={COLORS.textMuted} style={{ marginRight: 8, marginTop: 2 }} />
              <Text
                style={[ss.notesInput, { flex: 1 }]}
                onPress={() => {}}
              >
                {notes || <Text style={ss.placeholder}>{t('createRes.notesPlaceholder')}</Text>}
              </Text>
            </View>

            {/* Récap final avant confirmation */}
            <View style={ss.finalRecap}>
              <Text style={ss.finalRecapTitle}>{t('reservations.title')}</Text>
              <RecapRow icon="building"      label={t('reservations.hotel')}         value={hotelData?.name ?? '—'} />
              <RecapRow icon="bed"           label={t('reservations.room')}          value={selType ? t(ROOM_TYPE_KEYS[selType] ?? selType) : '—'} />
              <RecapRow icon="door-open"     label={t('common.room')}                value={`${t('createRes.noLabel')}${roomData?.number ?? '—'} · ${floorLabel(roomData?.floor ?? 0, t)}`} />
              {((roomData as any)?.vue || roomData?.description) ? <RecapRow icon="eye" label={t('createRes.viewSituation')} value={(roomData as any)?.vue || roomData?.description!} /> : null}
              <RecapRow icon="calendar"      label={t('reservations.checkin')}       value={checkin  ? fmtLong(checkin, monthsFull)  : '—'} />
              <RecapRow icon="calendar-alt"  label={t('reservations.checkout')}      value={checkout ? fmtLong(checkout, monthsFull) : '—'} />
              <RecapRow icon="moon"          label={t('reservations.nights')}        value={nights > 0 ? `${nights} ${nights > 1 ? t('common.nights') : t('common.night')}` : '—'} />
              <RecapRow icon="credit-card"   label={t('reservations.paymentMethod')} value={PAYMENT_METHODS.find(p => p.value === payMethod)?.label ?? '—'} />
              {total > 0 && (
                <View style={ss.totalFinal}>
                  <Text style={ss.totalFinalLabel}>{t('reservations.total')}</Text>
                  <Text style={ss.totalFinalValue}>{total.toLocaleString()} FCFA</Text>
                </View>
              )}
            </View>
          </View>
        )}

        <View style={{ height: 16 }} />
      </ScrollView>

      {/* Barre de navigation bas */}
      <View style={ss.footer}>
        {step > 0 && (
          <TouchableOpacity style={ss.backBtn} onPress={goBack}>
            <FontAwesome5 name="arrow-left" size={14} color={COLORS.primary} />
            <Text style={ss.backBtnText}>{t('common.back')}</Text>
          </TouchableOpacity>
        )}

        {step < 3 ? (
          <TouchableOpacity
            style={[ss.nextBtn, !canNext[step] && ss.nextBtnDisabled, step === 0 && { flex: 1 }]}
            onPress={goNext}
            disabled={!canNext[step]}
          >
            <Text style={ss.nextBtnText}>{t('common.confirm')}</Text>
            <FontAwesome5 name="arrow-right" size={14} color={COLORS.white} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[ss.confirmBtn, (!canNext[3] || loading) && ss.nextBtnDisabled]}
            onPress={handleSubmit}
            disabled={!canNext[3] || loading}
          >
            {loading ? <ActivityIndicator color={COLORS.white} /> : (
              <>
                <FontAwesome5 name="calendar-check" size={15} color={COLORS.white} />
                <View>
                  <Text style={ss.confirmBtnText}>{t('hotels.confirmBook')}</Text>
                  {total > 0 && <Text style={ss.confirmBtnSub}>{total.toLocaleString()} FCFA</Text>}
                </View>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Date pickers */}
      <DatePicker
        visible={datePick === 'in'}
        value={checkin}
        minDate={todayStr()}
        title={t('hotels.arrivalDate')}
        onConfirm={d => { setCheckin(d); if (checkout && d >= checkout) setCheckout(''); setDatePick(null); }}
        onCancel={() => setDatePick(null)}
      />
      <DatePicker
        visible={datePick === 'out'}
        value={checkout}
        minDate={checkin || todayStr()}
        title={t('hotels.departureDate')}
        onConfirm={d => { setCheckout(d); setDatePick(null); }}
        onCancel={() => setDatePick(null)}
      />
    </View>
  );
}

// ─── Petits composants ────────────────────────────────────────────────────────

function SectionTitle({ label, icon }: { label: string; icon: string }) {
  return (
    <View style={ss.sectionTitle}>
      <FontAwesome5 name={icon as any} size={13} color={COLORS.primary} />
      <Text style={ss.sectionTitleText}>{label}</Text>
    </View>
  );
}

function RecapRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={ss.recapRow}>
      <FontAwesome5 name={icon as any} size={11} color={COLORS.textMuted} style={{ width: 16 }} />
      <Text style={ss.recapLabel}>{label}</Text>
      <Text style={ss.recapValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const ss = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 24 },

  // Stepper
  stepper:          { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  stepWrap:         { alignItems: 'center', position: 'relative', flex: 1 },
  stepDot:          { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: COLORS.border, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  stepDone:         { backgroundColor: '#10B981', borderColor: '#10B981' },
  stepCurrent:      { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  stepNum:          { fontSize: 10, fontWeight: '700', color: COLORS.textMuted },
  stepLabel:        { fontSize: 9, color: COLORS.textMuted, textAlign: 'center', fontWeight: '500' },
  stepLabelCurrent: { color: COLORS.primary, fontWeight: '700' },
  stepLine:         { position: 'absolute', top: 12, left: '50%', right: '-50%', height: 2, backgroundColor: COLORS.border, zIndex: -1 },
  stepLineDone:     { backgroundColor: '#10B981' },

  // Titres étapes
  stepTitle: { fontSize: 20, fontWeight: '800', color: COLORS.dark, marginBottom: 4 },
  stepSub:   { fontSize: 13, color: COLORS.textMuted, marginBottom: 16 },

  // Hôtels
  hotelCard:         { backgroundColor: COLORS.white, borderRadius: 16, padding: 14, marginBottom: 10, flexDirection: 'row', gap: 12, borderWidth: 2, borderColor: COLORS.border, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  hotelCardActive:   { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  hotelCardLeft:     { justifyContent: 'center', position: 'relative' },
  hotelImg:          { width: 68, height: 68, borderRadius: 12 },
  hotelImgFallback:  { width: 68, height: 68, borderRadius: 12, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center' },
  hotelImgCheck:     { position: 'absolute', bottom: -4, right: -4, width: 20, height: 20, borderRadius: 10, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.white },
  hotelNameRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  hotelName:       { fontSize: 15, fontWeight: '700', color: COLORS.dark, flex: 1 },
  hotelMeta:       { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 },
  hotelCity:       { fontSize: 11, color: COLORS.textMuted },
  hotelStarsRow:   { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 6 },
  hotelCat:        { fontSize: 10, color: COLORS.textMuted, marginLeft: 4 },
  hotelPriceRow:   { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  hotelPriceFrom:  { fontSize: 9, color: COLORS.textMuted },
  hotelPrice:      { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  hotelNight:      { fontSize: 10, color: COLORS.textMuted },

  // Types de chambre
  typeCard:        { backgroundColor: COLORS.white, borderRadius: 16, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 2, borderColor: COLORS.border, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  typeCardActive:  { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeEmojiBox:    { width: 52, height: 52, borderRadius: 14, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center' },
  typeEmoji:       { fontSize: 26 },
  typeNameRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  typeName:        { fontSize: 16, fontWeight: '700', color: COLORS.dark, flex: 1 },
  typeCountBadge:  { backgroundColor: '#EEF2FF', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  typeCount:       { fontSize: 10, fontWeight: '700', color: COLORS.primary },
  typeDesc:        { fontSize: 11, color: COLORS.textMuted, marginBottom: 5 },
  typeMeta:        { flexDirection: 'row', gap: 12 },
  typeMetaItem:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  typeMetaText:    { fontSize: 11, color: COLORS.textMuted },
  typePriceBox:    { alignItems: 'flex-end', paddingLeft: 8, minWidth: 90 },
  typePriceFrom:   { fontSize: 9, color: COLORS.textMuted },
  typePrice:       { fontSize: 17, fontWeight: '900', color: COLORS.primary },
  typeCurrency:    { fontSize: 9, color: COLORS.textMuted },
  typePriceMax:    { fontSize: 9, color: COLORS.textMuted },
  typePriceSurDevis:{ fontSize: 12, color: COLORS.textMuted, fontStyle: 'italic' },
  typeCheck:       { position: 'absolute', top: 10, right: 10, width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.white, justifyContent: 'center', alignItems: 'center' },

  // Chambres spécifiques
  roomCard:        { backgroundColor: COLORS.white, borderRadius: 16, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 2, borderColor: COLORS.border, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  roomCardActive:  { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  roomNumBox:      { alignItems: 'center', backgroundColor: '#EEF2FF', borderRadius: 12, padding: 10, minWidth: 60 },
  roomNumLabel:    { fontSize: 9, color: COLORS.textMuted, fontWeight: '600' },
  roomNum:         { fontSize: 22, fontWeight: '900', color: COLORS.primary },
  roomFloor:       { fontSize: 9, color: COLORS.textMuted, textAlign: 'center', marginTop: 2 },
  roomBadges:      { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 6 },
  badge:           { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EEF2FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeActive:     { backgroundColor: 'rgba(255,255,255,0.2)' },
  badgeText:       { fontSize: 10, fontWeight: '600', color: COLORS.primary },
  situationBox:    { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: '#FFFBEB', padding: 7, borderRadius: 8, borderLeftWidth: 2, borderLeftColor: '#F59E0B' },
  situationBoxActive:{ backgroundColor: 'rgba(255,255,255,0.15)', borderLeftColor: '#FCD34D' },
  situationText:   { fontSize: 11, color: '#92400E', flex: 1 },
  roomPriceCol:    { alignItems: 'flex-end', minWidth: 80 },
  roomPrice:       { fontSize: 17, fontWeight: '900', color: COLORS.primary },
  roomPriceUnit:   { fontSize: 9, color: COLORS.textMuted },
  roomCheckBadge:  { marginTop: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.white, justifyContent: 'center', alignItems: 'center' },

  // Dates
  datesRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  dateBtn:       { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12, padding: 12 },
  dateBtnLabel:  { fontSize: 9, color: COLORS.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  dateBtnValue:  { fontSize: 14, fontWeight: '700', color: COLORS.dark, marginTop: 1 },
  placeholder:   { color: COLORS.textMuted, fontWeight: '400' },

  // Prix recap
  priceRecap:       { backgroundColor: COLORS.white, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  priceRecapRow:    { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  priceRecapLabel:  { fontSize: 13, color: COLORS.textMuted },
  priceRecapValue:  { fontSize: 14, fontWeight: '600', color: COLORS.dark },
  priceRecapDivider:{ height: 1, backgroundColor: COLORS.border, marginVertical: 8 },
  priceTotal:       { backgroundColor: '#EEF2FF', marginHorizontal: -14, paddingHorizontal: 14, paddingVertical: 10, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, marginBottom: -14 },
  priceTotalLabel:  { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  priceTotalValue:  { fontSize: 20, fontWeight: '900', color: COLORS.primary },

  // Paiement
  pmItem:         { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 2, borderColor: COLORS.border, borderRadius: 12, padding: 12, marginBottom: 8, backgroundColor: COLORS.white },
  pmItemActive:   { borderColor: COLORS.primary, backgroundColor: '#EEF2FF' },
  pmIcon:         { fontSize: 22 },
  pmLabel:        { flex: 1, fontSize: 14, color: COLORS.dark },
  pmLabelActive:  { color: COLORS.primary, fontWeight: '700' },
  pmCheck:        { width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },

  // Notes
  notesBox:  { flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 12, backgroundColor: COLORS.white, marginBottom: 16, minHeight: 60 },
  notesInput:{ fontSize: 14, color: COLORS.dark },

  // Sections
  sectionTitle:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 10 },
  sectionTitleText: { fontSize: 14, fontWeight: '700', color: COLORS.dark, textTransform: 'uppercase', letterSpacing: 0.4 },

  // Récap final
  finalRecap:       { backgroundColor: COLORS.white, borderRadius: 14, padding: 16, marginTop: 8, borderWidth: 1, borderColor: COLORS.border },
  finalRecapTitle:  { fontSize: 14, fontWeight: '700', color: COLORS.dark, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.4 },
  recapRow:         { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  recapLabel:       { fontSize: 12, color: COLORS.textMuted, width: 100 },
  recapValue:       { flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.dark },
  totalFinal:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#EEF2FF', marginHorizontal: -16, paddingHorizontal: 16, paddingVertical: 12, borderBottomLeftRadius: 14, borderBottomRightRadius: 14, marginBottom: -16, marginTop: 4 },
  totalFinalLabel:  { fontSize: 15, fontWeight: '700', color: COLORS.primary },
  totalFinalValue:  { fontSize: 22, fontWeight: '900', color: COLORS.primary },

  // Récap bannière chambre (étape 3)
  recapBanner:      { backgroundColor: COLORS.primary, borderRadius: 14, padding: 14, marginBottom: 16, flexDirection: 'row', gap: 12, alignItems: 'center' },
  recapBannerLeft:  { width: 56, height: 56, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  recapBannerImg:   { width: 56, height: 56, borderRadius: 12 },
  recapBannerEmoji: { fontSize: 24 },
  recapBannerTitle: { fontSize: 14, fontWeight: '700', color: COLORS.white },
  recapBannerSub:   { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  recapBannerPrice: { fontSize: 17, fontWeight: '900', color: '#FCD34D', textAlign: 'right' },
  recapBannerNight: { fontSize: 9, color: 'rgba(255,255,255,0.6)', textAlign: 'right' },

  // Footer nav
  footer:        { flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 24, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, elevation: 8 },
  backBtn:       { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, borderWidth: 2, borderColor: COLORS.border },
  backBtnText:   { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  nextBtn:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, shadowColor: COLORS.primary, shadowOpacity: 0.4, shadowRadius: 8, elevation: 4 },
  nextBtnText:   { fontSize: 15, fontWeight: '700', color: COLORS.white },
  nextBtnDisabled:{ opacity: 0.4, shadowOpacity: 0 },
  confirmBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#10B981', borderRadius: 12, paddingVertical: 12, shadowColor: '#10B981', shadowOpacity: 0.4, shadowRadius: 8, elevation: 4 },
  confirmBtnText:{ fontSize: 15, fontWeight: '700', color: COLORS.white },
  confirmBtnSub: { fontSize: 11, color: 'rgba(255,255,255,0.8)', textAlign: 'center' },

  // États vides / chargement
  centered:    { alignItems: 'center', paddingVertical: 40, gap: 12 },
  loadingText: { fontSize: 14, color: COLORS.textMuted },
  emptyText:   { fontSize: 16, fontWeight: '600', color: COLORS.textMuted },
  emptySub:    { fontSize: 12, color: COLORS.grayLight, textAlign: 'center', maxWidth: 240 },
});
