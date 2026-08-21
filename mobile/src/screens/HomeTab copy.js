import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Image,
  StyleSheet, Platform, StatusBar, Animated, Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, SPACE, RADIUS, SHADOW, API_URL, API_HEADERS, fixMediaUrl } from '../theme';
import { apiFetch, setTokens as setApiTokens } from '../api';
import { PulsingDot, GradientAvatar } from '../components';

const PAD = SPACE.xl;
const TIMELINE_WINDOW = 3;

const QUICK = [
  { icon: 'calendar-outline',    label: 'Schedule',    color: COLORS.brand,   bg: COLORS.brandLight,   action: 'schedule' },
  { icon: 'ribbon-outline',      label: 'Sponsors',    color: COLORS.brand,   bg: COLORS.brandLight,   action: 'sponsors' },
  { icon: 'mic-outline',         label: 'Speakers',    color: COLORS.purple,  bg: COLORS.purpleLight,  action: 'speakers' },
  { icon: 'camera-outline',      label: 'Photos',      color: COLORS.success, bg: COLORS.successLight, action: 'photos' },
  { icon: 'newspaper-outline',   label: 'Feed',        color: COLORS.purple,  bg: COLORS.purpleLight,  action: 'feed' },
  { icon: 'people-outline',      label: 'Directory',   color: COLORS.teal,    bg: COLORS.tealLight     },
  { icon: 'stats-chart-outline', label: 'Polls',       color: COLORS.accent,  bg: COLORS.accentLight,  action: 'polls' },
  { icon: 'bulb-outline',         label: 'Ideathon',    color: COLORS.purple,  bg: COLORS.purpleLight,  action: 'ideathon' },
  { icon: 'trophy-outline',      label: 'Leaderboard', color: COLORS.rose,    bg: COLORS.roseLight,    action: 'leaderboard' },
];

const TYPE_STYLE = {
  keynote:   { icon: 'mic-outline',           color: COLORS.purple,  bg: COLORS.purpleLight,  label: 'Keynote'   },
  technical: { icon: 'hardware-chip-outline', color: COLORS.brand,   bg: COLORS.brandLight,   label: 'Technical' },
  workshop:  { icon: 'construct-outline',     color: COLORS.accent,  bg: COLORS.accentLight,  label: 'Workshop'  },
  break:     { icon: 'cafe-outline',          color: COLORS.success, bg: COLORS.successLight, label: 'Break'     },
  meal:      { icon: 'restaurant-outline',    color: COLORS.success, bg: COLORS.successLight, label: 'Meal'      },
  cultural:  { icon: 'musical-notes-outline', color: COLORS.rose,    bg: COLORS.roseLight,    label: 'Cultural'  },
  panel:     { icon: 'people-outline',        color: COLORS.teal,    bg: COLORS.tealLight,    label: 'Panel'     },
  ceremony:  { icon: 'sparkles-outline',      color: COLORS.purple,  bg: COLORS.purpleLight,  label: 'Ceremony'  },
  ideathon:  { icon: 'bulb-outline',          color: COLORS.accent,  bg: COLORS.accentLight,  label: 'Ideathon'  },
  special:   { icon: 'star-outline',          color: COLORS.brand,   bg: COLORS.brandLight,   label: 'Special'   },
  paper:     { icon: 'document-outline',      color: COLORS.teal,    bg: COLORS.tealLight,    label: 'Paper'     },
  poster:    { icon: 'images-outline',        color: COLORS.rose,    bg: COLORS.roseLight,    label: 'Poster'    },
  other:     { icon: 'ellipse-outline',       color: COLORS.textSec, bg: '#eef2f7',           label: 'Session'   },
};

const DEFAULT_CONF = {
  name: 'ETD 2026', tagline: 'IIT Delhi', logo_url: null,
  start_date: '2026-10-23', end_date: '2026-10-25',
};

function confDay(start) {
  if (!start) return 1;
  return Math.max(1, Math.floor((Date.now() - new Date(start).getTime()) / 86400000) + 1);
}
function totalDays(start, end) {
  if (!start || !end) return 3;
  return Math.max(1, Math.round((new Date(end) - new Date(start)) / 86400000) + 1);
}
function currentConferenceDay(start, end) {
  return Math.min(totalDays(start, end), confDay(start));
}

function getEventDate(ev, which = 'start') {
  const iso = which === 'end' ? ev.end_datetime : ev.start_datetime;
  if (iso) { const d = new Date(iso); if (!Number.isNaN(d.getTime())) return d; }
  return null;
}

function formatTime(d) {
  if (!d) return '';
  try {
    return d.toLocaleTimeString('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    });
  } catch {
    const total = d.getUTCHours() * 60 + d.getUTCMinutes() + 330; // +05:30
    const mins = ((total % 1440) + 1440) % 1440;
    const h24 = Math.floor(mins / 60);
    const m = mins % 60;
    const ampm = h24 >= 12 ? 'PM' : 'AM';
    const h12 = h24 % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  }
}

function formatRange(ev) {
  const s = getEventDate(ev, 'start');
  const e = getEventDate(ev, 'end');
  if (!s) return '';
  return e ? `${formatTime(s)} – ${formatTime(e)}` : formatTime(s);
}

function classifyAndSort(events) {
  const now = new Date();
  return events.map(e => {
    const start = getEventDate(e, 'start');
    const end = getEventDate(e, 'end');
    let status = e.status;
    if (status === 'live') status = 'current';
    else if (status === 'upcoming') status = 'next';
    if (!status && start && end) {
      if (now >= start && now < end) status = 'current';
      else if (now >= end) status = 'past';
      else status = 'next';
    }
    return { ...e, status: status || 'next', startMs: start ? start.getTime() : 0 };
  }).sort((a, b) => a.startMs - b.startMs || (a.display_order || 0) - (b.display_order || 0));
}

function smartWindow(sorted, max) {
  if (sorted.length <= max) return sorted;
  const anchor = sorted.findIndex(e => e.status === 'current' || e.status === 'next');
  if (anchor === -1) return sorted.slice(-max);
  const start = Math.max(0, Math.min(anchor, sorted.length - max));
  return sorted.slice(start, start + max);
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function TimelineCard({ ev, index, total, expanded, onToggle, anim }) {
  const ts = TYPE_STYLE[ev.session_type || ev.event_type] || TYPE_STYLE.other;
  const isCurrent = ev.status === 'current';
  const isPast = ev.status === 'past';
  const isFeatured = !!ev.is_featured;
  const isLast = index === total - 1;

  const slideX = anim.interpolate({ inputRange: [0, 1], outputRange: [60, 0] });
  const scale = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.88, 0.96, 1] });
  const rotateZ = anim.interpolate({ inputRange: [0, 1], outputRange: ['2deg', '0deg'] });

  const cardInner = isFeatured ? (
    <LinearGradient
      colors={isCurrent ? ['#1a3a8f', COLORS.brand] : [COLORS.brand, '#5b7cfa']}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={[s.card, s.featuredCard, isPast && s.pastCard]}
    >
      <View style={s.cardTopRow}>
        <View style={[s.typePill, s.typePillFeatured]}>
          <Ionicons name={ts.icon} size={13} color="#fff" />
          <Text style={s.typePillFeaturedText}>{ts.label}</Text>
        </View>
        <View style={s.cardTopRight}>
          {isCurrent && (
            <View style={s.liveBadge}>
              <PulsingDot color="#fff" size={6} />
              <Text style={s.liveBadgeText}>LIVE</Text>
            </View>
          )}
          {isPast && <View style={s.doneBadge}><Text style={s.doneBadgeText}>DONE</Text></View>}
        </View>
      </View>
      <Text style={s.titleFeatured} numberOfLines={expanded ? 4 : 2}>{ev.title}</Text>
      <View style={s.metaRow}>
        <View style={s.metaItem}>
          <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.7)" />
          <Text style={s.metaTextFeatured}>{formatRange(ev)}</Text>
        </View>
        {!!ev.room && (
          <View style={s.metaItem}>
            <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.7)" />
            <Text style={s.metaTextFeatured}>{ev.room}</Text>
          </View>
        )}
      </View>
      <View style={s.badgeRow}>
        <View style={s.ghostBadge}><Ionicons name="star" size={10} color="#fde68a" /><Text style={s.ghostBadgeText}>Featured</Text></View>
        {ev.is_parallel && <View style={s.ghostBadge}><Text style={s.ghostBadgeText}>Parallel</Text></View>}
        <View style={s.ghostBadge}><Text style={s.ghostBadgeText}>Day {ev.day}</Text></View>
      </View>
      {expanded && (
        <Animated.View style={s.expandedWrap}>
          <View style={s.expandDividerFeatured} />
          {!!ev.speaker && (
            <View style={s.expandMetaRow}>
              <Ionicons name="person-circle-outline" size={16} color="rgba(255,255,255,0.8)" />
              <Text style={s.expandMetaFeatured}>{ev.speaker}</Text>
            </View>
          )}
          {!!ev.description && <Text style={s.expandDescFeatured}>{ev.description}</Text>}
          {ev.feedback_enabled && (
            <View style={[s.expandMetaRow, { marginTop: SPACE.sm }]}>
              <Ionicons name="chatbox-ellipses-outline" size={14} color="rgba(255,255,255,0.7)" />
              <Text style={s.expandMetaFeatured}>Feedback enabled</Text>
            </View>
          )}
        </Animated.View>
      )}
      <View style={s.chevronRow}>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color="rgba(255,255,255,0.5)" />
      </View>
    </LinearGradient>
  ) : (
    <View style={[s.card, isCurrent && s.currentCard, isPast && s.pastCard]}>
      <View style={[s.accentBar, { backgroundColor: ts.color }]} />
      <View style={s.cardTopRow}>
        <View style={[s.typePill, { backgroundColor: ts.bg }]}>
          <Ionicons name={ts.icon} size={13} color={ts.color} />
          <Text style={[s.typePillText, { color: ts.color }]}>{ts.label}</Text>
        </View>
        <View style={s.cardTopRight}>
          {isCurrent && (
            <View style={s.liveBadge}>
              <PulsingDot color="#fff" size={6} />
              <Text style={s.liveBadgeText}>LIVE</Text>
            </View>
          )}
          {isPast && <View style={s.doneBadge}><Text style={s.doneBadgeText}>DONE</Text></View>}
        </View>
      </View>
      <Text style={s.title} numberOfLines={expanded ? 4 : 2}>{ev.title}</Text>
      <View style={s.metaRow}>
        <View style={s.metaItem}>
          <Ionicons name="time-outline" size={14} color={COLORS.textTer} />
          <Text style={s.metaText}>{formatRange(ev)}</Text>
        </View>
        {!!ev.room && (
          <View style={s.metaItem}>
            <Ionicons name="location-outline" size={14} color={COLORS.textTer} />
            <Text style={s.metaText}>{ev.room}</Text>
          </View>
        )}
      </View>
      <View style={s.badgeRow}>
        <View style={s.softBadge}><Text style={s.softBadgeText}>Day {ev.day}</Text></View>
        {ev.is_parallel && <View style={s.softBadge}><Text style={s.softBadgeText}>Parallel</Text></View>}
        {ev.feedback_enabled && <View style={s.softBadge}><Ionicons name="chatbox-ellipses-outline" size={10} color={COLORS.textSec} /><Text style={s.softBadgeText}>Feedback</Text></View>}
      </View>
      {expanded && (
        <Animated.View style={s.expandedWrap}>
          <View style={s.expandDivider} />
          {!!ev.speaker && (
            <View style={s.expandMetaRow}>
              <Ionicons name="person-circle-outline" size={16} color={COLORS.textSec} />
              <Text style={s.expandMeta}>{ev.speaker}</Text>
            </View>
          )}
          {!!ev.description && <Text style={s.expandDesc}>{ev.description}</Text>}
        </Animated.View>
      )}
      <View style={s.chevronRow}>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.textTer} />
      </View>
    </View>
  );

  return (
    <Animated.View style={{ opacity: anim, transform: [{ translateX: slideX }, { scale }, { rotate: rotateZ }] }}>
      <View style={s.timelineRow}>
        <View style={s.rail}>
          <Text style={[s.railTime, isPast && s.railTimePast]}>{formatTime(getEventDate(ev))}</Text>
          <View style={s.railTrack}>
            {isCurrent ? (
              <View style={s.railDotLive}>
                <PulsingDot color={COLORS.error} size={8} />
              </View>
            ) : (
              <View style={[s.railDot, { backgroundColor: isPast ? '#cbd5e1' : ts.color, borderColor: isPast ? '#e2e8f0' : ts.bg }]} />
            )}
            {!isLast && <View style={[s.railLine, isPast && s.railLinePast]} />}
          </View>
        </View>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={0.9} onPress={onToggle}>
          {cardInner}
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

export default function HomeTab({
  user, tokens,
  onOpenNotifications, onOpenSponsors, onOpenSpeakers,
  onOpenChats, onOpenQR, onOpenSchedule, onOpenLeaderboard, onOpenPhotos,
  onOpenFeed, onOpenProfile, onOpenPolls, onOpenIdeathon,
  chatBadge,
}) {
  const [unread, setUnread] = useState(0);
  const [points, setPoints] = useState(0);
  const [rank, setRank] = useState(0);
  const [conf, setConf] = useState(DEFAULT_CONF);
  const [allEvents, setAllEvents] = useState([]);
  const [latestNotif, setLatestNotif] = useState(null);
  const [selectedDay, setSelectedDay] = useState(1);
  const [expandedId, setExpandedId] = useState(null);
  const tokensRef = useRef(null);
  const cardAnims = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;

  useEffect(() => { tokensRef.current = tokens; }, [tokens]);
  useEffect(() => { if (tokens) setApiTokens(tokens); }, [tokens]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';

  const fetchAll = useCallback(async () => {
    const t = tokensRef.current || tokens;
    if (!t?.access) return;
    const safeJson = async (p) => { try { const r = await p; if (!r.ok) return null; return await r.json(); } catch { return null; } };
    const [u, p, c, ev, notif] = await Promise.all([
      safeJson(apiFetch('/notifications/unread-count/')),
      safeJson(apiFetch('/leaderboard/my/')),
      safeJson(fetch(`${API_URL}/conferences/settings/`, { headers: API_HEADERS })),
      safeJson(fetch(`${API_URL}/schedule/sessions/`, { headers: API_HEADERS })),
      safeJson(apiFetch('/notifications/my/')),
    ]);
    if (u) setUnread(u.unread_count || 0);
    if (p) { setPoints(p.total_points || 0); setRank(p.rank || 0); }
    if (c) setConf(prev => ({ ...prev, ...c }));
    if (ev?.sessions) setAllEvents(ev.sessions);
    if (notif?.notifications?.length) setLatestNotif(notif.notifications[0]);
  }, [tokens]);

  useEffect(() => {
    const d = setTimeout(fetchAll, 500);
    const t = setInterval(fetchAll, 30000);
    return () => { clearTimeout(d); clearInterval(t); };
  }, [fetchAll]);

  const day = currentConferenceDay(conf.start_date, conf.end_date);
  const total = totalDays(conf.start_date, conf.end_date);
  const progress = Math.round((day / Math.max(total, 1)) * 100);

  useEffect(() => { setSelectedDay(day); }, [day]);
  useEffect(() => { setExpandedId(null); }, [selectedDay]);

  const allSorted = useMemo(() => classifyAndSort(allEvents), [allEvents]);
  const dayEvents = useMemo(() => allSorted.filter(e => Number(e.day) === selectedDay), [allSorted, selectedDay]);
  const windowEvents = useMemo(() => smartWindow(dayEvents, TIMELINE_WINDOW), [dayEvents]);
  const windowKey = windowEvents.map(e => e.id || e.title).join('|');
  const liveSession = allSorted.find(e => e.status === 'current');
  const remainingCount = Math.max(0, dayEvents.length - windowEvents.length);

  useEffect(() => {
    cardAnims.forEach(a => a.setValue(0));
    Animated.stagger(120, windowEvents.map((_, i) =>
      Animated.spring(cardAnims[i], { toValue: 1, tension: 68, friction: 9, useNativeDriver: true })
    )).start();
  }, [selectedDay, windowKey]);

  const allPast = windowEvents.length > 0 && windowEvents.every(e => e.status === 'past');
  const dayLabel = selectedDay === day
    ? (allPast ? "That's a wrap for today!" : 'Happening now')
    : selectedDay < day ? 'Completed' : 'Coming up';

  const handleQuickAction = (action) => {
    if (action === 'schedule' && onOpenSchedule) onOpenSchedule();
    else if (action === 'sponsors' && onOpenSponsors) onOpenSponsors();
    else if (action === 'speakers' && onOpenSpeakers) onOpenSpeakers();
    else if (action === 'leaderboard' && onOpenLeaderboard) onOpenLeaderboard();
    else if (action === 'photos' && onOpenPhotos) onOpenPhotos();
    else if (action === 'feed' && onOpenFeed) onOpenFeed();
    else if (action === 'polls' && onOpenPolls) onOpenPolls();
    else if (action === 'ideathon' && onOpenIdeathon) onOpenIdeathon();
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f0f4f9' }}>
      <StatusBar barStyle="dark-content" />

      {/* Top bar */}
      <View style={g.topbar}>
        <Text style={g.topbarBrand}>{conf.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md }}>
          <TouchableOpacity onPress={onOpenNotifications} style={{ position: 'relative' }}>
            <Ionicons name="notifications-outline" size={26} color={COLORS.text} />
            {unread > 0 && <View style={g.notifBadge}><Text style={g.notifBadgeText}>{unread > 9 ? '9+' : unread}</Text></View>}
          </TouchableOpacity>
          {/* Profile avatar — tappable */}
          <TouchableOpacity onPress={onOpenProfile} activeOpacity={0.8}>
            {user.profile_photo_url
              ? <Image source={{ uri: fixMediaUrl(user.profile_photo_url) }} style={g.avatar} />
              : <GradientAvatar name={user.first_name || user.email} size={40} radius={20} />}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 105, paddingBottom: 120 }}>

        {/* Hero */}
        <View style={{ paddingHorizontal: PAD, marginBottom: SPACE.lg }}>
          <View style={g.heroCard}>
            <View style={g.blob1} /><View style={g.blob2} />
            <View style={g.heroTop}>
              <View>
                <Text style={g.heroLabel}>CURRENT STATUS</Text>
                <View style={g.heroDayPill}><View style={g.heroDayDot} /><Text style={g.heroDayText}>Day {day} of {total}</Text></View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={g.heroLabel}>VENUE</Text>
                <Text style={g.heroVenue} numberOfLines={1}>{conf.tagline}</Text>
              </View>
            </View>
            <Text style={g.heroGreeting}>Good {greeting},{'\n'}{user.first_name || 'Attendee'} 👋</Text>
            <View style={{ marginTop: SPACE.lg }}>
              <View style={g.progressRow}><Text style={g.progressLbl}>Conference Progress</Text><Text style={g.progressPct}>{progress}%</Text></View>
              <View style={g.progressTrack}><View style={[g.progressFill, { width: `${progress}%` }]} /></View>
            </View>
          </View>
        </View>

        {/* Live session */}
        {liveSession && (
          <View style={[g.glassCard, { marginHorizontal: PAD, marginBottom: SPACE.lg }]}>
            <View style={g.liveTopRow}>
              <View style={g.livePill}><PulsingDot color={COLORS.error} size={7} /><Text style={g.livePillText}>LIVE NOW</Text></View>
              <Text style={g.liveRoom}>{(liveSession.room || '').toUpperCase()}</Text>
            </View>
            <Text style={g.liveTitle}>{liveSession.title}</Text>
            <Text style={g.liveMeta}>Day {liveSession.day} • {formatRange(liveSession)}</Text>
            {!!liveSession.speaker && <Text style={g.liveSpeaker}>{liveSession.speaker}</Text>}
          </View>
        )}

        {/* Quick Actions */}
        <Text style={[g.sectionTitle, { paddingHorizontal: PAD }]}>Quick Actions</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: PAD, gap: SPACE.md, paddingBottom: SPACE.xs }}
          style={{ marginBottom: SPACE.xl }}>
          {QUICK.map(q => (
            <TouchableOpacity key={q.label} style={g.quickCard} activeOpacity={0.75}
              onPress={() => handleQuickAction(q.action)}>
              <View style={[g.quickIcon, { backgroundColor: q.bg }]}><Ionicons name={q.icon} size={22} color={q.color} /></View>
              <Text style={g.quickLabel}>{q.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* QR + Chats */}
        <View style={{ paddingHorizontal: PAD, marginBottom: SPACE.xl, flexDirection: 'row', gap: SPACE.md }}>
          <TouchableOpacity activeOpacity={0.85} style={{ flex: 1 }} onPress={onOpenQR}>
            <LinearGradient colors={[COLORS.text, '#2d3748']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={g.dualBtn}>
              <Ionicons name="qr-code" size={22} color="#fff" /><Text style={g.dualBtnText}>Show My QR</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.85} style={{ flex: 1, position: 'relative' }} onPress={onOpenChats}>
            <LinearGradient colors={[COLORS.brand, COLORS.brandDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={g.dualBtn}>
              <Ionicons name="chatbubbles" size={22} color="#fff" /><Text style={g.dualBtnText}>My Chats</Text>
            </LinearGradient>
            {chatBadge > 0 && <View style={g.chatBadge}><Text style={g.chatBadgeText}>{chatBadge > 9 ? '9+' : chatBadge}</Text></View>}
          </TouchableOpacity>
        </View>

        {/* My Status */}
        <Text style={[g.sectionTitle, { paddingHorizontal: PAD }]}>My Status</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: PAD, gap: SPACE.md, paddingBottom: SPACE.xs }}
          style={{ marginBottom: SPACE.xl }}>
          {[
            { label: 'RANK',    value: rank > 0 ? `#${rank}` : '—' },
            { label: 'POINTS',  value: points >= 1000 ? `${(points / 1000).toFixed(1)}k` : String(points) },
            { label: 'DAY',     value: `${day}/${total}` },
            { label: 'PROFILE', value: user.profile_complete ? '✓ Done' : 'Pending' },
          ].map(st => (
            <View key={st.label} style={g.statusPill}>
              <Text style={g.statusPillLabel}>{st.label}</Text>
              <Text style={g.statusPillValue}>{st.value}</Text>
            </View>
          ))}
        </ScrollView>

        {/* TIMELINE */}
        <View style={[g.sectionRow, { paddingHorizontal: PAD }]}>
          <Text style={g.sectionTitle}>Timeline</Text>
          <TouchableOpacity onPress={onOpenSchedule} activeOpacity={0.8}>
            <View style={g.seeFullBtn}>
              <Text style={g.seeFullText}>See Full</Text>
              <Ionicons name="arrow-forward" size={14} color={COLORS.brand} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Day chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: PAD, gap: SPACE.sm, paddingBottom: SPACE.md }}
          style={{ marginBottom: SPACE.sm }}>
          {Array.from({ length: total }, (_, idx) => {
            const chipDay = idx + 1;
            const active = chipDay === selectedDay;
            const isToday = chipDay === day;
            const dayCount = allSorted.filter(e => Number(e.day) === chipDay).length;
            return (
              <TouchableOpacity key={chipDay} onPress={() => setSelectedDay(chipDay)} activeOpacity={0.82}>
                {active ? (
                  <LinearGradient colors={[COLORS.brand, COLORS.brandDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={g.dayChipActive}>
                    <Text style={g.dayChipActiveText}>Day {chipDay}</Text>
                    <View style={g.dayChipCountActive}><Text style={g.dayChipCountActiveText}>{dayCount}</Text></View>
                    {isToday && <View style={g.autoIndicator}><View style={g.autoDot} /></View>}
                  </LinearGradient>
                ) : (
                  <View style={g.dayChip}>
                    <Text style={g.dayChipText}>Day {chipDay}</Text>
                    <View style={g.dayChipCount}><Text style={g.dayChipCountText}>{dayCount}</Text></View>
                    {isToday && <View style={g.todayPill}><Text style={g.todayPillText}>Today</Text></View>}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Day context label */}
        <View style={{ paddingHorizontal: PAD, marginBottom: SPACE.lg }}>
          <View style={g.dayContextRow}>
            <View style={[g.dayContextDot, { backgroundColor: allPast ? COLORS.textTer : COLORS.brand }]} />
            <Text style={g.dayContextText}>{dayLabel}</Text>
            <Text style={g.dayContextSub}> · {dayEvents.length} sessions</Text>
          </View>
        </View>

        {/* Timeline cards */}
        <View style={{ paddingHorizontal: PAD, gap: SPACE.lg, marginBottom: SPACE.lg }}>
          {windowEvents.length === 0 && (
            <View style={[g.glassCard, { alignItems: 'center', paddingVertical: SPACE.xxl }]}>
              <Ionicons name="calendar-outline" size={32} color={COLORS.textTer} />
              <Text style={{ fontSize: FONT.sm, color: COLORS.textTer, marginTop: SPACE.sm }}>No sessions for Day {selectedDay}</Text>
            </View>
          )}
          {windowEvents.map((ev, i) => (
            <TimelineCard
              key={ev.id || `${ev.day}-${i}`}
              ev={ev}
              index={i}
              total={windowEvents.length}
              expanded={expandedId === (ev.id || `${ev.day}-${i}`)}
              onToggle={() => setExpandedId(expandedId === (ev.id || `${ev.day}-${i}`) ? null : (ev.id || `${ev.day}-${i}`))}
              anim={cardAnims[i]}
            />
          ))}
        </View>

        {/* More sessions */}
        {remainingCount > 0 && (
          <TouchableOpacity style={[g.moreBtn, { marginHorizontal: PAD, marginBottom: SPACE.xl }]} activeOpacity={0.85} onPress={onOpenSchedule}>
            <LinearGradient colors={['rgba(24,86,255,0.06)', 'rgba(24,86,255,0.02)']} style={g.moreBtnInner}>
              <View style={g.moreBtnIcon}>
                <Ionicons name="layers-outline" size={20} color={COLORS.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={g.moreBtnTitle}>+{remainingCount} more session{remainingCount > 1 ? 's' : ''} on Day {selectedDay}</Text>
                <Text style={g.moreBtnSub}>Open full schedule to see all</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.brand} />
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Latest notification */}
        {latestNotif && (
          <View style={{ paddingHorizontal: PAD, marginBottom: SPACE.xl }}>
            <View style={[g.sectionRow, { marginBottom: 0 }]}><Text style={g.sectionTitle}>Latest</Text></View>
            <TouchableOpacity style={g.annCard} activeOpacity={0.85} onPress={onOpenNotifications}>
              <LinearGradient colors={[COLORS.brand, COLORS.brandDark]} style={g.annTop}>
                <Ionicons name="megaphone" size={44} color="rgba(255,255,255,0.12)" />
              </LinearGradient>
              <View style={g.annBottom}>
                <Text style={g.annTime}>{timeAgo(latestNotif.delivered_at || latestNotif.created_at)}</Text>
                <Text style={g.annTitle} numberOfLines={2}>{latestNotif.title}</Text>
                <Text style={g.annBody} numberOfLines={3}>{latestNotif.body}</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  timelineRow: { flexDirection: 'row', gap: SPACE.md, alignItems: 'stretch' },
  rail: { width: 64, alignItems: 'center' },
  railTime: { fontSize: 11, fontWeight: FONT.w8, color: COLORS.brand, marginBottom: SPACE.xs, textAlign: 'center' },
  railTimePast: { color: COLORS.textTer },
  railTrack: { flex: 1, alignItems: 'center', paddingTop: 2 },
  railDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 3 },
  railDotLive: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(239,68,68,0.12)' },
  railLine: { width: 3, flex: 1, marginTop: SPACE.sm, borderRadius: 4, backgroundColor: 'rgba(24,86,255,0.14)' },
  railLinePast: { backgroundColor: 'rgba(148,163,184,0.2)' },
  card: { backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.96)', padding: SPACE.lg, overflow: 'hidden', ...Platform.select({ ios: { shadowColor: '#002182', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.07, shadowRadius: 20 }, android: { elevation: 2 } }) },
  featuredCard: { borderWidth: 0, padding: SPACE.xl },
  currentCard: { borderColor: 'rgba(24,86,255,0.2)', borderWidth: 1.5 },
  pastCard: { opacity: 0.55 },
  accentBar: { position: 'absolute', left: 0, top: 16, bottom: 16, width: 4, borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACE.md },
  cardTopRight: { flexDirection: 'row', gap: SPACE.xs },
  typePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: SPACE.md, paddingVertical: 6, borderRadius: RADIUS.full },
  typePillText: { fontSize: 11, fontWeight: FONT.w8, letterSpacing: 0.3 },
  typePillFeatured: { backgroundColor: 'rgba(255,255,255,0.15)' },
  typePillFeaturedText: { fontSize: 11, fontWeight: FONT.w8, letterSpacing: 0.3, color: '#fff' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.error, paddingHorizontal: SPACE.sm, paddingVertical: 5, borderRadius: RADIUS.full },
  liveBadgeText: { fontSize: 9, fontWeight: FONT.w8, color: '#fff', letterSpacing: 0.8 },
  doneBadge: { backgroundColor: '#e2e8f0', paddingHorizontal: SPACE.sm, paddingVertical: 5, borderRadius: RADIUS.full },
  doneBadgeText: { fontSize: 9, fontWeight: FONT.w8, color: COLORS.textTer, letterSpacing: 0.8 },
  title: { fontSize: FONT.lg, fontWeight: FONT.w9, color: COLORS.text, lineHeight: 24, letterSpacing: -0.2 },
  titleFeatured: { fontSize: FONT.xl, fontWeight: FONT.w9, color: '#fff', lineHeight: 28, letterSpacing: -0.3 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.md, marginTop: SPACE.sm },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: FONT.xs, color: COLORS.textTer, fontWeight: FONT.w6 },
  metaTextFeatured: { fontSize: FONT.xs, color: 'rgba(255,255,255,0.72)', fontWeight: FONT.w6 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.xs, marginTop: SPACE.md },
  softBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: SPACE.sm, paddingVertical: 5, borderRadius: RADIUS.full, backgroundColor: '#eef3f8' },
  softBadgeText: { fontSize: 10, fontWeight: FONT.w7, color: COLORS.textSec, letterSpacing: 0.3 },
  ghostBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: SPACE.sm, paddingVertical: 5, borderRadius: RADIUS.full, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  ghostBadgeText: { fontSize: 10, fontWeight: FONT.w7, color: '#fff', letterSpacing: 0.3 },
  chevronRow: { alignItems: 'center', marginTop: SPACE.sm },
  expandedWrap: { marginTop: SPACE.sm },
  expandDivider: { height: 1, backgroundColor: 'rgba(148,163,184,0.18)', marginBottom: SPACE.md },
  expandDividerFeatured: { height: 1, backgroundColor: 'rgba(255,255,255,0.14)', marginBottom: SPACE.md },
  expandMetaRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, marginBottom: SPACE.xs },
  expandMeta: { fontSize: FONT.sm, color: COLORS.textSec, fontWeight: FONT.w6 },
  expandMetaFeatured: { fontSize: FONT.sm, color: 'rgba(255,255,255,0.85)', fontWeight: FONT.w6 },
  expandDesc: { fontSize: FONT.sm, color: COLORS.textSec, lineHeight: 20 },
  expandDescFeatured: { fontSize: FONT.sm, color: 'rgba(255,255,255,0.8)', lineHeight: 20 },
});

const g = StyleSheet.create({
  topbar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Platform.OS === 'ios' ? 54 : 44, paddingBottom: SPACE.md, paddingHorizontal: PAD, backgroundColor: 'rgba(240,244,249,0.92)' },
  topbarBrand: { fontSize: FONT.xxl, fontWeight: FONT.w8, color: COLORS.brand, letterSpacing: -0.3 },
  notifBadge: { position: 'absolute', top: -3, right: -3, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.error, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 2, borderColor: '#f0f4f9' },
  notifBadgeText: { fontSize: 9, fontWeight: FONT.w8, color: '#fff' },
  avatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: COLORS.border },
  heroCard: { backgroundColor: COLORS.brand, borderRadius: 32, padding: SPACE.xxl, overflow: 'hidden', ...Platform.select({ ios: { shadowColor: COLORS.brand, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.4, shadowRadius: 24 }, android: { elevation: 8 } }) },
  blob1: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.06)', top: -80, right: -60 },
  blob2: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(245,158,11,0.08)', bottom: -40, left: -40 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACE.xl },
  heroLabel: { fontSize: 9, fontWeight: FONT.w8, color: 'rgba(255,255,255,0.45)', letterSpacing: 1.5, marginBottom: SPACE.xs },
  heroDayPill: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', paddingHorizontal: SPACE.md, paddingVertical: SPACE.xs, borderRadius: RADIUS.full },
  heroDayDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#fde68a' },
  heroDayText: { fontSize: FONT.xs, fontWeight: FONT.w6, color: '#fff' },
  heroVenue: { fontSize: FONT.sm, fontWeight: FONT.w6, color: 'rgba(255,255,255,0.85)' },
  heroGreeting: { fontSize: 34, fontWeight: FONT.w9, color: '#fff', lineHeight: 40, letterSpacing: -0.5 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACE.sm },
  progressLbl: { fontSize: 10, fontWeight: FONT.w6, color: 'rgba(255,255,255,0.55)', letterSpacing: 0.5 },
  progressPct: { fontSize: 10, fontWeight: FONT.w8, color: 'rgba(255,255,255,0.7)' },
  progressTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2, backgroundColor: '#fff' },
  glassCard: { backgroundColor: 'rgba(255,255,255,0.72)', borderRadius: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', padding: SPACE.xl, ...Platform.select({ ios: { shadowColor: '#002182', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 16 }, android: { elevation: 0 } }) },
  liveTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACE.md },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, backgroundColor: COLORS.error, paddingHorizontal: SPACE.md, paddingVertical: 6, borderRadius: RADIUS.full },
  livePillText: { fontSize: 10, fontWeight: FONT.w8, color: '#fff', letterSpacing: 1 },
  liveRoom: { fontSize: FONT.xs, fontWeight: FONT.w7, color: COLORS.textTer, letterSpacing: 1 },
  liveTitle: { fontSize: FONT.xl + 2, fontWeight: FONT.w9, color: COLORS.brand, letterSpacing: -0.3, marginBottom: SPACE.xs },
  liveMeta: { fontSize: FONT.sm, color: COLORS.textTer, marginBottom: 2 },
  liveSpeaker: { fontSize: FONT.base, color: COLORS.textSec },
  sectionTitle: { fontSize: 28, fontWeight: FONT.w9, color: COLORS.brand, letterSpacing: -0.5, marginBottom: SPACE.md },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  seeFullBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.brandLight, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, borderRadius: RADIUS.full, marginBottom: SPACE.md },
  seeFullText: { fontSize: FONT.xs, fontWeight: FONT.w8, color: COLORS.brand, letterSpacing: 0.5 },
  quickCard: { borderRadius: 24, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.lg, alignItems: 'flex-start', gap: SPACE.md, minWidth: 100, backgroundColor: 'rgba(255,255,255,0.6)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)' },
  quickIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: FONT.sm, fontWeight: FONT.w6, color: COLORS.text },
  dualBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.sm, paddingVertical: SPACE.lg + 2, borderRadius: 20, ...Platform.select({ ios: { shadowColor: COLORS.text, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.18, shadowRadius: 12 }, android: { elevation: 4 } }) },
  dualBtnText: { fontSize: FONT.sm, fontWeight: FONT.w8, color: '#fff', letterSpacing: 0.2 },
  chatBadge: { position: 'absolute', top: -6, right: -4, minWidth: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.error, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2.5, borderColor: '#f0f4f9' },
  chatBadgeText: { fontSize: 10, fontWeight: FONT.w8, color: '#fff' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, backgroundColor: 'rgba(255,255,255,0.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, borderRadius: RADIUS.full },
  statusPillLabel: { fontSize: 10, fontWeight: FONT.w8, color: COLORS.textTer, letterSpacing: 1.5 },
  statusPillValue: { fontSize: FONT.xl, fontWeight: FONT.w9, color: COLORS.text },
  dayChip: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, borderRadius: RADIUS.full, backgroundColor: 'rgba(255,255,255,0.75)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.95)' },
  dayChipText: { fontSize: FONT.sm, fontWeight: FONT.w7, color: COLORS.text },
  dayChipCount: { backgroundColor: '#eef3f8', width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  dayChipCountText: { fontSize: 10, fontWeight: FONT.w8, color: COLORS.textSec },
  todayPill: { backgroundColor: COLORS.brandLight, paddingHorizontal: SPACE.sm, paddingVertical: 3, borderRadius: RADIUS.full },
  todayPillText: { fontSize: 9, fontWeight: FONT.w8, color: COLORS.brand },
  dayChipActive: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, borderRadius: RADIUS.full },
  dayChipActiveText: { fontSize: FONT.sm, fontWeight: FONT.w8, color: '#fff' },
  dayChipCountActive: { backgroundColor: 'rgba(255,255,255,0.2)', width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  dayChipCountActiveText: { fontSize: 10, fontWeight: FONT.w8, color: '#fff' },
  autoIndicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  autoDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#fff' },
  dayContextRow: { flexDirection: 'row', alignItems: 'center' },
  dayContextDot: { width: 8, height: 8, borderRadius: 4, marginRight: SPACE.sm },
  dayContextText: { fontSize: FONT.md, fontWeight: FONT.w8, color: COLORS.text },
  dayContextSub: { fontSize: FONT.md, fontWeight: FONT.w6, color: COLORS.textTer },
  moreBtn: { borderRadius: 20, overflow: 'hidden' },
  moreBtnInner: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingVertical: SPACE.lg, paddingHorizontal: SPACE.xl, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(24,86,255,0.12)' },
  moreBtnIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.brandLight, alignItems: 'center', justifyContent: 'center' },
  moreBtnTitle: { fontSize: FONT.sm, fontWeight: FONT.w8, color: COLORS.brand },
  moreBtnSub: { fontSize: FONT.xs, color: COLORS.textTer, marginTop: 2 },
  annCard: { borderRadius: 32, overflow: 'hidden', marginTop: SPACE.sm, ...SHADOW.lg },
  annTop: { height: 120, alignItems: 'center', justifyContent: 'center' },
  annBottom: { backgroundColor: COLORS.text, padding: SPACE.xl },
  annTime: { fontSize: 10, fontWeight: FONT.w7, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, marginBottom: SPACE.sm },
  annTitle: { fontSize: FONT.xl, fontWeight: FONT.w9, color: '#fff', lineHeight: 26, marginBottom: SPACE.sm },
  annBody: { fontSize: FONT.sm, color: 'rgba(255,255,255,0.7)', lineHeight: 20 },
});
