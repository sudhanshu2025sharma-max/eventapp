import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import {
  View, Text, StyleSheet, Platform, ScrollView, FlatList, TextInput,
  TouchableOpacity, Image, RefreshControl,
  Animated, Easing, Pressable, LayoutAnimation, UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  COLORS, FONT, SPACE, RADIUS, SHADOW,
  API_URL, API_HEADERS, fixMediaUrl, W, H,
} from '../theme';
import { GradientAvatar } from '../components';
import { getCached, setCache } from '../cache';
import ContactCardModal from './ContactCardModal';
import SpeakerRequestModal from './SpeakerRequestModal';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const _memCache = {
  attendees: null,
  speakers: null,
  interests: null,
};

// Module-level in-memory cache — survives tab switches (component remounts)


const TABS = ['Attendees', 'Speakers'];
const authH = t => ({ ...API_HEADERS, Authorization: `Bearer ${t?.access}` });

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ANIMATED PRIMITIVES
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function WaveIn({ children, index }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(t, {
      toValue: 1, duration: 600,
      delay: Math.min(index * 120, 700),
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: true,
    }).start();
  }, []);
  return (
    <Animated.View style={{
      opacity: t,
      transform: [
        { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [50, 0] }) },
        { scale: t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.9, 1.02, 1] }) },
      ],
    }}>
      {children}
    </Animated.View>
  );
}

function BreathingBorder({ color = COLORS.success, size = 68 }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(a, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])).start();
  }, []);
  return (
    <Animated.View style={{
      position: 'absolute', width: size, height: size, borderRadius: size / 2,
      borderWidth: 2.5, borderColor: color,
      opacity: a.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.7] }),
      transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] }) }],
    }} />
  );
}

function FloatingOrbs() {
  const orbs = useRef(
    Array.from({ length: 4 }, (_, i) => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    orbs.forEach((o, i) => {
      const dur = 3000 + i * 800;
      Animated.loop(Animated.parallel([
        Animated.sequence([
          Animated.timing(o.x, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(o.x, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(o.y, { toValue: 1, duration: dur * 1.2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(o.y, { toValue: 0, duration: dur * 1.2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ])).start();
    });
  }, []);

  const configs = [
    { size: 80, color: 'rgba(99,102,241,0.08)', left: -20, top: 10 },
    { size: 60, color: 'rgba(59,130,246,0.06)', right: 30, top: 50 },
    { size: 100, color: 'rgba(139,92,246,0.05)', right: -30, top: -10 },
    { size: 50, color: 'rgba(14,165,233,0.07)', left: 60, top: 60 },
  ];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {orbs.map((o, i) => {
        const c = configs[i];
        return (
          <Animated.View key={i} style={{
            position: 'absolute', width: c.size, height: c.size,
            borderRadius: c.size, backgroundColor: c.color,
            left: c.left, right: c.right, top: c.top,
            transform: [
              { translateX: o.x.interpolate({ inputRange: [0, 1], outputRange: [0, 30 + i * 10] }) },
              { translateY: o.y.interpolate({ inputRange: [0, 1], outputRange: [0, 20 + i * 8] }) },
            ],
          }} />
        );
      })}
    </View>
  );
}

/* Shimmer skeleton */
function Shimmer({ w, h, r = 10, style }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.timing(a, { toValue: 1, duration: 1200, useNativeDriver: true })).start();
  }, []);
  return (
    <Animated.View style={[{
      width: w, height: h, borderRadius: r, backgroundColor: '#d1d9e6',
      opacity: a.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.3, 0.65, 0.3] }),
    }, style]} />
  );
}

function SkeletonList() {
  return (
    <View style={{ paddingHorizontal: SPACE.xl, paddingTop: SPACE.md }}>
      {[0, 1, 2, 3, 4].map(i => (
        <View key={i} style={_s.skelCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Shimmer w={56} h={56} r={18} />
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Shimmer w="60%" h={14} />
              <Shimmer w="40%" h={11} style={{ marginTop: 8 }} />
              <Shimmer w="50%" h={11} style={{ marginTop: 6 }} />
            </View>
            <Shimmer w={44} h={44} r={14} />
          </View>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 14 }}>
            <Shimmer w={70} h={26} r={13} />
            <Shimmer w={90} h={26} r={13} />
            <Shimmer w={60} h={26} r={13} />
          </View>
        </View>
      ))}
    </View>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   EXPANDABLE PERSON CARD
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const PersonCard = memo(({ person, idx, isSelf, isSpeaker, cs, activeTag, onPress, onTag }) => {
  const [expanded, setExpanded] = useState(false);
  const press = useRef(new Animated.Value(1)).current;
  const expandAnim = useRef(new Animated.Value(0)).current;
  const status = cs?.status;
  const tags = person.research_interests
    ? person.research_interests.split(',').map(t => t.trim()).filter(Boolean)
    : [];

  const onIn = () => Animated.spring(press, { toValue: 0.975, tension: 400, friction: 20, useNativeDriver: true }).start();
  const onOut = () => Animated.spring(press, { toValue: 1, tension: 250, friction: 14, useNativeDriver: true }).start();

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(p => !p);
    Animated.spring(expandAnim, { toValue: expanded ? 0 : 1, tension: 200, friction: 18, useNativeDriver: true }).start();
  };

  const btn = (() => {
    if (isSelf) return null;
    if (status === 'connected') return { l: 'Message', i: 'chatbubble', c: ['#059669', '#10b981'], tc: '#fff' };
    if (status === 'pending_sent') return { l: 'Requested', i: 'hourglass-outline', c: ['#fbbf24', '#f59e0b'], tc: '#78350f', dis: true };
    if (status === 'pending_received') return { l: 'Accept / Decline', i: 'mail-unread', c: ['#ef4444', '#dc2626'], tc: '#fff' };
    if (isSpeaker) return { l: 'Request Discussion', i: 'chatbubble-ellipses', c: ['#7c3aed', '#6d28d9'], tc: '#fff' };
    return { l: 'Connect', i: 'person-add', c: [COLORS.brand, '#1e40af'], tc: '#fff' };
  })();

  const statusConfig = {
    connected: { label: 'Connected', color: '#059669', bg: '#d1fae5', icon: 'checkmark-circle' },
    pending_sent: { label: 'Requested', color: '#b45309', bg: '#fef3c7', icon: 'time' },
    pending_received: { label: 'Wants to connect', color: '#dc2626', bg: '#fee2e2', icon: 'mail-unread' },
  };
  const st = status && status !== 'none' ? statusConfig[status] : null;

  const chevronRotate = expandAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  return (
    <WaveIn index={idx}>
      <Animated.View style={{ transform: [{ scale: press }] }}>
        <View style={[_s.card, isSpeaker && _s.cardSpeaker]}>
          {/* Speaker top gradient bar */}
          {isSpeaker && (
            <LinearGradient
              colors={['#7c3aed', '#a78bfa', '#c4b5fd']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={_s.speakerBar}
            />
          )}

          {/* Main pressable area */}
          <Pressable onPressIn={onIn} onPressOut={onOut} onPress={toggleExpand}>
            {/* Row 1: Avatar + Info + Status */}
            <View style={_s.cardRow1}>
              {/* Avatar */}
              <View style={_s.avatarOuter}>
                {status === 'connected' && <BreathingBorder color="#10b981" size={64} />}
                <View style={_s.avatarInner}>
                  {person.profile_photo_url
                    ? <Image source={{ uri: person.profile_photo_url }} style={_s.avatar} />
                    : <GradientAvatar name={person.name} size={56} radius={18} />}
                </View>
                {isSpeaker && (
                  <LinearGradient colors={['#7c3aed', '#a78bfa']} style={_s.micBadge}>
                    <Ionicons name="mic" size={10} color="#fff" />
                  </LinearGradient>
                )}
                {status === 'connected' && <View style={_s.onlineDot} />}
              </View>

              {/* Info */}
              <View style={_s.infoCol}>
                <View style={_s.nameRow}>
                  <Text style={_s.name} numberOfLines={1}>{person.name}</Text>
                  {isSelf && (
                    <LinearGradient colors={[COLORS.brand, '#1e40af']} style={_s.youPill}>
                      <Text style={_s.youPillT}>YOU</Text>
                    </LinearGradient>
                  )}
                </View>

                {/* Designation — BOLD & DARK */}
                {!!person.designation && (
                  <View style={_s.desigRow}>
                    <Ionicons name="briefcase" size={12} color="#475569" />
                    <Text style={_s.desig} numberOfLines={expanded ? 3 : 1}>{person.designation}</Text>
                  </View>
                )}

                {/* Affiliation — STRONG CONTRAST */}
                {!!person.affiliation && (
                  <View style={_s.affRow}>
                    <View style={_s.affDot} />
                    <Text style={_s.aff} numberOfLines={1}>{person.affiliation}</Text>
                  </View>
                )}

                {/* Status badge */}
                {st && (
                  <View style={[_s.statusBadge, { backgroundColor: st.bg }]}>
                    <Ionicons name={st.icon} size={11} color={st.color} />
                    <Text style={[_s.statusBadgeT, { color: st.color }]}>{st.label}</Text>
                  </View>
                )}
              </View>

              {/* Expand chevron */}
              <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
                <View style={_s.chevronBtn}>
                  <Ionicons name="chevron-down" size={18} color="#94a3b8" />
                </View>
              </Animated.View>
            </View>

            {/* Preview tags (collapsed — show 2) */}
            {!expanded && tags.length > 0 && (
              <View style={_s.previewTags}>
                {tags.slice(0, 2).map(t => (
                  <View key={t} style={_s.previewTag}>
                    <View style={_s.previewTagDot} />
                    <Text style={_s.previewTagT} numberOfLines={1}>{t}</Text>
                  </View>
                ))}
                {tags.length > 2 && (
                  <View style={_s.previewMore}>
                    <Text style={_s.previewMoreT}>+{tags.length - 2} more</Text>
                  </View>
                )}
              </View>
            )}
          </Pressable>

          {/* ─── EXPANDED SECTION ─────────────────────────────────── */}
          {expanded && (
            <View style={_s.expandedSection}>
              {/* Divider */}
              <View style={_s.expandDivider} />

              {/* Full bio / designation when expanded */}
              {!!person.designation && (
                <View style={_s.expandBlock}>
                  <View style={_s.expandLabel}>
                    <Ionicons name="briefcase" size={13} color={COLORS.brand} />
                    <Text style={_s.expandLabelT}>Role</Text>
                  </View>
                  <Text style={_s.expandValue}>{person.designation}</Text>
                </View>
              )}

              {!!person.affiliation && (
                <View style={_s.expandBlock}>
                  <View style={_s.expandLabel}>
                    <Ionicons name="business" size={13} color={COLORS.brand} />
                    <Text style={_s.expandLabelT}>Organization</Text>
                  </View>
                  <Text style={_s.expandValue}>{person.affiliation}</Text>
                </View>
              )}

              {/* ALL Research Interests — fully visible */}
              {tags.length > 0 && (
                <View style={_s.expandBlock}>
                  <View style={_s.expandLabel}>
                    <Ionicons name="flask" size={13} color={COLORS.brand} />
                    <Text style={_s.expandLabelT}>Research Interests</Text>
                    <View style={_s.tagCountPill}>
                      <Text style={_s.tagCountT}>{tags.length}</Text>
                    </View>
                  </View>
                  <View style={_s.allTags}>
                    {tags.map(t => (
                      <TouchableOpacity
                        key={t}
                        style={[_s.fullTag, activeTag === t && _s.fullTagActive]}
                        onPress={() => onTag?.(t)}
                        activeOpacity={0.7}
                      >
                        <View style={[_s.fullTagDot, activeTag === t && _s.fullTagDotActive]} />
                        <Text style={[_s.fullTagT, activeTag === t && _s.fullTagTActive]}>{t}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Action button */}
              {btn && (
                <TouchableOpacity
                  onPress={() => onPress?.(person)}
                  activeOpacity={0.85}
                  disabled={btn.dis}
                  style={_s.actionWrap}
                >
                  <LinearGradient
                    colors={btn.c}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={[_s.actionBtn, btn.dis && { opacity: 0.7 }]}
                  >
                    <Ionicons name={btn.i} size={17} color={btn.tc} />
                    <Text style={[_s.actionBtnT, { color: btn.tc }]}>{btn.l}</Text>
                    {!btn.dis && <Ionicons name="arrow-forward" size={16} color={btn.tc} style={{ marginLeft: 'auto', opacity: 0.6 }} />}
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </Animated.View>
    </WaveIn>
  );
});

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   EMPTY STATE
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function EmptyState({ tab, hasFilter, onClear }) {
  const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(float, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])).start();
  }, []);
  return (
    <View style={_s.emptyWrap}>
      <Animated.View style={{ transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -16] }) }] }}>
        <LinearGradient colors={['#dbeafe', '#ede9fe']} style={_s.emptyOrb}>
          <Ionicons name={tab === 'Speakers' ? 'mic-off' : 'people'} size={48} color={COLORS.brand} />
        </LinearGradient>
      </Animated.View>
      <Text style={_s.emptyH}>No {tab.toLowerCase()} found</Text>
      <Text style={_s.emptyP}>
        {hasFilter ? 'Try different keywords or remove filters.' : `${tab} appear here after checking in.`}
      </Text>
      {hasFilter && (
        <TouchableOpacity onPress={onClear} activeOpacity={0.8}>
          <LinearGradient colors={[COLORS.brand, '#1e40af']} style={_s.emptyBtn}>
            <Ionicons name="refresh" size={16} color="#fff" />
            <Text style={_s.emptyBtnT}>Clear Filters</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   MAIN SCREEN
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function NetworkScreen({ tokens, user, onOpenChat, pendingCount, onOpenRequests }) {
  const [activeTab, setActiveTab] = useState('Attendees');
  const [attendees, setAttendees] = useState(_memCache.attendees || []);
  const [speakers, setSpeakers]   = useState(_memCache.speakers || []);
  const [interests, setInterests] = useState(_memCache.interests || []);
  const [search, setSearch]       = useState('');
  const [activeTag, setActiveTag] = useState('');
  const [loading, setLoading]     = useState(!_memCache.attendees);
  const [refreshing, setRefreshing] = useState(false);
  const [connStatus, setConnStatus] = useState({});
  const [cardTarget, setCardTarget] = useState(null);
  const [speakerTarget, setSpeakerTarget] = useState(null);
  const [searchVisible, setSearchVisible] = useState(false);
  const searchTimer = useRef(null);
  const initial = useRef({ a: !!_memCache.attendees, s: !!_memCache.speakers });
  

  const heroFade = useRef(new Animated.Value(0)).current;
  const searchHeight = useRef(new Animated.Value(0)).current;
  const tabSlide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(heroFade, { toValue: 1, duration: 800, easing: Easing.out(Easing.exp), useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    Animated.spring(tabSlide, { toValue: activeTab === 'Attendees' ? 0 : 1, tension: 300, friction: 25, useNativeDriver: true }).start();
  }, [activeTab]);

  const toggleSearch = () => {
    const show = !searchVisible;
    setSearchVisible(show);
    Animated.spring(searchHeight, { toValue: show ? 1 : 0, tension: 200, friction: 22, useNativeDriver: false }).start();
    if (!show && search) { setSearch(''); setTimeout(() => activeTab === 'Attendees' ? loadAttendees() : loadSpeakers(), 0); }
  };

  // ── data loading ─────────────────────────────────────────────────
  const loadStatuses = useCallback(async (ids) => {
    if (!ids?.length) return;
    // Show cached statuses instantly
    const cacheKey = 'conn_status_' + ids.slice().sort().join('_').substring(0, 40);
    const cached = await getCached(cacheKey);
    if (cached) setConnStatus(p => ({ ...p, ...cached }));
    try {
      const r = await fetch(`${API_URL}/chat/check/bulk/`, { method: 'POST', headers: authH(tokens), body: JSON.stringify({ user_ids: ids }) });
      const d = await r.json();
      if (d.statuses) {
        setConnStatus(p => ({ ...p, ...d.statuses }));
        setCache(cacheKey, d.statuses);
      }
    } catch {}
  }, [tokens]);

  const loadAttendees = useCallback(async (ref = false) => {
    const isS = !!(search.trim() || activeTag), ck = 'network_attendees';
    if (!ref && !isS) {
      // In-memory first (instant, no AsyncStorage delay)
      if (_memCache.attendees) {
        setAttendees(_memCache.attendees);
        setInterests(_memCache.interests || []);
        setLoading(false);
        if (!initial.current.a) { initial.current.a = true; fetchA(false, ck, isS); }
        return;
      }
      // AsyncStorage fallback
      if (!initial.current.a) {
        const c = await getCached(ck);
        if (c) { setAttendees(c.list); setInterests(c.interests || []); setLoading(false); initial.current.a = true; fetchA(false, ck, isS); return; }
      }
    }
    ref ? setRefreshing(true) : (!initial.current.a && setLoading(true));
    await fetchA(ref, ck, isS); initial.current.a = true;
  }, [tokens, search, activeTag, loadStatuses]);

  const fetchA = async (ref, ck, isS) => {
    try {
      const p = new URLSearchParams();
      if (search.trim()) p.append('search', search.trim());
      if (activeTag) p.append('interest', activeTag);
      const r = await fetch(`${API_URL}/checkins/network/?${p}`, { headers: authH(tokens) });
      const d = await r.json();
      const l = (d.attendees || []).filter(a => a.role !== 'speaker').map(a => ({ ...a, profile_photo_url: fixMediaUrl(a.profile_photo_url) }));
      setAttendees(l);
      if (!isS) {
        setInterests(d.interests || []);
        _memCache.attendees = l;
        _memCache.interests = d.interests || [];
        setCache(ck, { list: l, interests: d.interests || [] });
      }
      loadStatuses(l.map(a => a.id).filter(id => id !== user?.id));
    } catch {} finally { setLoading(false); setRefreshing(false); }
  };

  const loadSpeakers = useCallback(async (ref = false) => {
    const isS = !!search.trim(), ck = 'network_speakers';
    if (!ref && !isS) {
      if (_memCache.speakers) {
        setSpeakers(_memCache.speakers);
        setLoading(false);
        if (!initial.current.s) { initial.current.s = true; fetchS(false, ck, isS); }
        return;
      }
      if (!initial.current.s) {
        const c = await getCached(ck);
        if (c) { setSpeakers(c); setLoading(false); initial.current.s = true; fetchS(false, ck, isS); return; }
      }
    }
    ref ? setRefreshing(true) : (!initial.current.s && setLoading(true));
    await fetchS(ref, ck, isS); initial.current.s = true;
  }, [tokens, search, loadStatuses]);

  const fetchS = async (ref, ck, isS) => {
    try {
      const p = new URLSearchParams();
      if (search.trim()) p.append('search', search.trim());
      p.append('role', 'speaker');
      const r = await fetch(`${API_URL}/checkins/network/?${p}`, { headers: authH(tokens) });
      const d = await r.json();
      const l = (d.attendees || []).filter(a => a.role === 'speaker').map(a => ({ ...a, profile_photo_url: fixMediaUrl(a.profile_photo_url) }));
      setSpeakers(l);
      if (!isS) { _memCache.speakers = l; setCache(ck, l); }
      loadStatuses(l.map(a => a.id).filter(id => id !== user?.id));
    } catch {} finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { activeTab === 'Attendees' ? loadAttendees() : loadSpeakers(); }, [activeTab]);
  


  const onSearchInput = v => {
    setSearch(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => activeTab === 'Attendees' ? loadAttendees() : loadSpeakers(), 400);
  };
  const clearAll = () => { setSearch(''); setActiveTag(''); setTimeout(() => activeTab === 'Attendees' ? loadAttendees() : loadSpeakers(), 0); };
  const toggleTag = t => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setActiveTag(p => p === t ? '' : t); setTimeout(() => loadAttendees(), 0); };
  const switchTab = t => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setActiveTab(t); setSearch(''); setActiveTag(''); };

  const handlePress = p => {
    const c = connStatus[p.id];
    if (c?.status === 'connected' && c?.conversation_id) { onOpenChat?.(c.conversation_id); return; }
    if (c?.status === 'pending_sent') return;
    if (c?.status === 'pending_received') { onOpenRequests?.(); return; }
    if (activeTab === 'Speakers') setSpeakerTarget(p);
    else { setCardTarget(null); setTimeout(() => setCardTarget(p), 50); }
  };

  const list = activeTab === 'Attendees' ? attendees : speakers;
  const hasFilter = !!(search.trim() || activeTag);
  const sH = searchHeight.interpolate({ inputRange: [0, 1], outputRange: [0, 58] });
  const sO = searchHeight.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0, 1] });
  const tabW = (W - SPACE.xl * 2 - 8) / 2;

  return (
    <View style={_s.root}>
      {/* ━━ HEADER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <LinearGradient
        colors={['#050d1f', '#0b1a42', '#0d2466']}
        start={{ x: 0, y: 0 }} end={{ x: 0.8, y: 1 }}
        style={_s.header}
      >
        <FloatingOrbs />

        <Animated.View style={{ opacity: heroFade, transform: [{ translateY: heroFade.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }}>
          {/* Top row */}
          <View style={_s.headerRow}>
            <View style={_s.headerLeft}>
              <View style={_s.titleWrap}>
                <View style={_s.titleIcon}>
                  <Ionicons name="globe" size={18} color="#fff" />
                </View>
                <Text style={_s.headerTitle}>Network</Text>
              </View>
              <Text style={_s.headerSub}>Explore & Connect</Text>
            </View>

            <View style={_s.headerBtns}>
              <TouchableOpacity style={_s.hBtn} onPress={toggleSearch} activeOpacity={0.7}>
                <Ionicons name={searchVisible ? 'close' : 'search'} size={19} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={_s.hBtn} onPress={onOpenRequests} activeOpacity={0.7}>
                <Ionicons name="chatbubbles" size={19} color="#fff" />
                {pendingCount > 0 && (
                  <View style={_s.hBadge}>
                    <Text style={_s.hBadgeT}>{pendingCount > 9 ? '9+' : pendingCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Animated search */}
          <Animated.View style={{ height: sH, opacity: sO, overflow: 'hidden', marginTop: SPACE.sm }}>
            <View style={_s.searchBox}>
              <Ionicons name="search" size={17} color="#94a3b8" />
              <TextInput
                style={_s.searchInput}
                placeholder={`Search ${activeTab.toLowerCase()} by name, role, institution...`}
                placeholderTextColor="#64748b"
                value={search}
                onChangeText={onSearchInput}
                returnKeyType="search"
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => { setSearch(''); activeTab === 'Attendees' ? loadAttendees() : loadSpeakers(); }}>
                  <View style={_s.clearX}><Ionicons name="close" size={14} color="#64748b" /></View>
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        </Animated.View>
      </LinearGradient>

      {/* ━━ BODY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <View style={_s.body}>
        {/* Tab bar with animated slider */}
        <View style={_s.tabOuter}>
          <View style={_s.tabBar}>
            <Animated.View style={[_s.tabSlider, { width: tabW, transform: [{ translateX: Animated.multiply(tabSlide, tabW) }] }]}>
              <LinearGradient colors={[COLORS.brand, '#1e40af']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={_s.tabSliderGrad} />
            </Animated.View>
            {TABS.map(tab => (
              <TouchableOpacity key={tab} onPress={() => switchTab(tab)} activeOpacity={0.8} style={[_s.tabItem, { width: tabW }]}>
                <Ionicons
                  name={tab === 'Attendees' ? (activeTab === tab ? 'people' : 'people-outline') : (activeTab === tab ? 'mic' : 'mic-outline')}
                  size={16} color={activeTab === tab ? '#fff' : '#64748b'}
                />
                <Text style={[_s.tabT, activeTab === tab && _s.tabTA]}>{tab}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Interest filter chips */}
        {activeTab === 'Attendees' && interests.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={_s.chipScroll} style={_s.chipWrap}>
            <TouchableOpacity
              style={[_s.chip, !activeTag && _s.chipOn]}
              onPress={() => { setActiveTag(''); setTimeout(() => loadAttendees(), 0); }}
              activeOpacity={0.7}
            >
              <Ionicons name="apps" size={12} color={!activeTag ? '#fff' : '#64748b'} />
              <Text style={[_s.chipT, !activeTag && _s.chipTOn]}>All</Text>
            </TouchableOpacity>
            {interests.map(tag => (
              <TouchableOpacity
                key={tag}
                style={[_s.chip, activeTag === tag && _s.chipOn]}
                onPress={() => toggleTag(tag)}
                activeOpacity={0.7}
              >
                {activeTag === tag && <Ionicons name="checkmark-circle" size={13} color="#fff" />}
                <Text style={[_s.chipT, activeTag === tag && _s.chipTOn]}>{tag}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Active filter summary */}
        {hasFilter && !loading && (
          <View style={_s.filterRow}>
            <View style={_s.filterLeft}>
              <View style={_s.filterDot} />
              <Text style={_s.filterText}>
                <Text style={_s.filterBold}>{list.length}</Text> result{list.length !== 1 ? 's' : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={clearAll} style={_s.filterClear} activeOpacity={0.7}>
              <Ionicons name="close-circle" size={15} color="#ef4444" />
              <Text style={_s.filterClearT}>Clear all</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Speaker info */}
        {activeTab === 'Speakers' && !loading && speakers.length > 0 && (
          <View style={_s.spBanner}>
            <LinearGradient colors={['#f5f3ff', '#ede9fe']} style={_s.spBannerInner}>
              <View style={_s.spBannerIconWrap}>
                <Ionicons name="shield-checkmark" size={16} color="#7c3aed" />
              </View>
              <View style={_s.spBannerTextWrap}>
                <Text style={_s.spBannerTitle}>Moderated Requests</Text>
                <Text style={_s.spBannerDesc}>Speakers review all discussion requests. Include your topic for faster response.</Text>
              </View>
            </LinearGradient>
          </View>
        )}

        {/* ── LIST ──────────────────────────────────────────────── */}
        {loading ? (
          <SkeletonList />
        ) : list.length === 0 ? (
          <EmptyState tab={activeTab} hasFilter={hasFilter} onClear={clearAll} />
        ) : (
          <FlatList
            data={list}
            keyExtractor={p => p.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={_s.listContent}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={8}
            maxToRenderPerBatch={8}
            windowSize={5}
            removeClippedSubviews={true}
            refreshControl={
              <RefreshControl refreshing={refreshing}
                onRefresh={() => activeTab === 'Attendees' ? loadAttendees(true) : loadSpeakers(true)}
                tintColor={COLORS.brand} colors={[COLORS.brand]}
              />
            }
            renderItem={({ item: p, index: i }) => (
              <PersonCard
                person={p} idx={i}
                isSelf={p.id === user?.id}
                isSpeaker={activeTab === 'Speakers'}
                cs={connStatus[p.id]}
                activeTag={activeTag}
                onPress={handlePress}
                onTag={activeTab === 'Attendees' ? toggleTag : undefined}
              />
            )}
            ListFooterComponent={<View style={{ height: 140 }} />}
          />
        )}
      </View>

      {/* ── MODALS ──────────────────────────────────────────────── */}
      <ContactCardModal
        visible={!!cardTarget} onClose={() => setCardTarget(null)}
        onSent={() => { if (cardTarget) setConnStatus(p => ({ ...p, [cardTarget.id]: { status: 'pending_sent', conversation_id: null } })); setCardTarget(null); }}
        sender={user} receiver={cardTarget} tokens={tokens}
      />
      <SpeakerRequestModal
        visible={!!speakerTarget} onClose={() => setSpeakerTarget(null)}
        speaker={speakerTarget} tokens={tokens}
        onSent={d => {
          if (speakerTarget) {
            if (d.already_connected && d.conversation_id) {
              setConnStatus(p => ({ ...p, [speakerTarget.id]: { status: 'connected', conversation_id: d.conversation_id } }));
              setSpeakerTarget(null); onOpenChat?.(d.conversation_id);
            } else {
              setConnStatus(p => ({ ...p, [speakerTarget.id]: { status: 'pending_sent', conversation_id: null } }));
              setSpeakerTarget(null);
            }
          }
        }}
      />
    </View>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   STYLES
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const _s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#eef2f7' },

  // ── Header ──────────────────────────────────────────────────────────
  header: {
    paddingTop: Platform.OS === 'ios' ? 58 : 44,
    paddingHorizontal: SPACE.xl,
    paddingBottom: SPACE.xl,
    overflow: 'hidden',
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerLeft: { flex: 1 },
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleIcon: {
    width: 34, height: 34, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 30, fontWeight: '900', color: '#fff', letterSpacing: -0.8 },
  headerSub: { fontSize: 13, color: '#fff', marginTop: 6, marginLeft: 44, fontWeight: '500' },
  headerBtns: { flexDirection: 'row', gap: 10, marginTop: 2 },
  hBtn: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  hBadge: {
    position: 'absolute', top: -5, right: -5,
    minWidth: 21, height: 21, borderRadius: 11,
    backgroundColor: '#ef4444',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4, borderWidth: 2.5, borderColor: '#0b1a42',
  },
  hBadgeT: { fontSize: 10, fontWeight: '800', color: '#fff' },

  // Search
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 14,
    paddingHorizontal: 14, height: 48,
    ...SHADOW.md,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#0f172a', fontWeight: '500' },
  clearX: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },

  // ── Body ────────────────────────────────────────────────────────────
  body: {
    flex: 1, marginTop: -18,
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    backgroundColor: '#eef2f7',
    overflow: 'hidden',
  },

  // Tabs
  tabOuter: { paddingHorizontal: SPACE.xl, paddingTop: 22, paddingBottom: SPACE.sm },
  tabBar: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderRadius: 16, padding: 4,
    ...SHADOW.md, borderWidth: 1, borderColor: '#e2e8f0',
    position: 'relative',
  },
  tabSlider: { position: 'absolute', top: 4, left: 4, bottom: 4, borderRadius: 12, overflow: 'hidden' },
  tabSliderGrad: { flex: 1, borderRadius: 12 },
  tabItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 13, zIndex: 1 },
  tabT: { fontSize: 14, fontWeight: '700', color: '#64748b' },
  tabTA: { color: '#fff', fontWeight: '800' },

  // Chips
  chipWrap: { 
    marginBottom: SPACE.sm,
    paddingVertical: 6,   // gives room for shadow/border top & bottom
  },
  chipScroll: { 
    paddingHorizontal: SPACE.xl, 
    gap: 8, 
    flexDirection: 'row', 
    alignItems: 'center',
    paddingVertical: 4,   // extra breathing room
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#fff', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 9,
    borderWidth: 1.5, borderColor: '#e2e8f0',
    ...SHADOW.sm, height: 40, // add chip height
  },
  chipOn: { backgroundColor: COLORS.brand, borderColor: COLORS.brand, ...SHADOW.brand },
  chipT: { fontSize: 12, fontWeight: '600', color: '#475569' },
  chipTOn: { color: '#fff', fontWeight: '700' },

  // Filter bar
  filterRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACE.xl, marginBottom: SPACE.sm,
  },
  filterLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  filterDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.success },
  filterText: { fontSize: 13, color: '#475569', fontWeight: '500' },
  filterBold: { fontWeight: '900', color: '#0f172a' },
  filterClear: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fee2e2', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  filterClearT: { fontSize: 12, fontWeight: '700', color: '#ef4444' },

  // Speaker banner
  spBanner: { marginHorizontal: SPACE.xl, marginBottom: SPACE.md, borderRadius: 16, overflow: 'hidden' },
  spBannerInner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#ddd6fe',
  },
  spBannerIconWrap: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    ...SHADOW.sm,
  },
  spBannerTextWrap: { flex: 1 },
  spBannerTitle: { fontSize: 13, fontWeight: '800', color: '#5b21b6', marginBottom: 3 },
  spBannerDesc: { fontSize: 12, color: '#6d28d9', lineHeight: 18, fontWeight: '500' },

  // List
  listContent: { paddingHorizontal: SPACE.xl, paddingTop: SPACE.xs },

  // ── CARD ────────────────────────────────────────────────────────────
  card: {
    backgroundColor: '#fff', borderRadius: 22,
    borderWidth: 1, borderColor: '#e2e8f0',
    marginBottom: 14, overflow: 'hidden',
    ...SHADOW.md,
  },
  cardSpeaker: { borderColor: '#ddd6fe' },
  speakerBar: { height: 4 },

  cardRow1: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, paddingBottom: 10,
  },

  // Avatar
  avatarOuter: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  avatarInner: {},
  avatar: { width: 56, height: 56, borderRadius: 18, borderWidth: 2, borderColor: '#e2e8f0' },
  micBadge: {
    position: 'absolute', bottom: 2, right: 2,
    width: 22, height: 22, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: '#fff',
  },
  onlineDot: {
    position: 'absolute', top: 4, right: 4,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#10b981', borderWidth: 2.5, borderColor: '#fff',
  },

  // Info
  infoCol: { flex: 1, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name: { fontSize: 17, fontWeight: '800', color: '#0f172a', letterSpacing: -0.3 },
  youPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  youPillT: { fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 1 },

  // DESIGNATION — HIGH CONTRAST
  desigRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  desig: {
    fontSize: 14, fontWeight: '700',
    color: '#1e293b', // near-black for maximum readability
    flex: 1,
  },

  // AFFILIATION — HIGH CONTRAST
  affRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  affDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.brand },
  aff: {
    fontSize: 13, fontWeight: '700',
    color: '#334155', // dark slate — easily readable
    flex: 1,
  },

  // Status badge
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
    marginTop: 4,
  },
  statusBadgeT: { fontSize: 11, fontWeight: '700' },

  // Chevron
  chevronBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center',
    marginLeft: 8,
  },

  // Preview tags (collapsed)
  previewTags: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingBottom: 14,
    flexWrap: 'wrap',
  },
  previewTag: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#f0f4ff', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: '#dbe4ff',
  },
  previewTagDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.brand },
  previewTagT: { fontSize: 11, fontWeight: '600', color: '#3b53c4' },
  previewMore: {
    backgroundColor: '#f1f5f9', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  previewMoreT: { fontSize: 11, fontWeight: '700', color: '#64748b' },

  // ── EXPANDED ────────────────────────────────────────────────────────
  expandedSection: { paddingHorizontal: 16, paddingBottom: 16 },
  expandDivider: { height: 1, backgroundColor: '#f1f5f9', marginBottom: 14 },

  expandBlock: { marginBottom: 16 },
  expandLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  expandLabelT: {
    fontSize: 11, fontWeight: '800', color: '#64748b',
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  tagCountPill: {
    minWidth: 20, height: 18, borderRadius: 9,
    backgroundColor: COLORS.brandLight,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 5,
  },
  tagCountT: { fontSize: 10, fontWeight: '800', color: COLORS.brand },
  expandValue: {
    fontSize: 15, fontWeight: '600', color: '#1e293b',
    lineHeight: 22, paddingLeft: 22,
  },

  // All tags — fully visible
  allTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fullTag: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#f0f4ff', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1.5, borderColor: '#dbe4ff',
  },
  fullTagActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  fullTagDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.brand },
  fullTagDotActive: { backgroundColor: '#fff' },
  fullTagT: { fontSize: 13, fontWeight: '700', color: '#2d3a8c' },
  fullTagTActive: { color: '#fff' },

  // Action button
  actionWrap: { marginTop: 4, borderRadius: 14, overflow: 'hidden' },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 14, borderRadius: 14,
    paddingHorizontal: 20,
  },
  actionBtnT: { fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },

  // ── Skeleton ────────────────────────────────────────────────────────
  skelCard: {
    backgroundColor: '#fff', borderRadius: 22, padding: 16,
    marginBottom: 14, borderWidth: 1, borderColor: '#e2e8f0',
  },

  // ── Empty ───────────────────────────────────────────────────────────
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyOrb: { width: 120, height: 120, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  emptyH: { fontSize: 22, fontWeight: '900', color: '#0f172a', marginBottom: 10 },
  emptyP: { fontSize: 14, color: '#475569', textAlign: 'center', lineHeight: 22, fontWeight: '500', marginBottom: 20 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 },
  emptyBtnT: { fontSize: 14, fontWeight: '700', color: '#fff' },
});