import { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { COLORS } from '@/constants';
import { useTranslation } from 'react-i18next';

interface Props {
  visible:   boolean;
  value:     string;      // YYYY-MM-DD ou ''
  minDate?:  string;      // YYYY-MM-DD
  title?:    string;
  onConfirm: (date: string) => void;
  onCancel:  () => void;
}

export default function DatePicker({ visible, value, minDate, title, onConfirm, onCancel }: Props) {
  const { t } = useTranslation();
  const MONTHS = t('calendar.months', { returnObjects: true }) as string[];
  const DAYS   = t('calendar.weekDaysMin', { returnObjects: true }) as string[];
  const today = new Date();
  const todayStr = fmt(today.getFullYear(), today.getMonth() + 1, today.getDate());

  const [year,     setYear]     = useState(today.getFullYear());
  const [month,    setMonth]    = useState(today.getMonth());
  const [selected, setSelected] = useState(value || '');

  useEffect(() => {
    if (visible) {
      const base = value ? new Date(value + 'T00:00:00') : today;
      setYear(base.getFullYear());
      setMonth(base.getMonth());
      setSelected(value || '');
    }
  }, [visible]);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const daysInMonth   = new Date(year, month + 1, 0).getDate();
  const firstWeekDay  = (new Date(year, month, 1).getDay() + 6) % 7; // Lun=0

  const cells: (number | null)[] = [
    ...Array(firstWeekDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const dateStr = (d: number) => fmt(year, month + 1, d);
  const disabled = (d: number) => !!minDate && dateStr(d) < minDate;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={s.overlay}>
        <View style={s.card}>
          {title ? <Text style={s.title}>{title}</Text> : null}

          {/* Navigation mois */}
          <View style={s.nav}>
            <TouchableOpacity onPress={prevMonth} style={s.navBtn}>
              <FontAwesome5 name="chevron-left" size={13} color={COLORS.dark} />
            </TouchableOpacity>
            <Text style={s.monthLabel}>{MONTHS[month]} {year}</Text>
            <TouchableOpacity onPress={nextMonth} style={s.navBtn}>
              <FontAwesome5 name="chevron-right" size={13} color={COLORS.dark} />
            </TouchableOpacity>
          </View>

          {/* En-têtes jours */}
          <View style={s.row}>
            {DAYS.map((d, i) => (
              <Text key={i} style={s.dayHeader}>{d}</Text>
            ))}
          </View>

          {/* Grille */}
          <View style={s.grid}>
            {cells.map((d, i) => {
              if (d === null) return <View key={`e${i}`} style={s.cell} />;
              const ds      = dateStr(d);
              const isSel   = ds === selected;
              const isToday = ds === todayStr;
              const dis     = disabled(d);
              return (
                <TouchableOpacity
                  key={d}
                  style={[s.cell, isSel && s.cellSel, isToday && !isSel && s.cellToday]}
                  onPress={() => !dis && setSelected(ds)}
                  activeOpacity={dis ? 1 : 0.7}
                >
                  <Text style={[s.cellText, isSel && s.cellTextSel, dis && s.cellTextDis]}>
                    {d}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Sélection affichée */}
          {selected ? (
            <Text style={s.selectedLabel}>{t('calendar.selected', { date: formatDisplay(selected, t) })}</Text>
          ) : null}

          {/* Actions */}
          <View style={s.actions}>
            <TouchableOpacity style={s.cancelBtn} onPress={onCancel}>
              <Text style={s.cancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.confirmBtn, !selected && s.confirmBtnDisabled]}
              onPress={() => selected && onConfirm(selected)}
              disabled={!selected}
            >
              <Text style={s.confirmText}>{t('common.confirm')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function fmt(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function formatDisplay(iso: string, t: (key: string, opts?: any) => any) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  const months = t('calendar.monthsShort', { returnObjects: true }) as string[];
  return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`;
}

const CELL = '14.28%' as const;

const s = StyleSheet.create({
  overlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card:           { backgroundColor: '#fff', borderRadius: 20, padding: 20, width: '100%', maxWidth: 360 },
  title:          { fontSize: 15, fontWeight: '700', color: COLORS.dark, textAlign: 'center', marginBottom: 14 },
  nav:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  navBtn:         { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' },
  monthLabel:     { fontSize: 15, fontWeight: '700', color: COLORS.dark },
  row:            { flexDirection: 'row', marginBottom: 6 },
  dayHeader:      { width: CELL, textAlign: 'center', fontSize: 11, fontWeight: '600', color: COLORS.textMuted },
  grid:           { flexDirection: 'row', flexWrap: 'wrap' },
  cell:           { width: CELL, aspectRatio: 1, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  cellSel:        { backgroundColor: COLORS.primary, borderRadius: 999 },
  cellToday:      { borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: 999 },
  cellText:       { fontSize: 13, color: COLORS.dark },
  cellTextSel:    { color: '#fff', fontWeight: '700' },
  cellTextDis:    { color: COLORS.grayLight },
  selectedLabel:  { textAlign: 'center', fontSize: 13, color: COLORS.textMuted, marginTop: 10, marginBottom: 4 },
  actions:        { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn:      { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  cancelText:     { fontSize: 14, fontWeight: '600', color: COLORS.textMuted },
  confirmBtn:     { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: COLORS.primary, alignItems: 'center' },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmText:    { fontSize: 14, fontWeight: '700', color: '#fff' },
});
