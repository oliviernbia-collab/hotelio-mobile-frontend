import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TextInput, Modal,
  TouchableOpacity, RefreshControl, Image, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { hotelApi, favoriteApi, reservationApi } from '@/services/api';
import { PAYMENT_METHODS } from '@/constants';
import DatePicker from '@/components/DatePicker';
import PaymentInfoFields, { PaymentInfo, EMPTY_PAYMENT_INFO, validatePaymentInfo } from '@/components/PaymentInfoFields';
import { Hotel } from '@/types';
import { COLORS } from '@/constants';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';

const CARD_WIDTH = 155;
const CARD_GAP   = 8;
const CARD_STEP  = CARD_WIDTH + CARD_GAP;

const APP_PROMOS = [
  { id: 1, icon: 'bolt',     titleKey: 'hotels.promo1_title', descKey: 'hotels.promo1_desc', bg: '#1E3A5F', accent: '#F4A261' },
  { id: 2, icon: 'tag',      titleKey: 'hotels.promo2_title', descKey: 'hotels.promo2_desc', bg: '#065F46', accent: '#6EE7B7' },
  { id: 3, icon: 'building', titleKey: 'hotels.promo3_title', descKey: 'hotels.promo3_desc', bg: '#7C3AED', accent: '#DDD6FE' },
  { id: 4, icon: 'headset',  titleKey: 'hotels.promo4_title', descKey: 'hotels.promo4_desc', bg: '#9D174D', accent: '#FCA5A5' },
  { id: 5, icon: 'star',     titleKey: 'hotels.promo5_title', descKey: 'hotels.promo5_desc', bg: '#92400E', accent: '#FCD34D' },
];

const EMPTY_FORM = { check_in: '', check_out: '', guests: '1', paymentMethod: '' };
const EMPTY_INFO: PaymentInfo = { ...EMPTY_PAYMENT_INFO };

function PromoBanners() {
  const { t } = useTranslation();
  const scrollRef  = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);


  return (
    <View style={styles.promosSection}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.promosScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={e => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / CARD_STEP);
          setActiveIndex(idx % APP_PROMOS.length);
        }}
      >
        {APP_PROMOS.map(p => (
          <View key={p.id} style={[styles.promoCard, { backgroundColor: p.bg }]}>
            <View style={[styles.promoIconWrap, { backgroundColor: p.accent + '30' }]}>
              <FontAwesome5 name={p.icon} size={14} color={p.accent} solid />
            </View>
            <Text style={styles.promoTitle}>{t(p.titleKey)}</Text>
            <Text style={styles.promoDesc}>{t(p.descKey)}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.dotRow}>
        {APP_PROMOS.map((_, i) => (
          <View key={i} style={[styles.dot, i === activeIndex && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtDisplay(iso: string, monthsShort: string[]) {
  const [y, m, d] = iso.split('-');
  return `${parseInt(d)} ${monthsShort[parseInt(m) - 1]} ${y}`;
}

const HOTEL_CATS = ['Standard', 'Affaires', 'Luxe', 'Boutique', 'Resort', 'Auberge'];
const HOTEL_CAT_KEYS: Record<string, string> = {
  Standard: 'hotels.cat_standard', Affaires: 'hotels.cat_affaires', Luxe: 'hotels.cat_luxe',
  Boutique: 'hotels.cat_boutique', Resort: 'hotels.cat_resort', Auberge: 'hotels.cat_auberge',
};

const HOTEL_AMENITIES = [
  { key: 'wifi',        labelKey: 'hotels.wifi',        emoji: '📶' },
  { key: 'piscine',     labelKey: 'hotels.piscine',     emoji: '🏊' },
  { key: 'parking',     labelKey: 'hotels.parking',     emoji: '🅿️' },
  { key: 'restaurant',  labelKey: 'hotels.restaurant',  emoji: '🍽️' },
  { key: 'bar',         labelKey: 'hotels.bar',         emoji: '🍹' },
  { key: 'spa',         labelKey: 'hotels.spa',         emoji: '💆' },
  { key: 'gym',         labelKey: 'hotels.gym',         emoji: '🏋️' },
  { key: 'room_service',labelKey: 'hotels.roomService', emoji: '🛎️' },
  { key: 'clim',        labelKey: 'hotels.clim',        emoji: '❄️' },
  { key: 'petit_dej',   labelKey: 'hotels.breakfast',   emoji: '☕' },
  { key: 'transfer',    labelKey: 'hotels.transfer',    emoji: '✈️' },
  { key: 'business',    labelKey: 'hotels.business',    emoji: '💼' },
  { key: 'tv',          labelKey: 'hotels.tv',          emoji: '📺' },
  { key: 'coffre',      labelKey: 'hotels.safe',        emoji: '🔒' },
];

const EMPTY_HOTEL_FORM = {
  name: '', short_name: '', city: '', commune: '', quartier: '',
  stars: 3,
  category: 'Standard', price: '',
  phone: '', email: '', manager: '', description: '',
  services: [] as string[],
};

export default function HotelsScreen() {
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const { scope: scopeParam } = useLocalSearchParams<{ scope?: string }>();
  // 'mine' → mes hôtels uniquement (CRUD complet)
  // 'tous' → tous les hôtels (CRUD seulement pour les siens)
  // undefined → comportement identique à 'tous'
  const scope = scopeParam === 'mine' ? 'mine' : 'tous';

  const isManager = user?.role === 'admin' || user?.role === 'prestataire';
  const [activeTab, setActiveTab] = useState<'tous' | 'mes' | 'autres'>('tous');

  const [hotels,      setHotels]      = useState<Hotel[]>([]);
  const [search,      setSearch]      = useState('');
  const [showFilters,   setShowFilters]   = useState(false);
  const [filterCity,    setFilterCity]    = useState('');
  const [filterCommune, setFilterCommune] = useState('');
  const [filterQuartier,setFilterQuartier]= useState('');
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [favorites,   setFavorites]   = useState<Set<number>>(new Set());
  const [reserveHotel, setReserveHotel] = useState<Hotel | null>(null);
  const [reserveForm,  setReserveForm]  = useState({ ...EMPTY_FORM });
  const [paymentInfo,  setPaymentInfo]  = useState<PaymentInfo>({ ...EMPTY_INFO });
  const [reserving,    setReserving]    = useState(false);
  const [datePicker,   setDatePicker]   = useState<'check_in' | 'check_out' | null>(null);

  const [showHotelModal, setShowHotelModal] = useState(false);
  const [editingHotel,   setEditingHotel]   = useState<Hotel | null>(null);
  const [hotelForm,      setHotelForm]      = useState({ ...EMPTY_HOTEL_FORM });
  const [hotelSaving,    setHotelSaving]    = useState(false);
  const [hotelImage,     setHotelImage]     = useState<{ uri: string; name: string; type: string } | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);

  const fetchHotels = async () => {
    try {
      let res;
      if (scope === 'mine' && user?.role === 'prestataire') {
        res = await hotelApi.mine();
      } else {
        res = await hotelApi.list({ search: search || undefined });
      }
      setHotels(res.data.data ?? res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const myId = Number(user?.id);

  const scopedHotels = useMemo(() => {
    if (scope !== 'tous') return hotels;
    if (activeTab === 'mes')    return hotels.filter(h => Number(h.user_id) === myId);
    if (activeTab === 'autres') return hotels.filter(h => Number(h.user_id) !== myId);
    return hotels;
  }, [hotels, scope, activeTab, myId]);

  const filteredHotels = useMemo(() => {
    return scopedHotels.filter(h =>
      (!filterCity     || h.city     === filterCity) &&
      (!filterCommune  || h.commune  === filterCommune) &&
      (!filterQuartier || h.quartier === filterQuartier)
    );
  }, [scopedHotels, filterCity, filterCommune, filterQuartier]);

  // Options de filtre dynamiques (dérivées des hôtels chargés), en cascade Ville > Commune > Quartier
  const cityOptions = useMemo(() => (
    Array.from(new Set(scopedHotels.map(h => h.city).filter(Boolean))).sort()
  ), [scopedHotels]);

  const communeOptions = useMemo(() => (
    Array.from(new Set(
      scopedHotels
        .filter(h => !filterCity || h.city === filterCity)
        .map(h => h.commune)
        .filter((c): c is string => !!c)
    )).sort()
  ), [scopedHotels, filterCity]);

  const quartierOptions = useMemo(() => (
    Array.from(new Set(
      scopedHotels
        .filter(h => (!filterCity || h.city === filterCity) && (!filterCommune || h.commune === filterCommune))
        .map(h => h.quartier)
        .filter((q): q is string => !!q)
    )).sort()
  ), [scopedHotels, filterCity, filterCommune]);

  const activeFilterCount = [filterCity, filterCommune, filterQuartier].filter(Boolean).length;

  const resetFilters = () => { setFilterCity(''); setFilterCommune(''); setFilterQuartier(''); };

  const fetchFavorites = async () => {
    if (user?.role !== 'client') return;
    try {
      const res = await favoriteApi.list();
      setFavorites(new Set(res.data.map((h: Hotel) => h.id)));
    } catch {}
  };

  // Relancer le fetch et réinitialiser l'onglet à chaque changement de scope
  useEffect(() => {
    setActiveTab('tous');
    setLoading(true);
    setHotels([]);
    fetchHotels();
    fetchFavorites();
  }, [scope]);

  const onRefresh = () => { setRefreshing(true); fetchHotels(); };

  const toggleFav = async (id: number) => {
    try {
      await favoriteApi.toggle(id);
      setFavorites(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
    } catch {}
  };

  const openReserveModal = (hotel: Hotel) => {
    setReserveForm({ ...EMPTY_FORM });
    setPaymentInfo({ ...EMPTY_INFO });
    setReserveHotel(hotel);
  };

  const handleReserve = async () => {
    if (!reserveForm.check_in || !reserveForm.check_out) {
      return Alert.alert(t('common.required'), t('hotels.requiredFields'));
    }
    if (reserveForm.check_in >= reserveForm.check_out) {
      return Alert.alert(t('hotels.invalidDatesTitle'), t('hotels.invalidDates'));
    }
    if (!reserveForm.paymentMethod) {
      return Alert.alert(t('hotels.paymentRequiredTitle'), t('hotels.paymentRequired'));
    }
    const infoError = validatePaymentInfo(reserveForm.paymentMethod, paymentInfo, t);
    if (infoError) return Alert.alert(t('hotels.paymentInfo'), infoError);
    const guests = Number(reserveForm.guests);
    if (!guests || guests < 1) {
      return Alert.alert(t('hotels.invalidGuests'), t('hotels.guestsInvalid'));
    }
    setReserving(true);
    try {
      const hotelName = reserveHotel!.name;
      const res = await reservationApi.create({
        hotel_id:       reserveHotel!.id,
        checkin:        reserveForm.check_in,
        checkout:       reserveForm.check_out,
        payment_method: reserveForm.paymentMethod,
        guests,
      });
      const newId = res.data?.id;
      if (newId) {
        await reservationApi.processPayment(newId, { payment_method: reserveForm.paymentMethod });
      }
      setReserveHotel(null);
      Alert.alert(t('hotels.bookSuccess'), t('hotels.bookSuccessMsg', { hotel: hotelName }));
    } catch (e: any) {
      Alert.alert(t('common.error'), e.response?.data?.message ?? t('hotels.cannotBook'));
    } finally {
      setReserving(false);
    }
  };

  const openCreateHotel = () => {
    setHotelForm({ ...EMPTY_HOTEL_FORM });
    setHotelImage(null);
    setCurrentImageUrl(null);
    setEditingHotel(null);
    setShowHotelModal(true);
  };

  const openEditHotel = (h: Hotel) => {
    setHotelForm({
      name:        h.name ?? '',
      short_name:  h.short_name ?? '',
      city:        h.city ?? '',
      commune:     h.commune ?? '',
      quartier:    h.quartier ?? '',
      stars:       h.stars ?? 3,
      category:    h.category ?? 'Standard',
      price:       h.price ? String(h.price) : '',
      phone:       h.phone ?? '',
      email:       h.email ?? '',
      manager:     (h as any).manager ?? '',
      description: h.description ?? '',
      services:    Array.isArray(h.services) ? h.services : [],
    });
    setHotelImage(null);
    setCurrentImageUrl(h.image_url || null);
    setEditingHotel(h);
    setShowHotelModal(true);
  };

  const pickHotelImage = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'image/*',
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const MAX = 15 * 1024 * 1024; // 15 Mo
        if (asset.size && asset.size > MAX) {
          Alert.alert(t('hotels.photoTooBig'), t('hotels.photoTooBigMsg', { size: (asset.size / 1024 / 1024).toFixed(1) }));
          return;
        }
        setHotelImage({
          uri:  asset.uri,
          name: asset.name || 'hotel.jpg',
          type: asset.mimeType || 'image/jpeg',
        });
      }
    } catch (e) {
      console.error('Image picker:', e);
    }
  };

  const handleSaveHotel = async () => {
    if (!hotelForm.name.trim() || !hotelForm.city.trim()) {
      Alert.alert(t('common.required'), t('hotels.requiredName')); return;
    }
    setHotelSaving(true);
    try {
      let payload: object | FormData;

      if (hotelImage) {
        const fd = new FormData();
        fd.append('name',        hotelForm.name.trim());
        fd.append('short_name',  hotelForm.short_name.trim());
        fd.append('city',        hotelForm.city.trim());
        fd.append('commune',     hotelForm.commune.trim());
        fd.append('quartier',    hotelForm.quartier.trim());
        fd.append('stars',       String(hotelForm.stars));
        fd.append('category',    hotelForm.category);
        fd.append('price',       hotelForm.price || '0');
        fd.append('phone',       hotelForm.phone.trim());
        fd.append('email',       hotelForm.email.trim());
        fd.append('manager',     hotelForm.manager.trim());
        fd.append('description', hotelForm.description.trim());
        fd.append('services',    JSON.stringify(hotelForm.services));
        fd.append('image', { uri: hotelImage.uri, name: hotelImage.name, type: hotelImage.type } as any);
        payload = fd;
      } else {
        payload = {
          name:        hotelForm.name.trim(),
          short_name:  hotelForm.short_name.trim() || undefined,
          city:        hotelForm.city.trim(),
          commune:     hotelForm.commune.trim() || undefined,
          quartier:    hotelForm.quartier.trim() || undefined,
          stars:       Number(hotelForm.stars),
          category:    hotelForm.category,
          price:       hotelForm.price ? Number(hotelForm.price) : 0,
          phone:       hotelForm.phone.trim() || undefined,
          email:       hotelForm.email.trim() || undefined,
          manager:     hotelForm.manager.trim() || undefined,
          description: hotelForm.description.trim() || undefined,
          services:    hotelForm.services,
        };
      }

      if (editingHotel) {
        await hotelApi.update(editingHotel.id, payload);
      } else {
        await hotelApi.create(payload);
      }
      setShowHotelModal(false);
      setHotelImage(null);
      setCurrentImageUrl(null);
      fetchHotels();
    } catch (e: any) {
      Alert.alert(t('common.error'), e.response?.data?.message ?? t('hotels.cannotSave'));
    } finally {
      setHotelSaving(false);
    }
  };

  const handleDeleteHotel = (h: Hotel) => {
    Alert.alert(
      t('hotels.deleteTitle'),
      t('hotels.deleteMsg', { name: h.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'), style: 'destructive',
          onPress: async () => {
            try {
              await hotelApi.delete(h.id);
              fetchHotels();
            } catch (e: any) {
              Alert.alert(t('common.error'), e.response?.data?.message ?? t('hotels.cannotDelete'));
            }
          },
        },
      ]
    );
  };

  const renderStars = (n: number) => '⭐'.repeat(Math.min(Math.round(n), 5));

  const canManageHotel = (item: Hotel) => {
    if (user?.role === 'admin') return true;
    if (scope === 'mine') return true; // tous affichés appartiennent au prestataire
    return item.user_id === user?.id;
  };

  const renderHotel = ({ item }: { item: Hotel }) => {
    const canManage = canManageHotel(item);
    const isOther = scope === 'tous' && user?.role === 'prestataire' && item.user_id !== user?.id;

    return (
      <View style={styles.card}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push({ pathname: '/(tabs)/hotels/[id]', params: { id: item.id } })}
        >
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={styles.cardImage} resizeMode="cover" />
          ) : (
            <View style={styles.cardImagePlaceholder}>
              <Text style={styles.cardImageEmoji}>🏨</Text>
            </View>
          )}
        </TouchableOpacity>
        <View style={styles.cardBody}>
          <View style={styles.cardHeader}>
            <View style={styles.cardInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.hotelName}>{item.name}</Text>
                {isOther && (
                  <View style={styles.otherBadge}>
                    <Text style={styles.otherBadgeText}>{t('hotels.tab_other_badge')}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.location}>
                <FontAwesome5 name="map-marker-alt" size={11} color={COLORS.textMuted} />{'  '}
                {[item.city, item.commune, item.quartier].filter(Boolean).join(', ')}
              </Text>
              <Text style={styles.stars}>{renderStars(item.stars)} {item.stars} {item.stars > 1 ? t('hotels.stars_plural') : t('hotels.stars')}</Text>
            </View>
            {user?.role === 'client' && (
              <TouchableOpacity onPress={() => toggleFav(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <FontAwesome5
                  name="heart"
                  size={22}
                  color={favorites.has(item.id) ? COLORS.danger : COLORS.grayLight}
                  solid={favorites.has(item.id)}
                />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.cardFooter}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.category}</Text>
            </View>
            {item.rating ? (
              <View style={styles.ratingWrap}>
                <FontAwesome5 name="star" size={11} color="#F4A261" solid />
                <Text style={styles.ratingText}>{item.rating}</Text>
              </View>
            ) : null}
            <Text style={styles.price}>{item.price?.toLocaleString()} FCFA<Text style={styles.perNight}>{t('common.perNight')}</Text></Text>
          </View>

          {user?.role !== 'admin' && user?.role !== 'prestataire' && (
            <TouchableOpacity
              style={styles.reserveBtn}
              onPress={() => router.push({ pathname: '/(tabs)/reservations/create' as any, params: { hotel_id: item.id } })}
            >
              <FontAwesome5 name="calendar-check" size={13} color={COLORS.white} />
              <Text style={styles.reserveBtnText}>{t('hotels.bookBtn')}</Text>
            </TouchableOpacity>
          )}

          {canManage && (
            <View style={styles.managerActions}>
              <TouchableOpacity style={styles.editBtn} onPress={() => openEditHotel(item)}>
                <FontAwesome5 name="pen" size={12} color={COLORS.primary} />
                <Text style={styles.editBtnText}>{t('common.edit')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteHotel(item)}>
                <FontAwesome5 name="trash-alt" size={12} color={COLORS.danger} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <View style={styles.searchRow}>
          <View style={[styles.searchBar, { flex: 1, margin: 0 }]}>
            <FontAwesome5 name="search" size={15} color={COLORS.gray} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder={t('hotels.search')}
              returnKeyType="search"
              onSubmitEditing={fetchHotels}
              placeholderTextColor={COLORS.textMuted}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => { setSearch(''); fetchHotels(); }}>
                <FontAwesome5 name="times-circle" size={16} color={COLORS.gray} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]}
            onPress={() => setShowFilters(true)}
          >
            <FontAwesome5 name="sliders-h" size={15} color={activeFilterCount > 0 ? COLORS.white : COLORS.primary} />
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {activeFilterCount > 0 && (
          <View style={styles.activeFiltersRow}>
            {filterCity && (
              <TouchableOpacity style={styles.activeFilterChip} onPress={() => { setFilterCity(''); setFilterCommune(''); setFilterQuartier(''); }}>
                <Text style={styles.activeFilterChipText}>{filterCity}</Text>
                <FontAwesome5 name="times" size={10} color={COLORS.primary} />
              </TouchableOpacity>
            )}
            {filterCommune && (
              <TouchableOpacity style={styles.activeFilterChip} onPress={() => { setFilterCommune(''); setFilterQuartier(''); }}>
                <Text style={styles.activeFilterChipText}>{filterCommune}</Text>
                <FontAwesome5 name="times" size={10} color={COLORS.primary} />
              </TouchableOpacity>
            )}
            {filterQuartier && (
              <TouchableOpacity style={styles.activeFilterChip} onPress={() => setFilterQuartier('')}>
                <Text style={styles.activeFilterChipText}>{filterQuartier}</Text>
                <FontAwesome5 name="times" size={10} color={COLORS.primary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={resetFilters}>
              <Text style={styles.resetFiltersText}>{t('hotels.clearAll')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Barre de filtres (uniquement en mode "tous") */}
        {scope === 'tous' && user?.role === 'prestataire' && (
          <View style={styles.tabBar}>
            {(['tous', 'mes', 'autres'] as const).map(tab => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab && styles.tabActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab === 'tous' ? t('hotels.tab_all') : tab === 'mes' ? t('hotels.tab_mine') : t('hotels.tab_others')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <FlatList
          data={filteredHotels}
          keyExtractor={h => String(h.id)}
          renderItem={renderHotel}
          contentContainerStyle={{ padding: 12, paddingBottom: 80 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
          ListHeaderComponent={scope !== 'mine' ? <PromoBanners /> : null}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.empty}>
                <FontAwesome5 name="building" size={48} color={COLORS.grayLight} />
                <Text style={styles.emptyText}>{t('hotels.noResults')}</Text>
              </View>
            ) : null
          }
        />

      </View>

      {/* Modal filtres localisation */}
      <Modal visible={showFilters} transparent animationType="slide" onRequestClose={() => setShowFilters(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowFilters(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet} onPress={e => e.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>{t('hotels.filterByLocation')}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowFilters(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <FontAwesome5 name="times" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>{t('hotels.cityFilterLabel')}</Text>
              {cityOptions.length === 0 ? (
                <Text style={styles.filterEmptyText}>{t('hotels.noCityAvailable')}</Text>
              ) : (
                <View style={styles.filterChipsWrap}>
                  {cityOptions.map(c => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.catChip, filterCity === c && styles.catChipActive]}
                      onPress={() => {
                        setFilterCity(filterCity === c ? '' : c);
                        setFilterCommune('');
                        setFilterQuartier('');
                      }}
                    >
                      <Text style={[styles.catChipText, filterCity === c && styles.catChipTextActive]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={styles.fieldLabel}>{t('hotels.communeLabel')}</Text>
              {communeOptions.length === 0 ? (
                <Text style={styles.filterEmptyText}>{t('hotels.noCommuneAvailable')}{filterCity ? t('hotels.forLocation', { name: filterCity }) : ''}</Text>
              ) : (
                <View style={styles.filterChipsWrap}>
                  {communeOptions.map(c => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.catChip, filterCommune === c && styles.catChipActive]}
                      onPress={() => {
                        setFilterCommune(filterCommune === c ? '' : c);
                        setFilterQuartier('');
                      }}
                    >
                      <Text style={[styles.catChipText, filterCommune === c && styles.catChipTextActive]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={styles.fieldLabel}>{t('hotels.quartierLabel')}</Text>
              {quartierOptions.length === 0 ? (
                <Text style={styles.filterEmptyText}>{t('hotels.noQuartierAvailable')}{filterCommune ? t('hotels.forLocation', { name: filterCommune }) : ''}</Text>
              ) : (
                <View style={styles.filterChipsWrap}>
                  {quartierOptions.map(q => (
                    <TouchableOpacity
                      key={q}
                      style={[styles.catChip, filterQuartier === q && styles.catChipActive]}
                      onPress={() => setFilterQuartier(filterQuartier === q ? '' : q)}
                    >
                      <Text style={[styles.catChipText, filterQuartier === q && styles.catChipTextActive]}>{q}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                <TouchableOpacity style={[styles.editBtn, { flex: 1, justifyContent: 'center' }]} onPress={resetFilters}>
                  <FontAwesome5 name="undo" size={12} color={COLORS.primary} />
                  <Text style={styles.editBtnText}>{t('hotels.reset')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.confirmBtn, { flex: 1, marginTop: 0 }]} onPress={() => setShowFilters(false)}>
                  <Text style={styles.confirmBtnText}>{t('hotels.viewResults', { count: filteredHotels.length })}</Text>
                </TouchableOpacity>
              </View>
              <View style={{ height: 24 }} />
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* FAB Ajouter hôtel (uniquement en mode "mes hôtels") */}
      {isManager && scope === 'mine' && (
        <TouchableOpacity style={styles.fab} onPress={openCreateHotel}>
          <FontAwesome5 name="plus" size={22} color={COLORS.white} />
        </TouchableOpacity>
      )}

      {/* Modal hôtel */}
      <Modal visible={showHotelModal} transparent animationType="slide" onRequestClose={() => setShowHotelModal(false)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>{editingHotel ? t('hotels.editHotel') : t('hotels.newHotel')}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowHotelModal(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <FontAwesome5 name="times" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* ── Section : Photo ── */}
              <View style={styles.formSection}>
                <View style={styles.sectionHeader}>
                  <FontAwesome5 name="camera" size={14} color={COLORS.primary} />
                  <Text style={styles.sectionLabel}>{t('hotels.photoSection')}</Text>
                </View>
                <TouchableOpacity style={styles.imagePicker} onPress={pickHotelImage} activeOpacity={0.85}>
                  {hotelImage ? (
                    <>
                      <Image source={{ uri: hotelImage.uri }} style={styles.imagePickerImg} resizeMode="cover" />
                      <View style={styles.imagePickerOverlay}>
                        <FontAwesome5 name="camera" size={14} color={COLORS.white} />
                        <Text style={styles.imagePickerOverlayText}>{t('hotels.changePhoto')}</Text>
                      </View>
                    </>
                  ) : currentImageUrl ? (
                    <>
                      <Image source={{ uri: currentImageUrl }} style={styles.imagePickerImg} resizeMode="cover" />
                      <View style={styles.imagePickerOverlay}>
                        <FontAwesome5 name="camera" size={14} color={COLORS.white} />
                        <Text style={styles.imagePickerOverlayText}>{t('hotels.changePhoto')}</Text>
                      </View>
                    </>
                  ) : (
                    <View style={styles.imagePickerEmpty}>
                      <FontAwesome5 name="cloud-upload-alt" size={30} color={COLORS.textMuted} />
                      <Text style={styles.imagePickerText}>{t('hotels.addPhoto')}</Text>
                      <Text style={styles.imagePickerSub}>{t('hotels.photoFormats')}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                {hotelImage && (
                  <TouchableOpacity style={styles.imageRemoveBtn} onPress={() => setHotelImage(null)}>
                    <FontAwesome5 name="trash-alt" size={11} color={COLORS.danger} />
                    <Text style={styles.imageRemoveBtnText}>{t('hotels.removePhoto')}</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* ── Section : Identité ── */}
              <View style={styles.formSection}>
                <View style={styles.sectionHeader}>
                  <FontAwesome5 name="hotel" size={14} color={COLORS.primary} />
                  <Text style={styles.sectionLabel}>{t('hotels.identitySection')}</Text>
                </View>
                <Text style={styles.fieldLabel}>{t('hotels.hotelNameLabel')}</Text>
                <View style={styles.inputWrap}>
                  <TextInput style={styles.fieldInput} value={hotelForm.name} onChangeText={v => setHotelForm(f => ({ ...f, name: v }))} placeholder={t('hotels.hotelNamePh')} placeholderTextColor={COLORS.textMuted} />
                </View>
                <Text style={styles.fieldLabel}>{t('hotels.shortName')}</Text>
                <View style={styles.inputWrap}>
                  <TextInput style={styles.fieldInput} value={hotelForm.short_name} onChangeText={v => setHotelForm(f => ({ ...f, short_name: v }))} placeholder={t('hotels.shortNamePh')} placeholderTextColor={COLORS.textMuted} />
                </View>
                <Text style={styles.fieldLabel}>{t('hotels.manager')}</Text>
                <View style={styles.inputWrap}>
                  <FontAwesome5 name="user-tie" size={14} color={COLORS.textMuted} style={{ marginRight: 8 }} />
                  <TextInput style={styles.fieldInput} value={hotelForm.manager} onChangeText={v => setHotelForm(f => ({ ...f, manager: v }))} placeholder={t('hotels.managerPh')} placeholderTextColor={COLORS.textMuted} />
                </View>
              </View>

              {/* ── Section : Localisation ── */}
              <View style={styles.formSection}>
                <View style={styles.sectionHeader}>
                  <FontAwesome5 name="map-marker-alt" size={14} color="#ef4444" />
                  <Text style={styles.sectionLabel}>{t('hotels.locationSection')}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>{t('hotels.cityLabel')}</Text>
                    <View style={styles.inputWrap}>
                      <TextInput style={styles.fieldInput} value={hotelForm.city} onChangeText={v => setHotelForm(f => ({ ...f, city: v }))} placeholder={t('hotels.cityPh')} placeholderTextColor={COLORS.textMuted} />
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>{t('hotels.communeLabel')}</Text>
                    <View style={styles.inputWrap}>
                      <TextInput style={styles.fieldInput} value={hotelForm.commune} onChangeText={v => setHotelForm(f => ({ ...f, commune: v }))} placeholder={t('hotels.communePh')} placeholderTextColor={COLORS.textMuted} />
                    </View>
                  </View>
                </View>
                <Text style={styles.fieldLabel}>{t('hotels.quartierLabel')}</Text>
                <View style={styles.inputWrap}>
                  <TextInput style={styles.fieldInput} value={hotelForm.quartier} onChangeText={v => setHotelForm(f => ({ ...f, quartier: v }))} placeholder={t('hotels.quartierPh')} placeholderTextColor={COLORS.textMuted} />
                </View>
              </View>

              {/* ── Section : Classification ── */}
              <View style={styles.formSection}>
                <View style={styles.sectionHeader}>
                  <FontAwesome5 name="star" size={14} color="#f59e0b" />
                  <Text style={styles.sectionLabel}>{t('hotels.classSection')}</Text>
                </View>
                <Text style={styles.fieldLabel}>{t('hotels.starsLabel')}</Text>
                <View style={styles.starsRow}>
                  {[1,2,3,4,5].map(n => (
                    <TouchableOpacity key={n} onPress={() => setHotelForm(f => ({ ...f, stars: n }))} style={styles.starBtn}>
                      <FontAwesome5
                        name="star"
                        size={30}
                        color={n <= hotelForm.stars ? '#f59e0b' : COLORS.border}
                        solid={n <= hotelForm.stars}
                      />
                    </TouchableOpacity>
                  ))}
                  <Text style={styles.starsLabel}>{hotelForm.stars} {hotelForm.stars > 1 ? t('hotels.stars_plural') : t('hotels.stars')}</Text>
                </View>
                <Text style={styles.fieldLabel}>{t('hotels.categoryLabel')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                  <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
                    {HOTEL_CATS.map(c => (
                      <TouchableOpacity
                        key={c}
                        style={[styles.catChip, hotelForm.category === c && styles.catChipActive]}
                        onPress={() => setHotelForm(f => ({ ...f, category: c }))}
                      >
                        <Text style={[styles.catChipText, hotelForm.category === c && styles.catChipTextActive]}>{t(HOTEL_CAT_KEYS[c] ?? c)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              {/* ── Section : Tarif ── */}
              <View style={styles.formSection}>
                <View style={styles.sectionHeader}>
                  <FontAwesome5 name="tag" size={14} color="#10b981" />
                  <Text style={styles.sectionLabel}>{t('hotels.priceSection')}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>{t('hotels.priceLabel')}</Text>
                    <View style={styles.inputWrap}>
                      <TextInput style={styles.fieldInput} value={hotelForm.price} onChangeText={v => setHotelForm(f => ({ ...f, price: v.replace(/[^0-9]/g, '') }))} placeholder="210 000" placeholderTextColor={COLORS.textMuted} keyboardType="number-pad" />
                    </View>
                  </View>
                </View>
                <Text style={styles.fieldLabel}>{t('hotels.phoneLabel')}</Text>
                <View style={styles.inputWrap}>
                  <FontAwesome5 name="phone" size={14} color={COLORS.textMuted} style={{ marginRight: 8 }} />
                  <TextInput style={styles.fieldInput} value={hotelForm.phone} onChangeText={v => setHotelForm(f => ({ ...f, phone: v }))} placeholder="+225 00 00 00 00" placeholderTextColor={COLORS.textMuted} keyboardType="phone-pad" />
                </View>
                <Text style={styles.fieldLabel}>{t('hotels.emailLabel')}</Text>
                <View style={styles.inputWrap}>
                  <FontAwesome5 name="envelope" size={14} color={COLORS.textMuted} style={{ marginRight: 8 }} />
                  <TextInput style={styles.fieldInput} value={hotelForm.email} onChangeText={v => setHotelForm(f => ({ ...f, email: v }))} placeholder="contact@hotel.com" placeholderTextColor={COLORS.textMuted} keyboardType="email-address" autoCapitalize="none" />
                </View>
              </View>

              {/* ── Section : Équipements ── */}
              <View style={styles.formSection}>
                <View style={styles.sectionHeader}>
                  <FontAwesome5 name="concierge-bell" size={14} color="#8b5cf6" />
                  <Text style={styles.sectionLabel}>{t('hotels.amenitiesSection')}</Text>
                </View>
                <View style={styles.amenitiesGrid}>
                  {HOTEL_AMENITIES.map(a => {
                    const selected = hotelForm.services.includes(a.key);
                    return (
                      <TouchableOpacity
                        key={a.key}
                        style={[styles.amenityItem, selected && styles.amenityItemActive]}
                        onPress={() => setHotelForm(f => ({
                          ...f,
                          services: selected
                            ? f.services.filter(s => s !== a.key)
                            : [...f.services, a.key],
                        }))}
                      >
                        <Text style={styles.amenityEmoji}>{a.emoji}</Text>
                        <Text style={[styles.amenityLabel, selected && styles.amenityLabelActive]} numberOfLines={2}>
                          {t(a.labelKey)}
                        </Text>
                        {selected && (
                          <View style={styles.amenityCheck}>
                            <FontAwesome5 name="check" size={8} color={COLORS.white} />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* ── Section : Description ── */}
              <View style={styles.formSection}>
                <View style={styles.sectionHeader}>
                  <FontAwesome5 name="align-left" size={14} color={COLORS.textMuted} />
                  <Text style={styles.sectionLabel}>{t('hotels.descSection')}</Text>
                </View>
                <View style={[styles.inputWrap, { alignItems: 'flex-start', minHeight: 90 }]}>
                  <TextInput
                    style={[styles.fieldInput, { textAlignVertical: 'top' }]}
                    value={hotelForm.description}
                    onChangeText={v => setHotelForm(f => ({ ...f, description: v }))}
                    placeholder={t('hotels.descPh')}
                    placeholderTextColor={COLORS.textMuted}
                    multiline
                    numberOfLines={4}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.confirmBtn, { marginTop: 8 }, hotelSaving && { opacity: 0.6 }]}
                onPress={handleSaveHotel}
                disabled={hotelSaving}
              >
                {hotelSaving
                  ? <ActivityIndicator color={COLORS.white} />
                  : <>
                      <FontAwesome5 name={editingHotel ? 'save' : 'plus'} size={15} color={COLORS.white} />
                      <Text style={styles.confirmBtnText}>{editingHotel ? t('hotels.saveHotel') : t('hotels.createHotel')}</Text>
                    </>
                }
              </TouchableOpacity>
              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Calendriers */}
      <DatePicker
        visible={datePicker === 'check_in'}
        value={reserveForm.check_in}
        minDate={today()}
        title={t('hotels.arrivalDate')}
        onConfirm={d => { setReserveForm(f => ({ ...f, check_in: d, check_out: d > f.check_out ? '' : f.check_out })); setDatePicker(null); }}
        onCancel={() => setDatePicker(null)}
      />
      <DatePicker
        visible={datePicker === 'check_out'}
        value={reserveForm.check_out}
        minDate={reserveForm.check_in || today()}
        title={t('hotels.departureDate')}
        onConfirm={d => { setReserveForm(f => ({ ...f, check_out: d })); setDatePicker(null); }}
        onCancel={() => setDatePicker(null)}
      />

      {/* Modal réservation */}
      <Modal
        visible={!!reserveHotel}
        transparent
        animationType="slide"
        onRequestClose={() => setReserveHotel(null)}
      >
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.sheet}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* En-tête */}
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>{t('hotels.bookTitle')}</Text>
                <Text style={styles.sheetSubtitle} numberOfLines={1}>{reserveHotel?.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setReserveHotel(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <FontAwesome5 name="times" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Prix/nuit */}
            {reserveHotel?.price ? (
              <View style={styles.priceRow}>
                <FontAwesome5 name="tag" size={13} color={COLORS.primary} />
                <Text style={styles.priceLabel}>{reserveHotel.price.toLocaleString()} {t('hotels.perNightFull')}</Text>
              </View>
            ) : null}

            {/* Champs */}
            <Text style={styles.fieldLabel}>{t('hotels.arrivalDate')}</Text>
            <TouchableOpacity style={styles.inputWrap} onPress={() => setDatePicker('check_in')}>
              <FontAwesome5 name="calendar" size={14} color={COLORS.primary} style={{ marginRight: 10 }} />
              <Text style={[styles.fieldInput, !reserveForm.check_in && { color: COLORS.textMuted }]}>
                {reserveForm.check_in ? fmtDisplay(reserveForm.check_in, t('calendar.monthsShort', { returnObjects: true }) as string[]) : t('hotels.chooseDate')}
              </Text>
              <FontAwesome5 name="chevron-right" size={11} color={COLORS.textMuted} />
            </TouchableOpacity>

            <Text style={styles.fieldLabel}>{t('hotels.departureDate')}</Text>
            <TouchableOpacity style={styles.inputWrap} onPress={() => setDatePicker('check_out')}>
              <FontAwesome5 name="calendar-alt" size={14} color={COLORS.primary} style={{ marginRight: 10 }} />
              <Text style={[styles.fieldInput, !reserveForm.check_out && { color: COLORS.textMuted }]}>
                {reserveForm.check_out ? fmtDisplay(reserveForm.check_out, t('calendar.monthsShort', { returnObjects: true }) as string[]) : t('hotels.chooseDate')}
              </Text>
              <FontAwesome5 name="chevron-right" size={11} color={COLORS.textMuted} />
            </TouchableOpacity>

            <Text style={styles.fieldLabel}>{t('hotels.guestsLabel')}</Text>
            <View style={styles.inputWrap}>
              <FontAwesome5 name="user-friends" size={14} color={COLORS.textMuted} style={{ marginRight: 10 }} />
              <TextInput
                style={styles.fieldInput}
                value={reserveForm.guests}
                onChangeText={v => setReserveForm(f => ({ ...f, guests: v.replace(/[^0-9]/g, '') }))}
                placeholder="1"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="number-pad"
              />
            </View>

            <Text style={styles.fieldLabel}>{t('hotels.paymentMethod')}</Text>
            {PAYMENT_METHODS.map(pm => (
              <TouchableOpacity
                key={pm.value}
                style={[styles.pmItem, reserveForm.paymentMethod === pm.value && styles.pmItemActive]}
                onPress={() => { setReserveForm(f => ({ ...f, paymentMethod: pm.value })); setPaymentInfo({ ...EMPTY_INFO }); }}
              >
                <Text style={styles.pmIcon}>{pm.icon}</Text>
                <Text style={[styles.pmLabel, reserveForm.paymentMethod === pm.value && styles.pmLabelActive]}>
                  {pm.label}
                </Text>
                {reserveForm.paymentMethod === pm.value && (
                  <View style={styles.pmCheck}>
                    <Text style={{ color: COLORS.white, fontSize: 11, fontWeight: '700' }}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
            <PaymentInfoFields
              method={reserveForm.paymentMethod}
              info={paymentInfo}
              onChange={setPaymentInfo}
            />

            {/* Bouton confirmer */}
            <TouchableOpacity
              style={[styles.confirmBtn, reserving && { opacity: 0.6 }]}
              onPress={handleReserve}
              disabled={reserving}
            >
              {reserving
                ? <ActivityIndicator color={COLORS.white} />
                : <>
                    <FontAwesome5 name="calendar-check" size={15} color={COLORS.white} />
                    <Text style={styles.confirmBtnText}>{t('hotels.confirmBook')}</Text>
                  </>
              }
            </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container:            { flex: 1, backgroundColor: COLORS.background },
  searchRow:            { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 12, marginTop: 6, marginBottom: 4 },
  searchBar:            { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  searchInput:          { flex: 1, fontSize: 14, color: COLORS.text },
  filterBtn:            { width: 42, height: 42, borderRadius: 12, backgroundColor: COLORS.white, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  filterBtnActive:      { backgroundColor: COLORS.primary },
  filterBadge:          { position: 'absolute', top: -4, right: -4, backgroundColor: COLORS.danger, borderRadius: 8, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  filterBadgeText:      { color: COLORS.white, fontSize: 10, fontWeight: '700' },
  activeFiltersRow:     { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 8 },
  activeFilterChip:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EEF2FF', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  activeFilterChipText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  resetFiltersText:     { fontSize: 12, fontWeight: '600', color: COLORS.textMuted, textDecorationLine: 'underline' },
  filterChipsWrap:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterEmptyText:      { fontSize: 12, color: COLORS.textMuted, fontStyle: 'italic' },
  promosSection:        { marginBottom: 8, marginTop: 4 },
  promosScroll:         { paddingHorizontal: 12, gap: 8 },
  promoCard:            { width: CARD_WIDTH, borderRadius: 12, padding: 10, gap: 5 },
  dotRow:               { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, marginTop: 6 },
  dot:                  { width: 5, height: 5, borderRadius: 3, backgroundColor: '#CBD5E1' },
  dotActive:            { width: 14, height: 5, borderRadius: 3, backgroundColor: '#1E3A5F' },
  promoIconWrap:        { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  promoTitle:           { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  promoDesc:            { fontSize: 9, color: 'rgba(255,255,255,0.75)', lineHeight: 13 },
  card:                 { backgroundColor: COLORS.white, borderRadius: 16, marginBottom: 12, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 6, elevation: 3 },
  cardImage:            { width: '100%', height: 170 },
  cardImagePlaceholder: { width: '100%', height: 120, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  cardImageEmoji:       { fontSize: 40 },
  cardBody:             { padding: 14 },
  cardHeader:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  cardInfo:             { flex: 1, marginRight: 10 },
  hotelName:            { fontSize: 16, fontWeight: '700', color: COLORS.dark, marginBottom: 4 },
  location:             { fontSize: 12, color: COLORS.textMuted, marginBottom: 3 },
  stars:                { fontSize: 12, color: COLORS.textMuted },
  cardFooter:           { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge:                { backgroundColor: '#EEF2FF', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText:            { fontSize: 11, color: COLORS.primary, fontWeight: '600' },
  ratingWrap:           { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText:           { fontSize: 12, fontWeight: '700', color: COLORS.dark },
  price:                { marginLeft: 'auto', fontSize: 15, fontWeight: '700', color: COLORS.primary },
  perNight:             { fontSize: 11, fontWeight: '400', color: COLORS.textMuted },
  reserveBtn:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 10, marginTop: 12 },
  reserveBtnText:       { color: COLORS.white, fontSize: 14, fontWeight: '700' },
  empty:                { alignItems: 'center', paddingTop: 40, gap: 12 },
  emptyText:            { fontSize: 16, color: COLORS.textMuted },
  fab:                  { position: 'absolute', bottom: 20, right: 20, backgroundColor: COLORS.primary, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 8 },
  managerActions:       { flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' },
  editBtn:              { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EEF2FF', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, flex: 1 },
  editBtnText:          { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  deleteBtn:            { width: 36, height: 36, borderRadius: 8, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center' },
  tabBar:               { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  tab:                  { flex: 1, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.background, borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center' },
  tabActive:            { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabText:              { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },
  tabTextActive:        { color: COLORS.white },
  otherBadge:           { backgroundColor: '#F1F5F9', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  otherBadgeText:       { fontSize: 10, fontWeight: '600', color: '#94A3B8' },
  imagePicker:            { borderRadius: 12, overflow: 'hidden', height: 160, backgroundColor: COLORS.background, borderWidth: 1.5, borderColor: COLORS.border },
  imagePickerImg:         { width: '100%', height: 160 },
  imagePickerEmpty:       { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  imagePickerText:        { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  imagePickerSub:         { fontSize: 11, color: COLORS.grayLight },
  imagePickerOverlay:     { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 8 },
  imagePickerOverlayText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },
  imageRemoveBtn:         { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingVertical: 4 },
  imageRemoveBtnText:     { color: COLORS.danger, fontSize: 12 },
  formSection:          { backgroundColor: COLORS.white, borderRadius: 14, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  sectionHeader:        { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  sectionLabel:         { fontSize: 13, fontWeight: '700', color: COLORS.dark, textTransform: 'uppercase', letterSpacing: 0.4 },
  starsRow:             { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, marginBottom: 8 },
  starBtn:              { padding: 4 },
  starsLabel:           { fontSize: 14, color: COLORS.textMuted, marginLeft: 8, fontWeight: '600' },
  catChip:              { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.background },
  catChipActive:        { borderColor: COLORS.primary, backgroundColor: '#EEF2FF' },
  catChipText:          { fontSize: 13, color: COLORS.textMuted },
  catChipTextActive:    { color: COLORS.primary, fontWeight: '700' },
  amenitiesGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  amenityItem:          { width: '47%', flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10, padding: 10, backgroundColor: COLORS.background, position: 'relative' },
  amenityItemActive:    { borderColor: COLORS.primary, backgroundColor: '#EEF2FF' },
  amenityEmoji:         { fontSize: 18 },
  amenityLabel:         { flex: 1, fontSize: 12, color: COLORS.textMuted, lineHeight: 16 },
  amenityLabelActive:   { color: COLORS.primary, fontWeight: '600' },
  amenityCheck:         { position: 'absolute', top: 4, right: 4, width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  overlay:              { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:                { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 34 },
  sheetHeader:          { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  sheetTitle:           { fontSize: 18, fontWeight: '700', color: COLORS.dark },
  sheetSubtitle:        { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  priceRow:             { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EEF2FF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 16 },
  priceLabel:           { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  fieldLabel:           { fontSize: 13, fontWeight: '600', color: COLORS.dark, marginBottom: 6, marginTop: 14 },
  inputWrap:            { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, backgroundColor: COLORS.background },
  fieldInput:           { flex: 1, fontSize: 14, color: COLORS.text },
  confirmBtn:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 15, marginTop: 16 },
  confirmBtnText:       { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  pmItem:               { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 2, borderColor: COLORS.border, borderRadius: 12, padding: 12, marginBottom: 8, backgroundColor: COLORS.white },
  pmItemActive:         { borderColor: COLORS.primary, backgroundColor: '#EEF2FF' },
  pmIcon:               { fontSize: 20 },
  pmLabel:              { flex: 1, fontSize: 14, color: COLORS.dark },
  pmLabelActive:        { color: COLORS.primary, fontWeight: '700' },
  pmCheck:              { width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
});
