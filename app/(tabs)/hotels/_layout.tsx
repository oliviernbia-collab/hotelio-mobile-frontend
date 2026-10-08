import { Stack } from 'expo-router';
import { COLORS } from '@/constants';

export default function HotelsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle:      { backgroundColor: COLORS.primary },
        headerTintColor:  COLORS.white,
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    />
  );
}
