import { View, Text, Image, StyleSheet, ImageSourcePropType } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';

interface PaymentMethodLike {
  badge?: string;
  icon?: string;
  logo?: ImageSourcePropType;
  bg: string;
  fg?: string;
}

interface Props {
  method: PaymentMethodLike;
  size?: number;
}

/** Représente un moyen de paiement : vrai logo (Orange Money/MTN/Wave/Moov), ou à défaut
 * un badge coloré (DJAMO) / une icône FontAwesome5 (Espèces, Virement). */
export default function PaymentMethodIcon({ method, size = 32 }: Props) {
  if (method.logo) {
    const width = size * 1.35;
    return (
      <View style={[s.box, { width, height: size, borderRadius: size * 0.22, backgroundColor: '#fff', padding: size * 0.1 }]}>
        <Image source={method.logo} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
      </View>
    );
  }

  const style = [s.box, { width: size, height: size, borderRadius: size * 0.28, backgroundColor: method.bg }];

  if (method.icon) {
    return (
      <View style={style}>
        <FontAwesome5 name={method.icon} size={size * 0.46} color={method.fg} />
      </View>
    );
  }

  return (
    <View style={style}>
      <Text style={[s.badgeText, { color: method.fg, fontSize: size * 0.24 }]} numberOfLines={1}>
        {method.badge}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  box:       { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  badgeText: { fontWeight: '800' },
});
