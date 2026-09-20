import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, Alert,
  RefreshControl, Modal, ScrollView, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator, Switch,
} from 'react-native';
import { staffApi, hotelApi } from '@/services/api';
import { Staff, Hotel } from '@/types';
import { COLORS } from '@/constants';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { useTranslation } from 'react-i18next';

const ROLE_OPTIONS = [
  'Réceptionniste', 'Femme de chambre', 'Valet de chambre',
  'Room service', 'Cuisinier', 'Serveur', 'Barman',
  'Agent de sécurité', 'Maintenance', 'Responsable', 'Manager',
];

const ROLE_KEYS: Record<string, string> = {
  'Réceptionniste':    'staff.role_receptionniste',
  'Femme de chambre':  'staff.role_femme_chambre',
  'Valet de chambre':  'staff.role_valet_chambre',
  'Room service':      'staff.role_room_service',
  'Cuisinier':         'staff.role_cuisinier',
  'Serveur':           'staff.role_serveur',
  'Barman':            'staff.role_barman',
  'Agent de sécurité': 'staff.role_agent_securite',
  'Maintenance':       'staff.role_maintenance',
  'Responsable':       'staff.role_responsable',
  'Manager':           'staff.role_manager',
};

const TASK_OPTIONS = [
  'Check-in / Check-out clients',
  'Nettoyage des chambres',
  'Room service',
  'Accueil & réception',
  'Sécurité / surveillance',
  'Restauration',
  'Maintenance technique',
  'Gestion administrative',
  'Service petit-déjeuner',
  'Blanchisserie & linge',
];

const TASK_KEYS: Record<string, string> = {
  'Check-in / Check-out clients': 'staff.task_checkin_checkout',
  'Nettoyage des chambres':       'staff.task_nettoyage',
  'Room service':                 'staff.task_room_service',
  'Accueil & réception':          'staff.task_accueil',
  'Sécurité / surveillance':      'staff.task_securite',
  'Restauration':                 'staff.task_restauration',
  'Maintenance technique':        'staff.task_maintenance_technique',
  'Gestion administrative':       'staff.task_gestion_admin',
  'Service petit-déjeuner':       'staff.task_petit_dej',
  'Blanchisserie & linge':        'staff.task_blanchisserie',
};

const EMPTY_FORM = {
  hotel_id:       '' as string | number,
  first_name:     '',
  last_name:      '',
  role:           'Réceptionniste',
  phone:          '',
  email:          '',
  salary:         '',
  tasks:          [] as string[],
  status:         'actif',
  createAccount:  false,
  password:       '',
  confirmPassword:'',
};

interface StaffRow extends Staff {
  tasks?: string[];
  hotel_name?: string;
  hotel_short_name?: string;
}

export default function StaffScreen() {
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const isManager = user?.role === 'admin' || user?.role === 'prestataire';

  const [staff,      setStaff]      = useState<StaffRow[]>([]);
  const [hotels,     setHotels]     = useState<Hotel[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal,  setShowModal]  = useState(false);
  const [editing,    setEditing]    = useState<StaffRow | null>(null);
  const [saving,     setSaving]     = useState(false);
  const [form,              setForm]             = useState({ ...EMPTY_FORM });
  const [showRoles,         setShowRoles]        = useState(false);
  const [showPwd,           setShowPwd]          = useState(false);
  const [showConfirmPwd,    setShowConfirmPwd]   = useState(false);

  const loadData = async () => {
    try {
      const staffRes = await staffApi.list();
      setStaff(staffRes.data);
      if (isManager) {
        const hotelsRes = user?.role === 'prestataire'
          ? await hotelApi.mine()
          : await hotelApi.list();
        const list = Array.isArray(hotelsRes.data)
          ? hotelsRes.data
          : (hotelsRes.data?.data ?? []);
        setHotels(list);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, hotel_id: hotels[0]?.id ?? '' });
    setEditing(null);
    setShowPwd(false);
    setShowConfirmPwd(false);
    setShowModal(true);
  };

  const openEdit = (s: StaffRow) => {
    setForm({
      hotel_id:   s.hotel_id,
      first_name: s.first_name,
      last_name:  s.last_name,
      role:       s.role,
      phone:      s.phone ?? '',
      email:      s.email ?? '',
      salary:     s.salary ? String(s.salary) : '',
      tasks:      s.tasks ?? [],
      status:     s.status ?? 'actif',
      createAccount:  false,
      password:       '',
      confirmPassword:'',
    });
    setEditing(s);
    setShowModal(true);
  };

  const toggleTask = (t: string) => {
    setForm(f => ({
      ...f,
      tasks: f.tasks.includes(t)
        ? f.tasks.filter(x => x !== t)
        : [...f.tasks, t],
    }));
  };

  const handleSave = async () => {
    if (!form.hotel_id) { Alert.alert(t('common.required'), t('rooms.selectHotelMsg')); return; }
    if (!form.first_name.trim() || !form.last_name.trim()) {
      Alert.alert(t('common.required'), t('staff.firstLastNameRequired'));
      return;
    }
    if (form.createAccount) {
      if (!form.email.trim()) { Alert.alert(t('common.required'), t('staff.emailRequiredForAccess')); return; }
      if (!form.password) { Alert.alert(t('common.required'), t('staff.passwordRequiredMsg')); return; }
      if (form.password.length < 6) { Alert.alert(t('common.error'), t('staff.passwordMinMsg')); return; }
      if (form.password !== form.confirmPassword) { Alert.alert(t('common.error'), t('auth.passwordMismatch')); return; }
    }
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        hotel_id:   Number(form.hotel_id),
        first_name: form.first_name.trim(),
        last_name:  form.last_name.trim(),
        role:       form.role,
        phone:      form.phone.trim() || undefined,
        email:      form.email.trim() || undefined,
        salary:     form.salary ? Number(form.salary) : 0,
        tasks:      form.tasks,
        status:     form.status,
      };
      if (form.createAccount && form.password) {
        payload.password = form.password;
      }
      if (editing) {
        await staffApi.update(editing.id, payload);
      } else {
        await staffApi.create(payload);
      }
      setShowModal(false);
      loadData();
    } catch (e: any) {
      Alert.alert(t('common.error'), e.response?.data?.message ?? t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (s: StaffRow) => {
    Alert.alert(
      t('common.delete'),
      t('staff.deleteMsg', { name: `${s.first_name} ${s.last_name}` }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'), style: 'destructive',
          onPress: async () => {
            try {
              await staffApi.delete(s.id);
              loadData();
            } catch (e: any) {
              Alert.alert(t('common.error'), e.response?.data?.message ?? t('common.error'));
            }
          },
        },
      ]
    );
  };

  const getInitials = (s: Staff) =>
    `${s.first_name?.[0] ?? ''}${s.last_name?.[0] ?? ''}`.toUpperCase();

  const renderItem = ({ item }: { item: StaffRow }) => (
    <View style={styles.card}>
      <View style={styles.avatarWrap}>
        <Text style={styles.avatarText}>{getInitials(item)}</Text>
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{item.first_name} {item.last_name}</Text>
        <Text style={styles.roleText}>{t(ROLE_KEYS[item.role] ?? item.role)}</Text>
        {item.hotel_name && (
          <Text style={styles.hotelTag}>🏨 {item.hotel_short_name ?? item.hotel_name}</Text>
        )}
        {item.phone  ? <Text style={styles.meta}>📞 {item.phone}</Text> : null}
        {item.salary ? <Text style={styles.meta}>💰 {Number(item.salary).toLocaleString()} {t('staff.salaryPerMonth')}</Text> : null}
        {item.tasks && item.tasks.length > 0 && (
          <View style={styles.tasksWrap}>
            {item.tasks.slice(0, 3).map(tk => (
              <View key={tk} style={styles.taskChip}>
                <Text style={styles.taskChipText}>{t(TASK_KEYS[tk] ?? tk)}</Text>
              </View>
            ))}
            {item.tasks.length > 3 && (
              <View style={[styles.taskChip, { backgroundColor: COLORS.primary + '22' }]}>
                <Text style={[styles.taskChipText, { color: COLORS.primary }]}>
                  +{item.tasks.length - 3}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      <View style={{ gap: 10, alignItems: 'center' }}>
        <View style={[styles.statusDot, { backgroundColor: item.status === 'actif' ? COLORS.success : COLORS.gray }]} />
        {isManager && (
          <>
            <TouchableOpacity onPress={() => openEdit(item)}>
              <FontAwesome5 name="pen" size={16} color={COLORS.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDelete(item)}>
              <FontAwesome5 name="trash-alt" size={16} color={COLORS.danger} />
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={staff}
        keyExtractor={(s) => String(s.id)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadData(); }}
            colors={[COLORS.primary]}
          />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <FontAwesome5 name="users" size={48} color={COLORS.grayLight} />
              <Text style={styles.emptyText}>{t('staff.noStaff')}</Text>
            </View>
          ) : null
        }
      />

      {isManager && (
        <TouchableOpacity style={styles.fab} onPress={openCreate}>
          <FontAwesome5 name="user-plus" size={22} color={COLORS.white} />
        </TouchableOpacity>
      )}

      {/* ── Modal créer / modifier ── */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                {editing ? t('staff.editEmployee') : t('staff.newEmployee')}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <FontAwesome5 name="times" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Hôtel */}
              <Text style={styles.label}>{t('profile.hotelLabel')} *</Text>
              {hotels.length === 0 ? (
                <Text style={{ color: COLORS.textMuted, fontSize: 13, marginBottom: 12 }}>
                  {t('services.noHotelAvailable')}
                </Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                  <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 8 }}>
                    {hotels.map(h => (
                      <TouchableOpacity
                        key={h.id}
                        style={[
                          styles.optionChip,
                          String(form.hotel_id) === String(h.id) && styles.optionChipActive,
                        ]}
                        onPress={() => setForm(f => ({ ...f, hotel_id: h.id }))}
                      >
                        <Text style={[
                          styles.optionChipText,
                          String(form.hotel_id) === String(h.id) && styles.optionChipTextActive,
                        ]}>
                          {h.short_name || h.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              )}

              {/* Prénom / Nom */}
              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>{t('staff.firstNameLabel')}</Text>
                  <TextInput
                    style={styles.input}
                    value={form.first_name}
                    onChangeText={v => setForm(f => ({ ...f, first_name: v }))}
                    placeholder={t('staff.firstNamePlaceholder')}
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>{t('staff.lastNameLabel')}</Text>
                  <TextInput
                    style={styles.input}
                    value={form.last_name}
                    onChangeText={v => setForm(f => ({ ...f, last_name: v }))}
                    placeholder={t('staff.lastNamePlaceholder')}
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>
              </View>

              {/* Rôle */}
              <Text style={styles.label}>{t('profile.postLabel')}</Text>
              <TouchableOpacity
                style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between' }]}
                onPress={() => setShowRoles(true)}
              >
                <Text style={{ color: COLORS.dark, fontSize: 14 }}>{t(ROLE_KEYS[form.role] ?? form.role)}</Text>
                <FontAwesome5 name="chevron-down" size={12} color={COLORS.textMuted} />
              </TouchableOpacity>

              <Text style={styles.label}>{t('profile.phone')}</Text>
              <TextInput
                style={styles.input}
                value={form.phone}
                onChangeText={v => setForm(f => ({ ...f, phone: v }))}
                placeholder="+225 00 00 00 00"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="phone-pad"
              />

              {!form.createAccount && (
                <>
                  <Text style={styles.label}>{t('auth.email')}</Text>
                  <TextInput
                    style={styles.input}
                    value={form.email}
                    onChangeText={v => setForm(f => ({ ...f, email: v }))}
                    placeholder={t('auth.emailPlaceholder')}
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </>
              )}

              <Text style={styles.label}>{t('staff.monthlySalaryLabel')}</Text>
              <TextInput
                style={styles.input}
                value={form.salary}
                onChangeText={v => setForm(f => ({ ...f, salary: v.replace(/[^0-9]/g, '') }))}
                placeholder={t('staff.salaryPlaceholder')}
                placeholderTextColor={COLORS.textMuted}
                keyboardType="number-pad"
              />

              {editing && (
                <>
                  <Text style={styles.label}>{t('reservations.status')}</Text>
                  <View style={styles.row2}>
                    {['actif', 'inactif'].map(s => (
                      <TouchableOpacity
                        key={s}
                        style={[styles.statusBtn, form.status === s && styles.statusBtnActive]}
                        onPress={() => setForm(f => ({ ...f, status: s }))}
                      >
                        <Text style={[styles.statusBtnText, form.status === s && styles.statusBtnTextActive]}>
                          {s === 'actif' ? t('staff.active') : t('staff.inactive')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {/* Tâches */}
              <Text style={[styles.label, { marginTop: 16 }]}>{t('profile.assignedTasks')}</Text>
              <View style={styles.tasksGrid}>
                {TASK_OPTIONS.map(task => {
                  const selected = form.tasks.includes(task);
                  return (
                    <TouchableOpacity
                      key={task}
                      style={[styles.taskOption, selected && styles.taskOptionActive]}
                      onPress={() => toggleTask(task)}
                    >
                      <View style={[styles.checkbox, selected && styles.checkboxChecked]}>
                        {selected && <FontAwesome5 name="check" size={9} color={COLORS.white} />}
                      </View>
                      <Text
                        style={[styles.taskOptionText, selected && styles.taskOptionTextActive]}
                        numberOfLines={2}
                      >
                        {t(TASK_KEYS[task] ?? task)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Accès application (création uniquement) */}
              {!editing && (
                <View style={styles.accessSection}>
                  <View style={styles.accessHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.accessTitle}>
                        <FontAwesome5 name="mobile-alt" size={14} color={COLORS.primary} />{'  '}{t('staff.appAccess')}
                      </Text>
                      <Text style={styles.accessSubtitle}>
                        {t('staff.appAccessDesc')}
                      </Text>
                    </View>
                    <Switch
                      value={form.createAccount}
                      onValueChange={v => {
                        setForm(f => ({ ...f, createAccount: v, password: '', confirmPassword: '' }));
                        if (!v) { setShowPwd(false); setShowConfirmPwd(false); }
                      }}
                      trackColor={{ false: COLORS.border, true: COLORS.primary + '60' }}
                      thumbColor={form.createAccount ? COLORS.primary : COLORS.gray}
                    />
                  </View>
                  {form.createAccount && (
                    <View style={styles.accessFields}>
                      <Text style={styles.label}>{t('auth.email')} *</Text>
                      <TextInput
                        style={styles.input}
                        value={form.email}
                        onChangeText={v => setForm(f => ({ ...f, email: v }))}
                        placeholder={t('staff.employeeEmailPlaceholder')}
                        placeholderTextColor={COLORS.textMuted}
                        keyboardType="email-address"
                        autoCapitalize="none"
                      />
                      <Text style={styles.label}>{t('auth.password')} *</Text>
                      <View style={styles.pwdWrap}>
                        <TextInput
                          style={styles.pwdInput}
                          value={form.password}
                          onChangeText={v => setForm(f => ({ ...f, password: v }))}
                          placeholder={t('auth.passwordMin')}
                          placeholderTextColor={COLORS.textMuted}
                          secureTextEntry={!showPwd}
                        />
                        <TouchableOpacity
                          onPress={() => setShowPwd(v => !v)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <FontAwesome5
                            name={showPwd ? 'eye-slash' : 'eye'}
                            size={16}
                            color={COLORS.textMuted}
                          />
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.label}>{t('auth.confirmPassword')} *</Text>
                      <View style={styles.pwdWrap}>
                        <TextInput
                          style={styles.pwdInput}
                          value={form.confirmPassword}
                          onChangeText={v => setForm(f => ({ ...f, confirmPassword: v }))}
                          placeholder={t('auth.confirmPassword')}
                          placeholderTextColor={COLORS.textMuted}
                          secureTextEntry={!showConfirmPwd}
                        />
                        <TouchableOpacity
                          onPress={() => setShowConfirmPwd(v => !v)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <FontAwesome5
                            name={showConfirmPwd ? 'eye-slash' : 'eye'}
                            size={16}
                            color={COLORS.textMuted}
                          />
                        </TouchableOpacity>
                      </View>
                      <View style={styles.accessNote}>
                        <FontAwesome5 name="info-circle" size={12} color={COLORS.info} />
                        <Text style={styles.accessNoteText}>
                          {t('staff.accessNote')}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              )}

              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color={COLORS.white} />
                  : <Text style={styles.saveBtnText}>
                      {editing ? t('common.save') : t('staff.createEmployee')}
                    </Text>
                }
              </TouchableOpacity>
              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal rôle */}
      <Modal visible={showRoles} transparent animationType="fade" onRequestClose={() => setShowRoles(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowRoles(false)}>
          <View style={styles.roleSheet}>
            <Text style={[styles.sheetTitle, { marginBottom: 8 }]}>{t('staff.choosePost')}</Text>
            {ROLE_OPTIONS.map(r => (
              <TouchableOpacity
                key={r}
                style={[styles.roleItem, form.role === r && styles.roleItemActive]}
                onPress={() => { setForm(f => ({ ...f, role: r })); setShowRoles(false); }}
              >
                <Text style={[styles.roleItemText, form.role === r && styles.roleItemTextActive]}>{t(ROLE_KEYS[r] ?? r)}</Text>
                {form.role === r && <FontAwesome5 name="check" size={14} color={COLORS.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:            { flex: 1, backgroundColor: COLORS.background },
  card:                 { backgroundColor: COLORS.white, borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 5, elevation: 2 },
  avatarWrap:           { width: 50, height: 50, borderRadius: 25, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  avatarText:           { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  name:                 { fontSize: 15, fontWeight: '700', color: COLORS.dark },
  roleText:             { fontSize: 13, color: COLORS.primary, marginTop: 2, fontWeight: '600' },
  hotelTag:             { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  meta:                 { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  tasksWrap:            { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  taskChip:             { backgroundColor: '#EEF2FF', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  taskChipText:         { fontSize: 10, color: COLORS.primary, fontWeight: '600' },
  statusDot:            { width: 10, height: 10, borderRadius: 5 },
  empty:                { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText:            { fontSize: 16, color: COLORS.textMuted },
  fab:                  { position: 'absolute', bottom: 20, right: 20, backgroundColor: COLORS.primary, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 8 },
  overlay:              { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:                { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '92%' },
  sheetHeader:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetTitle:           { fontSize: 18, fontWeight: '700', color: COLORS.dark },
  label:                { fontSize: 13, fontWeight: '600', color: COLORS.dark, marginBottom: 6, marginTop: 12 },
  input:                { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: COLORS.background, fontSize: 14, color: COLORS.dark },
  pwdWrap:              { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: COLORS.background },
  pwdInput:             { flex: 1, fontSize: 14, color: COLORS.dark },
  row2:                 { flexDirection: 'row', gap: 10 },
  optionChip:           { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.white },
  optionChipActive:     { borderColor: COLORS.primary, backgroundColor: '#EEF2FF' },
  optionChipText:       { fontSize: 13, color: COLORS.textMuted },
  optionChipTextActive: { color: COLORS.primary, fontWeight: '700' },
  statusBtn:            { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center', backgroundColor: COLORS.white },
  statusBtnActive:      { borderColor: COLORS.primary, backgroundColor: '#EEF2FF' },
  statusBtnText:        { fontSize: 13, color: COLORS.textMuted },
  statusBtnTextActive:  { color: COLORS.primary, fontWeight: '700' },
  tasksGrid:            { gap: 8 },
  taskOption:           { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10, padding: 12, backgroundColor: COLORS.white },
  taskOptionActive:     { borderColor: COLORS.primary, backgroundColor: '#EEF2FF' },
  taskOptionText:       { flex: 1, fontSize: 13, color: COLORS.textMuted },
  taskOptionTextActive: { color: COLORS.primary, fontWeight: '600' },
  checkbox:             { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: COLORS.border, justifyContent: 'center', alignItems: 'center' },
  checkboxChecked:      { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  saveBtn:              { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 15, marginTop: 20 },
  saveBtnText:          { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  roleSheet:            { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, position: 'absolute', bottom: 0, left: 0, right: 0 },
  roleItem:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  roleItemActive:       { backgroundColor: '#EEF2FF', marginHorizontal: -20, paddingHorizontal: 20 },
  roleItemText:         { fontSize: 15, color: COLORS.dark },
  roleItemTextActive:   { color: COLORS.primary, fontWeight: '700' },
  accessSection:        { marginTop: 20, borderWidth: 1.5, borderColor: COLORS.primary + '40', borderRadius: 14, overflow: 'hidden' },
  accessHeader:         { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#EEF2FF', padding: 14 },
  accessTitle:          { fontSize: 14, fontWeight: '700', color: COLORS.dark },
  accessSubtitle:       { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  accessFields:         { padding: 14, gap: 4 },
  accessNote:           { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: COLORS.info + '15', borderRadius: 8, padding: 10, marginTop: 12 },
  accessNoteText:       { flex: 1, fontSize: 12, color: COLORS.info, lineHeight: 16 },
});
