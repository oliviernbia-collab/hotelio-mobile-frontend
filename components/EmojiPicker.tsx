import { useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView, FlatList,
} from 'react-native';
import { COLORS } from '@/constants';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

// ─── Catalogue d'emojis par catégorie ────────────────────────────────────────
// NOTE : `label` sert d'identifiant interne stable (utilisé par la prop
// `categories` des écrans consommateurs) — l'affichage utilise `labelKey`.

export const EMOJI_CATS: { label: string; labelKey: string; icon: string; emojis: string[] }[] = [
  {
    label: 'Plats',
    labelKey: 'emoji.cat_plats',
    icon:  '🍽️',
    emojis: [
      '🍕','🍔','🌮','🌯','🥗','🥙','🫔','🌭','🥪','🧆',
      '🍝','🍜','🍛','🍲','🥘','🫕','🍣','🍤','🦐','🦞',
      '🥩','🍗','🍖','🥚','🍳','🥞','🧇','🥓','🧀','🥗',
      '🍱','🍙','🍚','🍘','🍡','🫙','🥟','🦆','🥦','🥕',
    ],
  },
  {
    label: 'Boissons',
    labelKey: 'emoji.cat_boissons',
    icon:  '🥤',
    emojis: [
      '☕','🍵','🧃','🥤','🧋','🫖','🍹','🍸','🍷','🥂',
      '🍺','🍻','🥛','🧊','🍶','🫗','🧉','🍾','🍱','🫙',
    ],
  },
  {
    label: 'Desserts',
    labelKey: 'emoji.cat_desserts',
    icon:  '🍰',
    emojis: [
      '🍰','🎂','🧁','🍩','🍪','🍫','🍬','🍭','🍮','🍦',
      '🍧','🍨','🍡','🍢','🍣','🍓','🍒','🍑','🫐','🍇',
      '🍉','🍊','🍋','🍌','🍍','🥝','🍎','🍏','🍐','🥭',
    ],
  },
  {
    label: 'Hôtel',
    labelKey: 'emoji.cat_hotel',
    icon:  '🛎️',
    emojis: [
      '🛎️','🛏️','🔑','🗝️','🛁','🚿','🧴','🧼','🪒','🧺',
      '🧹','🧽','💆','💈','🏊','🎯','🌺','🌸','🪴','🕯️',
      '🛋️','🪑','🛗','🧳','🗺️','🏨','🏩','🌅','🌄','🌃',
    ],
  },
  {
    label: 'Services',
    labelKey: 'emoji.cat_services',
    icon:  '✨',
    emojis: [
      '✨','💆','🧘','💪','🏋️','🚗','✈️','🚕','🛻','🚌',
      '🎵','🎶','📸','🎮','🎯','🎱','🎳','🎭','🎪','🎨',
      '💼','📋','📞','💻','📱','⌚','📷','🔧','🔨','⚙️',
    ],
  },
  {
    label: 'Shopping',
    labelKey: 'emoji.cat_shopping',
    icon:  '🛍️',
    emojis: [
      '📦','🛍️','👜','👗','👒','💄','💍','💎','⌚','👟',
      '🧥','👔','🧴','🧸','🪆','🎁','🎀','🔮','🪬','🧿',
    ],
  },
  {
    label: 'Nature',
    labelKey: 'emoji.cat_nature',
    icon:  '🌿',
    emojis: [
      '🌿','🌸','🌺','🌻','🌹','🍀','🍃','🌱','🎋','🎍',
      '🌴','🌵','🌾','🍂','🍁','🍄','🌊','🏔️','⛰️','🌋',
      '⭐','🌟','💫','🔥','❄️','🌈','☀️','🌙','⚡','🌊',
    ],
  },
];

const NUM_COLS = 6;

// ─── Props ────────────────────────────────────────────────────────────────────

interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
  placeholder?: string;
  /** Filtrer les catégories affichées par label */
  categories?: string[];
  buttonSize?: number;
}

// ─── Composant ────────────────────────────────────────────────────────────────

export function EmojiPicker({
  value,
  onChange,
  placeholder = '😊',
  categories,
  buttonSize = 52,
}: EmojiPickerProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  const cats = categories
    ? EMOJI_CATS.filter(c => categories.includes(c.label))
    : EMOJI_CATS;

  const safeTab = Math.min(activeTab, cats.length - 1);
  const currentEmojis = cats[safeTab]?.emojis ?? [];

  return (
    <>
      {/* Bouton déclencheur */}
      <TouchableOpacity
        style={[styles.trigger, { width: buttonSize, height: buttonSize, borderRadius: buttonSize / 5 }]}
        onPress={() => setVisible(true)}
        activeOpacity={0.75}
      >
        {value ? (
          <Text style={styles.triggerEmoji}>{value}</Text>
        ) : (
          <>
            <Text style={styles.triggerPlaceholder}>{placeholder}</Text>
            <View style={styles.editBadge}>
              <FontAwesome5 name="pen" size={7} color="#fff" />
            </View>
          </>
        )}
        {value && (
          <View style={styles.editBadge}>
            <FontAwesome5 name="pen" size={7} color="#fff" />
          </View>
        )}
      </TouchableOpacity>

      {/* Modal picker */}
      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setVisible(false)}>
          <TouchableOpacity activeOpacity={1} onPress={e => e.stopPropagation()}>
            <View style={styles.sheet}>
              {/* Header */}
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>{t('emoji.pickTitle')}</Text>
                <View style={styles.sheetHeaderRight}>
                  {value ? (
                    <TouchableOpacity
                      style={styles.clearBtn}
                      onPress={() => { onChange(''); setVisible(false); }}
                    >
                      <FontAwesome5 name="times" size={11} color={COLORS.danger} />
                      <Text style={styles.clearText}>{t('emoji.clear')}</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity onPress={() => setVisible(false)}>
                    <FontAwesome5 name="times-circle" size={20} color={COLORS.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Onglets catégories */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tabsRow}
              >
                {cats.map((cat, i) => (
                  <TouchableOpacity
                    key={cat.label}
                    style={[styles.catTab, safeTab === i && styles.catTabActive]}
                    onPress={() => setActiveTab(i)}
                  >
                    <Text style={styles.catTabEmoji}>{cat.icon}</Text>
                    <Text style={[styles.catTabLabel, safeTab === i && styles.catTabLabelActive]}>
                      {t(cat.labelKey)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Grille emojis */}
              <FlatList
                data={currentEmojis}
                keyExtractor={(e, i) => `${e}-${i}`}
                numColumns={NUM_COLS}
                scrollEnabled
                style={styles.grid}
                contentContainerStyle={styles.gridContent}
                renderItem={({ item: emoji }) => (
                  <TouchableOpacity
                    style={[styles.emojiCell, value === emoji && styles.emojiCellActive]}
                    onPress={() => { onChange(emoji); setVisible(false); }}
                  >
                    <Text style={styles.emojiText}>{emoji}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  trigger:        { borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' },
  triggerEmoji:   { fontSize: 26 },
  triggerPlaceholder: { fontSize: 22, opacity: 0.35 },
  editBadge:      { position: 'absolute', bottom: 3, right: 3, width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },

  overlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet:          { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 16, maxHeight: '70%' },
  sheetHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, marginBottom: 10 },
  sheetTitle:     { fontSize: 16, fontWeight: '700', color: COLORS.dark },
  sheetHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clearBtn:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: '#FEE2E2' },
  clearText:      { fontSize: 11, fontWeight: '700', color: COLORS.danger },

  tabsRow:        { paddingHorizontal: 12, gap: 6, paddingBottom: 8 },
  catTab:         { alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: COLORS.background, borderWidth: 1.5, borderColor: COLORS.border, gap: 2 },
  catTabActive:   { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  catTabEmoji:    { fontSize: 16 },
  catTabLabel:    { fontSize: 10, fontWeight: '700', color: COLORS.textMuted },
  catTabLabelActive: { color: '#fff' },

  grid:           { marginTop: 4 },
  gridContent:    { paddingHorizontal: 10, paddingBottom: 24 },
  emojiCell:      { flex: 1, aspectRatio: 1, justifyContent: 'center', alignItems: 'center', margin: 3, borderRadius: 10, backgroundColor: COLORS.background },
  emojiCellActive: { backgroundColor: '#EEF2FF', borderWidth: 2, borderColor: COLORS.primary },
  emojiText:      { fontSize: 24 },
});
