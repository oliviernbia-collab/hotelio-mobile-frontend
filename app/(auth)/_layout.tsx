import { Stack } from 'expo-router';
import { COLORS } from '@/constants';
import { useTranslation } from 'react-i18next';

export default function AuthLayout() {
  const { t } = useTranslation();
  return (
    <Stack
      screenOptions={{
        headerStyle:      { backgroundColor: COLORS.primary },
        headerTintColor:  COLORS.white,
        headerTitleStyle: { fontWeight: 'bold' },
        contentStyle:     { backgroundColor: COLORS.background },
      }}
    >
      <Stack.Screen name="login"           options={{ title: t('auth.loginScreenTitle'),    headerShown: false }} />
      <Stack.Screen name="register"        options={{ title: t('auth.registerScreenTitle'), headerShown: false }} />
      <Stack.Screen name="forgot-password" options={{ title: t('auth.forgotTitle')  }} />
    </Stack>
  );
}
