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
    const raw = await AsyncStorage.getItem(`etd2026_schedule_v4_day_${day}`);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    return { data, stale: Date.now() - ts > CACHE_TTL };
  } catch { return null; }
}
async function writeScheduleCache(day, data) {
  try {
    await AsyncStorage.setItem(`etd2026_schedule_v4_day_${day}`, JSON.stringify({ data, ts: Date.now() }));
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
    <View style={{ padding: 16, gap: 14 }}>
      {[1, 2, 3, 4].map(i => (
        <View key={i} style={{
          backgroundColor: '#fff', borderRadius: 18, padding: 18,
          borderWidth: 1, borderColor: COLORS.border, gap: 10,
        }}>
          <Skeleton width={90} height={18} radius={9} />
          <Skeleton width="88%" height={18} />
          <Skeleton width="60%" height={12} radius={6} />
        </View>
      ))}
    </View>
  );
}

/* ── constants ── */
const TABS = [
  { key: 1, label: 'DAY 1', date: 'Oct 23', exactDate: '2026-10-23' },
  { key: 2, label: 'DAY 2', date: 'Oct 24', exactDate: '2026-10-24' },
  { key: 3, label: 'DAY 3', date: 'Oct 25', exactDate: '2026-10-25' },
  { key: 'bookmarks', label: 'SAVED', date: 'My Schedule', icon: 'bookmark' },
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
    if (typeof dt === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(dt.trim())) {
      let [h, m] = dt.trim().split(':');
      let hour = parseInt(h, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      hour = hour % 12 || 12;
      return `${hour.toString().padStart(2, '0')}:${m} ${ampm}`;
    }
    return new Date(dt).toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
    });
  } catch { return ''; }
}

function parseTimeMs(v) {
  if (!v) return NaN;
  if (typeof v === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(v.trim())) {
    const [h, m, s] = v.trim().split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, s || 0, 0);
    return d.getTime();
  }
  return new Date(v).getTime();
}

function getStatus(start, end) {
  if (!start || !end) return 'upcoming';
  const now = Date.now();
  const s = parseTimeMs(start);
  const e = parseTimeMs(end);
  if (isNaN(s) || isNaN(e)) return 'upcoming';
  if (now > e) return 'past';
  if (now >= s && now <= e) return 'live';
  return 'upcoming';
}

function getProgress(start, end) {
  const now = Date.now();
  const s = parseTimeMs(start);
  const e = parseTimeMs(end);
  if (isNaN(s) || isNaN(e)) return 0;
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
function SubRow({ sub, onBookmark, showParent }) {
  const sTime = sub.start_datetime || sub.start_time || sub.time_start;
  const eTime = sub.end_datetime || sub.end_time || sub.time_end;
  const speaker = sub.speaker_name || sub.speaker || (sub.speakers && sub.speakers[0]?.name);
  const parentTitle = showParent && sub.parent_session?.title;

  return (
    <View style={t.subRow}>
      <View style={t.subDot} />
      <View style={{ flex: 1 }}>
        {!!parentTitle && (
          <Text style={t.subParentLabel} numberOfLines={1}>{parentTitle}</Text>
        )}
        <Text style={t.subTitle}>{sub.title}</Text>
        {!!speaker && <Text style={t.subSpeaker}>{speaker}</Text>}
        {(sTime || eTime) ? (
          <Text style={t.subTime}>
            {fmtTime(sTime)}{eTime ? ` – ${fmtTime(eTime)}` : ''}
          </Text>
        ) : null}
      </View>
      {!!onBookmark && (
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onBookmark(sub, 'subsession');
          }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ paddingLeft: 8 }}
        >
          <Ionicons
            name={sub.is_bookmarked ? 'heart' : 'heart-outline'}
            size={20}
            color={sub.is_bookmarked ? COLORS.error : COLORS.textTer}
          />
        </TouchableOpacity>
      )}
    </View>
  );
}

/* ── Paper Row ── */
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, flexWrap: 'wrap' }}>
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
              size={20}
              color={paper.is_bookmarked ? COLORS.error : COLORS.textTer}
            />
          </TouchableOpacity>
        </View>

        <Text style={t.paperTitle} numberOfLines={3}>{paper.title}</Text>

        {!!firstAuthor && (
          <View style={t.paperAuthorRow}>
            <Ionicons name="person-circle-outline" size={14} color={COLORS.textSec} />
            <Text style={t.paperAuthor} numberOfLines={1}>
              {firstAuthor}{paper.authors && paper.authors.includes(',') ? ' et al.' : ''}
            </Text>
          </View>
        )}

        {!!paper.abstract && (
          <View style={{ marginTop: 8 }}>
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
function SessionCard({ session, onBookmark, onFeedback, onOpenPaper }) {
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
      <Animated.View style={{ marginBottom: 16, transform: [{ scale: isLive ? pulseAnim : 1 }] }}>
        {isLive && <NowLine />}
        <TouchableOpacity activeOpacity={0.9} onPress={toggleExpand}>
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
            {session.sub_sessions.map((sub, i) => (
              <SubRow key={sub.id || i} sub={sub} onBookmark={onBookmark} />
            ))}
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
    <View style={[t.card, isPast && t.cardPast, isLive && t.cardLive]}>
      {isLive && (
        <View style={t.progressWrap}>
          <View style={[t.progressBar, { width: `${getProgress(session.start_datetime, session.end_datetime)}%` }]} />
        </View>
      )}

      <View style={t.cardHeader}>
        <View style={[t.typePill, { backgroundColor: meta.bg }]}>
          <Ionicons name={meta.icon} size={12} color={meta.color} />
          <Text style={[t.typeText, { color: meta.color }]}>{(session.session_type || 'session').toUpperCase()}</Text>
        </View>

        <View style={t.headerRight}>
          {isLive && (
            <View style={t.liveBadge}>
              <PulsingDot color="#fff" size={4} />
              <Text style={t.liveBadgeText}>LIVE</Text>
            </View>
          )}
          {isPast && (
            <View style={t.pastBadge}>
              <Ionicons name="checkmark" size={10} color={COLORS.textSec} />
              <Text style={t.pastBadgeText}>DONE</Text>
            </View>
          )}
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onBookmark(session); }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons
              name={session.is_bookmarked ? 'heart' : 'heart-outline'}
              size={21}
              color={session.is_bookmarked ? COLORS.error : COLORS.textTer}
            />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={[t.sessionTitle, isPast && { color: COLORS.textSec }]}>{session.title}</Text>

      <View style={t.metaRow}>
        <View style={t.metaItem}>
          <Ionicons name="time-outline" size={14} color={isLive ? COLORS.error : COLORS.textSec} />
          <Text style={[t.metaText, isLive && { color: COLORS.error, fontWeight: FONT.w8 }]}>
            {fmtTime(session.start_datetime)} – {fmtTime(session.end_datetime)}
          </Text>
        </View>
        {!!session.room && (
          <View style={t.metaItem}>
            <Ionicons name="location-outline" size={14} color={COLORS.textSec} />
            <Text style={t.metaText}>{session.room}</Text>
          </View>
        )}
      </View>

      {session.is_parallel && !isLive && !isPast && (
        <View style={t.parallelBadgeWrap}>
          <View style={t.parallelBadge}>
            <Text style={t.parallelText}>PARALLEL SESSION</Text>
          </View>
        </View>
      )}

      {isPast && session.feedback_open && session.feedback_enabled && (
        <TouchableOpacity style={t.feedbackBtn} onPress={() => onFeedback(session)} activeOpacity={0.8}>
          <Ionicons name="chatbox-ellipses-outline" size={13} color={COLORS.brand} />
          <Text style={t.feedbackBtnText}>Give Feedback</Text>
        </TouchableOpacity>
      )}

      {canExpand && (
        <TouchableOpacity
          style={[t.expandTrigger, expanded && { backgroundColor: meta.color, borderColor: meta.color }]}
          onPress={toggleExpand}
          activeOpacity={0.7}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name={hasPapers ? 'documents-outline' : 'git-merge-outline'} size={14} color={expanded ? '#fff' : meta.color} />
            <Text style={[t.expandText, { color: expanded ? '#fff' : meta.color }]}>
              {hasPapers && hasSubs
                ? `${session.papers.length} Presentations & ${session.sub_sessions.length} Talks`
                : hasPapers
                  ? `${session.papers.length} Presentations`
                  : `${session.sub_sessions.length} Sub-sessions`}
            </Text>
          </View>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={15} color={expanded ? '#fff' : meta.color} />
        </TouchableOpacity>
      )}

      {expanded && hasPapers && (
        <View style={t.expandedArea}>
          {session.papers.map((p, i) => (
            <PaperRow key={p.id || i} paper={p} onOpenPaper={onOpenPaper} onBookmarkClick={onBookmark} />
          ))}
        </View>
      )}

      {expanded && hasSubs && (
        <View style={[t.expandedArea, hasPapers && { marginTop: 24 }]}>
          {hasPapers && (
            <View style={[t.papersHeader, { marginBottom: 8 }]}>
              <Ionicons name="git-merge-outline" size={14} color={COLORS.brand} />
              <Text style={t.papersSectionLabel}>SUB-SESSIONS ({session.sub_sessions.length})</Text>
            </View>
          )}
          {session.sub_sessions.map((sub, i) => (
            <SubRow key={sub.id || i} sub={sub} onBookmark={onBookmark} />
          ))}
        </View>
      )}
    </View>
  );

  return (
    <Animated.View style={{ marginBottom: 16, transform: [{ scale: isLive ? pulseAnim : 1 }] }}>
      {isLive && <NowLine />}
      {isLive ? (
        <LinearGradient colors={['#f43f5e', '#ec4899', '#8b5cf6']} start={{x:0,y:0}} end={{x:1,y:1}} style={t.liveWrapper}>
          {CardInner}
        </LinearGradient>
      ) : CardInner}
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

      <View style={t.featTopRow}>
        <View style={t.featTypeRow}>
          <Ionicons name="star" size={14} color={COLORS.accent} />
          <Text style={t.featType}>{(session.session_type || 'session').toUpperCase()}</Text>
        </View>

        <View style={t.headerRight}>
          {isLive && (
            <View style={t.liveBadge}>
              <PulsingDot color="#fff" size={5} />
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
              size={22}
              color={session.is_bookmarked ? COLORS.error : 'rgba(255,255,255,0.8)'}
            />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={t.featTitle}>{session.title}</Text>

      <View style={t.featMetaRow}>
        <View style={t.metaItem}>
          <Ionicons name="time-outline" size={14} color="#fff" />
          <Text style={t.featTime}>{fmtTime(session.start_datetime)} – {fmtTime(session.end_datetime)}</Text>
        </View>
        {!!session.room && (
          <View style={t.metaItem}>
            <Ionicons name="location-outline" size={14} color="#fff" />
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
          <Ionicons name="chatbox-ellipses-outline" size={13} color="#fff" />
          <Text style={t.feedbackBtnFeatText}>Give Feedback</Text>
        </TouchableOpacity>
      )}

      {canExpand && (
        <View style={t.featExpandHint}>
          <Text style={t.featExpandText}>Tap to expand</Text>
          <Animated.View style={{ transform: [{ rotate }] }}>
            <Ionicons name="chevron-down" size={16} color="rgba(255,255,255,0.7)" />
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
    <Modal visible={visible} transparent animationType="slide" presentationStyle="overFullScreen" onRequestClose={() => onClose(false)}>
      <View style={f.overlay}>
        <TouchableOpacity style={{ flex: 1 }} onPress={() => onClose(false)} />
        <View style={[f.modal, kbHeight > 0 && { height: '85%' }]}>
          <View style={f.header}>
            <View style={{ flex: 1 }}>
              <Text style={f.headerTitle}>Session Feedback</Text>
              {session && <Text style={f.headerSub} numberOfLines={1}>{session.title}</Text>}
            </View>
            <TouchableOpacity onPress={() => onClose(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={COLORS.textTer} />
            </TouchableOpacity>
          </View>
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 20, paddingBottom: kbHeight > 0 ? kbHeight + 20 : 30 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {loading && <ActivityIndicator color={COLORS.brand} style={{ marginTop: 30 }} />}
            {!!error && (
              <View style={f.errBox}>
                <Ionicons name="alert-circle" size={18} color={COLORS.error} />
                <Text style={f.errText}>{error}</Text>
              </View>
            )}
            {alreadyDone && (
              <View style={f.doneBox}>
                <Ionicons name="checkmark-circle" size={36} color={COLORS.success} />
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
                          size={32} color={COLORS.accent}
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
                        <Ionicons name={v ? 'thumbs-up' : 'thumbs-down'} size={16}
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
                        <Ionicons name="send" size={15} color="#fff" />
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
      const endpoint =
        itemType === 'paper' ? 'papers' :
        itemType === 'subsession' ? 'subsessions' :
        'sessions';
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
    <Modal visible={visible} transparent animationType="fade" presentationStyle="overFullScreen" onRequestClose={() => onClose(false)}>
      <View style={f.overlay}>
        <TouchableOpacity style={{ flex: 1 }} onPress={() => onClose(false)} activeOpacity={1} />
        <View style={[f.modal, { maxHeight: 420 }]}>
          <View style={f.header}>
            <View style={{ flex: 1 }}>
              <Text style={f.headerTitle}>Set Reminder</Text>
              {item && <Text style={f.headerSub} numberOfLines={1}>{item.title}</Text>}
            </View>
            <TouchableOpacity onPress={() => onClose(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={COLORS.textTer} />
            </TouchableOpacity>
          </View>
          <View style={{ padding: 20, gap: 8 }}>
            {REMINDER_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[f.reminderRow, selected === opt.value && f.reminderRowOn]}
                onPress={() => { Haptics.selectionAsync(); setSelected(opt.value); }}
                activeOpacity={0.7}
              >
                <Ionicons name={selected === opt.value ? 'radio-button-on' : 'radio-button-off'}
                  size={18} color={selected === opt.value ? COLORS.brand : COLORS.textTer} />
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
                      <Ionicons name="bookmark" size={15} color="#fff" />
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

let _memScheduleDays = { 1: null, 2: null, 3: null };

/* ── Main Screen ── */
export default function ScheduleTab({ tokens, onOpenPaper }) {
  const [activeTab, setActiveTab] = useState(1);
  const [sessions, setSessions] = useState(() => ({
    1: _memScheduleDays[1] || [],
    2: _memScheduleDays[2] || [],
    3: _memScheduleDays[3] || [],
  }));
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(() => !(_memScheduleDays[1]?.length || _memScheduleDays[2]?.length || _memScheduleDays[3]?.length));
  const [refreshing, setRefreshing] = useState(false);
  const [feedbackSession, setFeedbackSession] = useState(null);
  const [reminderItem, setReminderItem] = useState(null);
  const [offline, setOffline] = useState(false);
  const [bookmarkOffline, setBookmarkOffline] = useState(false);
  const scrollRef = useRef(null);
  const liveYPos = useRef(0);

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
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const s = data.sessions || [];
      if (s.length > 0) {
        writeScheduleCache(day, s);
      }
      return { sessions: s, fromCache: false };
    } catch {
      const cached = await readScheduleCache(day);
      if (cached?.data?.length) return { sessions: cached.data, fromCache: true };
      return { sessions: _memScheduleDays[day] || [], fromCache: true };
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
    if (c1?.data?.length || c2?.data?.length || c3?.data?.length) {
      const cachedObj = { 1: c1?.data || [], 2: c2?.data || [], 3: c3?.data || [] };
      _memScheduleDays = cachedObj;
      setSessions(cachedObj);
      setLoading(false);
    }
  }, []);

  const fetchAll = useCallback(async (silent = false, isRefresh = false) => {
    if (!silent && !isRefresh) setLoading(true);
    if (isRefresh) setRefreshing(true);
    const [r1, r2, r3, bm] = await Promise.all([
      fetchDay(1), fetchDay(2), fetchDay(3), fetchBookmarks(),
    ]);
    const nextSessions = { 1: r1.sessions, 2: r2.sessions, 3: r3.sessions };
    _memScheduleDays = nextSessions;
    setSessions(nextSessions);
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
  }, [activeTab]);

  const scrollToLive = () => {
    if (liveYPos.current > 0 && scrollRef.current) {
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
      scrollRef.current.scrollTo({ y: Math.max(0, liveYPos.current - 16), animated: true });
    }
  };

  const handleBookmark = (item, type = 'session') => {
    const itemType =
      type ||
      (item.session_type ? 'session' :
       item.parent_session !== undefined ? 'subsession' :
       'paper');

    const endpoint =
      itemType === 'paper' ? 'papers' :
      itemType === 'subsession' ? 'subsessions' :
      'sessions';

    if (item.is_bookmarked) {
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
      {/* 🌟 Event Branded Header */}
      <LinearGradient
        colors={['#050e2d', '#0a1a5e', '#0333b6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={t.headerGradient}
      >
        <View style={t.auraOrb} />
        
        {/* Top Header Row */}
        <View style={t.headerTopRow}>
          <View>
            <View style={t.brandBadgeRow}>
              <View style={t.brandBadgeDot} />
              <Text style={t.brandBadgeText}>ETD 2026 · IIT DELHI</Text>
            </View>
            <Text style={t.headerTitle}>Event Schedule</Text>
          </View>

          <View style={t.totalPill}>
            <Ionicons name="sparkles" size={13} color="#f59e0b" />
            <Text style={t.totalPillText}>{totalCount} Sessions</Text>
          </View>
        </View>

        {/* 🌟 Calendar Card Day Selector Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={t.tabScroll}>
          {TABS.map((tab) => {
            const on = activeTab === tab.key;
            const count = tab.key === 'bookmarks' ? bookmarks.length : (sessions[tab.key]?.length || 0);

            return (
              <TouchableOpacity
                key={tab.key}
                activeOpacity={0.88}
                style={[t.dayCard, on && t.dayCardOn]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setActiveTab(tab.key);
                }}
              >
                {on ? (
                  <LinearGradient
                    colors={[COLORS.brand, COLORS.brandDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={t.dayCardGrad}
                  >
                    <View style={t.dayCardTopRow}>
                      {tab.icon && <Ionicons name={tab.icon} size={12} color="#fff" style={{ marginRight: 2 }} />}
                      <Text style={t.dayCardLabelActive}>{tab.label}</Text>
                      <View style={t.badgeActive}>
                        <Text style={t.badgeActiveText}>{count}</Text>
                      </View>
                    </View>
                    <Text style={t.dayCardDateActive}>{tab.date}</Text>
                  </LinearGradient>
                ) : (
                  <View style={t.dayCardInner}>
                    <View style={t.dayCardTopRow}>
                      {tab.icon && <Ionicons name={tab.icon} size={12} color="rgba(255,255,255,0.7)" style={{ marginRight: 2 }} />}
                      <Text style={t.dayCardLabel}>{tab.label}</Text>
                      <View style={t.badgeInactive}>
                        <Text style={t.badgeInactiveText}>{count}</Text>
                      </View>
                    </View>
                    <Text style={t.dayCardDate}>{tab.date}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </LinearGradient>

      {!loading && offline && (
        <View style={t.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={14} color={COLORS.purple} />
          <Text style={t.offlineText}>Offline — showing cached schedule</Text>
        </View>
      )}
      {!loading && bookmarkOffline && activeTab === 'bookmarks' && (
        <View style={[t.offlineBanner, { backgroundColor: '#f59e0b22', borderColor: '#f59e0b44' }]}>
          <Ionicons name="wifi-outline" size={14} color={COLORS.warning} />
          <Text style={[t.offlineText, { color: COLORS.warning }]}>Bookmarks need a connection</Text>
        </View>
      )}

      {loading ? (
        <ScheduleSkeleton />
      ) : (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchAll(false, true)} tintColor={COLORS.brand} colors={[COLORS.brand]} />}
        >
          {currentData.length === 0 && (
            <View style={t.empty}>
              <View style={t.emptyIcon}>
                <Ionicons
                  name={activeTab === 'bookmarks' ? 'heart-outline' : 'calendar-outline'}
                  size={36}
                  color={COLORS.textTer}
                />
              </View>
              <Text style={t.emptyTitle}>
                {activeTab === 'bookmarks' ? 'No Saved Items' : 'Free Day!'}
              </Text>
              <Text style={t.emptySub}>
                {activeTab === 'bookmarks'
                  ? 'Save sessions, talks and presentations to build your personal itinerary.'
                  : 'No sessions are scheduled for this day yet.'}
              </Text>
            </View>
          )}

          {currentData.map((item, i) => {
            // Saved paper card
            if (activeTab === 'bookmarks' && item.type === 'paper') {
              return (
                <View key={`p-${item.id || i}`}>
                  <FadeIn delay={i * 30}>
                    <View style={t.savedPaperCard}>
                      <View style={t.savedPaperHeader}>
                        <Ionicons name="document-text" size={13} color={COLORS.brand} />
                        <Text style={t.savedPaperLabel}>SAVED PRESENTATION</Text>
                      </View>
                      <PaperRow
                        paper={{ ...item.paper, is_bookmarked: true }}
                        onOpenPaper={onOpenPaper}
                        onBookmarkClick={(p) => handleBookmark(p, 'paper')}
                      />
                    </View>
                  </FadeIn>
                </View>
              );
            }

            // Saved sub-session (talk) card
            if (activeTab === 'bookmarks' && item.type === 'subsession') {
              return (
                <View key={`sub-${item.id || i}`}>
                  <FadeIn delay={i * 30}>
                    <View style={t.savedPaperCard}>
                      <View style={t.savedPaperHeader}>
                        <Ionicons name="mic-outline" size={13} color={COLORS.purple} />
                        <Text style={[t.savedPaperLabel, { color: COLORS.purple }]}>SAVED TALK</Text>
                      </View>
                      <SubRow
                        sub={{ ...item.sub_session, is_bookmarked: true }}
                        onBookmark={(s) => handleBookmark(s, 'subsession')}
                        showParent
                      />
                    </View>
                  </FadeIn>
                </View>
              );
            }

            // Guard against unknown bookmark types
            if (activeTab === 'bookmarks' && item.type && item.type !== 'session') {
              return null;
            }

            const sess = activeTab === 'bookmarks'
              ? { ...item.session, is_bookmarked: true, bookmark_reminder: item.reminder_minutes }
              : item;

            if (!sess) return null;

            const isLive = getStatus(sess.start_datetime, sess.end_datetime) === 'live';

            return (
              <View
                key={sess.id || i}
                onLayout={(e) => {
                  if (isLive) {
                    liveYPos.current = e.nativeEvent.layout.y;
                  }
                }}
              >
                <FadeIn delay={i * 30}>
                  <SessionCard
                    session={sess}
                    onBookmark={(s, tp) => handleBookmark(s, tp || 'session')}
                    onFeedback={handleFeedback}
                    onOpenPaper={onOpenPaper}
                  />
                </FadeIn>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Floating Jump to Live Button */}
      {hasLive && (
        <TouchableOpacity
          style={t.jumpBtn}
          activeOpacity={0.88}
          onPress={scrollToLive}
        >
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
  /* ── Event Branded Gradient Header ── */
  headerGradient: {
    paddingTop: TOP + 8,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    position: 'relative',
    overflow: 'hidden',
    ...SHADOW.lg,
  },
  auraOrb: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.06)',
    top: -50,
    right: -30,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  brandBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  brandBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#60a5fa',
  },
  brandBadgeText: {
    fontSize: 10,
    fontWeight: FONT.w8,
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: FONT.w9,
    color: '#fff',
    letterSpacing: -0.5,
  },
  totalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  totalPillText: {
    fontSize: 11,
    fontWeight: FONT.w8,
    color: '#fff',
  },

  /* ── Calendar Card Day Selector Tabs ── */
  tabScroll: {
    paddingHorizontal: 16,
    gap: 10,
  },
  dayCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    minWidth: 110,
  },
  dayCardOn: {
    borderColor: '#60a5fa',
    ...SHADOW.brand,
  },
  dayCardInner: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dayCardGrad: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dayCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 4,
  },
  dayCardLabel: {
    fontSize: 11,
    fontWeight: FONT.w9,
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 0.5,
  },
  dayCardLabelActive: {
    fontSize: 11,
    fontWeight: FONT.w9,
    color: '#fff',
    letterSpacing: 0.5,
  },
  dayCardDate: {
    fontSize: 13,
    fontWeight: FONT.w7,
    color: 'rgba(255,255,255,0.95)',
  },
  dayCardDateActive: {
    fontSize: 13,
    fontWeight: FONT.w8,
    color: '#fff',
  },
  badgeInactive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeInactiveText: {
    fontSize: 10,
    fontWeight: FONT.w8,
    color: 'rgba(255,255,255,0.85)',
  },
  badgeActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeActiveText: {
    fontSize: 10,
    fontWeight: FONT.w9,
    color: '#fff',
  },

  /* ── Offline banner ── */
  offlineBanner: {
    backgroundColor: '#7c3aed18',
    borderBottomWidth: 1,
    borderColor: '#7c3aed33',
    paddingHorizontal: 20,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  offlineText: { fontSize: FONT.xs, color: COLORS.purple, fontWeight: FONT.w6 },

  /* ── Live wrapper ── */
  liveWrapper: { padding: 2.5, borderRadius: 20 },

  /* ── Regular Card ── */
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.sm,
  },
  cardPast: { opacity: 0.65, backgroundColor: '#fafbfc' },
  cardLive: { borderWidth: 0, borderRadius: 17.5 },

  progressWrap: {
    height: 3.5,
    backgroundColor: COLORS.borderLight,
    borderRadius: 2,
    marginBottom: 14,
    overflow: 'hidden',
  },
  progressBar: { height: '100%', backgroundColor: COLORS.error, borderRadius: 2 },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  typePill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  typeText: { fontSize: 9.5, fontWeight: FONT.w9, letterSpacing: 0.6 },

  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.error,
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: 8,
  },
  liveBadgeText: { fontSize: 9.5, fontWeight: FONT.w9, color: '#fff', letterSpacing: 0.5 },

  pastBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.borderLight,
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: 8,
  },
  pastBadgeText: { fontSize: 9.5, fontWeight: FONT.w8, color: COLORS.textSec, letterSpacing: 0.5 },

  sessionTitle: {
    fontSize: 16,
    fontWeight: FONT.w9,
    color: COLORS.text,
    lineHeight: 22,
    marginBottom: 12,
    letterSpacing: -0.2,
  },

  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: 12.5,
    fontWeight: FONT.w7,
    color: COLORS.textSec,
  },

  parallelBadgeWrap: {
    marginTop: 10,
    flexDirection: 'row',
  },
  parallelBadge: {
    backgroundColor: COLORS.accentLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  parallelText: {
    fontSize: 9.5,
    fontWeight: FONT.w9,
    color: COLORS.accent,
    letterSpacing: 0.6,
  },

  /* ── Featured card ── */
  featuredCard: {
    borderRadius: 18,
    padding: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: COLORS.brand, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.22, shadowRadius: 12 },
      android: { elevation: 3 },
    }),
  },
  featBlob: {
    position: 'absolute',
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.05)',
    top: -60, right: -40,
  },
  featTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  featTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  featType: {
    fontSize: 9.5,
    fontWeight: FONT.w9,
    color: '#fff',
    letterSpacing: 0.8,
  },
  featTitle: {
    fontSize: 18,
    fontWeight: FONT.w9,
    color: '#fff',
    letterSpacing: -0.3,
    lineHeight: 25,
    marginBottom: 14,
  },
  featMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  featTime: {
    fontSize: 12.5,
    color: '#fff',
    fontWeight: FONT.w7,
  },
  featExpandHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  featExpandText: {
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: FONT.w7,
    letterSpacing: 0.3,
  },

  /* ── Now line ── */
  nowLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  nowDash: { flex: 1, height: 1.5, backgroundColor: COLORS.error },
  nowText: { fontSize: 9.5, fontWeight: FONT.w9, color: COLORS.error, letterSpacing: 0.8 },

  /* ── Expand trigger ── */
  expandTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.bgAlt,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  expandText: { fontSize: 12, fontWeight: FONT.w8 },

  expandedArea: { marginTop: 14 },

  /* ── Sub sessions ── */
  subsContainer: {
    marginLeft: 16,
    marginTop: 6,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.borderLight,
    paddingLeft: 12,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 10,
  },
  subDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: COLORS.brand, marginTop: 5 },
  subParentLabel: {
    fontSize: 10,
    fontWeight: FONT.w7,
    color: COLORS.textTer,
    marginBottom: 2,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  subTitle: { fontSize: 13, fontWeight: FONT.w8, color: COLORS.text, marginBottom: 2, lineHeight: 18 },
  subSpeaker: { fontSize: 11, color: COLORS.textSec, fontWeight: FONT.w6 },
  subTime: { fontSize: 10, color: COLORS.textTer, marginTop: 3, fontWeight: FONT.w7 },

  /* ── Papers ── */
  papersContainer: {
    marginTop: 8,
    marginLeft: 16,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.brandLight,
    paddingLeft: 12,
    paddingBottom: 6,
  },
  papersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  papersSectionLabel: {
    fontSize: 9.5,
    fontWeight: FONT.w9,
    color: COLORS.brand,
    letterSpacing: 1,
  },

  paperRow: {
    flexDirection: 'row',
    marginBottom: 18,
    gap: 8,
  },
  paperTimeline: { width: 16, alignItems: 'center' },
  paperDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.brand, marginTop: 5 },
  paperLine: { width: 2, flex: 1, backgroundColor: COLORS.borderLight, marginTop: 4 },
  paperTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 6,
  },
  paperTime: { fontSize: 11, fontWeight: FONT.w9, color: COLORS.brand },
  paperIdBadge: {
    backgroundColor: COLORS.brandLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  paperIdText: {
    fontSize: 9.5,
    fontWeight: FONT.w8,
    color: COLORS.brand,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  paperTitle: {
    fontSize: 14,
    fontWeight: FONT.w8,
    color: COLORS.text,
    lineHeight: 20,
  },
  paperAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  paperAuthor: {
    fontSize: 11.5,
    color: COLORS.textSec,
    fontWeight: FONT.w6,
    flex: 1,
  },
  paperAbstract: {
    fontSize: 12,
    color: COLORS.textSec,
    lineHeight: 18,
    fontWeight: FONT.w5,
  },
  paperToggle: {
    fontSize: 11,
    fontWeight: FONT.w8,
    color: COLORS.brand,
    marginTop: 4,
  },
  paperReadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.brandLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  paperReadMoreText: { fontSize: 11, fontWeight: FONT.w8, color: COLORS.brand },

  /* ── Feedback ── */
  feedbackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.brandLight,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
  },
  feedbackBtnText: { fontSize: 11, fontWeight: FONT.w8, color: COLORS.brand },
  feedbackBtnFeat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  feedbackBtnFeatText: { fontSize: 11, fontWeight: FONT.w8, color: '#fff' },

  /* ── Empty state ── */
  empty: {
    alignItems: 'center',
    marginTop: 60,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: FONT.w9,
    color: COLORS.text,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 12.5,
    color: COLORS.textSec,
    textAlign: 'center',
    lineHeight: 19,
    fontWeight: FONT.w6,
  },

  /* ── Saved paper card ── */
  savedPaperCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.sm,
  },
  savedPaperHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  savedPaperLabel: {
    fontSize: 9.5,
    fontWeight: FONT.w9,
    color: COLORS.brand,
    letterSpacing: 0.8,
  },

  /* ── Jump to live ── */
  jumpBtn: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 140 : 110,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: COLORS.error,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    ...SHADOW.lg,
  },

  jumpText: { color: '#fff', fontWeight: FONT.w8, fontSize: 12 },
});

const f = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '60%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  headerTitle: { fontSize: FONT.md, fontWeight: FONT.w9, color: COLORS.text },
  headerSub: { fontSize: FONT.xs, color: COLORS.textTer, marginTop: 2 },

  errBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.errorLight,
    padding: 14,
    borderRadius: RADIUS.md,
  },
  errText: { fontSize: FONT.sm, color: COLORS.error, flex: 1 },

  doneBox: { alignItems: 'center', padding: 24, gap: 10 },
  doneTitle: { fontSize: FONT.md, fontWeight: FONT.w8, color: COLORS.success },
  doneSub: { fontSize: FONT.sm, color: COLORS.textSec, textAlign: 'center' },

  qCard: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  qText: { fontSize: FONT.sm, fontWeight: FONT.w7, color: COLORS.text, marginBottom: 12, lineHeight: 18 },

  starRow: { flexDirection: 'row', gap: 8 },

  boolRow: { flexDirection: 'row', gap: 12 },
  boolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  boolBtnOn: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  boolLabel: { fontSize: FONT.sm, fontWeight: FONT.w6, color: COLORS.textSec },

  textInput: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    padding: 12,
    fontSize: FONT.sm,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    minHeight: 70,
  },

  submitBtn: { borderRadius: RADIUS.md, overflow: 'hidden', marginTop: 10, ...SHADOW.brand },
  submitGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  submitText: { fontSize: FONT.sm, fontWeight: FONT.w7, color: '#fff' },

  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
  },
  reminderRowOn: { backgroundColor: COLORS.brandLight },
  reminderLabel: { fontSize: FONT.sm, color: COLORS.textSec },
});