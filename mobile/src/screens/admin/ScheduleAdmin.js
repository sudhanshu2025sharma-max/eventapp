import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform,
  ActivityIndicator, Alert, TextInput, Modal, RefreshControl,
  KeyboardAvoidingView, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONT, SPACE, RADIUS, SHADOW, TOP, API_URL, API_HEADERS } from '../../theme';

/* ── Constants ─────────────────────────────────────────────────────────── */
const DAYS_FILTER = [
  { key: '', label: 'All' },
  { key: '1', label: 'Day 1' },
  { key: '2', label: 'Day 2' },
  { key: '3', label: 'Day 3' },
];

const SESSION_TYPES = [
  { value: 'keynote',   label: 'Keynote' },
  { value: 'technical', label: 'Technical' },
  { value: 'workshop',  label: 'Workshop' },
  { value: 'break',     label: 'Break' },
  { value: 'meal',      label: 'Meal' },
  { value: 'cultural',  label: 'Cultural' },
  { value: 'panel',     label: 'Panel' },
  { value: 'ceremony',  label: 'Ceremony' },
  { value: 'ideathon',  label: 'Ideathon' },
  { value: 'special',   label: 'Special' },
];

const TYPE_COLORS = {
  keynote: COLORS.purple, technical: COLORS.brand, workshop: COLORS.accent,
  break: COLORS.success, meal: COLORS.success, cultural: COLORS.rose,
  panel: COLORS.teal, ceremony: COLORS.accent, ideathon: COLORS.purple,
  special: COLORS.textSec,
};

const QUICK_DATES = [
  { date: '2026-10-23', label: 'Oct 23' },
  { date: '2026-10-24', label: 'Oct 24' },
  { date: '2026-10-25', label: 'Oct 25' },
];

const HOURS_12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
function to24(h12, ampm) { if (ampm === 'AM') return h12 === 12 ? 0 : h12; return h12 === 12 ? 12 : h12 + 12; }
function to12(h24) { const ampm = h24 >= 12 ? 'PM' : 'AM'; const h = h24 % 12 || 12; return { h, ampm }; }

function pad(n) { return n.toString().padStart(2, '0'); }
function fmtTime(dt) {
  if (!dt) return '';
  const d = new Date(dt);
  try {
    return d.toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', hour12: false,
      timeZone: 'Asia/Kolkata',
    });
  } catch {
    const h = d.getUTCHours() + 5;
    const m = d.getUTCMinutes() + 30;
    const adjH = m >= 60 ? h + 1 : h;
    const adjM = m >= 60 ? m - 60 : m;
    return `${String(adjH % 24).padStart(2, '0')}:${String(adjM).padStart(2, '0')}`;
  }
}
function authH(tokens) {
  return { ...API_HEADERS, Authorization: `Bearer ${tokens.access}` };
}

/* ── Skeleton Loading ──────────────────────────────────────────────────── */
function Skeleton({ width, height = 14, radius = 6, style }) {
  const anim = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={[{
      width, height, borderRadius: radius,
      backgroundColor: COLORS.border, opacity: anim,
    }, style]} />
  );
}

function ListSkeleton() {
  return (
    <View style={{ padding: SPACE.xl, gap: SPACE.md }}>
      {[1, 2, 3, 4, 5, 6].map(i => (
        <View key={i} style={[sk.card]}>
          <View style={{ gap: SPACE.sm }}>
            <View style={{ flexDirection: 'row', gap: SPACE.sm }}>
              <Skeleton width={50} height={18} radius={RADIUS.full} />
              <Skeleton width={90} height={18} radius={RADIUS.full} />
            </View>
            <Skeleton width="80%" height={16} />
            <View style={{ flexDirection: 'row', gap: SPACE.sm }}>
              <Skeleton width={60} height={14} radius={RADIUS.full} />
              <Skeleton width={80} height={14} radius={RADIUS.full} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const sk = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: RADIUS.lg,
    padding: SPACE.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)',
  },
});

/* ── DateTime Picker Modal ─────────────────────────────────────────────── */
function DateTimePickerModal({ visible, value, onSelect, onClose, label }) {
  const parsed = value ? new Date(value) : null;
  const [dateStr, setDateStr] = useState(parsed ? `${parsed.getFullYear()}-${pad(parsed.getMonth()+1)}-${pad(parsed.getDate())}` : '2026-10-23');
  const init12 = parsed ? to12(parsed.getHours()) : { h: 9, ampm: 'AM' };
  const [hour12, setHour12] = useState(init12.h);
  const [minute, setMinute] = useState(parsed ? parsed.getMinutes() : 0);
  const [ampm, setAmpm] = useState(init12.ampm);

  useEffect(() => {
    if (visible && parsed) {
      setDateStr(`${parsed.getFullYear()}-${pad(parsed.getMonth()+1)}-${pad(parsed.getDate())}`);
      const i = to12(parsed.getHours());
      setHour12(i.h); setAmpm(i.ampm);
      setMinute(parsed.getMinutes());
    }
  }, [visible]);

  const confirm = () => {
    const h24 = to24(hour12, ampm);
    // Append +05:30 so JavaScript and backend both know this is IST
    const iso = `${dateStr}T${pad(h24)}:${pad(minute)}:00+05:30`;
    onSelect(iso);
  };


  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={dt.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={dt.modal} activeOpacity={1} onPress={() => {}}>
          <View style={dt.header}>
            <Text style={dt.title}>{label || 'Select Date & Time'}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={COLORS.textTer} />
            </TouchableOpacity>
          </View>

          <Text style={dt.sectionLabel}>DATE</Text>
          <TextInput
            style={dt.dateInput}
            value={dateStr}
            onChangeText={setDateStr}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={COLORS.textTer}
            maxLength={10}
            keyboardType="numbers-and-punctuation"
          />
          <View style={{ flexDirection: 'row', gap: SPACE.sm, marginBottom: SPACE.lg }}>
            {QUICK_DATES.map(d => (
              <TouchableOpacity key={d.date}
                style={[dt.dateBtn, dateStr === d.date && dt.dateBtnOn]}
                onPress={() => setDateStr(d.date)}>
                <Text style={[dt.dateBtnText, dateStr === d.date && { color: '#fff' }]}>{d.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={dt.sectionLabel}>TIME</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.lg }}>
            <View style={{ flex: 1 }}>
              <Text style={dt.timeLabel}>Hour</Text>
              <ScrollView style={dt.timeScroll} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                {HOURS_12.map(h => (
                  <TouchableOpacity key={h} style={[dt.timeItem, hour12 === h && dt.timeItemOn]}
                    onPress={() => setHour12(h)}>
                    <Text style={[dt.timeItemText, hour12 === h && dt.timeItemTextOn]}>{h}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <Text style={{ fontSize: 28, fontWeight: FONT.w8, color: COLORS.text, marginTop: 24 }}>:</Text>
            <View style={{ flex: 1 }}>
              <Text style={dt.timeLabel}>Min</Text>
              <ScrollView style={dt.timeScroll} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                {MINS.map(m => (
                  <TouchableOpacity key={m} style={[dt.timeItem, minute === m && dt.timeItemOn]}
                    onPress={() => setMinute(m)}>
                    <Text style={[dt.timeItemText, minute === m && dt.timeItemTextOn]}>{pad(m)}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <View style={{ gap: SPACE.sm, marginTop: 24 }}>
              {['AM', 'PM'].map(p => (
                <TouchableOpacity key={p}
                  style={[dt.ampmBtn, ampm === p && dt.ampmBtnOn]}
                  onPress={() => setAmpm(p)}>
                  <Text style={[dt.ampmText, ampm === p && dt.ampmTextOn]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={dt.preview}>
            <Ionicons name="calendar-outline" size={16} color={COLORS.brand} />
            <Text style={dt.previewText}>
              {dateStr}  ·  {hour12}:{pad(minute)} {ampm}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: SPACE.md, marginTop: SPACE.lg }}>
            <TouchableOpacity style={dt.cancelBtn} onPress={onClose}>
              <Text style={dt.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={dt.confirmBtn} onPress={confirm} activeOpacity={0.8}>
              <LinearGradient colors={[COLORS.brand, COLORS.brandDark]} style={dt.confirmGrad}>
                <Ionicons name="checkmark" size={18} color="#fff" />
                <Text style={dt.confirmText}>Confirm</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const dt = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: SPACE.xl },
  modal: {
    backgroundColor: COLORS.surface, borderRadius: 24, padding: SPACE.xl,
    width: '100%', maxWidth: 400, maxHeight: '90%',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACE.xl },
  title: { fontSize: FONT.lg, fontWeight: FONT.w9, color: COLORS.text },
  sectionLabel: { fontSize: 10, fontWeight: FONT.w8, color: COLORS.textTer, letterSpacing: 1.5, marginBottom: SPACE.sm },
  dateInput: {
    backgroundColor: COLORS.bg, borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.md, paddingVertical: SPACE.md,
    fontSize: FONT.md, fontWeight: FONT.w7, color: COLORS.text,
    borderWidth: 1, borderColor: COLORS.borderLight, marginBottom: SPACE.md,
    textAlign: 'center', letterSpacing: 1,
  },
  dateBtn: {
    flex: 1, alignItems: 'center', paddingVertical: SPACE.sm,
    borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: '#fff',
  },
  dateBtnOn: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  dateBtnText: { fontSize: FONT.xs, fontWeight: FONT.w7, color: COLORS.text },
  timeLabel: { fontSize: 10, fontWeight: FONT.w7, color: COLORS.textTer, textAlign: 'center', marginBottom: SPACE.xs },
  timeScroll: { height: 150, borderRadius: RADIUS.md, backgroundColor: COLORS.bg },
  timeItem: { paddingVertical: SPACE.sm, alignItems: 'center', borderRadius: RADIUS.sm, marginHorizontal: 4, marginVertical: 1 },
  timeItemOn: { backgroundColor: COLORS.brand },
  timeItemText: { fontSize: FONT.md, fontWeight: FONT.w6, color: COLORS.text },
  timeItemTextOn: { color: '#fff', fontWeight: FONT.w8 },
  ampmBtn: {
    paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md,
    borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: '#fff',
    alignItems: 'center',
  },
  ampmBtnOn: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  ampmText: { fontSize: FONT.sm, fontWeight: FONT.w7, color: COLORS.text },
  ampmTextOn: { color: '#fff' },
  preview: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.sm,
    backgroundColor: COLORS.brandLight, padding: SPACE.md, borderRadius: RADIUS.md,
  },
  previewText: { fontSize: FONT.sm, fontWeight: FONT.w7, color: COLORS.brand },
  cancelBtn: {
    flex: 1, alignItems: 'center', paddingVertical: SPACE.md,
    borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.border,
  },
  cancelText: { fontSize: FONT.sm, fontWeight: FONT.w6, color: COLORS.textSec },
  confirmBtn: { flex: 1, borderRadius: RADIUS.md, overflow: 'hidden' },
  confirmGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACE.sm, paddingVertical: SPACE.md,
  },
  confirmText: { fontSize: FONT.sm, fontWeight: FONT.w7, color: '#fff' },
});

/* ── Reusable Header ───────────────────────────────────────────────────── */
function Header({ title, sub, onBack, right }) {
  return (
    <View style={s.header}>
      <TouchableOpacity onPress={onBack} style={s.backBtn}>
        <Ionicons name="arrow-back" size={22} color={COLORS.text} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={s.headerTitle}>{title}</Text>
        {!!sub && <Text style={s.headerSub} numberOfLines={1}>{sub}</Text>}
      </View>
      {right}
    </View>
  );
}

/* ── DateTime Field (tap to open picker) ───────────────────────────────── */
function DateTimeField({ label, value, onChange }) {
  const [open, setOpen] = useState(false);
  const display = value ? `${value.slice(5, 10)}  ${value.slice(11, 16)}` : 'Tap to set';
  return (
    <View style={{ flex: 1 }}>
      <Text style={s.label}>{label}</Text>
      <TouchableOpacity style={s.dtField} onPress={() => setOpen(true)} activeOpacity={0.7}>
        <Ionicons name="calendar-outline" size={16} color={value ? COLORS.brand : COLORS.textTer} />
        <Text style={[s.dtFieldText, !value && { color: COLORS.textTer }]}>{display}</Text>
      </TouchableOpacity>
      <DateTimePickerModal
        visible={open}
        value={value}
        label={label}
        onClose={() => setOpen(false)}
        onSelect={(v) => { onChange(v); setOpen(false); }}
      />
    </View>
  );
}

/* ── Feedback Analytics ────────────────────────────────────────────────── */
function AnalyticsView({ session, tokens, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/schedule/admin/sessions/${session.id}/feedback-analytics/`, { headers: authH(tokens) });
        setData(await res.json());
      } catch { /* */ }
      setLoading(false);
    })();
  }, [session.id]);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <Header title="Feedback Analytics" sub={session.title} onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: SPACE.xl, paddingBottom: 100 }}>
        {loading && <ActivityIndicator color={COLORS.brand} style={{ marginTop: SPACE.xxl }} />}
        {data && (
          <>
            <View style={s.detailCard}>
              <Text style={{ fontSize: 36, fontWeight: FONT.w9, color: COLORS.brand, textAlign: 'center' }}>{data.total_responses}</Text>
              <Text style={{ fontSize: FONT.xs, color: COLORS.textTer, textAlign: 'center', marginTop: 2 }}>Total Responses</Text>
            </View>
            {(data.question_stats || []).map((q, i) => (
              <View key={i} style={s.detailCard}>
                <Text style={{ fontSize: FONT.sm, fontWeight: FONT.w7, color: COLORS.text, marginBottom: SPACE.sm }}>{i + 1}. {q.text}</Text>
                {q.type === 'rating' && (
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: SPACE.sm }}>
                    <Text style={{ fontSize: 28, fontWeight: FONT.w9, color: COLORS.accent }}>{q.avg_rating ?? '—'}</Text>
                    <Text style={{ fontSize: FONT.xs, color: COLORS.textTer }}>/5 avg</Text>
                  </View>
                )}
                {q.type === 'boolean' && (
                  <View style={{ flexDirection: 'row', gap: SPACE.xl }}>
                    <View>
                      <Text style={{ fontSize: 22, fontWeight: FONT.w8, color: COLORS.success }}>{q.yes_count}</Text>
                      <Text style={{ fontSize: 10, color: COLORS.textTer }}>Yes ({q.yes_pct}%)</Text>
                    </View>
                    <View>
                      <Text style={{ fontSize: 22, fontWeight: FONT.w8, color: COLORS.error }}>{q.no_count}</Text>
                      <Text style={{ fontSize: 10, color: COLORS.textTer }}>No</Text>
                    </View>
                  </View>
                )}
              </View>
            ))}
            <Text style={s.secLabel}>INDIVIDUAL RESPONSES</Text>
            {(data.responses || []).map((r, i) => (
              <View key={r.id || i} style={s.responseCard}>
                <Text style={{ fontSize: FONT.sm, fontWeight: FONT.w7, color: COLORS.text }}>{r.user_name}</Text>
                <Text style={{ fontSize: 10, color: COLORS.textTer, marginBottom: SPACE.sm }}>{r.user_email}</Text>
                {r.answers.map((a, j) => (
                  <View key={j} style={{ marginBottom: SPACE.xs }}>
                    <Text style={{ fontSize: 10, color: COLORS.textTer }}>{a.question_text}</Text>
                    <Text style={{ fontSize: FONT.xs, fontWeight: FONT.w6, color: COLORS.text }}>
                      {a.question_type === 'rating' ? `${a.rating_value}★` :
                       a.question_type === 'boolean' ? (a.boolean_value ? 'Yes' : 'No') :
                       a.text_value || '—'}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

/* ── Session Form (Create / Edit) ──────────────────────────────────────── */
function SessionForm({ session, tokens, onBack, onSaved }) {
  const isEdit = !!session;
  const [title, setTitle] = useState(session?.title || '');
  const [day, setDay] = useState(session?.day || 1);
  const [sessionType, setSessionType] = useState(session?.session_type || 'technical');
  const [startDt, setStartDt] = useState(
    session ? `${new Date(session.start_datetime).getFullYear()}-${pad(new Date(session.start_datetime).getMonth()+1)}-${pad(new Date(session.start_datetime).getDate())}T${pad(new Date(session.start_datetime).getHours())}:${pad(new Date(session.start_datetime).getMinutes())}:00` : ''
  );
  const [endDt, setEndDt] = useState(
    session ? `${new Date(session.end_datetime).getFullYear()}-${pad(new Date(session.end_datetime).getMonth()+1)}-${pad(new Date(session.end_datetime).getDate())}T${pad(new Date(session.end_datetime).getHours())}:${pad(new Date(session.end_datetime).getMinutes())}:00` : ''
  );
  const [room, setRoom] = useState(session?.room || '');
  const [desc, setDesc] = useState(session?.description || '');
  const [order, setOrder] = useState(String(session?.display_order ?? 0));
  const [featured, setFeatured] = useState(session?.is_featured || false);
  const [parallel, setParallel] = useState(session?.is_parallel || false);
  const [published, setPublished] = useState(session?.is_published ?? true);
  const [feedbackOn, setFeedbackOn] = useState(session?.feedback_enabled || false);
  const [autoOpen, setAutoOpen] = useState(session?.feedback_auto_open ?? true);
  const [saving, setSaving] = useState(false);

  // Sub-sessions (edit mode)
  const [subs, setSubs] = useState(session?.sub_sessions || []);
  const [showSubForm, setShowSubForm] = useState(false);
  const [subTitle, setSubTitle] = useState('');
  const [subStart, setSubStart] = useState('');
  const [subEnd, setSubEnd] = useState('');


  const save = async () => {
    if (!title.trim()) { Alert.alert('Error', 'Title is required'); return; }
    if (!startDt || !endDt) { Alert.alert('Error', 'Start and end times are required'); return; }
    setSaving(true);
    try {
      const body = {
        day, title: title.trim(), session_type: sessionType,
        start_datetime: new Date(startDt).toISOString(),
        end_datetime: new Date(endDt).toISOString(),
        room: room.trim(), description: desc.trim(),
        display_order: parseInt(order) || 0,
        is_featured: featured, is_parallel: parallel, is_published: published,
        feedback_enabled: feedbackOn, feedback_auto_open: autoOpen,
      };
      const url = isEdit
        ? `${API_URL}/schedule/admin/sessions/${session.id}/update/`
        : `${API_URL}/schedule/admin/sessions/create/`;
      const method = isEdit ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: authH(tokens), body: JSON.stringify(body) });
      const data = await res.json();
      if (data.id) {
        Alert.alert('Success', `Session ${isEdit ? 'updated' : 'created'}.`);
        onSaved(data);
      } else {
        Alert.alert('Error', data.error || JSON.stringify(data));
      }
    } catch (e) { Alert.alert('Error', e.message); }
    setSaving(false);
  };

  const addSub = async () => {
    if (!subTitle.trim()) { Alert.alert('Error', 'Sub-session title required'); return; }
    if (!isEdit) { Alert.alert('Info', 'Save the session first, then add sub-sessions.'); return; }
    try {
      const body = {
        title: subTitle.trim(),
        start_datetime: subStart ? new Date(subStart).toISOString() : null,
        end_datetime: subEnd ? new Date(subEnd).toISOString() : null,
      };
      const res = await fetch(`${API_URL}/schedule/admin/sessions/${session.id}/subsessions/`, {
        method: 'POST', headers: authH(tokens), body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setSubs(prev => [...prev, { id: data.id, title: data.title, start_datetime: subStart || null, end_datetime: subEnd || null }]);
        setSubTitle(''); setSubStart(''); setSubEnd(''); setShowSubForm(false);
      } else { Alert.alert('Error', data.error || 'Failed'); }
    } catch (e) { Alert.alert('Error', e.message); }
  };

  const deleteSub = (subId) => {
    Alert.alert('Delete', 'Remove this sub-session?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await fetch(`${API_URL}/schedule/admin/subsessions/${subId}/delete/`, {
            method: 'DELETE', headers: authH(tokens),
          });
          setSubs(prev => prev.filter(x => x.id !== subId));
        } catch { Alert.alert('Error', 'Failed'); }
      }},
    ]);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: COLORS.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title={isEdit ? 'Edit Session' : 'New Session'} sub={isEdit ? session.title : null} onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: SPACE.xl, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Basic Info */}
        <View style={s.formCard}>
          <Text style={s.formSection}>Basic Information</Text>

          <Text style={s.label}>Title *</Text>
          <TextInput style={s.input} value={title} onChangeText={setTitle}
            placeholder="e.g. Technical Session – 1" placeholderTextColor={COLORS.textTer} />

          <Text style={s.label}>Session Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACE.md }}>
            <View style={{ flexDirection: 'row', gap: SPACE.xs }}>
              {SESSION_TYPES.map(st => (
                <TouchableOpacity key={st.value}
                  style={[s.chip, sessionType === st.value && s.chipOn]}
                  onPress={() => setSessionType(st.value)}>
                  <Text style={[s.chipText, sessionType === st.value && s.chipTextOn]}>{st.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={{ flexDirection: 'row', gap: SPACE.md }}>
            <DateTimeField label="Start *" value={startDt} onChange={setStartDt} />
            <DateTimeField label="End *" value={endDt} onChange={setEndDt} />
          </View>

          <Text style={s.label}>Room / Venue</Text>
          <TextInput style={s.input} value={room} onChangeText={setRoom}
            placeholder="Main Auditorium" placeholderTextColor={COLORS.textTer} />

          <Text style={s.label}>Description</Text>
          <TextInput style={[s.input, { height: 80, textAlignVertical: 'top' }]}
            value={desc} onChangeText={setDesc}
            placeholder="Optional" placeholderTextColor={COLORS.textTer}
            multiline numberOfLines={3} />

          <Text style={s.label}>Display Order</Text>
          <TextInput style={[s.input, { width: 80 }]} value={order} onChangeText={setOrder}
            keyboardType="numeric" placeholder="0" placeholderTextColor={COLORS.textTer} />
        </View>

        {/* Flags */}
        <View style={s.formCard}>
          <Text style={s.formSection}>Flags</Text>
          {[
            { val: published, set: setPublished, label: 'Published', hint: 'Visible in app', icon: 'eye' },
            { val: featured, set: setFeatured, label: '★ Featured', hint: '1-hr push to all', icon: 'star' },
            { val: parallel, set: setParallel, label: 'Parallel', hint: 'Runs alongside another', icon: 'git-compare' },
            { val: feedbackOn, set: setFeedbackOn, label: 'Feedback', hint: 'Enable feedback form', icon: 'chatbox-ellipses' },
            { val: autoOpen, set: setAutoOpen, label: 'Auto-open', hint: 'Open at session end', icon: 'timer' },
          ].map(f => (
            <TouchableOpacity key={f.label} style={s.toggleRow} onPress={() => f.set(!f.val)} activeOpacity={0.7}>
              <Ionicons name={f.icon} size={18} color={f.val ? COLORS.brand : COLORS.textTer} />
              <View style={{ flex: 1 }}>
                <Text style={s.toggleLabel}>{f.label}</Text>
                <Text style={s.toggleHint}>{f.hint}</Text>
              </View>
              <View style={[s.toggle, f.val && s.toggleOnStyle]}>
                <View style={[s.toggleDot, f.val && s.toggleDotOn]} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Sub-sessions (edit mode) */}
        {isEdit && (
          <View style={s.formCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACE.md }}>
              <Text style={s.formSection}>Sub-Sessions ({subs.length})</Text>
              <TouchableOpacity style={s.addSubBtn} onPress={() => setShowSubForm(!showSubForm)}>
                <Ionicons name={showSubForm ? 'close' : 'add'} size={16} color={COLORS.brand} />
                <Text style={{ fontSize: FONT.xs, fontWeight: FONT.w7, color: COLORS.brand }}>
                  {showSubForm ? 'Cancel' : 'Add'}
                </Text>
              </TouchableOpacity>
            </View>

            {showSubForm && (
              <View style={s.subForm}>
                <Text style={s.label}>Title *</Text>
                <TextInput style={s.input} value={subTitle} onChangeText={setSubTitle}
                  placeholder="e.g. Invited Talk" placeholderTextColor={COLORS.textTer} />
                <View style={{ flexDirection: 'row', gap: SPACE.md }}>
                  <DateTimeField label="Start" value={subStart} onChange={setSubStart} />
                  <DateTimeField label="End" value={subEnd} onChange={setSubEnd} />
                </View>
                <TouchableOpacity style={s.saveSubBtn} onPress={addSub} activeOpacity={0.8}>
                  <Ionicons name="checkmark" size={16} color="#fff" />
                  <Text style={{ fontSize: FONT.xs, fontWeight: FONT.w7, color: '#fff' }}>Save Sub-Session</Text>
                </TouchableOpacity>
              </View>
            )}

            {subs.length === 0 && !showSubForm && (
              <Text style={{ fontSize: FONT.xs, color: COLORS.textTer, fontStyle: 'italic' }}>
                No sub-sessions. Tap Add to create one.
              </Text>
            )}
            {subs.map((sub, i) => (
              <View key={sub.id || i} style={s.subItem}>
                <View style={s.subDot} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: FONT.sm, fontWeight: FONT.w6, color: COLORS.text }}>{sub.title}</Text>
                  {sub.start_datetime && (
                    <Text style={{ fontSize: 10, color: COLORS.textTer }}>
                      {fmtTime(sub.start_datetime)}{sub.end_datetime ? ` – ${fmtTime(sub.end_datetime)}` : ''}
                    </Text>
                  )}
                </View>
                <TouchableOpacity onPress={() => deleteSub(sub.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="trash-outline" size={16} color={COLORS.error} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Save */}
        <TouchableOpacity style={s.saveBtn} onPress={save} disabled={saving} activeOpacity={0.8}>
          <LinearGradient colors={[COLORS.brand, COLORS.brandDark]} style={s.saveBtnGrad}>
            {saving ? <ActivityIndicator color="#fff" />
              : <><Ionicons name="checkmark-circle" size={18} color="#fff" /><Text style={s.saveBtnText}>{isEdit ? 'Save Changes' : 'Create Session'}</Text></>}
          </LinearGradient>
        </TouchableOpacity>

        {isEdit && (
          <TouchableOpacity style={s.deleteBtn} activeOpacity={0.7}
            onPress={() => Alert.alert('Delete', `Delete "${session.title}"?`, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: async () => {
                try {
                  await fetch(`${API_URL}/schedule/admin/sessions/${session.id}/delete/`, { method: 'DELETE', headers: authH(tokens) });
                  onSaved(null);
                } catch { Alert.alert('Error', 'Failed'); }
              }},
            ])}>
            <Ionicons name="trash-outline" size={16} color={COLORS.error} />
            <Text style={s.deleteBtnText}>Delete Session</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ── Session Detail ────────────────────────────────────────────────────── */
function SessionDetail({ session: initial, tokens, onBack, onRefresh }) {
  const [sess, setSess] = useState(initial);
  const [view, setView] = useState('detail');

  if (view === 'analytics') return <AnalyticsView session={sess} tokens={tokens} onBack={() => setView('detail')} />;
  if (view === 'edit') return <SessionForm session={sess} tokens={tokens} onBack={() => setView('detail')}
    onSaved={(data) => { if (data) setSess(data); else onBack(); setView('detail'); onRefresh(); }} />;

  const tc = TYPE_COLORS[sess.session_type] || COLORS.textSec;
  const status = sess.status || 'upcoming';

  const toggleFeedback = async () => {
    try {
      const res = await fetch(`${API_URL}/schedule/admin/sessions/${sess.id}/feedback-toggle/`, { method: 'POST', headers: authH(tokens) });
      const data = await res.json();
      if (data.success) setSess(prev => ({ ...prev, feedback_manual_open: data.feedback_manual_open, feedback_open: data.feedback_open }));
    } catch { Alert.alert('Error', 'Failed'); }
  };

  const quickToggle = async (field, val) => {
    try {
      const res = await fetch(`${API_URL}/schedule/admin/sessions/${sess.id}/update/`, {
        method: 'PATCH', headers: authH(tokens), body: JSON.stringify({ [field]: val }),
      });
      const data = await res.json();
      setSess(data); onRefresh();
    } catch {}
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <Header title="Session Details" sub={`Day ${sess.day}`} onBack={onBack}
        right={<TouchableOpacity onPress={() => setView('edit')} style={s.editHeaderBtn}>
          <Ionicons name="create-outline" size={18} color={COLORS.brand} />
        </TouchableOpacity>} />
      <ScrollView contentContainerStyle={{ padding: SPACE.xl, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={s.detailCard}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, marginBottom: SPACE.md }}>
            {sess.is_featured && <Text style={{ fontSize: 18, color: COLORS.accent }}>★</Text>}
            <View style={[s.pill, { backgroundColor: tc + '1A' }]}>
              <Text style={[s.pillText, { color: tc }]}>{(sess.session_type || '').toUpperCase()}</Text>
            </View>
            <View style={[s.pill, {
              backgroundColor: status === 'live' ? COLORS.errorLight : status === 'past' ? COLORS.borderLight : COLORS.brandLight
            }]}>
              <Text style={[s.pillText, {
                color: status === 'live' ? COLORS.error : status === 'past' ? COLORS.textTer : COLORS.brand
              }]}>{status.toUpperCase()}</Text>
            </View>
            {!sess.is_published && <View style={[s.pill, { backgroundColor: COLORS.errorLight }]}><Text style={[s.pillText, { color: COLORS.error }]}>DRAFT</Text></View>}
          </View>
          <Text style={s.detailTitle}>{sess.title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginTop: SPACE.md }}>
            <Ionicons name="time-outline" size={15} color={COLORS.textTer} />
            <Text style={s.detailMeta}>{fmtTime(sess.start_datetime)} – {fmtTime(sess.end_datetime)}</Text>
          </View>
          {!!sess.room && <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginTop: SPACE.xs }}>
            <Ionicons name="location-outline" size={15} color={COLORS.textTer} /><Text style={s.detailMeta}>{sess.room}</Text>
          </View>}
          {!!sess.description && <Text style={s.detailDesc}>{sess.description}</Text>}
        </View>

        {sess.sub_sessions && sess.sub_sessions.length > 0 && (
          <View style={s.detailCard}>
            <Text style={s.cardLabel}>Sub-Sessions ({sess.sub_sessions.length})</Text>
            {sess.sub_sessions.map((sub, i) => (
              <View key={sub.id || i} style={s.subItem}>
                <View style={s.subDot} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: FONT.sm, fontWeight: FONT.w6, color: COLORS.text }}>{sub.title}</Text>
                  {sub.start_datetime && <Text style={{ fontSize: 10, color: COLORS.textTer }}>{fmtTime(sub.start_datetime)}{sub.end_datetime ? ` – ${fmtTime(sub.end_datetime)}` : ''}</Text>}
                </View>
              </View>
            ))}
          </View>
        )}

        <Text style={s.secLabel}>QUICK ACTIONS</Text>
        <View style={{ flexDirection: 'row', gap: SPACE.md, marginBottom: SPACE.md }}>
          <TouchableOpacity style={[s.actionCard, { borderColor: sess.is_published ? COLORS.success : COLORS.border }]}
            onPress={() => quickToggle('is_published', !sess.is_published)}>
            <Ionicons name={sess.is_published ? 'eye' : 'eye-off'} size={22} color={sess.is_published ? COLORS.success : COLORS.textTer} />
            <Text style={s.actionLabel}>{sess.is_published ? 'Published' : 'Draft'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.actionCard, { borderColor: sess.is_featured ? COLORS.accent : COLORS.border }]}
            onPress={() => quickToggle('is_featured', !sess.is_featured)}>
            <Ionicons name={sess.is_featured ? 'star' : 'star-outline'} size={22} color={sess.is_featured ? COLORS.accent : COLORS.textTer} />
            <Text style={s.actionLabel}>{sess.is_featured ? 'Featured' : 'Regular'}</Text>
          </TouchableOpacity>
        </View>

        {sess.feedback_enabled && (
          <View style={s.detailCard}>
            <Text style={s.cardLabel}>Feedback</Text>
            <View style={{ flexDirection: 'row', gap: SPACE.sm, marginBottom: SPACE.md }}>
              <View style={[s.pill, { backgroundColor: sess.feedback_open ? COLORS.successLight : COLORS.warningLight }]}>
                <Text style={[s.pillText, { color: sess.feedback_open ? COLORS.success : COLORS.warning }]}>{sess.feedback_open ? 'OPEN' : 'CLOSED'}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: SPACE.sm }}>
              <TouchableOpacity style={[s.fbBtn, { backgroundColor: sess.feedback_manual_open ? COLORS.errorLight : COLORS.brandLight }]} onPress={toggleFeedback}>
                <Ionicons name={sess.feedback_manual_open ? 'lock-closed' : 'lock-open'} size={14} color={sess.feedback_manual_open ? COLORS.error : COLORS.brand} />
                <Text style={[s.fbBtnText, { color: sess.feedback_manual_open ? COLORS.error : COLORS.brand }]}>{sess.feedback_manual_open ? 'Close' : 'Open'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.fbBtn, { backgroundColor: COLORS.purpleLight }]} onPress={() => setView('analytics')}>
                <Ionicons name="stats-chart" size={14} color={COLORS.purple} />
                <Text style={[s.fbBtnText, { color: COLORS.purple }]}>Analytics</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/* ── Main List ─────────────────────────────────────────────────────────── */
export default function ScheduleAdmin({ tokens, onBack }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dayFilter, setDayFilter] = useState('');
  const [screen, setScreen] = useState(null);

  const load = useCallback(async (isRefresh) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const url = `${API_URL}/schedule/admin/sessions/${dayFilter ? `?day=${dayFilter}` : ''}`;
      const res = await fetch(url, { headers: authH(tokens) });
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch {}
    setLoading(false); setRefreshing(false);
  }, [tokens, dayFilter]);

  useEffect(() => { load(false); }, [load]);

  if (screen?.type === 'detail') return <SessionDetail session={screen.data} tokens={tokens} onBack={() => setScreen(null)} onRefresh={() => load(false)} />;
  if (screen?.type === 'create') return <SessionForm session={null} tokens={tokens} onBack={() => setScreen(null)} onSaved={() => { setScreen(null); load(false); }} />;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <Header title="Manage Sessions" sub={`${sessions.length} sessions`} onBack={onBack}
        right={<TouchableOpacity onPress={() => setScreen({ type: 'create' })} style={s.addHeaderBtn}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>} />

      {/* Fixed day filter bar */}
      <View style={s.filterBar}>
        {DAYS_FILTER.map(d => (
          <TouchableOpacity key={d.key} style={[s.chip, dayFilter === d.key && s.chipOn]}
            onPress={() => setDayFilter(d.key)}>
            <Text style={[s.chipText, dayFilter === d.key && s.chipTextOn]}>{d.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? <ListSkeleton /> : (
        <ScrollView
          contentContainerStyle={{ padding: SPACE.xl, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[COLORS.brand]} />}
        >
          {sessions.length === 0 && (
            <View style={{ alignItems: 'center', padding: SPACE.xxl }}>
              <Ionicons name="calendar-outline" size={48} color={COLORS.textTer} />
              <Text style={{ fontSize: FONT.md, color: COLORS.textSec, marginTop: SPACE.md }}>No sessions</Text>
            </View>
          )}
          {sessions.map(sess => {
            const tc = TYPE_COLORS[sess.session_type] || COLORS.textSec;
            return (
              <TouchableOpacity key={sess.id} style={s.listCard} activeOpacity={0.75}
                onPress={() => setScreen({ type: 'detail', data: sess })}>
                <View style={[s.listBar, { backgroundColor: tc }]} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginBottom: 4 }}>
                    <View style={[s.pill, { backgroundColor: COLORS.brandLight }]}>
                      <Text style={[s.pillText, { color: COLORS.brand }]}>Day {sess.day}</Text>
                    </View>
                    <Text style={s.listTime}>{fmtTime(sess.start_datetime)} – {fmtTime(sess.end_datetime)}</Text>
                    {sess.is_featured && <Text style={{ color: COLORS.accent }}>★</Text>}
                    {!sess.is_published && <View style={[s.pill, { backgroundColor: COLORS.errorLight }]}><Text style={[s.pillText, { color: COLORS.error }]}>DRAFT</Text></View>}
                  </View>
                  <Text style={s.listTitle} numberOfLines={2}>{sess.title}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginTop: SPACE.xs }}>
                    <View style={[s.pill, { backgroundColor: tc + '1A' }]}>
                      <Text style={[s.pillText, { color: tc }]}>{(sess.session_type || '').toUpperCase()}</Text>
                    </View>
                    {!!sess.room && <Text style={{ fontSize: 11, color: COLORS.textTer }}>📍 {sess.room}</Text>}
                    {sess.sub_sessions && sess.sub_sessions.length > 0 && (
                      <Text style={{ fontSize: 11, color: COLORS.textTer }}>↳ {sess.sub_sessions.length} sub</Text>
                    )}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textTer} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

/* ── Styles ────────────────────────────────────────────────────────────── */
const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: TOP, paddingBottom: SPACE.md, paddingHorizontal: SPACE.xl,
    backgroundColor: COLORS.bg, gap: SPACE.md,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#fff',
  },
  headerTitle: { fontSize: FONT.xl, fontWeight: FONT.w9, color: COLORS.brand, letterSpacing: -0.3 },
  headerSub: { fontSize: FONT.xs, color: COLORS.textTer, marginTop: 1 },
  editHeaderBtn: {
    width: 40, height: 40, borderRadius: RADIUS.md,
    backgroundColor: COLORS.brandLight, alignItems: 'center', justifyContent: 'center',
  },
  addHeaderBtn: {
    width: 40, height: 40, borderRadius: RADIUS.md,
    backgroundColor: COLORS.brand, alignItems: 'center', justifyContent: 'center',
  },

  filterBar: { flexDirection: 'row', paddingHorizontal: SPACE.xl, gap: SPACE.sm, paddingBottom: SPACE.sm },
  chip: {
    paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm,
    borderRadius: RADIUS.full, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: '#fff',
  },
  chipOn: { borderColor: COLORS.brand, backgroundColor: COLORS.brandLight },
  chipText: { fontSize: FONT.xs, fontWeight: FONT.w6, color: COLORS.textSec },
  chipTextOn: { color: COLORS.brand, fontWeight: FONT.w7 },

  listCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: RADIUS.lg,
    padding: SPACE.lg, marginBottom: SPACE.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)',
    overflow: 'hidden',
  },
  listBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  listTime: { fontSize: 11, fontWeight: FONT.w6, color: COLORS.textTer },
  listTitle: { fontSize: FONT.sm, fontWeight: FONT.w7, color: COLORS.text },

  pill: { paddingHorizontal: SPACE.sm, paddingVertical: 2, borderRadius: RADIUS.full },
  pillText: { fontSize: 9, fontWeight: FONT.w8, letterSpacing: 0.5 },

  secLabel: { fontSize: 10, fontWeight: FONT.w8, color: COLORS.textTer, letterSpacing: 1.5, marginBottom: SPACE.sm, marginLeft: 4, marginTop: SPACE.md },

  detailCard: {
    backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: RADIUS.xl, padding: SPACE.xl,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', marginBottom: SPACE.lg,
  },
  cardLabel: { fontSize: FONT.sm, fontWeight: FONT.w8, color: COLORS.text, marginBottom: SPACE.md },
  detailTitle: { fontSize: FONT.xl, fontWeight: FONT.w9, color: COLORS.text, letterSpacing: -0.3 },
  detailMeta: { fontSize: FONT.sm, color: COLORS.textSec },
  detailDesc: { fontSize: FONT.sm, color: COLORS.textSec, lineHeight: 20, marginTop: SPACE.md },

  subItem: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm, paddingVertical: SPACE.sm },
  subDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.textTer, marginTop: 5 },

  actionCard: {
    flex: 1, alignItems: 'center', gap: SPACE.sm, padding: SPACE.lg,
    borderRadius: RADIUS.lg, backgroundColor: 'rgba(255,255,255,0.85)', borderWidth: 1.5,
  },
  actionLabel: { fontSize: FONT.xs, fontWeight: FONT.w7, color: COLORS.text },

  fbBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.xs,
    paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, borderRadius: RADIUS.full,
  },
  fbBtnText: { fontSize: FONT.xs, fontWeight: FONT.w7 },

  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.sm,
    paddingVertical: SPACE.md, borderRadius: RADIUS.lg,
    borderWidth: 1.5, borderColor: COLORS.error, backgroundColor: COLORS.errorLight, marginTop: SPACE.lg,
  },
  deleteBtnText: { fontSize: FONT.sm, fontWeight: FONT.w7, color: COLORS.error },

  responseCard: {
    backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: RADIUS.lg,
    padding: SPACE.lg, marginBottom: SPACE.sm, borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)',
  },

  formCard: {
    backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: RADIUS.xl, padding: SPACE.xl,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', marginBottom: SPACE.lg,
  },
  formSection: { fontSize: FONT.md, fontWeight: FONT.w8, color: COLORS.text, marginBottom: SPACE.lg },
  label: { fontSize: FONT.xs, fontWeight: FONT.w7, color: COLORS.textSec, marginBottom: SPACE.xs },
  input: {
    backgroundColor: COLORS.bg, borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.md, paddingVertical: SPACE.md,
    fontSize: FONT.sm, color: COLORS.text,
    borderWidth: 1, borderColor: COLORS.borderLight, marginBottom: SPACE.md,
  },

  dtField: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.sm,
    backgroundColor: COLORS.bg, borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.md, paddingVertical: SPACE.md + 2,
    borderWidth: 1, borderColor: COLORS.borderLight, marginBottom: SPACE.md,
  },
  dtFieldText: { fontSize: FONT.sm, fontWeight: FONT.w6, color: COLORS.text },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.md,
    paddingVertical: SPACE.md, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  toggleLabel: { fontSize: FONT.sm, fontWeight: FONT.w6, color: COLORS.text },
  toggleHint: { fontSize: 10, color: COLORS.textTer, marginTop: 1 },
  toggle: {
    width: 44, height: 24, borderRadius: 12,
    backgroundColor: COLORS.border, justifyContent: 'center', paddingHorizontal: 2,
  },
  toggleOnStyle: { backgroundColor: COLORS.brand },
  toggleDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  toggleDotOn: { alignSelf: 'flex-end' },

  addSubBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.xs,
    paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm,
    borderRadius: RADIUS.full, backgroundColor: COLORS.brandLight,
  },
  subForm: {
    backgroundColor: COLORS.bg, borderRadius: RADIUS.md, padding: SPACE.md, marginBottom: SPACE.md,
  },
  saveSubBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.sm,
    backgroundColor: COLORS.brand, borderRadius: RADIUS.md, paddingVertical: SPACE.md,
  },

  saveBtn: { borderRadius: RADIUS.lg, overflow: 'hidden', marginTop: SPACE.sm, ...SHADOW.brand },
  saveBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACE.sm, paddingVertical: SPACE.lg,
  },
  saveBtnText: { fontSize: FONT.md, fontWeight: FONT.w7, color: '#fff' },
});
