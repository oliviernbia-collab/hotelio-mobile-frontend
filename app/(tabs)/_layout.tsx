import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { router } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { COLORS } from '@/constants';
import { View, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HeaderBackButton from '@/components/HeaderBackButton';
import { useTranslation } from 'react-i18next';

// Depuis expo-router 58, `href: null` se traduit par l'option `hidden` de React Navigation, qui
// redirige vers l'onglet initial dès que l'écran masqué prend le focus : tous les écrans ouverts via
// router.push (notifications, tickets, favoris…) renvoyaient alors à l'accueil. On masque donc
// uniquement le bouton.
const HIDDEN_TAB = { tabBarButton: () => null, tabBarItemStyle: { display: 'none' as const } };

export default function TabsLayout() {
  const { user, loading } = useAuthStore();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  // Redirection après mount — évite le warning "state update on unmounted component"
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/(auth)/login');
    }
  }, [loading, user]);

  if (loading || !user) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.primary }}>
        <ActivityIndicator size="large" color={COLORS.secondary} />
      </View>
    );
  }

  const role         = user.role;
  const isClient     = role === 'client';
  const isAdmin      = role === 'admin';
  const isAdminOrPr  = role === 'admin' || role === 'prestataire';
  const isStaff      = role === 'admin' || role === 'prestataire' || role === 'employe';
  // Le prestataire gère ses produits boutique dans ce même écran (mode dédié) — seuls
  // admin/employe n'ont rien à y faire.
  const hideBoutiqueTab = role === 'admin' || role === 'employe';

  // HIDDEN_TAB → retire le bouton de l'onglet (sans espace résiduel), l'écran restant accessible via router.push

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor:   COLORS.secondary,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.5)',
        tabBarStyle: {
          backgroundColor: COLORS.primary,
          borderTopColor:  'rgba(255,255,255,0.1)',
          paddingBottom:   Math.max(insets.bottom, 4),
          height:          60 + insets.bottom,
        },
        tabBarLabelStyle:  { fontSize: 10, fontWeight: '600' },
        headerStyle:       { backgroundColor: COLORS.primary },
        headerTintColor:   COLORS.white,
        headerTitleStyle:  { fontWeight: 'bold', fontSize: 18 },
      }}
    >
      {/* ── Accueil : tout le monde ── */}
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ focused, color, size }) => (
            <FontAwesome5 name="home" size={size} color={color} solid={focused} />
          ),
        }}
      />

      {/* ── Hôtels : tout le monde ── */}
      <Tabs.Screen
        name="hotels"
        options={{
          title: t('tabs.hotels'),
          tabBarIcon: ({ focused, color, size }) => (
            <FontAwesome5 name="building" size={size} color={color} solid={focused} />
          ),
        }}
      />

      {/* ── Réservations : tout le monde ── */}
      <Tabs.Screen
        name="reservations"
        options={{
          title: t('tabs.reservations'),
          tabBarIcon: ({ focused, color, size }) => (
            <FontAwesome5 name="calendar-alt" size={size} color={color} solid={focused} />
          ),
        }}
      />

      {/* ── Chambres : staff uniquement (pas client) ── */}
      <Tabs.Screen
        name="rooms"
        options={{
          title: t('tabs.rooms'),
          ...(isClient ? HIDDEN_TAB : {}),
          tabBarIcon: ({ focused, color, size }) => (
            <FontAwesome5 name="bed" size={size} color={color} solid={focused} />
          ),
        }}
      />

      {/* ── Personnel : admin & prestataire uniquement ── */}
      <Tabs.Screen
        name="staff"
        options={{
          title: t('tabs.staff'),
          ...(isAdminOrPr ? {} : HIDDEN_TAB),
          tabBarIcon: ({ focused, color, size }) => (
            <FontAwesome5 name="users" size={size} color={color} solid={focused} />
          ),
        }}
      />

      {/* ── Menu restaurant : staff uniquement ── */}
      <Tabs.Screen
        name="menu"
        options={{
          title: t('tabs.menu'),
          ...(isClient ? HIDDEN_TAB : {}),
          tabBarIcon: ({ focused, color, size }) => (
            <FontAwesome5 name="utensils" size={size} color={color} solid={focused} />
          ),
        }}
      />

      {/* ── Boutique : clients uniquement ── */}
      <Tabs.Screen
        name="boutique"
        options={{
          title: t('tabs.boutique'),
          ...(isStaff ? HIDDEN_TAB : {}),
          tabBarIcon: ({ focused, color, size }) => (
            <FontAwesome5 name="shopping-bag" size={size} color={color} solid={focused} />
          ),
        }}
      />

      {/* ── Admin : admin uniquement ── */}
      <Tabs.Screen
        name="admin"
        options={{
          title: t('tabs.admin'),
          ...(isAdmin ? {} : HIDDEN_TAB),
          tabBarIcon: ({ focused, color, size }) => (
            <FontAwesome5 name="shield-alt" size={size} color={color} solid={focused} />
          ),
        }}
      />

      {/* ── Profil : tout le monde ── */}
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ focused, color, size }) => (
            <FontAwesome5 name="user" size={size} color={color} solid={focused} />
          ),
        }}
      />

      {/* ── Écrans sans onglet (accessibles via router.push) ── */}
      <Tabs.Screen name="notifications" options={{ ...HIDDEN_TAB, title: t('tabs.notifications'), headerLeft: HeaderBackButton }} />
      <Tabs.Screen name="tickets"       options={{ ...HIDDEN_TAB, title: t('tabs.tickets'),       headerLeft: HeaderBackButton }} />
      <Tabs.Screen name="expenses"      options={{ ...HIDDEN_TAB, title: t('tabs.expenses'),      headerLeft: HeaderBackButton }} />
      <Tabs.Screen name="facturations"  options={{ ...HIDDEN_TAB, title: t('tabs.facturations'),  headerLeft: HeaderBackButton }} />
      <Tabs.Screen name="favorites"     options={{ ...HIDDEN_TAB, title: t('tabs.favorites'),     headerLeft: HeaderBackButton }} />
      <Tabs.Screen name="services"      options={{ ...HIDDEN_TAB, title: t('tabs.services'),      headerLeft: HeaderBackButton }} />
      <Tabs.Screen name="clients"       options={{ ...HIDDEN_TAB, title: t('tabs.topClients'),    headerLeft: HeaderBackButton }} />
      <Tabs.Screen name="staff-schedule" options={{ ...HIDDEN_TAB, title: t('staffSchedule.screenTitle'), headerLeft: HeaderBackButton }} />
      <Tabs.Screen name="pointage"      options={{ ...HIDDEN_TAB, title: t('tabs.pointage'),      headerLeft: HeaderBackButton }} />
      <Tabs.Screen name="two-factor"    options={{ ...HIDDEN_TAB, title: t('twoFa.screenTitle'),  headerLeft: HeaderBackButton }} />
      <Tabs.Screen name="pools"         options={{ ...HIDDEN_TAB, title: t('tabs.pools'),         headerLeft: HeaderBackButton }} />
      <Tabs.Screen name="orders"        options={{ ...HIDDEN_TAB, title: t('tabs.orders'),        headerLeft: HeaderBackButton }} />
      <Tabs.Screen name="payout-info"   options={{ ...HIDDEN_TAB, title: t('payoutInfo.screenTitle'), headerLeft: HeaderBackButton }} />
      <Tabs.Screen name="loyalty"       options={{ ...HIDDEN_TAB, title: t('profile.myLoyalty'), headerLeft: HeaderBackButton }} />
      <Tabs.Screen name="personal-info" options={{ ...HIDDEN_TAB, title: t('profile.personalInfo'), headerLeft: HeaderBackButton }} />
      <Tabs.Screen name="legal"         options={{ ...HIDDEN_TAB, title: t('legal.screenTitle'), headerLeft: HeaderBackButton }} />
    </Tabs>
  );
}
