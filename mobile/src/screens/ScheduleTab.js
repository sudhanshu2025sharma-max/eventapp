import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform,
  Animated, ActivityIndicator, Modal, TextInput, Alert, KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONT, SPACE, RADIUS, SHADOW, TOP, API_URL, API_HEADERS } from '../theme';
import { useKeyboardHeight } from '../useKeyboard';
import { FadeIn, PulsingDot, Badge } from '../components';
import AsyncStorage from '@react-native-async-storage/async-storage';

/* ── Schedule cache (1-hour TTL, bypasses cache.js 5-min default) ── */
const CACHE_TTL = 3600000; // 1 hour
async function readScheduleCache(day) {
  try {
    const raw = await AsyncStorage.getItem(`etd2026_schedule_day_${day}`);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    // return stale data regardless of age — caller decides freshness
    return { data, stale: Date.now() - ts > CACHE_TTL };
  } catch { return null; }
}
async function writeScheduleCache(day, data) {
  try {
    await AsyncStorage.setItem(`etd2026_schedule_day_${day}`, JSON.stringify({ data, ts: Date.now() }));
  } catch { /* silent */ }
}

/* ── Skeleton Loading ───────────────────────────────────────────────────── */
function Skeleton({ width, height = 14, radius = 6, style }) {
  const pulse = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.3, duration: 800, useNativeDriver: true }),
    ])).start();
  }, []);
  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: COLORS.border, opacity: pulse }, style]} />;
}

function ScheduleSkeleton() {
  return (
    <View style={{ padding: SPACE.xl, gap: SPACE.md }}>
      {/* Featured skeleton */}
      <View style={{ borderRadius: 24, backgroundColor: COLORS.brandLight, padding: SPACE.xxl, gap: SPACE.md }}>
        <View style={{ flexDirection: "row", gap: SPACE.sm }}>
          <Skeleton width={16} height={16} radius={4} />
          <Skeleton width={70} height={14} radius={RADIUS.full} />
        </View>
        <Skeleton width="75%" height={22} />
        <View style={{ flexDirection: "row", gap: SPACE.sm }}>
          <Skeleton width={100} height={12} radius={RADIUS.full} />
          <Skeleton width={80} height={12} radius={RADIUS.full} />
        </View>
      </View>
      {/* Regular card skeletons */}
      {[1, 2, 3, 4, 5].map(i => (
        <View key={i} style={{
          flexDirection: "row", alignItems: "center",
          backgroundColor: "rgba(255,255,255,0.72)", borderRadius: 20,
          padding: SPACE.lg, borderWidth: 1, borderColor: "rgba(255,255,255,0.9)",
          gap: SPACE.md,
        }}>
          <Skeleton width={44} height={44} radius={RADIUS.md} />
          <View style={{ flex: 1, gap: SPACE.sm }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Skeleton width={100} height={12} radius={RADIUS.full} />
              <Skeleton width={20} height={20} radius={10} />
            </View>
            <Skeleton width="85%" height={14} />
            <View style={{ flexDirection: "row", gap: SPACE.sm }}>
              <Skeleton width={70} height={10} radius={RADIUS.full} />
              <Skeleton width={50} height={10} radius={RADIUS.full} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

/* ── constants ─────────────────────────────────────────────────────────── */
const TABS = [
  { key: 1, label: 'Day 1', date: 'Oct 23' },
  { key: 2, label: 'Day 2', date: 'Oct 24' },
  { key: 3, label: 'Day 3', date: 'Oct 25' },
  { key: 'bookmarks', label: '❤️', date: 'Saved' },
];

const TYPE_META = {
  keynote:   { icon: 'mic-outline',       color: COLORS.purple,  bg: COLORS.purpleLight  },
  technical: { icon: 'code-slash-outline', color: COLORS.brand,   bg: COLORS.brandLight   },
  workshop:  { icon: 'construct-outline',  color: COLORS.accent,  bg: COLORS.accentLight  },
  break:     { icon: 'cafe-outline',       color: COLORS.success, bg: COLORS.successLight },
  meal:      { icon: 'restaurant-outline', color: COLORS.success, bg: COLORS.successLight },
  cultural:  { icon: 'musical-notes-outline', color: COLORS.rose, bg: COLORS.roseLight    },
  panel:     { icon: 'people-outline',     color: COLORS.teal,    bg: COLORS.tealLight    },
  ceremony:  { icon: 'star-outline',       color: COLORS.accent,  bg: COLORS.accentLight  },
  ideathon:  { icon: 'bulb-outline',       color: COLORS.purple,  bg: COLORS.purpleLight  },
  special:   { icon: 'flag-outline',       color: COLORS.textSec, bg: COLORS.borderLight  },
};

const REMINDER_OPTIONS = [
  { value: 5,  label: '5 min' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hour' },
];

function fmtTime(dt) {
  if (!dt) return '';
  const d = new Date(dt);
  // Format in IST (Asia/Kolkata) to avoid timezone ambiguity
  try {
    return d.toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', hour12: false,
      timeZone: 'Asia/Kolkata',
    });
  } catch {
    // Fallback if toLocaleTimeString fails
    const h = d.getUTCHours() + 5;
    const m = d.getUTCMinutes() + 30;
    const adjH = m >= 60 ? h + 1 : h;
    const adjM = m >= 60 ? m - 60 : m;
    return `${String(adjH % 24).padStart(2, '0')}:${String(adjM).padStart(2, '0')}`;
  }
}

function isNow(start, end) {
  const now = Date.now();
  return now >= new Date(start).getTime() && now <= new Date(end).getTime();
}

function isPast(end) {
  return Date.now() > new Date(end).getTime();
}

/* ── Tab Indicator ─────────────────────────────────────────────────────── */
function TabBar({ active, onTab }) {
  const indicatorX = useRef(new Animated.Value(0)).current;
  const idx = TABS.findIndex(t => t.key === active);

  useEffect(() => {
    Animated.spring(indicatorX, {
      toValue: idx * (100 / TABS.length),
      tension: 300, friction: 25, useNativeDriver: false,
    }).start();
  }, [idx]);

  return (
    <View style={t.tabRow}>
      <Animated.View style={[t.indicator, {
        width: `${100 / TABS.length}%`,
        left: indicatorX.interpolate({
          inputRange: [0, 100],
          outputRange: ['0%', '100%'],
        }),
      }]} />
      {TABS.map((tab) => {
        const on = active === tab.key;
        return (
          <TouchableOpacity key={tab.key} style={t.tab} onPress={() => onTab(tab.key)} activeOpacity={0.7}>
            <Text style={[t.tabLabel, on && t.tabLabelOn]}>{tab.label}</Text>
            <Text style={[t.tabDate, on && t.tabDateOn]}>{tab.date}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/* ── Now Indicator Line ────────────────────────────────────────────────── */
function NowLine() {
  return (
    <View style={t.nowLine}>
      <PulsingDot color={COLORS.error} size={8} />
      <View style={t.nowDash} />
      <Text style={t.nowText}>NOW</Text>
    </View>
  );
}

/* ── Sub-session row ───────────────────────────────────────────────────── */
function SubRow({ sub }) {
  return (
    <View style={t.subRow}>
      <View style={t.subDot} />
      <View style={{ flex: 1 }}>
        <Text style={t.subTitle}>{sub.title}</Text>
        {(sub.start_datetime || sub.end_datetime) ? (
          <Text style={t.subTime}>
            {fmtTime(sub.start_datetime)}{sub.end_datetime ? ` – ${fmtTime(sub.end_datetime)}` : ''}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/* ── Session Card ──────────────────────────────────────────────────────── */
function SessionCard({ session, onBookmark, onFeedback }) {
  const [expanded, setExpanded] = useState(false);
  const chevron = useRef(new Animated.Value(0)).current;
  const meta = TYPE_META[session.session_type] || TYPE_META.special;
  const live = isNow(session.start_datetime, session.end_datetime);
  const past = isPast(session.end_datetime);
  const hasSubs = session.sub_sessions && session.sub_sessions.length > 0;

  const toggleExpand = () => {
    if (!hasSubs) return;
    Animated.spring(chevron, {
      toValue: expanded ? 0 : 1,
      tension: 300, friction: 20, useNativeDriver: true,
    }).start();
    setExpanded(!expanded);
  };

  const rotate = chevron.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  // Featured card = gradient
  if (session.is_featured) {
    return (
      <View style={{ marginBottom: SPACE.md }}>
        {live && <NowLine />}
        <TouchableOpacity activeOpacity={0.85} onPress={toggleExpand}>
          <LinearGradient
            colors={[COLORS.brandDeep, COLORS.brand]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[t.featuredCard, live && t.liveGlow]}
          >
            <View style={t.featBlob} />
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.sm }}>
                  <Text style={t.featStar}>★</Text>
                  <Text style={t.featType}>{session.session_type.toUpperCase()}</Text>
                  {live && (
                    <View style={t.liveBadge}>
                      <PulsingDot color="#fff" size={6} />
                      <Text style={t.liveBadgeText}>LIVE</Text>
                    </View>
                  )}
                  {session.is_parallel && (
                    <View style={t.parallelBadge}><Text style={t.parallelText}>PARALLEL</Text></View>
                  )}
                </View>
                <Text style={t.featTitle}>{session.title}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginTop: SPACE.sm }}>
                  <Ionicons name="time-outline" size={13} color="rgb(255, 255, 255)" />
                  <Text style={t.featTime}>{fmtTime(session.start_datetime)} – {fmtTime(session.end_datetime)}</Text>
                  {!!session.room && (
                    <>
                      <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255)' }} />
                      <Ionicons name="location-outline" size={13} color="rgba(255,255,255)" />
                      <Text style={t.featTime}>{session.room}</Text>
                    </>
                  )}
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: SPACE.sm }}>
                <TouchableOpacity onPress={() => onBookmark(session)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name={session.is_bookmarked ? 'heart' : 'heart-outline'} size={22}
                    color={session.is_bookmarked ? COLORS.error : 'rgba(255,255,255,0.5)'} />
                </TouchableOpacity>
                {hasSubs && (
                  <Animated.View style={{ transform: [{ rotate }] }}>
                    <Ionicons name="chevron-down" size={20} color="rgba(255,255,255,0.5)" />
                  </Animated.View>
                )}
              </View>
            </View>
            {/* Feedback button for past featured */}
            {past && session.feedback_open && session.feedback_enabled && (
              <TouchableOpacity style={t.feedbackBtnFeat} onPress={() => onFeedback(session)} activeOpacity={0.8}>
                <Ionicons name="chatbox-ellipses-outline" size={14} color="#fff" />
                <Text style={t.feedbackBtnFeatText}>Give Feedback</Text>
              </TouchableOpacity>
            )}
          </LinearGradient>
        </TouchableOpacity>
        {expanded && hasSubs && (
          <View style={t.subsContainer}>
            {session.sub_sessions.map((sub, i) => <SubRow key={sub.id || i} sub={sub} />)}
          </View>
        )}
      </View>
    );
  }

  // Regular card
  return (
    <View style={{ marginBottom: SPACE.md }}>
      {live && <NowLine />}
      <TouchableOpacity
        style={[t.card, past && { opacity: 0.55 }, live && t.liveCard]}
        activeOpacity={0.82}
        onPress={toggleExpand}
      >
        <View style={[t.typeBar, { backgroundColor: meta.color }]} />
        <View style={[t.iconBox, { backgroundColor: meta.bg }]}>
          <Ionicons name={meta.icon} size={20} color={meta.color} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginBottom: 3 }}>
                <Text style={[t.time, { color: meta.color }]}>{fmtTime(session.start_datetime)} – {fmtTime(session.end_datetime)}</Text>
                {live && (
                  <View style={[t.liveBadge, { backgroundColor: COLORS.error }]}>
                    <PulsingDot color="#fff" size={5} />
                    <Text style={t.liveBadgeText}>LIVE</Text>
                  </View>
                )}
                {session.is_parallel && (
                  <View style={[t.parallelBadge, { backgroundColor: COLORS.warningLight }]}>
                    <Text style={[t.parallelText, { color: COLORS.warning }]}>PARALLEL</Text>
                  </View>
                )}
              </View>
              <Text style={t.sessionTitle}>{session.title}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm }}>
              <TouchableOpacity onPress={() => onBookmark(session)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name={session.is_bookmarked ? 'heart' : 'heart-outline'} size={20}
                  color={session.is_bookmarked ? COLORS.error : COLORS.textTer} />
              </TouchableOpacity>
              {hasSubs && (
                <Animated.View style={{ transform: [{ rotate }] }}>
                  <Ionicons name="chevron-down" size={18} color={COLORS.textTer} />
                </Animated.View>
              )}
            </View>
          </View>
          {!!session.room && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <Ionicons name="location-outline" size={11} color={COLORS.textTer} />
              <Text style={t.metaText}>{session.room}</Text>
            </View>
          )}
          {/* Feedback button for past sessions */}
          {past && session.feedback_open && session.feedback_enabled && (
            <TouchableOpacity style={t.feedbackBtn} onPress={() => onFeedback(session)} activeOpacity={0.8}>
              <Ionicons name="chatbox-ellipses-outline" size={13} color={COLORS.brand} />
              <Text style={t.feedbackBtnText}>Give Feedback</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
      {expanded && hasSubs && (
        <View style={t.subsContainer}>
          {session.sub_sessions.map((sub, i) => <SubRow key={sub.id || i} sub={sub} />)}
        </View>
      )}
    </View>
  );
}

/* ── Feedback Modal ────────────────────────────────────────────────────── */
function FeedbackModal({ visible, session, tokens, onClose }) {
  const kbHeight = useKeyboardHeight();
  const scrollRef = useRef(null);
  const [form, setForm] = useState(null);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [alreadyDone, setAlreadyDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible || !session) return;
    setLoading(true); setError(''); setAlreadyDone(false); setAnswers({});
    (async () => {
      try {
        const res = await fetch(`${API_URL}/schedule/sessions/${session.id}/feedback/`, {
          headers: { ...API_HEADERS, Authorization: `Bearer ${tokens.access}` },
        });
        const data = await res.json();
        if (res.status === 403) { setError(data.error); setLoading(false); return; }
        if (data.already_submitted) { setAlreadyDone(true); setLoading(false); return; }
        if (data.form) { setForm(data.form); }
        else { setError(data.error || 'No form found'); }
      } catch { setError('Network error'); }
      setLoading(false);
    })();
  }, [visible, session]);

  const setAnswer = (qId, key, val) => {
    setAnswers(prev => ({ ...prev, [qId]: { ...prev[qId], question_id: qId, [key]: val } }));
  };

  const submit = async () => {
    if (!form) return;
    // validate required
    for (const q of form.questions) {
      if (!q.is_required) continue;
      const a = answers[q.id];
      if (!a) { Alert.alert('Missing', `Please answer: "${q.question_text}"`); return; }
      if (q.question_type === 'rating' && !a.rating_value) { Alert.alert('Missing', `Please rate: "${q.question_text}"`); return; }
      if (q.question_type === 'boolean' && a.boolean_value == null) { Alert.alert('Missing', `Please answer: "${q.question_text}"`); return; }
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/schedule/sessions/${session.id}/feedback/submit/`, {
        method: 'POST',
        headers: { ...API_HEADERS, Authorization: `Bearer ${tokens.access}` },
        body: JSON.stringify({ answers: Object.values(answers) }),
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert('Thank You! 🎉', data.message || 'Feedback submitted.');
        onClose(true);
      } else {
        Alert.alert('Error', data.error || 'Submit failed');
      }
    } catch { Alert.alert('Error', 'Network error'); }
    setSubmitting(false);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => onClose(false)}>
      <View style={f.overlay}>
        <TouchableOpacity style={{ flex: 1 }} onPress={() => onClose(false)} />
        <View style={[f.modal, kbHeight > 0 && { height: '85%' }]}>
          {/* Header */}
          <View style={f.header}>
            <View style={{ flex: 1 }}>
              <Text style={f.headerTitle}>Session Feedback</Text>
              {session && <Text style={f.headerSub} numberOfLines={1}>{session.title}</Text>}
            </View>
            <TouchableOpacity onPress={() => onClose(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color={COLORS.textTer} />
            </TouchableOpacity>
          </View>

          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: SPACE.xl, paddingBottom: kbHeight > 0 ? kbHeight + 20 : 30 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {loading && <ActivityIndicator color={COLORS.brand} style={{ marginTop: SPACE.xxl }} />}
            {!!error && (
              <View style={f.errBox}>
                <Ionicons name="alert-circle" size={20} color={COLORS.error} />
                <Text style={f.errText}>{error}</Text>
              </View>
            )}
            {alreadyDone && (
              <View style={f.doneBox}>
                <Ionicons name="checkmark-circle" size={40} color={COLORS.success} />
                <Text style={f.doneTitle}>Already Submitted</Text>
                <Text style={f.doneSub}>You've already provided feedback for this session.</Text>
              </View>
            )}
            {form && !alreadyDone && form.questions.map((q, qi) => (
              <View key={q.id} style={f.qCard}>
                <Text style={f.qText}>{qi + 1}. {q.question_text}{q.is_required ? ' *' : ''}</Text>
                {q.question_type === 'rating' && (
                  <View style={f.starRow}>
                    {[1, 2, 3, 4, 5].map(v => (
                      <TouchableOpacity key={v} onPress={() => setAnswer(q.id, 'rating_value', v)} activeOpacity={0.7}>
                        <Ionicons
                          name={(answers[q.id]?.rating_value || 0) >= v ? 'star' : 'star-outline'}
                          size={36} color={COLORS.accent}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {q.question_type === 'boolean' && (
                  <View style={f.boolRow}>
                    {[true, false].map(v => (
                      <TouchableOpacity
                        key={String(v)}
                        style={[f.boolBtn, answers[q.id]?.boolean_value === v && f.boolBtnOn]}
                        onPress={() => setAnswer(q.id, 'boolean_value', v)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name={v ? 'thumbs-up' : 'thumbs-down'} size={18}
                          color={answers[q.id]?.boolean_value === v ? '#fff' : COLORS.textSec} />
                        <Text style={[f.boolLabel, answers[q.id]?.boolean_value === v && { color: '#fff' }]}>
                          {v ? 'Yes' : 'No'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {q.question_type === 'text' && (
                  <TextInput
                    style={f.textInput}
                    placeholder="Your thoughts..."
                    placeholderTextColor={COLORS.textTer}
                    multiline numberOfLines={3}
                    textAlignVertical="top"
                    value={answers[q.id]?.text_value || ''}
                    onChangeText={v => setAnswer(q.id, 'text_value', v)}
                    maxLength={500}
                    onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 350)}
                  />
                )}
              </View>
            ))}
            {form && !alreadyDone && (
              <TouchableOpacity style={f.submitBtn} onPress={submit} disabled={submitting} activeOpacity={0.8}>
                <LinearGradient colors={[COLORS.brand, COLORS.brandDark]} style={f.submitGrad}>
                  {submitting
                    ? <ActivityIndicator color="#fff" />
                    : <>
                        <Ionicons name="send" size={16} color="#fff" />
                        <Text style={f.submitText}>Submit Feedback</Text>
                      </>}
                </LinearGradient>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/* ── Reminder Picker Modal ─────────────────────────────────────────────── */
function ReminderModal({ visible, session, tokens, onClose }) {
  const [selected, setSelected] = useState(5);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await fetch(`${API_URL}/schedule/sessions/${session.id}/bookmark/`, {
        method: 'POST',
        headers: { ...API_HEADERS, Authorization: `Bearer ${tokens.access}` },
        body: JSON.stringify({ reminder_minutes: selected }),
      });
    } catch { /* silent */ }
    setSaving(false);
    onClose(true);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => onClose(false)}>
      <View style={f.overlay}>
        <View style={[f.modal, { maxHeight: 380 }]}>
          <View style={f.header}>
            <View>
              <Text style={f.headerTitle}>Set Reminder</Text>
              {session && <Text style={f.headerSub} numberOfLines={1}>{session.title}</Text>}
            </View>
            <TouchableOpacity onPress={() => onClose(false)}>
              <Ionicons name="close" size={24} color={COLORS.textTer} />
            </TouchableOpacity>
          </View>
          <View style={{ padding: SPACE.xl, gap: SPACE.sm }}>
            {REMINDER_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[f.reminderRow, selected === opt.value && f.reminderRowOn]}
                onPress={() => setSelected(opt.value)}
                activeOpacity={0.7}
              >
                <Ionicons name={selected === opt.value ? 'radio-button-on' : 'radio-button-off'}
                  size={20} color={selected === opt.value ? COLORS.brand : COLORS.textTer} />
                <Text style={[f.reminderLabel, selected === opt.value && { color: COLORS.brand, fontWeight: FONT.w7 }]}>
                  {opt.label} before
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={f.submitBtn} onPress={save} disabled={saving} activeOpacity={0.8}>
              <LinearGradient colors={[COLORS.brand, COLORS.brandDark]} style={f.submitGrad}>
                {saving
                  ? <ActivityIndicator color="#fff" />
                  : <>
                      <Ionicons name="bookmark" size={16} color="#fff" />
                      <Text style={f.submitText}>Bookmark & Remind</Text>
                    </>}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ── Main Screen ───────────────────────────────────────────────────────── */
export default function ScheduleTab({ tokens }) {
  const [activeTab, setActiveTab] = useState(1);
  const [sessions, setSessions] = useState({ 1: [], 2: [], 3: [] });
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedbackSession, setFeedbackSession] = useState(null);
  const [reminderSession, setReminderSession] = useState(null);
  const [offline, setOffline] = useState(false);          // day tabs from cache
  const [bookmarkOffline, setBookmarkOffline] = useState(false); // bookmarks need connection
  const scrollRef = useRef(null);

  const auth = tokens?.access
    ? { ...API_HEADERS, Authorization: `Bearer ${tokens.access}` }
    : API_HEADERS;

  const fetchDay = useCallback(async (day) => {
    try {
      const res = await fetch(`${API_URL}/schedule/sessions/?day=${day}`, { headers: auth });
      const data = await res.json();
      const sessions = data.sessions || [];
      writeScheduleCache(day, sessions); // always refresh cache on success
      return { sessions, fromCache: false };
    } catch {
      // network failed — fall back to cache (stale or fresh)
      const cached = await readScheduleCache(day);
      if (cached) return { sessions: cached.data, fromCache: true };
      return { sessions: [], fromCache: false };
    }
  }, [tokens]);

  const fetchBookmarks = useCallback(async () => {
    if (!tokens?.access) { setBookmarkOffline(true); return []; }
    try {
      const res = await fetch(`${API_URL}/schedule/bookmarks/`, { headers: auth });
      const data = await res.json();
      setBookmarkOffline(false);
      return (data.bookmarks || []).map(b => ({ ...b.session, is_bookmarked: true, bookmark_reminder: b.reminder_minutes }));
    } catch { setBookmarkOffline(true); return []; }
  }, [tokens]);

  // Seed UI from cache immediately, no skeleton shown if cache exists
  const seedFromCache = useCallback(async () => {
    const [c1, c2, c3] = await Promise.all([
      readScheduleCache(1), readScheduleCache(2), readScheduleCache(3),
    ]);
    if (c1 || c2 || c3) {
      setSessions({
        1: c1?.data || [],
        2: c2?.data || [],
        3: c3?.data || [],
      });
      setLoading(false); // show cached data immediately, no skeleton
    }
  }, []);

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const [r1, r2, r3, bm] = await Promise.all([
      fetchDay(1), fetchDay(2), fetchDay(3), fetchBookmarks(),
    ]);
    setSessions({ 1: r1.sessions, 2: r2.sessions, 3: r3.sessions });
    setBookmarks(bm);
    setOffline(r1.fromCache || r2.fromCache || r3.fromCache);
    setLoading(false);
  }, [fetchDay, fetchBookmarks]);

  useEffect(() => {
    // 1. Paint from cache instantly
    seedFromCache().then(() => {
      // 2. Refresh from network silently in background
      fetchAll(true);
    });
  }, []);  // run once on mount — fetchAll via ref avoids stale closure

  // Find detail for expanded sessions
  const fetchDetail = async (id) => {
    try {
      const res = await fetch(`${API_URL}/schedule/sessions/${id}/`, { headers: auth });
      return await res.json();
    } catch { return null; }
  };

  const handleBookmark = async (session) => {
    if (session.is_bookmarked) {
      // Unbookmark
      try {
        await fetch(`${API_URL}/schedule/sessions/${session.id}/bookmark/`, {
          method: 'POST', headers: auth, body: JSON.stringify({}),
        });
        fetchAll();
      } catch { /* silent */ }
    } else {
      // Show reminder picker
      setReminderSession(session);
    }
  };

  const handleFeedback = (session) => {
    setFeedbackSession(session);
  };

  const currentData = activeTab === 'bookmarks'
    ? bookmarks
    : (sessions[activeTab] || []);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* Header */}
      <View style={t.header}>
        <Text style={t.headerTitle}>Schedule</Text>
        <Text style={t.headerSub}>ETD 2026  ·  3 Days  ·  32 Sessions</Text>
        <TabBar active={activeTab} onTab={setActiveTab} />
      </View>

      {/* Offline banner */}
      {!loading && offline && (
        <View style={{ backgroundColor: '#7c3aed22', borderBottomWidth: 1, borderColor: '#7c3aed44',
          paddingHorizontal: SPACE.xl, paddingVertical: SPACE.sm,
          flexDirection: 'row', alignItems: 'center', gap: SPACE.sm }}>
          <Ionicons name="cloud-offline-outline" size={15} color={COLORS.purple} />
          <Text style={{ fontSize: FONT.xs, color: COLORS.purple, fontWeight: FONT.w6 }}>
            Offline — showing cached schedule
          </Text>
        </View>
      )}
      {!loading && bookmarkOffline && activeTab === 'bookmarks' && (
        <View style={{ backgroundColor: '#f59e0b22', borderBottomWidth: 1, borderColor: '#f59e0b44',
          paddingHorizontal: SPACE.xl, paddingVertical: SPACE.sm,
          flexDirection: 'row', alignItems: 'center', gap: SPACE.sm }}>
          <Ionicons name="wifi-outline" size={15} color={COLORS.warning} />
          <Text style={{ fontSize: FONT.xs, color: COLORS.warning, fontWeight: FONT.w6 }}>
            Bookmarks need a connection
          </Text>
        </View>
      )}
      {loading ? (
        <ScheduleSkeleton />
      ) : (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: SPACE.xl, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        >
          {currentData.length === 0 && (
            <View style={{ alignItems: 'center', padding: SPACE.xxl, gap: SPACE.md }}>
              <Ionicons name={activeTab === 'bookmarks' ? 'heart-outline' : 'calendar-outline'}
                size={48} color={COLORS.textTer} />
              <Text style={{ fontSize: FONT.md, fontWeight: FONT.w7, color: COLORS.textSec }}>
                {activeTab === 'bookmarks' ? 'No bookmarked sessions' : 'No sessions scheduled'}
              </Text>
              {activeTab === 'bookmarks' && (
                <Text style={{ fontSize: FONT.sm, color: COLORS.textTer, textAlign: 'center' }}>
                  Tap the ♡ on any session to bookmark it and set a reminder.
                </Text>
              )}
            </View>
          )}
          {currentData.map((sess, i) => (
            <FadeIn key={sess.id} delay={i * 40}>
              <SessionCard
                session={sess}
                onBookmark={handleBookmark}
                onFeedback={handleFeedback}
              />
            </FadeIn>
          ))}
        </ScrollView>
      )}

      {/* Feedback Modal */}
      <FeedbackModal
        visible={!!feedbackSession}
        session={feedbackSession}
        tokens={tokens}
        onClose={(submitted) => {
          setFeedbackSession(null);
          if (submitted) fetchAll();
        }}
      />

      {/* Reminder Modal */}
      <ReminderModal
        visible={!!reminderSession}
        session={reminderSession}
        tokens={tokens}
        onClose={(saved) => {
          setReminderSession(null);
          if (saved) fetchAll();
        }}
      />
    </View>
  );
}

/* ── Styles ────────────────────────────────────────────────────────────── */
const t = StyleSheet.create({
  header: {
    paddingTop: TOP,
    paddingBottom: SPACE.md,
    paddingHorizontal: SPACE.xl,
    backgroundColor: COLORS.bg,
  },
  headerTitle: { fontSize: 28, fontWeight: FONT.w9, color: COLORS.brand, letterSpacing: -0.5 },
  headerSub: { fontSize: FONT.sm, color: COLORS.textblack, marginTop: 3, marginBottom: SPACE.lg },

  tabRow: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: RADIUS.lg, padding: 3, position: 'relative',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)',
  },
  indicator: {
    position: 'absolute', top: 3, bottom: 3,
    backgroundColor: COLORS.brand, borderRadius: RADIUS.lg - 2,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: SPACE.sm, zIndex: 1 },
  tabLabel: { fontSize: FONT.sm, fontWeight: FONT.w7, color: COLORS.textSec },
  tabLabelOn: { color: '#fff' },
  tabDate: { fontSize: 9, color: COLORS.textTer, marginTop: 1 },
  tabDateOn: { color: 'rgba(255,255,255,0.7)' },

  card: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 20, overflow: 'hidden',
    padding: SPACE.lg,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)',
    ...Platform.select({
      ios: { shadowColor: '#002182', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
      android: { elevation: 0 },
    }),
  },
  liveCard: {
    borderColor: COLORS.brand,
    borderWidth: 1.5,
  },
  typeBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  iconBox: { width: 44, height: 44, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', marginRight: SPACE.md },
  time: { fontSize: FONT.xs, fontWeight: FONT.w7 },
  sessionTitle: { fontSize: FONT.sm, fontWeight: FONT.w7, color: COLORS.text, marginBottom: 2 },
  metaText: { fontSize: FONT.xs, color: COLORS.textTer },

  featuredCard: {
    borderRadius: 24, padding: SPACE.xxl, overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: COLORS.brand, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16 },
      android: { elevation: 6 },
    }),
  },
  liveGlow: {
    ...Platform.select({
      ios: { shadowOpacity: 0.5, shadowRadius: 24 },
      android: { elevation: 10 },
    }),
  },
  featBlob: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.05)', top: -60, right: -40 },
  featStar: { fontSize: 16, color: COLORS.accent },
  featType: { fontSize: 10, fontWeight: FONT.w8, color: 'rgba(255,255,255)', letterSpacing: 1 },
  featTitle: { fontSize: FONT.xl, fontWeight: FONT.w9, color: '#fff', letterSpacing: -0.3 },
  featTime: { fontSize: FONT.xs, color: 'rgba(255,255,255)' },

  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.error, paddingHorizontal: SPACE.sm, paddingVertical: 3, borderRadius: RADIUS.full,
  },
  liveBadgeText: { fontSize: 9, fontWeight: FONT.w8, color: '#fff', letterSpacing: 0.5 },

  parallelBadge: {
    backgroundColor: 'rgba(245,158,11,0.2)',
    paddingHorizontal: SPACE.sm, paddingVertical: 2, borderRadius: RADIUS.full,
  },
  parallelText: { fontSize: 9, fontWeight: FONT.w8, color: COLORS.accent, letterSpacing: 0.5 },

  nowLine: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.sm,
    marginBottom: SPACE.sm, paddingHorizontal: SPACE.sm,
  },
  nowDash: { flex: 1, height: 1.5, backgroundColor: COLORS.error },
  nowText: { fontSize: 9, fontWeight: FONT.w8, color: COLORS.error, letterSpacing: 1 },

  subsContainer: {
    marginLeft: SPACE.xxl, marginTop: SPACE.xs,
    borderLeftWidth: 2, borderLeftColor: COLORS.borderLight,
    paddingLeft: SPACE.md,
  },
  subRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm, paddingVertical: SPACE.sm },
  subDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.textTer, marginTop: 5 },
  subTitle: { fontSize: FONT.xs, fontWeight: FONT.w6, color: COLORS.textSec },
  subTime: { fontSize: 10, color: COLORS.textTer, marginTop: 1 },

  feedbackBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.xs,
    marginTop: SPACE.sm, alignSelf: 'flex-start',
    backgroundColor: COLORS.brandLight, paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.xs + 2, borderRadius: RADIUS.full,
  },
  feedbackBtnText: { fontSize: FONT.xs, fontWeight: FONT.w7, color: COLORS.brand },
  feedbackBtnFeat: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, alignSelf: 'flex-start',
    marginTop: SPACE.lg, backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm, borderRadius: RADIUS.full,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  feedbackBtnFeatText: { fontSize: FONT.xs, fontWeight: FONT.w7, color: '#fff' },
});

const f = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    height: '55%',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: SPACE.xl, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  headerTitle: { fontSize: FONT.lg, fontWeight: FONT.w9, color: COLORS.text },
  headerSub: { fontSize: FONT.xs, color: COLORS.textTer, marginTop: 2 },

  errBox: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.sm,
    backgroundColor: COLORS.errorLight, padding: SPACE.lg, borderRadius: RADIUS.md,
  },
  errText: { fontSize: FONT.sm, color: COLORS.error, flex: 1 },

  doneBox: { alignItems: 'center', padding: SPACE.xxl, gap: SPACE.md },
  doneTitle: { fontSize: FONT.lg, fontWeight: FONT.w8, color: COLORS.success },
  doneSub: { fontSize: FONT.sm, color: COLORS.textSec, textAlign: 'center' },

  qCard: {
    marginBottom: SPACE.xl, paddingBottom: SPACE.lg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  qText: { fontSize: FONT.sm, fontWeight: FONT.w7, color: COLORS.text, marginBottom: SPACE.md, lineHeight: 20 },

  starRow: { flexDirection: 'row', gap: SPACE.sm },

  boolRow: { flexDirection: 'row', gap: SPACE.md },
  boolBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.sm,
    paddingVertical: SPACE.md, paddingHorizontal: SPACE.xl,
    borderRadius: RADIUS.lg, borderWidth: 1.5, borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  boolBtnOn: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  boolLabel: { fontSize: FONT.sm, fontWeight: FONT.w6, color: COLORS.textSec },

  textInput: {
    backgroundColor: COLORS.bg, borderRadius: RADIUS.md,
    padding: SPACE.md, fontSize: FONT.sm, color: COLORS.text,
    borderWidth: 1, borderColor: COLORS.borderLight,
    minHeight: 80,
  },

  submitBtn: { borderRadius: RADIUS.lg, overflow: 'hidden', marginTop: SPACE.md, ...SHADOW.brand },
  submitGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACE.sm, paddingVertical: SPACE.lg, paddingHorizontal: SPACE.xl,
  },
  submitText: { fontSize: FONT.md, fontWeight: FONT.w7, color: '#fff' },

  reminderRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.md,
    paddingVertical: SPACE.md, paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.md,
  },
  reminderRowOn: { backgroundColor: COLORS.brandLight },
  reminderLabel: { fontSize: FONT.base, color: COLORS.textSec },
});
