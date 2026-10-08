import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Platform, ActivityIndicator, Alert, KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, SPACE, RADIUS, API_URL, API_HEADERS, TOP, BOTTOM } from '../theme';

// ── helpers ────────────────────────────────────────────────────────────────
function timeAgo(iso) {
  if (!iso) return '';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const ROLE_OPTIONS = [
  { label: 'Everyone',    value: 'all',         target_type: 'all'  },
  { label: 'Participants',value: 'participant',  target_type: 'role' },
  { label: 'Speakers',    value: 'speaker',      target_type: 'role' },
  { label: 'Staff',       value: 'staff',        target_type: 'role' },
];

// ── Send form ───────────────────────────────────────────────────────────────
function SendForm({ tokens, onSent }) {
  const [title,    setTitle]    = useState('');
  const [body,     setBody]     = useState('');
  const [target,   setTarget]   = useState(ROLE_OPTIONS[0]);
  const [sending,  setSending]  = useState(false);

  const send = async () => {
    if (!title.trim() || !body.trim()) {
      Alert.alert('Missing fields', 'Title and message are required.');
      return;
    }
    setSending(true);
    try {
      const payload = {
        title: title.trim(),
        body:  body.trim(),
        target_type: target.target_type,
        ...(target.target_type === 'role' && { target_role: target.value }),
      };
      const res  = await fetch(`${API_URL}/notifications/send/`, {
        method:  'POST',
        headers: { ...API_HEADERS, Authorization: `Bearer ${tokens.access}` },
        body:    JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert('Sent ✓', `Delivered to ${data.sent} device${data.sent !== 1 ? 's' : ''}.`);
        setTitle(''); setBody('');
        onSent();          // refresh history
      } else {
        Alert.alert('Error', data.error || 'Send failed.');
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    }
    setSending(false);
  };

  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>Send Notification</Text>

      {/* audience chips */}
      <Text style={s.fieldLabel}>Audience</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACE.md }}>
        <View style={{ flexDirection: 'row', gap: SPACE.sm }}>
          {ROLE_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[s.chip, target.value === opt.value && s.chipOn]}
              onPress={() => setTarget(opt)}
            >
              <Text style={[s.chipTxt, target.value === opt.value && s.chipTxtOn]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <Text style={s.fieldLabel}>Title</Text>
      <TextInput
        style={s.input}
        value={title}
        onChangeText={setTitle}
        placeholder="Notification title"
        placeholderTextColor={COLORS.textTer}
        maxLength={100}
      />

      <Text style={s.fieldLabel}>Message</Text>
      <TextInput
        style={[s.input, s.textarea]}
        value={body}
        onChangeText={setBody}
        placeholder="Write your message…"
        placeholderTextColor={COLORS.textTer}
        multiline
        numberOfLines={4}
        maxLength={500}
        textAlignVertical="top"
      />

      <TouchableOpacity
        style={[s.sendBtn, sending && { opacity: 0.6 }]}
        onPress={send}
        disabled={sending}
        activeOpacity={0.8}
      >
        {sending
          ? <ActivityIndicator color="#fff" size="small" />
          : <>
              <Ionicons name="send" size={16} color="#fff" />
              <Text style={s.sendTxt}>Send</Text>
            </>}
      </TouchableOpacity>
    </View>
  );
}

// ── History list ────────────────────────────────────────────────────────────
function History({ tokens, refresh }) {
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res  = await fetch(`${API_URL}/notifications/history/`, {
          headers: { ...API_HEADERS, Authorization: `Bearer ${tokens.access}` },
        });
        const data = await res.json();
        setItems(data.notifications || []);
      } catch { /* silent */ }
      setLoading(false);
    })();
  }, [refresh]);   // re-runs when parent increments refresh key

  if (loading) return (
    <View style={{ alignItems: 'center', padding: SPACE.xxl }}>
      <ActivityIndicator color={COLORS.brand} />
    </View>
  );

  if (!items.length) return (
    <View style={{ alignItems: 'center', padding: SPACE.xxl }}>
      <Ionicons name="notifications-off-outline" size={32} color={COLORS.textTer} />
      <Text style={{ marginTop: SPACE.sm, color: COLORS.textTer, fontSize: FONT.sm }}>No notifications sent yet</Text>
    </View>
  );

  return (
    <View>
      {items.map(n => (
        <View key={n.id} style={s.histCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={s.histTitle} numberOfLines={1}>{n.title}</Text>
            <View style={[s.statusBadge, n.status === 'sent' && s.statusSent]}>
              <Text style={[s.statusTxt, n.status === 'sent' && s.statusSentTxt]}>
                {n.status}
              </Text>
            </View>
          </View>
          <Text style={s.histBody} numberOfLines={2}>{n.body}</Text>
          <View style={{ flexDirection: 'row', gap: SPACE.lg, marginTop: SPACE.sm }}>
            <Text style={s.histMeta}>
              <Ionicons name="send-outline" size={11} /> {n.sent_count} sent
            </Text>
            <Text style={s.histMeta}>
              <Ionicons name="time-outline" size={11} /> {timeAgo(n.created_at)}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ── Root screen ─────────────────────────────────────────────────────────────
export default function AdminScreen({ tokens, onBack }) {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View>
          <Text style={s.headerTitle}>Admin Panel</Text>
          <Text style={s.headerSub}>Push notifications</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: SPACE.xl, paddingBottom: 120 + BOTTOM }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <SendForm tokens={tokens} onSent={() => setRefreshKey(k => k + 1)} />

        <Text style={s.secLabel}>SENT HISTORY</Text>
        <History tokens={tokens} refresh={refreshKey} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: TOP + 8,
    paddingBottom: SPACE.lg,
    paddingHorizontal: SPACE.xl,
    backgroundColor: COLORS.bg,
    gap: SPACE.md,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: RADIUS.md,
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
  cardTitle: { fontSize: FONT.md, fontWeight: FONT.w8, color: COLORS.text, marginBottom: SPACE.lg },

  fieldLabel: { fontSize: FONT.xs, fontWeight: FONT.w7, color: COLORS.textSec, marginBottom: SPACE.sm },

  chip: {
    paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm,
    borderRadius: RADIUS.full, borderWidth: 1.5,
    borderColor: COLORS.border, backgroundColor: '#fff',
  },
  chipOn:    { borderColor: COLORS.brand, backgroundColor: COLORS.brandLight },
  chipTxt:   { fontSize: FONT.xs, fontWeight: FONT.w6, color: COLORS.textSec },
  chipTxtOn: { color: COLORS.brand },

  input: {
    backgroundColor: '#f0f4f9', borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.md, paddingVertical: SPACE.md,
    fontSize: FONT.sm, color: COLORS.text,
    borderWidth: 1, borderColor: COLORS.borderLight,
    marginBottom: SPACE.md,
  },
  textarea: { height: 100, paddingTop: SPACE.md },

  sendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACE.sm, backgroundColor: COLORS.brand,
    borderRadius: RADIUS.md, paddingVertical: 14, marginTop: SPACE.sm,
  },
  sendTxt: { color: '#fff', fontWeight: FONT.w7, fontSize: FONT.md },

  histCard: {
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderRadius: RADIUS.lg, padding: SPACE.lg,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)',
    marginBottom: SPACE.md,
  },
  histTitle: { fontSize: FONT.sm, fontWeight: FONT.w7, color: COLORS.text, flex: 1, marginRight: SPACE.sm },
  histBody:  { fontSize: FONT.xs, color: COLORS.textSec, lineHeight: 18 },
  histMeta:  { fontSize: FONT.xs, color: COLORS.textTer },

  statusBadge: {
    paddingHorizontal: SPACE.sm, paddingVertical: 2,
    borderRadius: RADIUS.full, backgroundColor: COLORS.borderLight,
  },
  statusSent:    { backgroundColor: COLORS.successLight },
  statusTxt:     { fontSize: 9.5, fontWeight: FONT.w7, color: COLORS.textTer, textTransform: 'uppercase' },
  statusSentTxt: { color: COLORS.success },
});
