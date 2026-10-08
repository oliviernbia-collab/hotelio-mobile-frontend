import { TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { COLORS } from '@/constants';

export default function HeaderBackButton() {
  return (
    <TouchableOpacity
      style={styles.btn}
      onPress={() => router.back()}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <FontAwesome5 name="arrow-left" size={18} color={COLORS.white} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { marginLeft: 16, padding: 4 },
});
