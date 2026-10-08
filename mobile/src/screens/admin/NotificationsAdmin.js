import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Platform, ActivityIndicator, Alert,
  KeyboardAvoidingView, Image, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, SPACE, RADIUS, API_URL, API_HEADERS, TOP, BOTTOM } from '../../theme';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function timeAgo(iso) {
  if (!iso) return '';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)    return 'Just now';
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function authHeaders(tokens) {
  return { ...API_HEADERS, Authorization: `Bearer ${tokens.access}` };
}

const TARGET_OPTIONS = [
  { label: 'All Users',    target_type: 'all',  target_role: '' },
  { label: 'Participants', target_type: 'role', target_role: 'participant' },
  { label: 'Speakers',     target_type: 'role', target_role: 'speaker' },
  { label: 'Staff',        target_type: 'role', target_role: 'staff' },
  { label: 'Team Heads',   target_type: 'role', target_role: 'team_head' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = {
    sent:    { bg: COLORS.successLight, color: COLORS.success },
    failed:  { bg: COLORS.errorLight,   color: COLORS.error },
    pending: { bg: COLORS.warningLight, color: COLORS.warning },
  }[status] || { bg: COLORS.borderLight, color: COLORS.textTer };
  return (
    <View style={[b.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[b.txt, { color: cfg.color }]}>{status.toUpperCase()}</Text>
    </View>
  );
}
const b = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full },
  txt:   { fontSize: 9, fontWeight: FONT.w8, letterSpacing: 0.5 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Edit modal — inline (replaces content area)
// ─────────────────────────────────────────────────────────────────────────────
function EditScreen({ notif, tokens, onDone, onBack }) {
  const [title,   setTitle]   = useState(notif.title);
  const [body,    setBody]    = useState(notif.body);
  const [saving,  setSaving]  = useState(false);

  const save = async () => {
    if (!title.trim() || !body.trim()) {
      Alert.alert('Missing fields', 'Title and message are required.');
      return;
    }
    setSaving(true);
    try {
      const res  = await fetch(`${API_URL}/notifications/${notif.id}/`, {
        method:  'PATCH',
        headers: authHeaders(tokens),
        body:    JSON.stringify({ title: title.trim(), body: body.trim() }),
      });
      const data = await res.json();
      if (data.success) { onDone(); }
      else { Alert.alert('Error', data.error || 'Save failed.'); }
    } catch (e) { Alert.alert('Error', e.message); }
    setSaving(false);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View>
          <Text style={s.headerTitle}>Edit Notification</Text>
          <Text style={s.headerSub}>Changes title & body only</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: SPACE.xl, paddingBottom: 120 + BOTTOM }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* cover preview (read-only on mobile) */}
        {!!notif.cover_image_url && (
          <Image
            source={{ uri: notif.cover_image_url }}
            style={s.coverPreview}
            resizeMode="cover"
          />
        )}

        <View style={s.card}>
          <Text style={s.fieldLabel}>Title *</Text>
          <TextInput
            style={s.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Notification title"
            placeholderTextColor={COLORS.textTer}
            maxLength={200}
          />

          <Text style={s.fieldLabel}>Message *</Text>
          <TextInput
            style={[s.input, s.textarea]}
            value={body}
            onChangeText={setBody}
            placeholder="Notification body…"
            placeholderTextColor={COLORS.textTer}
            multiline
            numberOfLines={5}
            maxLength={1000}
            textAlignVertical="top"
          />

          {/* ceiling: cover_image + attachment upload from mobile not supported;
                      use web dashboard (/panel/notifications/) for file management */}
          <View style={s.infoBox}>
            <Ionicons name="information-circle-outline" size={15} color={COLORS.brand} />
            <Text style={s.infoTxt}>
              Cover image & attachments can only be managed from the web dashboard.
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: SPACE.md, marginTop: SPACE.sm }}>
            <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: COLORS.brand }]} onPress={save} disabled={saving}>
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <><Ionicons name="save-outline" size={16} color="#fff" /><Text style={s.btnTxt}>Save Changes</Text></>}
            </TouchableOpacity>
            <TouchableOpacity style={[s.btn, { paddingHorizontal: SPACE.lg, backgroundColor: COLORS.borderLight }]} onPress={onBack}>
              <Text style={[s.btnTxt, { color: COLORS.textSec }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Send form
// ─────────────────────────────────────────────────────────────────────────────
function SendForm({ tokens, onSent }) {
  const [title,   setTitle]   = useState('');
  const [body,    setBody]    = useState('');
  const [target,  setTarget]  = useState(TARGET_OPTIONS[0]);
  const [sending, setSending] = useState(false);
  const [open,    setOpen]    = useState(true);   // collapsible

  const send = async () => {
    if (!title.trim() || !body.trim()) {
      Alert.alert('Missing fields', 'Title and message are required.');
      return;
    }
    Alert.alert(
      'Send Notification',
      `Send "${title.trim()}" to ${target.label}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send', style: 'default', onPress: async () => {
            setSending(true);
            try {
              const payload = {
                title:       title.trim(),
                body:        body.trim(),
                target_type: target.target_type,
                ...(target.target_type === 'role' && { target_role: target.target_role }),
              };
              const res  = await fetch(`${API_URL}/notifications/send/`, {
                method:  'POST',
                headers: authHeaders(tokens),
                body:    JSON.stringify(payload),
              });
              const data = await res.json();
              if (data.success) {
                Alert.alert('Sent ✓', `Delivered to ${data.sent} device${data.sent !== 1 ? 's' : ''}. ${data.failed} failed.`);
                setTitle(''); setBody(''); setTarget(TARGET_OPTIONS[0]);
                onSent();
              } else {
                Alert.alert('Error', data.error || 'Send failed.');
              }
            } catch (e) { Alert.alert('Error', e.message); }
            setSending(false);
          },
        },
      ]
    );
  };

  return (
    <View style={s.card}>
      {/* collapsible header */}
      <TouchableOpacity
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: open ? SPACE.lg : 0 }}
        onPress={() => setOpen(o => !o)}
        activeOpacity={0.7}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm }}>
          <Ionicons name="paper-plane" size={16} color={COLORS.success} />
          <Text style={s.cardTitle}>Send Notification</Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.textTer} />
      </TouchableOpacity>

      {open && (
        <>
          <Text style={s.fieldLabel}>Audience</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACE.md }}>
            <View style={{ flexDirection: 'row', gap: SPACE.sm, paddingVertical: 2 }}>
              {TARGET_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.target_role || 'all'}
                  style={[s.chip, target.label === opt.label && s.chipOn]}
                  onPress={() => setTarget(opt)}
                >
                  <Text style={[s.chipTxt, target.label === opt.label && s.chipTxtOn]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <Text style={s.fieldLabel}>Title *</Text>
          <TextInput
            style={s.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Short, clear title"
            placeholderTextColor={COLORS.textTer}
            maxLength={200}
          />

          <Text style={s.fieldLabel}>Message *</Text>
          <TextInput
            style={[s.input, s.textarea]}
            value={body}
            onChangeText={setBody}
            placeholder="Notification body text…"
            placeholderTextColor={COLORS.textTer}
            multiline
            numberOfLines={4}
            maxLength={1000}
            textAlignVertical="top"
          />

          {/* ceiling: cover_image + attachments upload stays web-only on mobile */}
          <View style={s.infoBox}>
            <Ionicons name="information-circle-outline" size={15} color={COLORS.brand} />
            <Text style={s.infoTxt}>
              Cover image & file attachments — use the web dashboard.
            </Text>
          </View>

          <TouchableOpacity
            style={[s.btn, { backgroundColor: COLORS.brand, justifyContent: 'center', marginTop: SPACE.sm }]}
            onPress={send}
            disabled={sending}
            activeOpacity={0.8}
          >
            {sending
              ? <ActivityIndicator color="#fff" size="small" />
              : <><Ionicons name="send" size={15} color="#fff" /><Text style={s.btnTxt}>Send Now</Text></>}
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// History list
// ─────────────────────────────────────────────────────────────────────────────
function HistoryList({ tokens, refresh, onEdit }) {
  const [items,      setItems]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deviceCount, setDeviceCount] = useState(null);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res  = await fetch(`${API_URL}/notifications/history/`, {
        headers: authHeaders(tokens),
      });
      const data = await res.json();
      setItems(data.notifications || []);
      if (data.device_count != null) setDeviceCount(data.device_count);
    } catch { /* silent */ }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { load(); }, [refresh]);

  const deleteNotif = (id, title) => {
    Alert.alert(
      'Delete Notification',
      `Delete "${title}"? Users will no longer see it.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            try {
              await fetch(`${API_URL}/notifications/${id}/`, {
                method:  'DELETE',
                headers: authHeaders(tokens),
              });
              setItems(prev => prev.filter(n => n.id !== id));
            } catch (e) { Alert.alert('Error', e.message); }
          },
        },
      ]
    );
  };

  if (loading) return (
    <View style={{ alignItems: 'center', padding: SPACE.xxl }}>
      <ActivityIndicator color={COLORS.brand} />
    </View>
  );

  return (
    <View>
      {/* stats bar */}
      <View style={s.statsBar}>
        <Ionicons name="phone-portrait-outline" size={14} color={COLORS.brand} />
        <Text style={s.statsTxt}>
          {deviceCount != null ? `${deviceCount} active devices` : 'History'}
        </Text>
        <Text style={s.statsSep}>·</Text>
        <Text style={s.statsTxt}>{items.length} notifications</Text>
      </View>

      {items.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="notifications-off-outline" size={36} color={COLORS.textTer} />
          <Text style={s.emptyTxt}>No notifications sent yet</Text>
        </View>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[COLORS.brand]} />
          }
          showsVerticalScrollIndicator={false}
          scrollEnabled={false}   // parent ScrollView handles scrolling
        >
          {items.map(n => (
            <View key={n.id} style={s.histCard}>
              {/* cover image thumbnail */}
              {!!n.cover_image_url && (
                <Image source={{ uri: n.cover_image_url }} style={s.thumb} resizeMode="cover" />
              )}

              <View style={s.histBody}>
                {/* row 1: title + status */}
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm, marginBottom: 4 }}>
                  <Text style={s.histTitle} numberOfLines={1}>{n.title}</Text>
                  <StatusBadge status={n.status} />
                </View>

                {/* body preview */}
                <Text style={s.histBodyTxt} numberOfLines={2}>{n.body}</Text>

                {/* meta row */}
                <View style={s.metaRow}>
                  {/* target */}
                  <View style={s.targetChip}>
                    <Ionicons name="people-outline" size={11} color={COLORS.brand} />
                    <Text style={s.targetTxt}>
                      {n.target_type === 'all' ? 'All' : n.target_role || n.target_type}
                    </Text>
                  </View>
                  {/* sent */}
                  <Text style={s.metaTxt}>
                    <Ionicons name="send-outline" size={11} /> {n.sent_count} sent
                  </Text>
                  {/* delivered */}
                  <Text style={s.metaTxt}>
                    <Ionicons name="checkmark-done-outline" size={11} /> {n.delivered_count} delivered
                  </Text>
                  {/* read */}
                  <Text style={s.metaTxt}>
                    <Ionicons name="eye-outline" size={11} /> {n.read_count} read
                  </Text>
                  {/* attachments */}
                  {n.attachment_count > 0 && (
                    <Text style={s.metaTxt}>
                      <Ionicons name="attach" size={11} /> {n.attachment_count} file{n.attachment_count > 1 ? 's' : ''}
                    </Text>
                  )}
                  {/* time */}
                  <Text style={[s.metaTxt, { marginLeft: 'auto' }]}>
                    <Ionicons name="time-outline" size={11} /> {timeAgo(n.created_at)}
                  </Text>
                </View>

                {/* action buttons */}
                <View style={s.actionRow}>
                  <TouchableOpacity style={s.actionBtn} onPress={() => onEdit(n)} activeOpacity={0.7}>
                    <Ionicons name="create-outline" size={15} color={COLORS.brand} />
                    <Text style={[s.actionTxt, { color: COLORS.brand }]}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.actionBtn, s.actionBtnDanger]} onPress={() => deleteNotif(n.id, n.title)} activeOpacity={0.7}>
                    <Ionicons name="trash-outline" size={15} color={COLORS.error} />
                    <Text style={[s.actionTxt, { color: COLORS.error }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root screen
// ─────────────────────────────────────────────────────────────────────────────
export default function NotificationsAdmin({ tokens, onBack }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [editing,    setEditing]    = useState(null);   // notif object or null

  if (editing) {
    return (
      <EditScreen
        notif={editing}
        tokens={tokens}
        onBack={() => setEditing(null)}
        onDone={() => { setEditing(null); setRefreshKey(k => k + 1); }}
      />
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View>
          <Text style={s.headerTitle}>Push Notifications</Text>
          <Text style={s.headerSub}>Send to all participants or by role</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: SPACE.xl, paddingBottom: 120 + BOTTOM }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <SendForm tokens={tokens} onSent={() => setRefreshKey(k => k + 1)} />

        <Text style={s.secLabel}>SENT HISTORY</Text>
        <HistoryList
          tokens={tokens}
          refresh={refreshKey}
          onEdit={n => setEditing(n)}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: TOP + 8,
    paddingBottom: SPACE.lg, paddingHorizontal: SPACE.xl,
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

  secLabel: {
    fontSize: 10, fontWeight: FONT.w8, color: COLORS.textTer,
    letterSpacing: 1.5, marginBottom: SPACE.md, marginLeft: 4,
  },

  card: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: RADIUS.xl, padding: SPACE.xl,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)',
    marginBottom: SPACE.xl,
  },
  cardTitle: { fontSize: FONT.md, fontWeight: FONT.w7, color: COLORS.text },

  fieldLabel: {
    fontSize: FONT.xs, fontWeight: FONT.w7,
    color: COLORS.textSec, marginBottom: SPACE.sm,
  },
  input: {
    backgroundColor: '#f0f4f9', borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.md, paddingVertical: SPACE.md,
    fontSize: FONT.sm, color: COLORS.text,
    borderWidth: 1, borderColor: COLORS.borderLight,
    marginBottom: SPACE.md,
  },
  textarea: { height: 110, paddingTop: SPACE.md },

  chip: {
    paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm,
    borderRadius: RADIUS.full, borderWidth: 1.5,
    borderColor: COLORS.border, backgroundColor: '#fff',
  },
  chipOn:    { borderColor: COLORS.brand, backgroundColor: COLORS.brandLight },
  chipTxt:   { fontSize: FONT.xs, fontWeight: FONT.w6, color: COLORS.textSec },
  chipTxtOn: { color: COLORS.brand },

  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm,
    backgroundColor: COLORS.brandLight, borderRadius: RADIUS.md,
    padding: SPACE.md, marginBottom: SPACE.sm,
  },
  infoTxt: { flex: 1, fontSize: FONT.xs, color: COLORS.brand, lineHeight: 18 },

  btn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.sm,
    borderRadius: RADIUS.md, paddingVertical: 13, paddingHorizontal: SPACE.lg,
  },
  btnTxt: { color: '#fff', fontWeight: FONT.w7, fontSize: FONT.sm },

  statsBar: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.sm,
    marginBottom: SPACE.md, paddingHorizontal: 4,
  },
  statsTxt:  { fontSize: FONT.xs, color: COLORS.textTer },
  statsSep:  { color: COLORS.border },

  empty: { alignItems: 'center', padding: SPACE.xxl, gap: SPACE.md },
  emptyTxt: { fontSize: FONT.sm, color: COLORS.textTer, fontWeight: FONT.w5 },

  histCard: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: RADIUS.lg, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)',
    marginBottom: SPACE.md,
  },
  thumb: { width: '100%', height: 110 },
  histBody: { padding: SPACE.md },
  histTitle: {
    flex: 1, fontSize: FONT.sm, fontWeight: FONT.w7, color: COLORS.text,
  },
  histBodyTxt: { fontSize: FONT.xs, color: COLORS.textSec, lineHeight: 18 },

  metaRow: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: SPACE.sm, marginTop: SPACE.sm, alignItems: 'center',
  },
  metaTxt: { fontSize: FONT.xs, color: COLORS.textTer },
  targetChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.brandLight,
    paddingHorizontal: SPACE.sm, paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  targetTxt: { fontSize: 10, fontWeight: FONT.w7, color: COLORS.brand },

  actionRow: {
    flexDirection: 'row', gap: SPACE.sm, marginTop: SPACE.md,
    borderTopWidth: 1, borderTopColor: COLORS.borderLight, paddingTop: SPACE.md,
  },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm,
    borderRadius: RADIUS.md, backgroundColor: COLORS.brandLight,
  },
  actionBtnDanger: { backgroundColor: COLORS.errorLight },
  actionTxt: { fontSize: FONT.xs, fontWeight: FONT.w6 },

  coverPreview: {
    width: '100%', height: 160, borderRadius: RADIUS.lg,
    marginBottom: SPACE.lg,
  },
});
