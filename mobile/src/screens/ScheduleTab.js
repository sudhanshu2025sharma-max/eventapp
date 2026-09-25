import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform,
  Animated, ActivityIndicator, Modal, TextInput, Alert, RefreshControl,
  UIManager, LayoutAnimation, Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { COLORS, FONT, SPACE, RADIUS, SHADOW, TOP, API_URL, API_HEADERS } from '../theme';
import { useKeyboardHeight } from '../useKeyboard';
import { FadeIn, PulsingDot } from '../components';
import AsyncStorage from '@react-native-async-storage/async-storage';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  if (!global.nativeFabricUIManager) UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* ── Schedule cache (1-hour TTL) ── */
const CACHE_TTL = 3600000;
async function readScheduleCache(day) {
  try {
    const raw = await AsyncStorage.getItem(`etd2026_schedule_v3_day_${day}`);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    return { data, stale: Date.now() - ts > CACHE_TTL };
  } catch { return null; }
}
async function writeScheduleCache(day, data) {
  try {
    await AsyncStorage.setItem(`etd2026_schedule_v3_day_${day}`, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

/* ── Skeleton ── */
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
    <View style={{ padding: 20, gap: 20 }}>
      {[1, 2, 3, 4].map(i => (
        <View key={i} style={{
          backgroundColor: '#fff', borderRadius: 20, padding: 22,
          borderWidth: 1, borderColor: COLORS.border, gap: 14,
        }}>
          <Skeleton width={90} height={22} radius={11} />
          <Skeleton width="88%" height={20} />
          <Skeleton width="60%" height={14} radius={7} />
        </View>
      ))}
    </View>
  );
}

/* ── constants ── */
const TABS = [
  { key: 1, label: 'Day 1', date: 'Oct 23', exactDate: '2026-10-23' },
  { key: 2, label: 'Day 2', date: 'Oct 24', exactDate: '2026-10-24' },
  { key: 3, label: 'Day 3', date: 'Oct 25', exactDate: '2026-10-25' },
  { key: 'bookmarks', label: 'Saved', date: 'My Schedule', icon: 'bookmark' },
];

const TYPE_META = {
  keynote:   { icon: 'mic-outline',           color: COLORS.purple,  bg: COLORS.purpleLight  },
  technical: { icon: 'code-slash-outline',    color: COLORS.brand,   bg: COLORS.brandLight   },
  workshop:  { icon: 'construct-outline',     color: COLORS.accent,  bg: COLORS.accentLight  },
  break:     { icon: 'cafe-outline',          color: COLORS.success, bg: COLORS.successLight },
  meal:      { icon: 'restaurant-outline',    color: COLORS.success, bg: COLORS.successLight },
  cultural:  { icon: 'musical-notes-outline', color: COLORS.rose,    bg: COLORS.roseLight    },
  panel:     { icon: 'people-outline',        color: COLORS.teal,    bg: COLORS.tealLight    },
  ceremony:  { icon: 'star-outline',          color: COLORS.accent,  bg: COLORS.accentLight  },
  ideathon:  { icon: 'bulb-outline',          color: COLORS.purple,  bg: COLORS.purpleLight  },
  special:   { icon: 'flag-outline',          color: COLORS.textSec, bg: COLORS.borderLight  },
};

const REMINDER_OPTIONS = [
  { value: 5,  label: '5 minutes before' },
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
];

function fmtTime(dt) {
  if (!dt) return '';
  try {
    return new Date(dt).toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
    });
  } catch { return ''; }
}

function getStatus(start, end) {
  if (!start || !end) return 'upcoming';
  const now = Date.now();
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (now > e) return 'past';
  if (now >= s && now <= e) return 'live';
  return 'upcoming';
}

function getProgress(start, end) {
  const now = Date.now();
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (now > e) return 100;
  if (now < s) return 0;
  return ((now - s) / (e - s)) * 100;
}

/* ── Now Indicator Line ── */
function NowLine() {
  return (
    <View style={t.nowLine}>
      <PulsingDot color={COLORS.error} size={8} />
      <View style={t.nowDash} />
      <Text style={t.nowText}>HAPPENING NOW</Text>
    </View>
  );
}

/* ── Sub-session row ── */
function SubRow({ sub }) {
  return (
    <View style={t.subRow}>
      <View style={t.subDot} />
      <View style={{ flex: 1 }}>
        <Text style={t.subTitle}>{sub.title}</Text>
        {!!sub.speaker_name && <Text style={t.subSpeaker}>{sub.speaker_name}</Text>}
        {(sub.start_datetime || sub.end_datetime) ? (
          <Text style={t.subTime}>
            {fmtTime(sub.start_datetime)}{sub.end_datetime ? ` – ${fmtTime(sub.end_datetime)}` : ''}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/* ── Paper Row (with bookmark) ── */
function PaperRow({ paper, onOpenPaper, onBookmarkClick }) {
  const [showAbstract, setShowAbstract] = useState(false);
  const timeStr = paper.start_datetime
    ? fmtTime(paper.start_datetime) + (paper.end_datetime ? ' – ' + fmtTime(paper.end_datetime) : '')
    : '';
  const status = getStatus(paper.start_datetime, paper.end_datetime);
  const isPast = status === 'past';
  const isLive = status === 'live';
  const firstAuthor = (paper.authors || '').split(/[,;]/)[0].trim();
  const abstractPreview = (paper.abstract || '').slice(0, 140);
  const hasMoreAbstract = (paper.abstract || '').length > 140;

  return (
    <View style={[t.paperRow, isPast && { opacity: 0.55 }]}>
      <View style={t.paperTimeline}>
        <View style={[
          t.paperDot,
          isLive && { backgroundColor: COLORS.error, transform: [{ scale: 1.4 }] },
          isPast && { backgroundColor: COLORS.textTer },
        ]} />
        <View style={t.paperLine} />
      </View>

      <View style={{ flex: 1 }}>
        <View style={t.paperTop}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, flexWrap: 'wrap' }}>
            {!!timeStr && (
              <Text style={[t.paperTime, isLive && { color: COLORS.error }]}>{timeStr}</Text>
            )}
            {!!paper.paper_id && (
              <View style={t.paperIdBadge}>
                <Text style={t.paperIdText}>{paper.paper_id}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onBookmarkClick(paper, 'paper'); }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons
              name={paper.is_bookmarked ? 'heart' : 'heart-outline'}
              size={22}
              color={paper.is_bookmarked ? COLORS.error : COLORS.textTer}
            />
          </TouchableOpacity>
        </View>

        <Text style={t.paperTitle} numberOfLines={3}>{paper.title}</Text>

        {!!firstAuthor && (
          <View style={t.paperAuthorRow}>
            <Ionicons name="person-circle-outline" size={15} color={COLORS.textSec} />
            <Text style={t.paperAuthor} numberOfLines={1}>
              {firstAuthor}{paper.authors && paper.authors.includes(',') ? ' et al.' : ''}
            </Text>
          </View>
        )}

        {!!paper.abstract && (
          <View style={{ marginTop: 12 }}>
            <Text style={t.paperAbstract} numberOfLines={showAbstract ? undefined : 3}>
              {showAbstract ? paper.abstract : abstractPreview + (hasMoreAbstract ? '...' : '')}
            </Text>
            {hasMoreAbstract && (
              <TouchableOpacity onPress={() => setShowAbstract(!showAbstract)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={t.paperToggle}>{showAbstract ? 'Show less' : 'Read more'}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {!!onOpenPaper && (
          <TouchableOpacity
            style={t.paperReadMoreBtn}
            onPress={() => onOpenPaper(paper.paper_id || paper.title)}
            activeOpacity={0.7}
          >
            <Ionicons name="document-text-outline" size={13} color={COLORS.brand} />
            <Text style={t.paperReadMoreText}>View in Papers</Text>
            <Ionicons name="arrow-forward" size={12} color={COLORS.brand} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

/* ── Session Card ── */
function SessionCard({ session, onBookmark, onFeedback, onOpenPaper, onLayoutLive }) {
  const [expanded, setExpanded] = useState(false);
  const chevron = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const meta = TYPE_META[session.session_type] || TYPE_META.special;
  const status = getStatus(session.start_datetime, session.end_datetime);
  const isLive = status === 'live';
  const isPast = status === 'past';
  const hasSubs = session.sub_sessions && session.sub_sessions.length > 0;
  const hasPapers = session.papers && session.papers.length > 0;
  const canExpand = hasSubs || hasPapers;

  useEffect(() => {
    if (isLive) {
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.008, duration: 1500, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])).start();
    }
  }, [isLive]);

  const toggleExpand = () => {
    if (!canExpand) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Animated.spring(chevron, {
      toValue: expanded ? 0 : 1,
      tension: 300, friction: 20, useNativeDriver: true,
    }).start();
    setExpanded(!expanded);
  };

  const rotate = chevron.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  // Featured card
  if (session.is_featured) {
    return (
      <Animated.View style={{ marginBottom: 20, transform: [{ scale: isLive ? pulseAnim : 1 }] }}>
        {isLive && <NowLine />}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={toggleExpand}
          onLayout={(e) => { if (isLive && onLayoutLive) onLayoutLive(e.nativeEvent.layout.y); }}
        >
          {isLive ? (
            <LinearGradient colors={['#f43f5e', '#ec4899', '#8b5cf6']} start={{x:0,y:0}} end={{x:1,y:1}} style={t.liveWrapper}>
              <FeaturedInner session={session} isLive isPast={false} onBookmark={onBookmark} onFeedback={onFeedback} canExpand={canExpand} rotate={rotate} />
            </LinearGradient>
          ) : (
            <FeaturedInner session={session} isLive={false} isPast={isPast} onBookmark={onBookmark} onFeedback={onFeedback} canExpand={canExpand} rotate={rotate} />
          )}
        </TouchableOpacity>
        {expanded && hasSubs && (
          <View style={t.subsContainer}>
            {session.sub_sessions.map((sub, i) => <SubRow key={sub.id || i} sub={sub} />)}
          </View>
        )}
        {expanded && hasPapers && (
          <View style={t.papersContainer}>
            <View style={t.papersHeader}>
              <Ionicons name="documents-outline" size={14} color={COLORS.brand} />
              <Text style={t.papersSectionLabel}>PRESENTATIONS ({session.papers.length})</Text>
            </View>
            {session.papers.map((p, i) => <PaperRow key={p.id || i} paper={p} onOpenPaper={onOpenPaper} onBookmarkClick={onBookmark} />)}
          </View>
        )}
      </Animated.View>
    );
  }

  // Regular card
  const CardInner = (
    <View
      style={[t.card, isPast && t.cardPast, isLive && t.cardLive]}
      onLayout={(e) => { if (isLive && onLayoutLive) onLayoutLive(e.nativeEvent.layout.y); }}
    >
      {/* Live progress bar */}
      {isLive && (
        <View style={t.progressWrap}>
          <View style={[t.progressBar, { width: `${getProgress(session.start_datetime, session.end_datetime)}%` }]} />
        </View>
      )}

      {/* Row 1: Type pill + Status + Bookmark */}
      <View style={t.cardHeader}>
        <View style={[t.typePill, { backgroundColor: meta.bg }]}>
          <Ionicons name={meta.icon} size={13} color={meta.color} />
          <Text style={[t.typeText, { color: meta.color }]}>{session.session_type.toUpperCase()}</Text>
        </View>

        <View style={t.headerRight}>
          {isLive && (
            <View style={t.liveBadge}>
              <PulsingDot color="#fff" size={5} />
              <Text style={t.liveBadgeText}>LIVE</Text>
            </View>
          )}
          {isPast && (
            <View style={t.pastBadge}>
              <Ionicons name="checkmark" size={11} color={COLORS.textSec} />
              <Text style={t.pastBadgeText}>DONE</Text>
            </View>
          )}
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onBookmark(session); }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons
              name={session.is_bookmarked ? 'heart' : 'heart-outline'}
              size={23}
              color={session.is_bookmarked ? COLORS.error : COLORS.textTer}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Row 2: Title */}
      <Text style={[t.sessionTitle, isPast && { color: COLORS.textSec }]}>{session.title}</Text>

      {/* Row 3: Meta info */}
      <View style={t.metaRow}>
        <View style={t.metaItem}>
          <Ionicons name="time-outline" size={15} color={isLive ? COLORS.error : COLORS.textSec} />
          <Text style={[t.metaText, isLive && { color: COLORS.error, fontWeight: FONT.w8 }]}>
            {fmtTime(session.start_datetime)} – {fmtTime(session.end_datetime)}
          </Text>
        </View>
        {!!session.room && (
          <View style={t.metaItem}>
            <Ionicons name="location-outline" size={15} color={COLORS.textSec} />
            <Text style={t.metaText}>{session.room}</Text>
          </View>
        )}
      </View>

      {/* Parallel tag - separate row for breathing space */}
      {session.is_parallel && !isLive && !isPast && (
        <View style={t.parallelBadgeWrap}>
          <View style={t.parallelBadge}>
            <Text style={t.parallelText}>PARALLEL SESSION</Text>
          </View>
        </View>
      )}

      {/* Feedback button */}
      {isPast && session.feedback_open && session.feedback_enabled && (
        <TouchableOpacity style={t.feedbackBtn} onPress={() => onFeedback(session)} activeOpacity={0.8}>
          <Ionicons name="chatbox-ellipses-outline" size={14} color={COLORS.brand} />
          <Text style={t.feedbackBtnText}>Give Feedback</Text>
        </TouchableOpacity>
      )}

      {/* Expand trigger */}
      {canExpand && (
        <TouchableOpacity
          style={[t.expandTrigger, expanded && { backgroundColor: meta.color, borderColor: meta.color }]}
          onPress={toggleExpand}
          activeOpacity={0.7}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name={hasPapers ? 'documents-outline' : 'git-merge-outline'} size={15} color={expanded ? '#fff' : meta.color} />
            <Text style={[t.expandText, { color: expanded ? '#fff' : meta.color }]}>
              {hasPapers ? `${session.papers.length} Presentations` : `${session.sub_sessions.length} Sub-sessions`}
            </Text>
          </View>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={expanded ? '#fff' : meta.color} />
        </TouchableOpacity>
      )}

      {expanded && hasPapers && (
        <View style={t.expandedArea}>
          {session.papers.map((p, i) => (
            <PaperRow key={p.id || i} paper={p} onOpenPaper={onOpenPaper} onBookmarkClick={onBookmark} />
          ))}
        </View>
      )}

      {expanded && hasSubs && !hasPapers && (
        <View style={t.expandedArea}>
          {session.sub_sessions.map((sub, i) => <SubRow key={sub.id || i} sub={sub} />)}
        </View>
      )}
    </View>
  );

  return (
    <Animated.View style={{ marginBottom: 20, transform: [{ scale: isLive ? pulseAnim : 1 }] }}>
      {isLive && <NowLine />}
      <TouchableOpacity activeOpacity={0.9} onPress={toggleExpand}>
        {isLive ? (
          <LinearGradient colors={['#f43f5e', '#ec4899', '#8b5cf6']} start={{x:0,y:0}} end={{x:1,y:1}} style={t.liveWrapper}>
            {CardInner}
          </LinearGradient>
        ) : CardInner}
      </TouchableOpacity>
    </Animated.View>
  );
}

/* ── Featured Card Inner ── */
function FeaturedInner({ session, isLive, isPast, onBookmark, onFeedback, canExpand, rotate }) {
  return (
    <LinearGradient
      colors={isLive ? ['#0F172A', '#0333b6'] : [COLORS.brandDeep, COLORS.brand]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={[t.featuredCard, isPast && { opacity: 0.7 }]}
    >
      <View style={t.featBlob} />

      {/* Top row: type + status + bookmark */}
      <View style={t.featTopRow}>
        <View style={t.featTypeRow}>
          <Ionicons name="star" size={15} color={COLORS.accent} />
          <Text style={t.featType}>{session.session_type.toUpperCase()}</Text>
        </View>

        <View style={t.headerRight}>
          {isLive && (
            <View style={t.liveBadge}>
              <PulsingDot color="#fff" size={6} />
              <Text style={t.liveBadgeText}>LIVE</Text>
            </View>
          )}
          {isPast && (
            <View style={[t.pastBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Text style={[t.pastBadgeText, { color: '#fff' }]}>DONE</Text>
            </View>
          )}
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onBookmark(session); }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={session.is_bookmarked ? 'heart' : 'heart-outline'}
              size={24}
              color={session.is_bookmarked ? COLORS.error : 'rgba(255,255,255,0.8)'}
            />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={t.featTitle}>{session.title}</Text>

      <View style={t.featMetaRow}>
        <View style={t.metaItem}>
          <Ionicons name="time-outline" size={15} color="#fff" />
          <Text style={t.featTime}>{fmtTime(session.start_datetime)} – {fmtTime(session.end_datetime)}</Text>
        </View>
        {!!session.room && (
          <View style={t.metaItem}>
            <Ionicons name="location-outline" size={15} color="#fff" />
            <Text style={t.featTime}>{session.room}</Text>
          </View>
        )}
      </View>

      {session.is_parallel && (
        <View style={t.parallelBadgeWrap}>
          <View style={[t.parallelBadge, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
            <Text style={[t.parallelText, { color: '#fff' }]}>PARALLEL SESSION</Text>
          </View>
        </View>
      )}

      {isPast && session.feedback_open && session.feedback_enabled && (
        <TouchableOpacity style={t.feedbackBtnFeat} onPress={() => onFeedback(session)} activeOpacity={0.8}>
          <Ionicons name="chatbox-ellipses-outline" size={14} color="#fff" />
          <Text style={t.feedbackBtnFeatText}>Give Feedback</Text>
        </TouchableOpacity>
      )}

      {canExpand && (
        <View style={t.featExpandHint}>
          <Text style={t.featExpandText}>Tap to expand</Text>
          <Animated.View style={{ transform: [{ rotate }] }}>
            <Ionicons name="chevron-down" size={18} color="rgba(255,255,255,0.7)" />
          </Animated.View>
        </View>
      )}
    </LinearGradient>
  );
}

/* ── Feedback Modal ── */
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
            contentContainerStyle={{ padding: 24, paddingBottom: kbHeight > 0 ? kbHeight + 20 : 30 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {loading && <ActivityIndicator color={COLORS.brand} style={{ marginTop: 40 }} />}
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

/* ── Reminder Modal ── */
function ReminderModal({ visible, item, itemType, tokens, onClose }) {
  const [selected, setSelected] = useState(15);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (visible) { setSelected(15); setSaving(false); } }, [visible]);

  const save = async () => {
    setSaving(true);
    try {
      const endpoint = itemType === 'paper' ? 'papers' : 'sessions';
      await fetch(`${API_URL}/schedule/${endpoint}/${item.id}/bookmark/`, {
        method: 'POST',
        headers: { ...API_HEADERS, Authorization: `Bearer ${tokens.access}` },
        body: JSON.stringify({ reminder_minutes: selected }),
      });
    } catch {}
    setSaving(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose(true);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => onClose(false)}>
      <View style={f.overlay}>
        <TouchableOpacity style={{ flex: 1 }} onPress={() => onClose(false)} activeOpacity={1} />
        <View style={[f.modal, { maxHeight: 440 }]}>
          <View style={f.header}>
            <View style={{ flex: 1 }}>
              <Text style={f.headerTitle}>Set Reminder</Text>
              {item && <Text style={f.headerSub} numberOfLines={1}>{item.title}</Text>}
            </View>
            <TouchableOpacity onPress={() => onClose(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color={COLORS.textTer} />
            </TouchableOpacity>
          </View>
          <View style={{ padding: 24, gap: 10 }}>
            {REMINDER_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[f.reminderRow, selected === opt.value && f.reminderRowOn]}
                onPress={() => { Haptics.selectionAsync(); setSelected(opt.value); }}
                activeOpacity={0.7}
              >
                <Ionicons name={selected === opt.value ? 'radio-button-on' : 'radio-button-off'}
                  size={20} color={selected === opt.value ? COLORS.brand : COLORS.textTer} />
                <Text style={[f.reminderLabel, selected === opt.value && { color: COLORS.brand, fontWeight: FONT.w7 }]}>
                  {opt.label}
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

/* ── Main Screen ── */
export default function ScheduleTab({ tokens, onOpenPaper }) {
  const [activeTab, setActiveTab] = useState(1);
  const [sessions, setSessions] = useState({ 1: [], 2: [], 3: [] });
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [feedbackSession, setFeedbackSession] = useState(null);
  const [reminderItem, setReminderItem] = useState(null);
  const [offline, setOffline] = useState(false);
  const [bookmarkOffline, setBookmarkOffline] = useState(false);
  const scrollRef = useRef(null);
  const liveYPos = useRef(0);
  const hasScrolledToLive = useRef(false);

  const auth = tokens?.access
    ? { ...API_HEADERS, Authorization: `Bearer ${tokens.access}` }
    : API_HEADERS;

  useEffect(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayTab = TABS.find(t => t.exactDate === todayStr);
    if (todayTab) setActiveTab(todayTab.key);
  }, []);

  const fetchDay = useCallback(async (day) => {
    try {
      const res = await fetch(`${API_URL}/schedule/sessions/?day=${day}`, { headers: auth });
      const data = await res.json();
      const s = data.sessions || [];
      writeScheduleCache(day, s);
      return { sessions: s, fromCache: false };
    } catch {
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
      return data.bookmarks || [];
    } catch { setBookmarkOffline(true); return []; }
  }, [tokens]);

  const seedFromCache = useCallback(async () => {
    const [c1, c2, c3] = await Promise.all([
      readScheduleCache(1), readScheduleCache(2), readScheduleCache(3),
    ]);
    if (c1 || c2 || c3) {
      setSessions({ 1: c1?.data || [], 2: c2?.data || [], 3: c3?.data || [] });
      setLoading(false);
    }
  }, []);

  const fetchAll = useCallback(async (silent = false, isRefresh = false) => {
    if (!silent && !isRefresh) setLoading(true);
    if (isRefresh) setRefreshing(true);
    const [r1, r2, r3, bm] = await Promise.all([
      fetchDay(1), fetchDay(2), fetchDay(3), fetchBookmarks(),
    ]);
    setSessions({ 1: r1.sessions, 2: r2.sessions, 3: r3.sessions });
    setBookmarks(bm);
    setOffline(r1.fromCache || r2.fromCache || r3.fromCache);
    setLoading(false);
    setRefreshing(false);
  }, [fetchDay, fetchBookmarks]);

  useEffect(() => {
    seedFromCache().then(() => fetchAll(true));
  }, []);

  useEffect(() => {
    liveYPos.current = 0;
    hasScrolledToLive.current = false;
  }, [activeTab]);

  const scrollToLive = () => {
    if (liveYPos.current > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      scrollRef.current?.scrollTo({ y: Math.max(0, liveYPos.current - 30), animated: true });
    }
  };

  const handleBookmark = (item, type = 'session') => {
    const itemType = type || (item.session_type ? 'session' : 'paper');
    if (item.is_bookmarked) {
      const endpoint = itemType === 'paper' ? 'papers' : 'sessions';
      fetch(`${API_URL}/schedule/${endpoint}/${item.id}/bookmark/`, {
        method: 'POST', headers: auth, body: JSON.stringify({}),
      }).then(() => fetchAll(true));
    } else {
      setReminderItem({ item, type: itemType });
    }
  };

  const handleFeedback = (session) => setFeedbackSession(session);

  const currentData = activeTab === 'bookmarks' ? bookmarks : (sessions[activeTab] || []);
  const hasLive = activeTab !== 'bookmarks' && currentData.some(s => getStatus(s.start_datetime, s.end_datetime) === 'live');
  const totalCount = (sessions[1]?.length || 0) + (sessions[2]?.length || 0) + (sessions[3]?.length || 0);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* Header */}
      <View style={t.header}>
        <View style={t.headerTop}>
          <Text style={t.headerTitle}>Schedule</Text>
          <Text style={t.headerSub}>ETD 2026  ·  {totalCount} Sessions</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={t.tabScroll}>
          {TABS.map((tab) => {
            const on = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[t.tab, on && t.tabOn]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveTab(tab.key); }}
                activeOpacity={0.8}
              >
                {tab.icon && <Ionicons name={tab.icon} size={13} color={on ? '#fff' : COLORS.textSec} style={{ marginRight: 7 }} />}
                <View>
                  <Text style={[t.tabLabel, on && t.tabLabelOn]}>{tab.label}</Text>
                  <Text style={[t.tabDate, on && t.tabDateOn]}>{tab.date}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {!loading && offline && (
        <View style={t.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={15} color={COLORS.purple} />
          <Text style={t.offlineText}>Offline — showing cached schedule</Text>
        </View>
      )}
      {!loading && bookmarkOffline && activeTab === 'bookmarks' && (
        <View style={[t.offlineBanner, { backgroundColor: '#f59e0b22', borderColor: '#f59e0b44' }]}>
          <Ionicons name="wifi-outline" size={15} color={COLORS.warning} />
          <Text style={[t.offlineText, { color: COLORS.warning }]}>Bookmarks need a connection</Text>
        </View>
      )}

      {loading ? (
        <ScheduleSkeleton />
      ) : (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: 20, paddingBottom: 140 }}
          showsVerticalScrollIndicator={false}
          onScroll={() => {
            if (!hasScrolledToLive.current && hasLive && liveYPos.current > 0) {
              hasScrolledToLive.current = true;
              setTimeout(() => scrollToLive(), 300);
            }
          }}
          scrollEventThrottle={200}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchAll(false, true)} tintColor={COLORS.brand} colors={[COLORS.brand]} />}
        >
          {currentData.length === 0 && (
            <View style={t.empty}>
              <View style={t.emptyIcon}>
                <Ionicons
                  name={activeTab === 'bookmarks' ? 'heart-outline' : 'calendar-outline'}
                  size={40}
                  color={COLORS.textTer}
                />
              </View>
              <Text style={t.emptyTitle}>
                {activeTab === 'bookmarks' ? 'No Saved Items' : 'Free Day!'}
              </Text>
              <Text style={t.emptySub}>
                {activeTab === 'bookmarks'
                  ? 'Save sessions and presentations to build your personal itinerary.'
                  : 'No sessions are scheduled for this day yet.'}
              </Text>
            </View>
          )}

          {currentData.map((item, i) => {
            if (activeTab === 'bookmarks' && item.type === 'paper') {
              return (
                <FadeIn key={`p-${i}`} delay={i * 40}>
                  <View style={t.savedPaperCard}>
                    <View style={t.savedPaperHeader}>
                      <Ionicons name="document-text" size={14} color={COLORS.brand} />
                      <Text style={t.savedPaperLabel}>SAVED PRESENTATION</Text>
                    </View>
                    <PaperRow
                      paper={{ ...item.paper, is_bookmarked: true }}
                      onOpenPaper={onOpenPaper}
                      onBookmarkClick={(p) => handleBookmark(p, 'paper')}
                    />
                  </View>
                </FadeIn>
              );
            }

            const sess = activeTab === 'bookmarks'
              ? { ...item.session, is_bookmarked: true, bookmark_reminder: item.reminder_minutes }
              : item;

            return (
              <FadeIn key={sess.id} delay={i * 40}>
                <SessionCard
                  session={sess}
                  onBookmark={(s, tp) => handleBookmark(s, tp || 'session')}
                  onFeedback={handleFeedback}
                  onOpenPaper={onOpenPaper}
                  onLayoutLive={(y) => { liveYPos.current = y; }}
                />
              </FadeIn>
            );
          })}
        </ScrollView>
      )}

      {hasLive && liveYPos.current > 0 && (
        <TouchableOpacity style={t.jumpBtn} activeOpacity={0.85} onPress={scrollToLive}>
          <PulsingDot color="#fff" size={5} />
          <Text style={t.jumpText}>Jump to Live</Text>
          <Ionicons name="arrow-down" size={14} color="#fff" />
        </TouchableOpacity>
      )}

      <FeedbackModal
        visible={!!feedbackSession}
        session={feedbackSession}
        tokens={tokens}
        onClose={(submitted) => {
          setFeedbackSession(null);
          if (submitted) fetchAll(true);
        }}
      />

      <ReminderModal
        visible={!!reminderItem}
        item={reminderItem?.item}
        itemType={reminderItem?.type}
        tokens={tokens}
        onClose={(saved) => {
          setReminderItem(null);
          if (saved) fetchAll(true);
        }}
      />
    </View>
  );
}

/* ── Styles ── */
const t = StyleSheet.create({
  /* ── Header ── */
  header: {
    paddingTop: TOP + 12,
    paddingBottom: 18,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTop: {
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: FONT.w9,
    color: COLORS.brand,
    letterSpacing: -0.6,
    marginBottom: 4,
  },
  headerSub: {
    fontSize: 13,
    color: COLORS.textSec,
    fontWeight: FONT.w6,
  },

  tabScroll: { paddingHorizontal: 20, gap: 10 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgAlt,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabOn: { backgroundColor: COLORS.brand, borderColor: COLORS.brand, ...SHADOW.brand },
  tabLabel: { fontSize: 14, fontWeight: FONT.w8, color: COLORS.text },
  tabLabelOn: { color: '#fff' },
  tabDate: { fontSize: 10, fontWeight: FONT.w6, color: COLORS.textSec, marginTop: 2 },
  tabDateOn: { color: 'rgba(255,255,255,0.75)' },

  /* ── Offline banner ── */
  offlineBanner: {
    backgroundColor: '#7c3aed22',
    borderBottomWidth: 1,
    borderColor: '#7c3aed44',
    paddingHorizontal: 24,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  offlineText: { fontSize: FONT.xs, color: COLORS.purple, fontWeight: FONT.w6 },

  /* ── Live wrapper (rainbow gradient border) ── */
  liveWrapper: { padding: 3, borderRadius: 24 },

  /* ── Regular Card ── */
  card: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.sm,
  },
  cardPast: { opacity: 0.65, backgroundColor: '#fafbfc' },
  cardLive: { borderWidth: 0, borderRadius: 21 },

  /* Live progress bar */
  progressWrap: {
    height: 4,
    backgroundColor: COLORS.borderLight,
    borderRadius: 2,
    marginBottom: 18,
    overflow: 'hidden',
  },
  progressBar: { height: '100%', backgroundColor: COLORS.error, borderRadius: 2 },

  /* Header row */
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  typePill: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  typeText: { fontSize: 10, fontWeight: FONT.w9, letterSpacing: 0.8 },

  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.error,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
  },
  liveBadgeText: { fontSize: 9, fontWeight: FONT.w9, color: '#fff', letterSpacing: 0.5 },

  pastBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.borderLight,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
  },
  pastBadgeText: { fontSize: 9, fontWeight: FONT.w8, color: COLORS.textSec, letterSpacing: 0.5 },

  /* Title */
  sessionTitle: {
    fontSize: 18,
    fontWeight: FONT.w9,
    color: COLORS.text,
    lineHeight: 25,
    marginBottom: 14,
    letterSpacing: -0.2,
  },

  /* Meta */
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 18,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  metaText: {
    fontSize: 13.5,
    fontWeight: FONT.w7,
    color: COLORS.textSec,
  },

  /* Parallel badge - own row */
  parallelBadgeWrap: {
    marginTop: 14,
    flexDirection: 'row',
  },
  parallelBadge: {
    backgroundColor: COLORS.accentLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  parallelText: {
    fontSize: 9,
    fontWeight: FONT.w9,
    color: COLORS.accent,
    letterSpacing: 0.8,
  },

  /* ── Featured card ── */
  featuredCard: {
    borderRadius: 22,
    padding: 24,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: COLORS.brand, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 14 },
      android: { elevation: 4 },
    }),
  },
  featBlob: {
    position: 'absolute',
    width: 220, height: 220, borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.05)',
    top: -70, right: -50,
  },
  featTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  featTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featType: {
    fontSize: 10,
    fontWeight: FONT.w9,
    color: '#fff',
    letterSpacing: 1,
  },
  featTitle: {
    fontSize: FONT.xl,
    fontWeight: FONT.w9,
    color: '#fff',
    letterSpacing: -0.3,
    lineHeight: 30,
    marginBottom: 16,
  },
  featMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 18,
  },
  featTime: {
    fontSize: 13.5,
    color: '#fff',
    fontWeight: FONT.w7,
  },
  featExpandHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  featExpandText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: FONT.w7,
    letterSpacing: 0.3,
  },

  /* ── Now line ── */
  nowLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  nowDash: { flex: 1, height: 1.5, backgroundColor: COLORS.error },
  nowText: { fontSize: 10, fontWeight: FONT.w9, color: COLORS.error, letterSpacing: 1 },

  /* ── Expand trigger ── */
  expandTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.bgAlt,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 14,
    marginTop: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  expandText: { fontSize: 13, fontWeight: FONT.w8 },

  expandedArea: { marginTop: 18 },

  /* ── Sub sessions ── */
  subsContainer: {
    marginLeft: 20,
    marginTop: 8,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.borderLight,
    paddingLeft: 16,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 12,
  },
  subDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.brand, marginTop: 6 },
  subTitle: { fontSize: 14, fontWeight: FONT.w8, color: COLORS.text, marginBottom: 3, lineHeight: 20 },
  subSpeaker: { fontSize: 12, color: COLORS.textSec, fontWeight: FONT.w6 },
  subTime: { fontSize: 11, color: COLORS.textTer, marginTop: 4, fontWeight: FONT.w7 },

  /* ── Papers ── */
  papersContainer: {
    marginTop: 10,
    marginLeft: 20,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.brandLight,
    paddingLeft: 16,
    paddingBottom: 8,
  },
  papersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 16,
  },
  papersSectionLabel: {
    fontSize: 10,
    fontWeight: FONT.w9,
    color: COLORS.brand,
    letterSpacing: 1.2,
  },

  paperRow: {
    flexDirection: 'row',
    marginBottom: 22,
    gap: 10,
  },
  paperTimeline: { width: 20, alignItems: 'center' },
  paperDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.brand, marginTop: 6 },
  paperLine: { width: 2, flex: 1, backgroundColor: COLORS.borderLight, marginTop: 4 },
  paperTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 8,
  },
  paperTime: { fontSize: 12, fontWeight: FONT.w9, color: COLORS.brand },
  paperIdBadge: {
    backgroundColor: COLORS.brandLight,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  paperIdText: {
    fontSize: 10,
    fontWeight: FONT.w8,
    color: COLORS.brand,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  paperTitle: {
    fontSize: 15,
    fontWeight: FONT.w8,
    color: COLORS.text,
    lineHeight: 22,
    letterSpacing: -0.1,
  },
  paperAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  paperAuthor: {
    fontSize: 12.5,
    color: COLORS.textSec,
    fontWeight: FONT.w6,
    flex: 1,
  },
  paperAbstract: {
    fontSize: 13,
    color: COLORS.textSec,
    lineHeight: 20,
    fontWeight: FONT.w5,
  },
  paperToggle: {
    fontSize: 12,
    fontWeight: FONT.w8,
    color: COLORS.brand,
    marginTop: 6,
  },
  paperReadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.brandLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
  },
  paperReadMoreText: { fontSize: 12, fontWeight: FONT.w8, color: COLORS.brand },

  /* ── Feedback ── */
  feedbackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 16,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.brandLight,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 14,
  },
  feedbackBtnText: { fontSize: 12, fontWeight: FONT.w8, color: COLORS.brand },
  feedbackBtnFeat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    alignSelf: 'flex-start',
    marginTop: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  feedbackBtnFeatText: { fontSize: 12, fontWeight: FONT.w8, color: '#fff' },

  /* ── Empty state ── */
  empty: {
    alignItems: 'center',
    marginTop: 80,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: FONT.w9,
    color: COLORS.text,
    marginBottom: 10,
  },
  emptySub: {
    fontSize: 13.5,
    color: COLORS.textSec,
    textAlign: 'center',
    lineHeight: 21,
    fontWeight: FONT.w6,
  },

  /* ── Saved paper card ── */
  savedPaperCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 22,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.sm,
  },
  savedPaperHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 18,
  },
  savedPaperLabel: {
    fontSize: 10,
    fontWeight: FONT.w9,
    color: COLORS.brand,
    letterSpacing: 1,
  },

  /* ── Jump to live ── */
  jumpBtn: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.error,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: RADIUS.full,
    ...SHADOW.lg,
  },
  jumpText: { color: '#fff', fontWeight: FONT.w8, fontSize: 13 },
});

const f = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: '60%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  headerTitle: { fontSize: FONT.lg, fontWeight: FONT.w9, color: COLORS.text },
  headerSub: { fontSize: FONT.xs, color: COLORS.textTer, marginTop: 3 },

  errBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.errorLight,
    padding: 16,
    borderRadius: RADIUS.md,
  },
  errText: { fontSize: FONT.sm, color: COLORS.error, flex: 1 },

  doneBox: { alignItems: 'center', padding: 30, gap: 12 },
  doneTitle: { fontSize: FONT.lg, fontWeight: FONT.w8, color: COLORS.success },
  doneSub: { fontSize: FONT.sm, color: COLORS.textSec, textAlign: 'center' },

  qCard: {
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  qText: { fontSize: FONT.sm, fontWeight: FONT.w7, color: COLORS.text, marginBottom: 14, lineHeight: 20 },

  starRow: { flexDirection: 'row', gap: 10 },

  boolRow: { flexDirection: 'row', gap: 14 },
  boolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  boolBtnOn: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  boolLabel: { fontSize: FONT.sm, fontWeight: FONT.w6, color: COLORS.textSec },

  textInput: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    padding: 14,
    fontSize: FONT.sm,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    minHeight: 80,
  },

  submitBtn: { borderRadius: RADIUS.lg, overflow: 'hidden', marginTop: 12, ...SHADOW.brand },
  submitGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  submitText: { fontSize: FONT.md, fontWeight: FONT.w7, color: '#fff' },

  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: RADIUS.md,
  },
  reminderRowOn: { backgroundColor: COLORS.brandLight },
  reminderLabel: { fontSize: FONT.base, color: COLORS.textSec },
});
