import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, changeLanguage } from '@/i18n';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  return (
    <View style={styles.row}>
      {LANGUAGES.map(lang => {
        const active = i18n.language === lang.code;
        return (
          <TouchableOpacity
            key={lang.code}
            style={[styles.btn, active && styles.btnActive]}
            onPress={() => changeLanguage(lang.code)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={styles.flag}>{lang.flag}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row:      { flexDirection: 'row', gap: 6 },
  btn:      { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  btnActive:{ borderColor: 'rgba(255,255,255,0.8)', backgroundColor: 'rgba(255,255,255,0.28)' },
  flag:     { fontSize: 16 },
});
