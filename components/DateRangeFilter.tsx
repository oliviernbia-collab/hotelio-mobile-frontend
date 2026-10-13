import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS } from '@/constants';
import DatePicker from '@/components/DatePicker';

interface Props {
  from: string;
  to:   string;
  onChange: (from: string, to: string) => void;
}

function fmtDisplay(iso: string) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export default function DateRangeFilter({ from, to, onChange }: Props) {
  const { t } = useTranslation();
  const [picking, setPicking] = useState<'from' | 'to' | null>(null);

  const hasFilter = !!from || !!to;

  return (
    <View style={s.row}>
      <TouchableOpacity style={s.pill} onPress={() => setPicking('from')}>
        <FontAwesome5 name="calendar-alt" size={11} color={COLORS.primary} />
        <Text style={s.pillText}>
          {t('dateFilter.from')}: {from ? fmtDisplay(from) : '—'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.pill} onPress={() => setPicking('to')}>
        <FontAwesome5 name="calendar-alt" size={11} color={COLORS.primary} />
        <Text style={s.pillText}>
          {t('dateFilter.to')}: {to ? fmtDisplay(to) : '—'}
        </Text>
      </TouchableOpacity>

      {hasFilter && (
        <TouchableOpacity style={s.clearBtn} onPress={() => onChange('', '')}>
          <FontAwesome5 name="times" size={12} color={COLORS.danger} />
        </TouchableOpacity>
      )}

      <DatePicker
        visible={picking === 'from'}
        value={from}
        title={t('dateFilter.from')}
        onConfirm={d => { onChange(d, to && d > to ? '' : to); setPicking(null); }}
        onCancel={() => setPicking(null)}
      />
      <DatePicker
        visible={picking === 'to'}
        value={to}
        minDate={from || undefined}
        title={t('dateFilter.to')}
        onConfirm={d => { onChange(from, d); setPicking(null); }}
        onCancel={() => setPicking(null)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingBottom: 8, flexWrap: 'wrap' },
  pill:      { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border },
  pillText:  { fontSize: 11, fontWeight: '600', color: COLORS.dark },
  clearBtn:  { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center' },
});
