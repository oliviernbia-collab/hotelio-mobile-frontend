import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  Alert, Modal, ScrollView, RefreshControl, ActivityIndicator,
} from 'react-native';
import { Stack } from 'expo-router';
import { adminApi } from '@/services/api';
import { COLORS } from '@/constants';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
}

const ROLES   = ['admin', 'prestataire', 'employe', 'client'];
const STATUSES = ['actif', 'inactif', 'en_attente', 'suspendu'];

const ROLE_COLORS: Record<string, string> = {
  admin:       '#6366f1',
  prestataire: '#0ea5e9',
  employe:     '#f59e0b',
  client:      '#10b981',
};
const STATUS_COLORS: Record<string, string> = {
  actif:       '#10b981',
  inactif:     '#6b7280',
  en_attente:  '#f59e0b',
  suspendu:    '#ef4444',
};
const STATUS_LABEL_KEYS: Record<string, string> = {
  actif: 'users.status_actif', inactif: 'users.status_inactif',
  en_attente: 'reservations.status_en_attente', suspendu: 'users.status_suspendu',
};

const EMPTY_FORM = { name: '', email: '', password: '', role: 'employe', status: 'actif' };

export default function AdminUsersScreen() {
  const { t } = useTranslation();
  const [users,      setUsers]      = useState<User[]>([]);
  const [search,     setSearch]     = useState('');
  const [roleFilter, setRoleFilter] = useState('tous');
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modal,      setModal]      = useState<'create' | 'edit' | null>(null);
  const [selected,   setSelected]   = useState<User | null>(null);
  const [form,       setForm]       = useState({ ...EMPTY_FORM });
  const [saving,     setSaving]     = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await adminApi.users.list();
      setUsers(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchUsers(); }, []);

  const filtered = users.filter(u => {
    const matchRole   = roleFilter === 'tous' || u.role === roleFilter;
    const matchSearch = !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    return matchRole && matchSearch;
  });

  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setSelected(null);
    setModal('create');
  };

  const openEdit = (u: User) => {
    setForm({ name: u.name, email: u.email, password: '', role: u.role, status: u.status });
    setSelected(u);
    setModal('edit');
  };

  const handleSave = async () => {
    if (!form.name || !form.email) return Alert.alert(t('common.error'), t('common.required'));
    if (modal === 'create' && !form.password) return Alert.alert(t('common.error'), t('common.required'));
    setSaving(true);
    try {
      if (modal === 'create') {
        await adminApi.users.create(form);
      } else if (selected) {
        const payload: any = { name: form.name, email: form.email, role: form.role, status: form.status };
        if (form.password) payload.password = form.password;
        await adminApi.users.update(selected.id, payload);
      }
      setModal(null);
      fetchUsers();
    } catch (e: any) {
      Alert.alert(t('common.error'), e.response?.data?.message ?? t('common.error'));
    } finally { setSaving(false); }
  };

  const handleDelete = (u: User) => {
    Alert.alert(
      t('common.delete'),
      t('users.deleteConfirmMsg', { name: u.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'), style: 'destructive',
          onPress: async () => {
            try {
              await adminApi.users.delete(u.id);
              fetchUsers();
            } catch (e: any) {
              Alert.alert(t('common.error'), e.response?.data?.message ?? t('common.error'));
            }
          },
        },
      ]
    );
  };

  const handleToggleStatus = async (u: User) => {
    const next = u.status === 'actif' ? 'suspendu' : 'actif';
    try {
      await adminApi.users.update(u.id, { status: next });
      fetchUsers();
    } catch (e: any) {
      Alert.alert(t('common.error'), e.response?.data?.message ?? t('common.error'));
    }
  };

  const renderUser = ({ item }: { item: User }) => {
    const roleColor   = ROLE_COLORS[item.role]   ?? COLORS.gray;
    const statusColor = STATUS_COLORS[item.status] ?? COLORS.gray;
    const isPending   = item.status === 'en_attente';

    return (
      <View style={[styles.card, isPending && styles.cardPending]}>
        <View style={[styles.avatar, { backgroundColor: roleColor + '22' }]}>
          <Text style={[styles.avatarText, { color: roleColor }]}>
            {item.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.userName}>{item.name}</Text>
          <Text style={styles.userEmail}>{item.email}</Text>
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: roleColor + '22' }]}>
              <Text style={[styles.badgeText, { color: roleColor }]}>{t(`roles.${item.role}` as any, item.role)}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: statusColor + '22' }]}>
              <Text style={[styles.badgeText, { color: statusColor }]}>{t(STATUS_LABEL_KEYS[item.status] ?? item.status)}</Text>
            </View>
          </View>
          {isPending && (
            <Text style={styles.pendingHint}>{t('reservations.status_en_attente')}</Text>
          )}
        </View>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(item)}>
            <FontAwesome5 name="pen" size={13} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: (item.status === 'actif' ? '#FEF3C7' : '#D1FAE5') }]}
            onPress={() => handleToggleStatus(item)}
          >
            <FontAwesome5
              name={item.status === 'actif' ? 'pause-circle' : 'play-circle'}
              size={13}
              color={item.status === 'actif' ? '#92400E' : '#065F46'}
            />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#FEE2E2' }]} onPress={() => handleDelete(item)}>
            <FontAwesome5 name="trash-alt" size={13} color={COLORS.danger} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: t('admin.users') }} />
      <View style={styles.container}>
        {/* Barre de recherche + filtre rôle */}
        <View style={styles.toolbar}>
          <View style={styles.searchWrap}>
            <FontAwesome5 name="search" size={13} color={COLORS.textMuted} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder={t('users.searchPlaceholder')}
              value={search}
              onChangeText={setSearch}
              placeholderTextColor={COLORS.textMuted}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <FontAwesome5 name="times-circle" size={14} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <FlatList
          data={filtered}
          keyExtractor={u => String(u.id)}
          renderItem={renderUser}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 90 }}
          ListHeaderComponent={
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                {['tous', ...ROLES].map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.filterChip, roleFilter === r && styles.filterChipActive]}
                    onPress={() => setRoleFilter(r)}
                  >
                    <Text style={[styles.filterChipText, roleFilter === r && styles.filterChipTextActive]}>
                      {r === 'tous' ? t('hotels.tab_all') : t(`roles.${r}` as any, r)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={styles.count}>{filtered.length} {filtered.length > 1 ? t('users.usersPlural') : t('users.user')}</Text>
            </>
          }
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchUsers(); }} colors={[COLORS.primary]} />}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.empty}>
                <FontAwesome5 name="user-slash" size={42} color={COLORS.grayLight} />
                <Text style={styles.emptyText}>{t('users.noUsersFound')}</Text>
              </View>
            ) : null
          }
        />

        {/* FAB créer */}
        <TouchableOpacity style={styles.fab} onPress={openCreate}>
          <FontAwesome5 name="user-plus" size={20} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      {/* Modal créer / éditer */}
      <Modal visible={!!modal} transparent animationType="slide" onRequestClose={() => setModal(null)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                {modal === 'create' ? t('users.newUser') : `${t('common.edit')} — ${selected?.name}`}
              </Text>
              <TouchableOpacity onPress={() => setModal(null)}>
                <FontAwesome5 name="times" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>{t('auth.fullName')}</Text>
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={v => setForm(f => ({ ...f, name: v }))}
                placeholder={t('auth.fullNamePlaceholder')}
              />

              <Text style={styles.fieldLabel}>{t('auth.email')}</Text>
              <TextInput
                style={styles.input}
                value={form.email}
                onChangeText={v => setForm(f => ({ ...f, email: v }))}
                placeholder={t('auth.emailPlaceholder')}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.fieldLabel}>
                {t('auth.password')}{modal === 'edit' ? t('users.passwordEditHint') : ''}
              </Text>
              <TextInput
                style={styles.input}
                value={form.password}
                onChangeText={v => setForm(f => ({ ...f, password: v }))}
                placeholder={modal === 'edit' ? '••••••••' : t('auth.passwordMin')}
                secureTextEntry
              />

              <Text style={styles.fieldLabel}>{t('profile.role')}</Text>
              <View style={styles.chipGroup}>
                {ROLES.map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.chip, form.role === r && { backgroundColor: ROLE_COLORS[r] ?? COLORS.primary }]}
                    onPress={() => setForm(f => ({ ...f, role: r }))}
                  >
                    <Text style={[styles.chipText, form.role === r && { color: COLORS.white }]}>{t(`roles.${r}` as any, r)}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>{t('reservations.status')}</Text>
              <View style={styles.chipGroup}>
                {STATUSES.map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chip, form.status === s && { backgroundColor: STATUS_COLORS[s] ?? COLORS.primary }]}
                    onPress={() => setForm(f => ({ ...f, status: s }))}
                  >
                    <Text style={[styles.chipText, form.status === s && { color: COLORS.white }]}>{t(STATUS_LABEL_KEYS[s] ?? s)}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color={COLORS.white} />
                  : <>
                      <FontAwesome5 name={modal === 'create' ? 'user-plus' : 'save'} size={15} color={COLORS.white} />
                      <Text style={styles.saveBtnText}>{modal === 'create' ? t('users.createUser') : t('common.save')}</Text>
                    </>
                }
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: COLORS.background },
  toolbar:          { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4 },
  searchWrap:       { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.border },
  searchInput:      { flex: 1, fontSize: 14, color: COLORS.text },
  filterRow:        { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  filterChip:       { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipText:   { fontSize: 12, color: COLORS.textMuted, fontWeight: '600' },
  filterChipTextActive: { color: COLORS.white },
  count:            { fontSize: 12, color: COLORS.textMuted, paddingHorizontal: 16, paddingBottom: 6 },
  card:             { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.white, borderRadius: 14, padding: 12, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardPending:      { borderLeftWidth: 3, borderLeftColor: '#f59e0b' },
  avatar:           { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  avatarText:       { fontSize: 18, fontWeight: '700' },
  userName:         { fontSize: 14, fontWeight: '700', color: COLORS.dark },
  userEmail:        { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
  badgeRow:         { flexDirection: 'row', gap: 6, marginTop: 5 },
  badge:            { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  badgeText:        { fontSize: 10, fontWeight: '700' },
  pendingHint:      { fontSize: 11, color: '#92400E', marginTop: 4, fontWeight: '600' },
  actions:          { gap: 6 },
  actionBtn:        { width: 30, height: 30, borderRadius: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: '#EEF2FF' },
  empty:            { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText:        { fontSize: 15, color: COLORS.textMuted },
  fab:              { position: 'absolute', bottom: 20, right: 20, backgroundColor: COLORS.primary, width: 54, height: 54, borderRadius: 27, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 8 },
  overlay:          { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:            { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '90%' },
  sheetHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetTitle:       { fontSize: 17, fontWeight: '700', color: COLORS.dark },
  fieldLabel:       { fontSize: 13, fontWeight: '600', color: COLORS.dark, marginBottom: 6, marginTop: 14 },
  input:            { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: COLORS.text, backgroundColor: COLORS.background },
  chipGroup:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:             { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border },
  chipText:         { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },
  saveBtn:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, marginTop: 22, marginBottom: 10 },
  saveBtnText:      { color: COLORS.white, fontSize: 15, fontWeight: '700' },
});
