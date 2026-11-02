import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal, TextInput,
  ActivityIndicator, Alert, RefreshControl, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { FontAwesome5 } from '@expo/vector-icons';
import { staffApi } from '@/services/api';
import { Staff } from '@/types';
import { COLORS } from '@/constants';

/* Planning hebdomadaire du personnel — équivalent mobile de staff/schedule côté web :
   un employé par ligne, les 7 jours de la semaine, un créneau par jour (modifiable). */

type Shift = 'matin' | 'apres_midi' | 'nuit' | 'repos';
type Schedule = {
  id: number; staff_id: number; hotel_id: number; date: string; shift: Shift;
  start_time: string | null; end_time: string | null; poste: string | null;
};

// Mêmes créneaux et couleurs que la page web ; horaires proposés par défaut à la saisie
const SHIFTS: Record<Shift, { icon: string; color: string; bg: string; start: string; end: string }> = {
  matin:      { icon: '🌅', color: '#3b82f6', bg: 'rgba(59,130,246,.15)',  start: '07:00', end: '15:00' },
  apres_midi: { icon: '☀️', color: '#f59e0b', bg: 'rgba(245,158,11,.15)',  start: '15:00', end: '23:00' },
  nuit:       { icon: '🌙', color: '#8b5cf6', bg: 'rgba(139,92,246,.15)',  start: '23:00', end: '07:00' },
  repos:      { icon: '💤', color: '#6b7280', bg: 'rgba(107,114,128,.15)', start: '',      end: ''      },
};

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function mondayOf(d: Date) {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
}
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const hm = (t: string | null) => (t ? t.slice(0, 5) : '');

export default function StaffScheduleScreen() {
  const { t } = useTranslation();
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [staff,     setStaff]     = useState<Staff[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [hotelId,   setHotelId]   = useState<number | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [edit,      setEdit]      = useState<{ member: Staff; date: string } | null>(null);
  const [form,      setForm]      = useState({ shift: 'matin' as Shift, start: '', end: '', poste: '' });
  const [saving,    setSaving]    = useState(false);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const from = iso(days[0]);
  const to   = iso(days[6]);

  const load = useCallback(async () => {
    try {
      const [st, sc] = await Promise.all([
        staffApi.list(),
        staffApi.schedules({ from, to }),
      ]);
      const list: Staff[] = st.data.data ?? st.data;
      setStaff(list);
      setSchedules(sc.data ?? []);
      setHotelId((cur) => cur ?? (list[0]?.hotel_id ?? null));
    } catch (e: any) {
      Alert.alert(t('common.error'), e.response?.data?.message ?? t('common.error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [from, to, t]);

  useEffect(() => { load(); }, [load]);

  // Hôtels présents dans la liste du personnel (sélecteur, comme le filtre hôtel du web)
  const hotels = useMemo(() => {
    const map = new Map<number, string>();
    staff.forEach((s) => map.set(s.hotel_id, (s as any).hotel_name || `#${s.hotel_id}`));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [staff]);

  const members = staff.filter((s) => !hotelId || s.hotel_id === hotelId);
  const byKey = useMemo(() => {
    const m = new Map<string, Schedule>();
    schedules.forEach((s) => m.set(`${s.staff_id}_${String(s.date).slice(0, 10)}`, s));
    return m;
  }, [schedules]);

  const openEdit = (member: Staff, date: string) => {
    const sc = byKey.get(`${member.id}_${date}`);
    setForm({
      shift: sc?.shift ?? 'matin',
      start: hm(sc?.start_time ?? null) || (sc ? '' : SHIFTS.matin.start),
      end:   hm(sc?.end_time ?? null)   || (sc ? '' : SHIFTS.matin.end),
      poste: sc?.poste ?? '',
    });
    setEdit({ member, date });
  };

  const pickShift = (shift: Shift) => setForm((f) => ({ ...f, shift, start: SHIFTS[shift].start, end: SHIFTS[shift].end }));

  const save = async () => {
    if (!edit) return;
    setSaving(true);
    try {
      await staffApi.addSchedule({
        staff_id: edit.member.id,
        hotel_id: edit.member.hotel_id,
        date: edit.date,
        shift: form.shift,
        start_time: form.shift === 'repos' ? null : form.start.trim() || null,
        end_time:   form.shift === 'repos' ? null : form.end.trim() || null,
        poste: form.poste.trim() || null,
      });
      setEdit(null);
      load();
    } catch (e: any) {
      Alert.alert(t('common.error'), e.response?.data?.message ?? t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const dayLabels = t('staffSchedule.daysShort', { returnObjects: true }) as string[];

  if (loading) {
    return <View style={s.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  return (
    <View style={s.container}>
      {/* Navigation semaine */}
      <View style={s.weekBar}>
        <TouchableOpacity style={s.weekNav} onPress={() => setWeekStart((w) => addDays(w, -7))}>
          <FontAwesome5 name="chevron-left" size={14} color={COLORS.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setWeekStart(mondayOf(new Date()))}>
          <Text style={s.weekTitle}>{days[0].toLocaleDateString('fr-FR')} → {days[6].toLocaleDateString('fr-FR')}</Text>
          <Text style={s.weekSub}>{t('staffSchedule.tapToday')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.weekNav} onPress={() => setWeekStart((w) => addDays(w, 7))}>
          <FontAwesome5 name="chevron-right" size={14} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {hotels.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={s.hotelRow}>
          {hotels.map((h) => (
            <TouchableOpacity key={h.id} style={[s.chip, hotelId === h.id && s.chipActive]} onPress={() => setHotelId(h.id)}>
              <Text style={[s.chipText, hotelId === h.id && s.chipTextActive]}>{h.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <ScrollView
        contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[COLORS.primary]} />}
      >
        {members.length === 0 ? (
          <View style={s.empty}>
            <FontAwesome5 name="users" size={42} color={COLORS.grayLight} />
            <Text style={s.emptyText}>{t('staff.noStaff')}</Text>
          </View>
        ) : members.map((m) => (
          <View key={m.id} style={s.card}>
            <Text style={s.name}>{m.first_name} {m.last_name}</Text>
            {m.role ? <Text style={s.role}>{m.role}</Text> : null}
            <View style={s.daysRow}>
              {days.map((d, i) => {
                const key = iso(d);
                const sc = byKey.get(`${m.id}_${key}`);
                const v = sc ? SHIFTS[sc.shift] : null;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[s.day, v && { backgroundColor: v.bg, borderColor: v.color }]}
                    onPress={() => openEdit(m, key)}
                  >
                    <Text style={s.dayLabel}>{dayLabels[i]} {d.getDate()}</Text>
                    <Text style={s.dayIcon}>{v ? v.icon : '+'}</Text>
                    {sc?.start_time ? <Text style={[s.dayTime, { color: v!.color }]}>{hm(sc.start_time)}</Text> : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Modal d'édition d'un créneau */}
      <Modal visible={!!edit} transparent animationType="slide" onRequestClose={() => setEdit(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalWrap}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>{edit?.member.first_name} {edit?.member.last_name}</Text>
            <Text style={s.modalSub}>{edit ? new Date(`${edit.date}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : ''}</Text>

            <View style={s.shiftRow}>
              {(Object.keys(SHIFTS) as Shift[]).map((k) => (
                <TouchableOpacity
                  key={k}
                  style={[s.shiftChip, form.shift === k && { backgroundColor: SHIFTS[k].bg, borderColor: SHIFTS[k].color }]}
                  onPress={() => pickShift(k)}
                >
                  <Text style={s.shiftIcon}>{SHIFTS[k].icon}</Text>
                  <Text style={[s.shiftText, form.shift === k && { color: SHIFTS[k].color }]}>{t(`staffSchedule.shift_${k}`)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {form.shift !== 'repos' && (
              <View style={s.timeRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>{t('staffSchedule.start')}</Text>
                  <TextInput style={s.input} value={form.start} onChangeText={(v) => setForm((f) => ({ ...f, start: v }))} placeholder="07:00" placeholderTextColor={COLORS.textMuted} maxLength={5} keyboardType="numbers-and-punctuation" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>{t('staffSchedule.end')}</Text>
                  <TextInput style={s.input} value={form.end} onChangeText={(v) => setForm((f) => ({ ...f, end: v }))} placeholder="15:00" placeholderTextColor={COLORS.textMuted} maxLength={5} keyboardType="numbers-and-punctuation" />
                </View>
              </View>
            )}

            <Text style={s.label}>{t('staffSchedule.poste')}</Text>
            <TextInput style={s.input} value={form.poste} onChangeText={(v) => setForm((f) => ({ ...f, poste: v }))} placeholder={t('staffSchedule.postePlaceholder')} placeholderTextColor={COLORS.textMuted} maxLength={100} />

            <View style={s.modalActions}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setEdit(null)}>
                <Text style={s.cancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.saveBtn} onPress={save} disabled={saving}>
                {saving ? <ActivityIndicator color={COLORS.white} /> : <Text style={s.saveText}>{t('common.save')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: COLORS.background },
  centered:   { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  weekBar:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  weekNav:    { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.primary + '12', alignItems: 'center', justifyContent: 'center' },
  weekTitle:  { fontSize: 15, fontWeight: '800', color: COLORS.dark, textAlign: 'center' },
  weekSub:    { fontSize: 11, color: COLORS.textMuted, textAlign: 'center', marginTop: 2 },
  hotelRow:   { gap: 8, paddingHorizontal: 12, paddingTop: 10 },
  chip:       { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText:   { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  chipTextActive: { color: COLORS.white },
  card:       { backgroundColor: COLORS.white, borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
  name:       { fontSize: 15, fontWeight: '800', color: COLORS.dark },
  role:       { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
  daysRow:    { flexDirection: 'row', gap: 4, marginTop: 10 },
  day:        { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.background },
  dayLabel:   { fontSize: 9, fontWeight: '700', color: COLORS.textMuted },
  dayIcon:    { fontSize: 16, marginVertical: 2, color: COLORS.textMuted },
  dayTime:    { fontSize: 9, fontWeight: '700' },
  empty:      { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText:  { fontSize: 14, color: COLORS.textMuted },
  modalWrap:  { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modal:      { backgroundColor: COLORS.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.dark },
  modalSub:   { fontSize: 13, color: COLORS.textMuted, marginBottom: 14, textTransform: 'capitalize' },
  shiftRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  shiftChip:  { width: '48%', flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border },
  shiftIcon:  { fontSize: 18 },
  shiftText:  { fontSize: 13, fontWeight: '700', color: COLORS.dark },
  timeRow:    { flexDirection: 'row', gap: 10 },
  label:      { fontSize: 12, fontWeight: '600', color: COLORS.dark, marginBottom: 5, marginTop: 4 },
  input:      { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: COLORS.dark, marginBottom: 10 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn:  { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  cancelText: { fontSize: 14, fontWeight: '700', color: COLORS.textMuted },
  saveBtn:    { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center', backgroundColor: COLORS.primary },
  saveText:   { fontSize: 14, fontWeight: '700', color: COLORS.white },
});
