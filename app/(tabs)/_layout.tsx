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

  // href: null → retire complètement l'onglet (sans espace résiduel)
  // href: undefined → affiche l'onglet normalement

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
          href: isClient ? null : undefined,
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
          href: isAdminOrPr ? undefined : null,
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
          href: isClient ? null : undefined,
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
          href: isStaff ? null : undefined,
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
          href: isAdmin ? undefined : null,
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
      <Tabs.Screen name="notifications" options={{ href: null, title: t('tabs.notifications'), headerLeft: HeaderBackButton }} />
      <Tabs.Screen name="tickets"       options={{ href: null, title: t('tabs.tickets'),       headerLeft: HeaderBackButton }} />
      <Tabs.Screen name="expenses"      options={{ href: null, title: t('tabs.expenses'),      headerLeft: HeaderBackButton }} />
      <Tabs.Screen name="facturations"  options={{ href: null, title: t('tabs.facturations'),  headerLeft: HeaderBackButton }} />
      <Tabs.Screen name="favorites"     options={{ href: null, title: t('tabs.favorites'),     headerLeft: HeaderBackButton }} />
      <Tabs.Screen name="services"      options={{ href: null, title: t('tabs.services'),      headerLeft: HeaderBackButton }} />
      <Tabs.Screen name="clients"       options={{ href: null, title: t('tabs.topClients'),    headerLeft: HeaderBackButton }} />
      <Tabs.Screen name="pointage"      options={{ href: null, title: t('tabs.pointage'),      headerLeft: HeaderBackButton }} />
    </Tabs>
  );
}
