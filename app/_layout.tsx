import { useEffect, useState } from 'react';
import { View, Image, StyleSheet, ActivityIndicator, Text, TouchableOpacity, LogBox } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { COLORS } from '@/constants';
import { initI18n } from '@/i18n';
import { useTranslation } from 'react-i18next';

// Supprimer les warnings AxiosError en développement — gérés par le store
if (__DEV__) {
  LogBox.ignoreLogs([
    'AxiosError: Network Error',
    '[AxiosError: Network Error]',
    'Possible Unhandled Promise Rejection',
  ]);
}

function ServerDownScreen({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  const { t } = useTranslation();
  return (
    <View style={styles.serverDown}>
      <FontAwesome5 name="server" size={64} color="rgba(255,255,255,0.3)" />
      <Text style={styles.sdTitle}>{t('server.down')}</Text>
      <Text style={styles.sdDesc}>{t('server.desc')}</Text>
      <View style={styles.sdCode}>
        <Text style={styles.sdCodeText}>cd mobile/backend</Text>
        <Text style={styles.sdCodeText}>node server.js</Text>
      </View>
      <TouchableOpacity style={styles.retryBtn} onPress={onRetry} disabled={retrying}>
        {retrying
          ? <ActivityIndicator color={COLORS.white} size="small" />
          : <>
              <FontAwesome5 name="redo" size={14} color={COLORS.white} />
              <Text style={styles.retryText}>{t('server.retry')}</Text>
            </>
        }
      </TouchableOpacity>
    </View>
  );
}

export default function RootLayout() {
  const { loadUser, serverDown } = useAuthStore();
  const [ready, setReady]       = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    initI18n().then(() => loadUser()).finally(() => setReady(true));
  }, []);

  const handleRetry = async () => {
    setRetrying(true);
    await loadUser();
    setRetrying(false);
  };

  if (!ready) {
    return (
      <SafeAreaProvider>
        <View style={styles.splash}>
          <View style={styles.logoRing}>
            <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="cover" />
          </View>
          <ActivityIndicator color={COLORS.secondary} size="large" style={styles.indicator} />
        </View>
      </SafeAreaProvider>
    );
  }

  if (serverDown) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <ServerDownScreen onRetry={handleRetry} retrying={retrying} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash:      { flex: 1, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', gap: 0 },
  logoRing:    { width: 160, height: 160, borderRadius: 80, overflow: 'hidden', backgroundColor: COLORS.white, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 24, elevation: 12 },
  logo:        { width: 160, height: 160 },
  indicator:   { marginTop: 36 },
  serverDown:  { flex: 1, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 16 },
  sdTitle:     { fontSize: 24, fontWeight: '800', color: COLORS.white, marginTop: 16 },
  sdDesc:      { fontSize: 15, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 22 },
  sdCode:      { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: 14, marginTop: 8, width: '100%' },
  sdCodeText:  { fontFamily: 'monospace', color: '#86efac', fontSize: 13, lineHeight: 22 },
  retryBtn:    { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.secondary, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12, marginTop: 8 },
  retryText:   { color: COLORS.white, fontWeight: '700', fontSize: 16 },
});
