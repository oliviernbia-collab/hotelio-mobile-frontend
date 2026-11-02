import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS } from '@/constants';

/* Carte de localisation d'un hôtel — même carte Google que le web (hotels/details,
   reservations/success) : coordonnées GPS si l'hôtel en a, sinon recherche par nom +
   quartier + ville, avec les mêmes niveaux de zoom. */

type Props = {
  name?: string | null;
  quartier?: string | null;
  city?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  height?: number;
};

export function hotelMapUrls({ name, quartier, city, latitude, longitude }: Props) {
  if (latitude && longitude) {
    const q = `${latitude},${longitude}`;
    return {
      embed: `https://maps.google.com/maps?q=${q}&output=embed&hl=fr&z=16`,
      link:  `https://www.google.com/maps?q=${q}`,
    };
  }
  const q = encodeURIComponent([name, quartier, city, "Côte d'Ivoire"].filter(Boolean).join(' '));
  return {
    embed: `https://maps.google.com/maps?q=${q}&output=embed&hl=fr&z=15`,
    link:  `https://www.google.com/maps/search/?api=1&query=${q}`,
  };
}

export default function HotelMap(props: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const { embed, link } = hotelMapUrls(props);
  const address = [props.quartier, props.city].filter(Boolean).join(', ');

  // Page minimale qui occupe tout le cadre avec l'iframe de la carte.
  const html = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<style>html,body{margin:0;padding:0;height:100%;overflow:hidden;background:#EEF2FF}iframe{border:0;width:100%;height:100%;display:block}</style>
</head><body><iframe src="${embed}" loading="eager" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe></body></html>`;

  return (
    <View style={s.card}>
      <View style={s.header}>
        <FontAwesome5 name="map-marker-alt" size={15} color={COLORS.secondary} />
        <Text style={s.title}>{t('resSuccess.location')}</Text>
        <TouchableOpacity style={s.openBtn} onPress={() => Linking.openURL(link)}>
          <FontAwesome5 name="external-link-alt" size={11} color={COLORS.primary} />
          <Text style={s.openText}>{t('resSuccess.openMaps')}</Text>
        </TouchableOpacity>
      </View>

      <View style={[s.mapBox, { height: props.height ?? 220 }]}>
        <WebView
          // Exactement comme le web : la carte Google est intégrée dans une iframe. Charger
          // l'URL d'intégration comme page entière passe par une redirection Google que la
          // WebView ne suit pas de façon fiable (carte vide).
          source={{ html, baseUrl: 'https://hotelio-ci.site' }}
          originWhitelist={['*']}
          style={s.map}
          onLoadEnd={() => setLoading(false)}
          // Le contenu de l'iframe se charge normalement ; seuls les liens ouverts par
          // l'utilisateur dans la page principale (itinéraire, « Agrandir ») partent vers
          // l'app Maps au lieu de remplacer la carte.
          onShouldStartLoadWithRequest={(req) => {
            if (req.isTopFrame === false) return true;
            if (req.url === 'about:blank' || req.url.startsWith('https://hotelio-ci.site')) return true;
            if (req.url.startsWith('http')) { Linking.openURL(req.url); return false; }
            return true;
          }}
          javaScriptEnabled
          domStorageEnabled
          setSupportMultipleWindows={false}
          scrollEnabled={false}
          nestedScrollEnabled
        />
        {loading && (
          <View style={s.loader}>
            <ActivityIndicator color={COLORS.primary} />
          </View>
        )}
      </View>

      {address ? (
        <Text style={s.address}>
          <FontAwesome5 name="map-pin" size={11} color={COLORS.textMuted} />  {address}
        </Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  card:     { backgroundColor: COLORS.white, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  header:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  title:    { flex: 1, fontSize: 15, fontWeight: '700', color: COLORS.dark },
  openBtn:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: COLORS.primary + '12' },
  openText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  mapBox:   { borderRadius: 12, overflow: 'hidden', backgroundColor: '#EEF2FF' },
  map:      { flex: 1 },
  loader:   { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  address:  { marginTop: 8, fontSize: 12, color: COLORS.textMuted },
});
