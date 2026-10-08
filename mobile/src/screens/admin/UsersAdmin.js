import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Platform, ActivityIndicator, Alert,
  Image, RefreshControl, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, SPACE, RADIUS, API_URL, API_HEADERS, TOP, BOTTOM } from '../../theme';
import { GradientAvatar } from '../../components';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function authHeaders(tokens) {
  return { ...API_HEADERS, Authorization: `Bearer ${tokens.access}` };
}

const ROLE_FILTERS = [
  { label: 'All',          value: '' },
  { label: 'Participants', value: 'participant' },
  { label: 'Speakers',     value: 'speaker' },
  { label: 'Staff',        value: 'staff' },
  { label: 'Team Heads',   value: 'team_head' },
];

const ROLE_COLOR = {
  participant: { bg: COLORS.brandLight,   fg: COLORS.brand   },
  speaker:     { bg: COLORS.purpleLight,  fg: COLORS.purple  },
  staff:       { bg: COLORS.tealLight,    fg: COLORS.teal    },
  team_head:   { bg: COLORS.accentLight,  fg: COLORS.accent  },
  super_admin: { bg: COLORS.errorLight,   fg: COLORS.error   },
  mgmt_admin:  { bg: COLORS.warningLight, fg: COLORS.warning },
};

function RolePill({ role }) {
  const c = ROLE_COLOR[role] || { bg: COLORS.borderLight, fg: COLORS.textTer };
  return (
    <View style={[u.pill, { backgroundColor: c.bg }]}>
      <Text style={[u.pillTxt, { color: c.fg }]}>
        {role.replace('_', ' ').toUpperCase()}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Action modal — warn / suspend / unsuspend
// ─────────────────────────────────────────────────────────────────────────────
function ActionModal({ user, tokens, onClose, onDone }) {
  const [action,  setAction]  = useState(user.is_active ? 'warn' : 'unsuspend');
  const [note,    setNote]    = useState('');
  const [loading, setLoading] = useState(false);

  const ACTIONS = user.is_active
    ? [
        { key: 'warn',    label: 'Send Warning',    icon: 'warning-outline',    color: COLORS.warning },
        { key: 'suspend', label: 'Suspend Account', icon: 'ban-outline',        color: COLORS.error   },
      ]
    : [
        { key: 'unsuspend', label: 'Restore Account', icon: 'checkmark-circle-outline', color: COLORS.success },
      ];

  const submit = async () => {
    if ((action === 'warn' || action === 'suspend') && !note.trim()) {
      Alert.alert('Note required', 'Please enter a note before proceeding.');
      return;
    }
    const confirmMsg = {
      warn:      `Send a warning to ${user.first_name}?`,
      suspend:   `Suspend ${user.first_name}'s account? They will be immediately logged out.`,
      unsuspend: `Restore ${user.first_name}'s account access?`,
    }[action];

    Alert.alert('Confirm', confirmMsg, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm', style: action === 'suspend' ? 'destructive' : 'default',
        onPress: async () => {
          setLoading(true);
          try {
            const res  = await fetch(`${API_URL}/auth/users/${user.id}/action/`, {
              method:  'POST',
              headers: authHeaders(tokens),
              body:    JSON.stringify({ action, note: note.trim() }),
            });
            const data = await res.json();
            if (data.success) { onDone(); }
            else { Alert.alert('Error', data.error || 'Action failed.'); }
          } catch (e) { Alert.alert('Error', e.message); }
          setLoading(false);
        },
      },
    ]);
  };

  return (
    <Modal transparent animationType="slide" presentationStyle="overFullScreen" onRequestClose={onClose}>
      <View style={m.overlay}>
        <View style={m.sheet}>
          {/* user header */}
          <View style={m.userRow}>
            {user.profile_photo_url
              ? <Image source={{ uri: user.profile_photo_url }} style={m.avatar} />
              : <GradientAvatar name={user.first_name || user.email} size={48} radius={16} />}
            <View style={{ flex: 1 }}>
              <Text style={m.userName}>{user.first_name} {user.last_name}</Text>
              <Text style={m.userEmail}>{user.email}</Text>
            </View>
            <RolePill role={user.role} />
          </View>

          {/* existing warning note */}
          {!!user.warning_note && (
            <View style={m.existingNote}>
              <Ionicons name="warning" size={13} color={COLORS.warning} />
              <Text style={m.existingNoteTxt} numberOfLines={3}>
                Previous warning: {user.warning_note}
              </Text>
            </View>
          )}

          {/* action tabs */}
          <Text style={m.label}>Action</Text>
          <View style={{ flexDirection: 'row', gap: SPACE.sm, marginBottom: SPACE.lg }}>
            {ACTIONS.map(a => (
              <TouchableOpacity
                key={a.key}
                style={[m.actionChip, action === a.key && { borderColor: a.color, backgroundColor: a.color + '18' }]}
                onPress={() => setAction(a.key)}
              >
                <Ionicons name={a.icon} size={15} color={action === a.key ? a.color : COLORS.textTer} />
                <Text style={[m.actionChipTxt, action === a.key && { color: a.color }]}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* note input — not needed for unsuspend */}
          {action !== 'unsuspend' && (
            <>
              <Text style={m.label}>
                {action === 'warn' ? 'Warning message *' : 'Suspension reason *'}
              </Text>
              <TextInput
                style={m.input}
                value={note}
                onChangeText={setNote}
                placeholder={
                  action === 'warn'
                    ? 'Explain the warning to the user…'
                    : 'Reason for suspension…'
                }
                placeholderTextColor={COLORS.textTer}
                multiline
                numberOfLines={3}
                maxLength={500}
                textAlignVertical="top"
              />
            </>
          )}

          <View style={{ flexDirection: 'row', gap: SPACE.md }}>
            <TouchableOpacity style={[m.btn, { flex: 1, backgroundColor: COLORS.borderLight }]} onPress={onClose}>
              <Text style={[m.btnTxt, { color: COLORS.textSec }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[m.btn, { flex: 1, backgroundColor:
                action === 'suspend'   ? COLORS.error   :
                action === 'unsuspend' ? COLORS.success :
                COLORS.warning
              }]}
              onPress={submit}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={m.btnTxt}>Confirm</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// User card
// ─────────────────────────────────────────────────────────────────────────────
function UserCard({ user, onAction }) {
  return (
    <View style={[u.card, !user.is_active && u.cardSuspended]}>
      <View style={u.row}>
        {user.profile_photo_url
          ? <Image source={{ uri: user.profile_photo_url }} style={u.avatar} />
          : <GradientAvatar name={user.first_name || user.email} size={44} radius={14} />}

        <View style={{ flex: 1, marginLeft: SPACE.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, flexWrap: 'wrap' }}>
            <Text style={u.name}>{user.first_name} {user.last_name}</Text>
            {!user.is_active && (
              <View style={u.suspendedBadge}>
                <Text style={u.suspendedTxt}>SUSPENDED</Text>
              </View>
            )}
          </View>
          <Text style={u.email} numberOfLines={1}>{user.email}</Text>
          {!!user.registration_id && (
            <Text style={u.regId}>{user.registration_id}</Text>
          )}
          {!!user.affiliation && (
            <Text style={u.affil} numberOfLines={1}>{user.affiliation}</Text>
          )}
        </View>

        <RolePill role={user.role} />
      </View>

      {/* warning note preview */}
      {!!user.warning_note && (
        <View style={u.warnBar}>
          <Ionicons name="warning" size={12} color={COLORS.warning} />
          <Text style={u.warnTxt} numberOfLines={2}>{user.warning_note}</Text>
        </View>
      )}

      {/* suspended reason preview */}
      {!user.is_active && !!user.suspended_reason && (
        <View style={u.suspendBar}>
          <Ionicons name="ban" size={12} color={COLORS.error} />
          <Text style={u.suspendTxt} numberOfLines={2}>{user.suspended_reason}</Text>
        </View>
      )}

      {/* action button */}
      <TouchableOpacity style={u.actionBtn} onPress={() => onAction(user)} activeOpacity={0.7}>
        <Ionicons name="shield-outline" size={14} color={COLORS.brand} />
        <Text style={u.actionTxt}>Moderate</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root screen
// ─────────────────────────────────────────────────────────────────────────────
export default function UsersAdmin({ tokens, onBack }) {
  const [users,      setUsers]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search,     setSearch]     = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [total,      setTotal]      = useState(0);
  const [selected,   setSelected]   = useState(null);   // user being moderated

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (search)     params.set('search', search);
      if (roleFilter) params.set('role',   roleFilter);
      const res  = await fetch(`${API_URL}/auth/users/?${params}`, {
        headers: authHeaders(tokens),
      });
      const data = await res.json();
      setUsers(data.users || []);
      setTotal(data.total || 0);
    } catch { /* silent */ }
    setLoading(false);
    setRefreshing(false);
  }, [search, roleFilter, tokens]);

  useEffect(() => { load(); }, [load]);

  const handleActionDone = () => {
    setSelected(null);
    load();
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* header */}
      <View style={u.header}>
        <TouchableOpacity onPress={onBack} style={u.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={u.headerTitle}>User Management</Text>
          <Text style={u.headerSub}>{total} users</Text>
        </View>
      </View>

      {/* search */}
      <View style={u.searchWrap}>
        <Ionicons name="search-outline" size={16} color={COLORS.textTer} style={{ marginRight: SPACE.sm }} />
        <TextInput
          style={u.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search name, email, reg ID…"
          placeholderTextColor={COLORS.textTer}
          returnKeyType="search"
        />
        {!!search && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={16} color={COLORS.textTer} />
          </TouchableOpacity>
        )}
      </View>

      {/* role filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ maxHeight: 44 }}
        contentContainerStyle={{ paddingHorizontal: SPACE.xl, gap: SPACE.sm, alignItems: 'center' }}
      >
        {ROLE_FILTERS.map(f => (
          <TouchableOpacity
            key={f.value}
            style={[u.chip, roleFilter === f.value && u.chipOn]}
            onPress={() => setRoleFilter(f.value)}
          >
            <Text style={[u.chipTxt, roleFilter === f.value && u.chipTxtOn]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.brand} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: SPACE.xl, paddingBottom: 120 + BOTTOM }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[COLORS.brand]} />
          }
        >
          {users.length === 0
            ? (
              <View style={{ alignItems: 'center', padding: SPACE.xxl }}>
                <Ionicons name="people-outline" size={40} color={COLORS.textTer} />
                <Text style={{ marginTop: SPACE.md, color: COLORS.textTer, fontSize: FONT.sm }}>No users found</Text>
              </View>
            )
            : users.map(usr => (
              <UserCard key={usr.id} user={usr} onAction={u => setSelected(u)} />
            ))
          }
        </ScrollView>
      )}

      {/* moderation modal */}
      {selected && (
        <ActionModal
          user={selected}
          tokens={tokens}
          onClose={() => setSelected(null)}
          onDone={handleActionDone}
        />
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const u = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: TOP + 8,
    paddingBottom: SPACE.md, paddingHorizontal: SPACE.xl,
    backgroundColor: COLORS.bg, gap: SPACE.md,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#fff',
  },
  headerTitle: { fontSize: FONT.xl, fontWeight: FONT.w9, color: COLORS.brand, letterSpacing: -0.3 },
  headerSub:   { fontSize: FONT.xs, color: COLORS.textTer, marginTop: 1 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: SPACE.xl, marginBottom: SPACE.md,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: RADIUS.lg, paddingHorizontal: SPACE.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', height: 44,
  },
  searchInput: { flex: 1, fontSize: FONT.sm, color: COLORS.text },

  chip: {
    paddingHorizontal: SPACE.md, paddingVertical: 6,
    borderRadius: RADIUS.full, borderWidth: 1.5,
    borderColor: COLORS.border, backgroundColor: '#fff',
  },
  chipOn:    { borderColor: COLORS.brand, backgroundColor: COLORS.brandLight },
  chipTxt:   { fontSize: FONT.xs, fontWeight: FONT.w6, color: COLORS.textSec },
  chipTxtOn: { color: COLORS.brand },

  card: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: RADIUS.lg, padding: SPACE.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)',
    marginBottom: SPACE.md,
  },
  cardSuspended: { borderLeftWidth: 3, borderLeftColor: COLORS.error },

  row:    { flexDirection: 'row', alignItems: 'flex-start' },
  avatar: { width: 44, height: 44, borderRadius: 14 },

  name:  { fontSize: FONT.sm, fontWeight: FONT.w7, color: COLORS.text },
  email: { fontSize: FONT.xs, color: COLORS.textTer, marginTop: 2 },
  regId: { fontSize: FONT.xs, color: COLORS.brand, marginTop: 1, fontWeight: FONT.w6 },
  affil: { fontSize: FONT.xs, color: COLORS.textSec, marginTop: 1 },

  pill:    { paddingHorizontal: SPACE.sm, paddingVertical: 3, borderRadius: RADIUS.full },
  pillTxt: { fontSize: 9, fontWeight: FONT.w8, letterSpacing: 0.3 },

  suspendedBadge: { backgroundColor: COLORS.errorLight, paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.full },
  suspendedTxt:   { fontSize: 9, fontWeight: FONT.w8, color: COLORS.error, letterSpacing: 0.3 },

  warnBar: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm,
    backgroundColor: COLORS.warningLight, borderRadius: RADIUS.sm,
    padding: SPACE.sm, marginTop: SPACE.sm,
  },
  warnTxt: { flex: 1, fontSize: FONT.xs, color: COLORS.warning, lineHeight: 16 },

  suspendBar: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm,
    backgroundColor: COLORS.errorLight, borderRadius: RADIUS.sm,
    padding: SPACE.sm, marginTop: SPACE.sm,
  },
  suspendTxt: { flex: 1, fontSize: FONT.xs, color: COLORS.error, lineHeight: 16 },

  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-end', marginTop: SPACE.sm,
    paddingHorizontal: SPACE.md, paddingVertical: 6,
    borderRadius: RADIUS.md, backgroundColor: COLORS.brandLight,
  },
  actionTxt: { fontSize: FONT.xs, fontWeight: FONT.w6, color: COLORS.brand },
});

const m = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: SPACE.xl, paddingBottom: 24 + BOTTOM,
  },
  userRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: SPACE.md, marginBottom: SPACE.lg,
    paddingBottom: SPACE.lg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  avatar:    { width: 48, height: 48, borderRadius: 16 },
  userName:  { fontSize: FONT.md, fontWeight: FONT.w7, color: COLORS.text },
  userEmail: { fontSize: FONT.xs, color: COLORS.textTer, marginTop: 2 },

  existingNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm,
    backgroundColor: COLORS.warningLight, borderRadius: RADIUS.md,
    padding: SPACE.md, marginBottom: SPACE.lg,
  },
  existingNoteTxt: { flex: 1, fontSize: FONT.xs, color: COLORS.warning, lineHeight: 18 },

  label: { fontSize: FONT.xs, fontWeight: FONT.w7, color: COLORS.textSec, marginBottom: SPACE.sm },

  actionChip: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.sm,
    flex: 1, justifyContent: 'center',
    paddingVertical: SPACE.md, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  actionChipTxt: { fontSize: FONT.xs, fontWeight: FONT.w6, color: COLORS.textTer },

  input: {
    backgroundColor: COLORS.bg, borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.md, paddingVertical: SPACE.md,
    fontSize: FONT.sm, color: COLORS.text,
    borderWidth: 1, borderColor: COLORS.borderLight,
    marginBottom: SPACE.lg, minHeight: 90,
  },

  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACE.sm, borderRadius: RADIUS.md, paddingVertical: 13,
  },
  btnTxt: { color: '#fff', fontWeight: FONT.w7, fontSize: FONT.sm },
});
