import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { View, ActivityIndicator } from 'react-native';
import { COLORS } from '@/constants';

export default function Index() {
  const { user, loading } = useAuthStore();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.primary }}>
        <ActivityIndicator size="large" color={COLORS.secondary} />
      </View>
    );
  }

  return user ? <Redirect href="/(tabs)" /> : <Redirect href="/(auth)/login" />;
}
