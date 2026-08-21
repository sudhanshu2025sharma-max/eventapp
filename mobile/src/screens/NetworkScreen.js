import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import {
  View, Text, StyleSheet, Platform, ScrollView, FlatList, TextInput,
  TouchableOpacity, Image, RefreshControl,
  Animated, Easing, Pressable, LayoutAnimation, UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  COLORS, SPACE, SHADOW,
  API_URL, API_HEADERS, fixMediaUrl, W,
} from '../theme';
import { GradientAvatar } from '../components';
import { getCached, setCache } from '../cache';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Network cache — 30 min TTL (longer than cache.js 5-min default)
const NET_TTL = 30 * 60 * 1000;
async function getNetCache(key) {
  try {
    const raw = await AsyncStorage.getItem(`net_${key}`);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > NET_TTL) return null;
    return data;
  } catch { return null; }
}
async function setNetCache(key, data) {
  try {
    await AsyncStorage.setItem(`net_${key}`, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}
import ContactCardModal from './ContactCardModal';
import SpeakerRequestModal from './SpeakerRequestModal';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const _memCache = {
  attendees: null,
  speakers: null,
  interests: null,
  discover: null,
};

const TABS = ['Attendees', 'For You', 'Speakers'];
const authH = t => ({ ...API_HEADERS, Authorization: `Bearer ${t?.access}` });

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
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              width: c.size,
              height: c.size,
              borderRadius: c.size,
              backgroundColor: c.color,
              left: c.left,
              right: c.right,
              top: c.top,
              transform: [
                { translateX: o.x.interpolate({ inputRange: [0, 1], outputRange: [0, 30 + i * 10] }) },
                { translateY: o.y.interpolate({ inputRange: [0, 1], outputRange: [0, 20 + i * 8] }) },
              ],
            }}
          />
        );
      })}
    </View>
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
    <Animated.View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2.5,
        borderColor: color,
        opacity: a.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.7] }),
        transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] }) }],
      }}
    />
  );
}

function Shimmer({ w, h, r = 10, style }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.timing(a, { toValue: 1, duration: 1200, useNativeDriver: true })).start();
  }, []);
  return (
    <Animated.View
      style={[
        {
          width: w,
          height: h,
          borderRadius: r,
          backgroundColor: '#d1d9e6',
          opacity: a.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.3, 0.65, 0.3] }),
        },
        style,
      ]}
    />
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

function BubbleNode({ tag, count, isMine, maxCount, idx, total, onTap, expanded, onPop }) {
  const float    = useRef(new Animated.Value(0)).current;
  const scale    = useRef(new Animated.Value(0)).current;
  const glow     = useRef(new Animated.Value(0)).current;
  const popScale = useRef(new Animated.Value(1)).current;
  const popFade  = useRef(new Animated.Value(1)).current;

  // 8 particles for burst effect
  const particles = useRef(
    Array.from({ length: 8 }, () => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      o: new Animated.Value(0),
    }))
  ).current;

  const [popping, setPopping] = useState(false);

  const minR = 24, maxR = 40;
  const ratio = maxCount > 0 ? count / maxCount : 0.5;
  const radius = minR + ratio * (maxR - minR);

  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      tension: 120,
      friction: 8,
      delay: idx * 60,
      useNativeDriver: true,
    }).start();

    const dur = 2200 + idx * 300;
    Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();

    if (isMine) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glow, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(glow, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();
    }
  }, []);

  const handlePress = () => {
    if (popping) return;
    setPopping(true);

    // Hook for sound FX — user can plug in expo-av here later
    onPop?.(tag);

    // Fire particles outward in 8 directions
    const burstDist = radius + 24;
    particles.forEach((p, i) => {
      const angle = (i / 8) * Math.PI * 2;
      p.x.setValue(0); p.y.setValue(0); p.o.setValue(1);
      Animated.parallel([
        Animated.timing(p.x, { toValue: Math.cos(angle) * burstDist, duration: 500, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(p.y, { toValue: Math.sin(angle) * burstDist, duration: 500, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(p.o, { toValue: 0, duration: 500, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]).start();
    });

    // Pop bubble: scale up briefly then shrink to zero
    Animated.sequence([
      Animated.timing(popScale, { toValue: 1.25, duration: 90, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(popScale, { toValue: 0, duration: 220, easing: Easing.in(Easing.back(2)), useNativeDriver: true }),
        Animated.timing(popFade,  { toValue: 0, duration: 220, useNativeDriver: true }),
      ]),
    ]).start(() => {
      // Trigger data-level removal AFTER pop animation completes
      onTap?.(tag);
    });
  };

  const driftX = (idx % 3 === 0 ? 6 : idx % 3 === 1 ? -5 : 4);
  const driftY = (idx % 2 === 0 ? -8 : 7);

  const bgColor = isMine
    ? `rgba(124,58,237,${0.12 + ratio * 0.18})`
    : `rgba(59,130,246,${0.08 + ratio * 0.12})`;

  const borderColor = isMine ? '#7c3aed' : `rgba(59,130,246,${0.25 + ratio * 0.25})`;
  const textColor = isMine ? '#5b21b6' : '#1e40af';
  const particleColor = isMine ? '#a78bfa' : '#60a5fa';

  return (
    <Animated.View
      style={{
        opacity: popFade,
        transform: [
          { scale: Animated.multiply(scale, popScale) },
          { translateX: float.interpolate({ inputRange: [0, 1], outputRange: [0, driftX] }) },
          { translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, driftY] }) },
        ],
      }}
    >
      {/* Particles */}
      {popping && particles.map((pt, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: radius - 3,
            top: radius - 3,
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: particleColor,
            opacity: pt.o,
            transform: [{ translateX: pt.x }, { translateY: pt.y }],
          }}
        />
      ))}

      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.75}
        style={{ alignItems: 'center', margin: 2 }}
      >
        <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
          {isMine && (
            <Animated.View
              style={{
                position: 'absolute',
                width: radius * 2 + 6,
                height: radius * 2 + 6,
                borderRadius: radius + 3,
                borderWidth: 2,
                borderColor: '#a78bfa',
                opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.5] }),
                transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] }) }],
              }}
            />
          )}

          <View
            style={{
              width: radius * 2,
              height: radius * 2,
              borderRadius: radius,
              backgroundColor: expanded ? (isMine ? '#7c3aed' : COLORS.brand) : bgColor,
              borderWidth: isMine ? 2 : 1.5,
              borderColor: expanded ? '#fff' : borderColor,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 6,
            }}
          >
            <Text
              style={{
                fontSize: Math.max(9, Math.min(12, radius * 0.32)),
                fontWeight: '900',
                color: expanded ? '#fff' : textColor,
                textAlign: 'center',
                letterSpacing: -0.2,
              }}
              numberOfLines={2}
            >
              {tag}
            </Text>
            <View
              style={{
                marginTop: 2,
                backgroundColor: expanded ? 'rgba(255,255,255,0.25)' : (isMine ? 'rgba(124,58,237,0.15)' : 'rgba(59,130,246,0.12)'),
                borderRadius: 8,
                paddingHorizontal: 5,
                paddingVertical: 1,
              }}
            >
              <Text
                style={{
                  fontSize: 9,
                  fontWeight: '900',
                  color: expanded ? '#fff' : (isMine ? '#7c3aed' : '#3b82f6'),
                }}
              >
                {count}
              </Text>
            </View>
          </View>

          {isMine && !expanded && (
            <View style={{
              position: 'absolute', top: -2, right: -2,
              width: 16, height: 16, borderRadius: 8,
              backgroundColor: '#7c3aed',
              alignItems: 'center', justifyContent: 'center',
              borderWidth: 2, borderColor: '#fff',
            }}>
              <Ionicons name="star" size={8} color="#fff" />
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function ConferenceCloud({ cloud, myInterests = [], onConnectPerson, tokens }) {
  const [expandedTag, setExpandedTag] = useState(null);
  const [tagPeople, setTagPeople] = useState([]);
  const [tagLoading, setTagLoading] = useState(false);
  const [hiddenTags, setHiddenTags] = useState(new Set());

  // Pop sound — load once, replay on each pop
  const popSound = useRef(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Set audio mode so sound plays even in silent mode
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, shouldDuckAndroid: true });
        const { sound } = await Audio.Sound.createAsync(
          { uri: `${API_URL.replace('/api/v1', '')}/media/audio/bubble-pop-up-sfx.mp3` },
          { volume: 0.7 }
        );
        if (mounted) popSound.current = sound;
        else await sound.unloadAsync();
      } catch { /* silent — pop still works without sound */ }
    })();
    return () => {
      mounted = false;
      if (popSound.current) popSound.current.unloadAsync().catch(() => {});
    };
  }, []);

  const handlePop = async (tag) => {
    try {
      if (popSound.current) {
        await popSound.current.setPositionAsync(0);
        await popSound.current.playAsync();
      }
    } catch { /* silent */ }
  };

  // Respawn: called AFTER pop animation completes (via onTap)
  // Removes bubble briefly, triggers layout reflow, then respawns + opens tag
  const handleBubbleTap = (tag) => {
    LayoutAnimation.configureNext({
      duration: 400,
      create:  { type: 'spring', property: 'scaleXY', springDamping: 0.7 },
      update:  { type: 'spring', springDamping: 0.7 },
      delete:  { type: 'linear', property: 'opacity' },
    });
    setHiddenTags(prev => new Set(prev).add(tag));

    // Respawn after 900ms with reflow, then open people list
    setTimeout(() => {
      LayoutAnimation.configureNext({
        duration: 400,
        create:  { type: 'spring', property: 'scaleXY', springDamping: 0.6 },
        update:  { type: 'spring', springDamping: 0.6 },
      });
      setHiddenTags(prev => { const n = new Set(prev); n.delete(tag); return n; });
      // Now trigger the existing expand behavior
      toggleTag(tag);
    }, 900);
  };

  if (!cloud?.length) return null;

  const mine = (myInterests || []).map(t => String(t).toLowerCase());
  const top = cloud.slice(0, 14);
  const maxCount = top.reduce((m, [, c]) => Math.max(m, c), 1);

  const toggleTag = async (tag) => {
    if (expandedTag === tag) {
      setExpandedTag(null);
      setTagPeople([]);
      return;
    }

    setExpandedTag(tag);
    setTagPeople([]);
    setTagLoading(true);

    try {
      const url = `${API_URL}/checkins/network/?interest=${encodeURIComponent(tag)}`;
      const r = await fetch(url, { headers: authH(tokens) });
      const d = await r.json();
      const people = (d.attendees || [])
        .slice(0, 8)
        .map(a => ({ ...a, profile_photo_url: fixMediaUrl(a.profile_photo_url) }));
      setTagPeople(people);
    } catch {
      setTagPeople([]);
    }
    setTagLoading(false);
  };

  // Show max 12 bubbles to fit card

  return (
    <View style={_s.cloudCard}>
      {/* Header */}
      <View style={_s.cloudHead}>
        <LinearGradient colors={['#4f46e5', '#7c3aed']} style={_s.cloudIconWrap}>
          <Ionicons name="planet" size={16} color="#fff" />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={_s.cloudTitle}>Research Universe</Text>
          <Text style={_s.cloudSub}>Tap any bubble to see researchers</Text>
        </View>
        <View style={_s.cloudLegend}>
          <View style={_s.cloudLegendDot} />
          <Text style={_s.cloudLegendT}>Yours</Text>
        </View>
      </View>

      {/* Bubble field */}
      <View style={_s.bubbleField}>
        {top.slice(0, 12)
          .filter(([tag]) => !hiddenTags.has(tag))
          .map(([tag, count], idx) => (
          <BubbleNode
            key={tag}
            tag={tag}
            count={count}
            isMine={mine.includes(String(tag).toLowerCase())}
            maxCount={maxCount}
            idx={idx}
            total={Math.min(top.length, 12)}
            onTap={handleBubbleTap}
            onPop={handlePop}
            expanded={expandedTag === tag}
          />
        ))}
      </View>

      {/* Connection lines hint */}
      <View style={_s.bubbleHint}>
        <Ionicons name="finger-print" size={14} color="#94a3b8" />
        <Text style={_s.bubbleHintT}>
          {expandedTag ? `Showing researchers in "${expandedTag}"` : 'Bubble size = number of researchers'}
        </Text>
      </View>

      {/* Expanded people list */}
      {expandedTag && (
        <View style={_s.bubbleExpanded}>
          <View style={_s.bubbleExpandedHead}>
            <LinearGradient colors={['#4f46e5', '#7c3aed']} style={_s.bubbleExpandedPill}>
              <Ionicons name="flash" size={11} color="#fff" />
              <Text style={_s.bubbleExpandedPillT}>{expandedTag}</Text>
            </LinearGradient>
            <Text style={_s.bubbleExpandedCount}>
              {tagLoading ? 'Loading...' : `${tagPeople.length} researcher${tagPeople.length !== 1 ? 's' : ''}`}
            </Text>
            <TouchableOpacity onPress={() => { setExpandedTag(null); setTagPeople([]); }} style={_s.bubbleCloseBtn}>
              <Ionicons name="close" size={14} color="#64748b" />
            </TouchableOpacity>
          </View>

          {tagLoading && (
            <View style={{ padding: 16, alignItems: 'center' }}>
              <Shimmer w={200} h={14} r={7} />
              <Shimmer w={160} h={14} r={7} style={{ marginTop: 10 }} />
            </View>
          )}

          {!tagLoading && tagPeople.length === 0 && (
            <View style={_s.bubbleExpandedEmpty}>
              <Ionicons name="telescope" size={20} color="#94a3b8" />
              <Text style={_s.bubbleExpandedEmptyT}>No checked-in researchers for "{expandedTag}" yet</Text>
            </View>
          )}

          {!tagLoading && tagPeople.map(person => (
            <TouchableOpacity
              key={person.id}
              style={_s.bubblePersonRow}
              onPress={() => onConnectPerson?.(person)}
              activeOpacity={0.8}
            >
              {person.profile_photo_url
                ? <Image source={{ uri: person.profile_photo_url }} style={_s.bubblePersonPhoto} />
                : <GradientAvatar name={person.name} size={40} radius={13} />}
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={_s.bubblePersonName} numberOfLines={1}>{person.name}</Text>
                {!!person.affiliation && <Text style={_s.bubblePersonAff} numberOfLines={1}>{person.affiliation}</Text>}
              </View>
              <LinearGradient colors={[COLORS.brand, '#1e40af']} style={_s.bubblePersonBtn}>
                <Ionicons name="person-add" size={13} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

function NoInterestState({ cloud }) {
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: SPACE.xl, paddingTop: SPACE.sm, paddingBottom: 140 }}
    >
      <ConferenceCloud cloud={cloud} myInterests={[]} tokens={null} />
      <LinearGradient colors={['#f5f3ff', '#eff6ff']} style={_s.noInterestCard}>
        <View style={_s.noInterestOrb}>
          <Ionicons name="flask" size={38} color="#7c3aed" />
        </View>
        <Text style={_s.noInterestH}>No research interests on your profile yet</Text>
        <Text style={_s.noInterestP}>
          Add a few topics in your profile and this tab will turn into a live research radar with people who overlap with your work.
        </Text>
        <View style={_s.noInterestHint}>
          <Ionicons name="person-circle" size={15} color="#475569" />
          <Text style={_s.noInterestHintT}>Profile → Edit Profile → Research Interests</Text>
        </View>
      </LinearGradient>
    </ScrollView>
  );
}

const DiscoverySpotlight = memo(({ person, cs, onAction, onShuffle }) => {
  if (!person) return null;

  const status = cs?.status;
  const cta = (() => {
    if (status === 'connected') return { l: 'Message now', i: 'chatbubble', c: ['#059669', '#10b981'], dis: false };
    if (status === 'pending_sent') return { l: 'Request sent', i: 'hourglass-outline', c: ['#f59e0b', '#fbbf24'], dis: true };
    if (status === 'pending_received') return { l: 'Open requests', i: 'mail-unread', c: ['#ef4444', '#dc2626'], dis: false };
    return { l: 'Connect instantly', i: 'person-add', c: ['#7c3aed', '#4f46e5'], dis: false };
  })();

  const headline =
    person.match_score >= 4 ? 'Research Twin' :
    person.match_score >= 2 ? 'Strong Match' : 'Fresh Connection';

  const reasons = (person.common_interests || []).slice(0, 3).join(', ');

  return (
    <LinearGradient
      colors={['#0f172a', '#1e1b4b', '#1d4ed8']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={_s.dHero}
    >
      <View style={_s.dHeroTop}>
        <View style={_s.dHeroPill}>
          <Ionicons name="sparkles" size={12} color="#fff" />
          <Text style={_s.dHeroPillT}>{headline}</Text>
        </View>
        <TouchableOpacity onPress={onShuffle} activeOpacity={0.8} style={_s.dShuffleBtn}>
          <Ionicons name="shuffle" size={14} color="#fff" />
          <Text style={_s.dShuffleBtnT}>Surprise me</Text>
        </TouchableOpacity>
      </View>

      <View style={_s.dHeroMain}>
        <View style={_s.dHeroLeft}>
          <View style={_s.dHeroAvatarWrap}>
            {person.profile_photo_url
              ? <Image source={{ uri: person.profile_photo_url }} style={_s.dHeroAvatar} />
              : <GradientAvatar name={person.name} size={70} radius={22} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={_s.dHeroName} numberOfLines={1}>{person.name}</Text>
            {!!person.designation && <Text style={_s.dHeroDesig} numberOfLines={1}>{person.designation}</Text>}
            {!!person.affiliation && <Text style={_s.dHeroAff} numberOfLines={2}>{person.affiliation}</Text>}
          </View>
        </View>
        <View style={_s.dScoreWrap}>
          <View style={_s.dScoreRing}>
            <Text style={_s.dScoreNum}>{person.match_score}</Text>
            <Text style={_s.dScoreLab}>shared</Text>
          </View>
        </View>
      </View>

      <Text style={_s.dHeroWhy}>
        You both care about <Text style={{ fontWeight: '900' }}>{reasons || 'similar research areas'}</Text>.
      </Text>

      <View style={_s.dCommonRow}>
        {(person.common_interests || []).slice(0, 5).map(tag => (
          <View key={tag} style={_s.dCommonChip}>
            <Ionicons name="radio-button-on" size={10} color="#34d399" />
            <Text style={_s.dCommonChipT}>{tag}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity onPress={() => onAction?.(person)} activeOpacity={0.85} disabled={cta.dis} style={{ marginTop: 14 }}>
        <LinearGradient colors={cta.c} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[_s.dCta, cta.dis && { opacity: 0.75 }]}>
          <Ionicons name={cta.i} size={17} color="#fff" />
          <Text style={_s.dCtaT}>{cta.l}</Text>
          {!cta.dis && <Ionicons name="arrow-forward" size={16} color="#fff" style={{ marginLeft: 'auto', opacity: 0.8 }} />}
        </LinearGradient>
      </TouchableOpacity>
    </LinearGradient>
  );
});

const DiscoveryCard = memo(({ person, cs, onAction }) => {
  const press = useRef(new Animated.Value(1)).current;
  const status = cs?.status;

  const onIn = () => Animated.spring(press, { toValue: 0.98, tension: 400, friction: 20, useNativeDriver: true }).start();
  const onOut = () => Animated.spring(press, { toValue: 1, tension: 250, friction: 14, useNativeDriver: true }).start();

  const action = (() => {
    if (status === 'connected') return { l: 'Message', i: 'chatbubble', c: ['#059669', '#10b981'], dis: false };
    if (status === 'pending_sent') return { l: 'Requested', i: 'hourglass-outline', c: ['#f59e0b', '#fbbf24'], dis: true };
    if (status === 'pending_received') return { l: 'Open Requests', i: 'mail-unread', c: ['#ef4444', '#dc2626'], dis: false };
    return { l: 'Connect', i: 'person-add', c: [COLORS.brand, '#1e40af'], dis: false };
  })();

  const otherTags = (person.all_interests || []).filter(t => !(person.common_interests || []).includes(t)).slice(0, 3);

  return (
    <Animated.View style={{ transform: [{ scale: press }] }}>
      <Pressable onPressIn={onIn} onPressOut={onOut}>
        <View style={_s.dCard}>
          <LinearGradient
            colors={person.match_score >= 4 ? ['#10b981', '#34d399'] : person.match_score >= 2 ? ['#7c3aed', '#8b5cf6'] : ['#3b82f6', '#60a5fa']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={_s.dCardBar}
          />
          <View style={_s.dCardRow}>
            <View style={_s.dCardAvatarWrap}>
              {status === 'connected' && <BreathingBorder color="#10b981" size={60} />}
              {person.profile_photo_url
                ? <Image source={{ uri: person.profile_photo_url }} style={_s.dCardAvatar} />
                : <GradientAvatar name={person.name} size={52} radius={16} />}
            </View>

            <View style={_s.dCardInfo}>
              <View style={_s.dCardNameRow}>
                <Text style={_s.dCardName} numberOfLines={1}>{person.name}</Text>
                <View style={_s.dMiniScore}>
                  <Ionicons name="git-merge" size={10} color="#7c3aed" />
                  <Text style={_s.dMiniScoreT}>{person.match_score}</Text>
                </View>
              </View>
              {!!person.designation && <Text style={_s.dCardDesig} numberOfLines={1}>{person.designation}</Text>}
              {!!person.affiliation && <Text style={_s.dCardAff} numberOfLines={1}>{person.affiliation}</Text>}
            </View>

            <TouchableOpacity onPress={() => onAction?.(person)} disabled={action.dis} activeOpacity={0.8}>
              <LinearGradient colors={action.c} style={[_s.dMiniBtn, action.dis && { opacity: 0.7 }]}>
                <Ionicons name={action.i} size={16} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <Text style={_s.dBecause}>
            Because you both study {(person.common_interests || []).slice(0, 2).join(' • ')}
            {(person.common_interests || []).length > 2 ? ` • +${person.common_interests.length - 2}` : ''}
          </Text>

          <View style={_s.dTagRow}>
            {(person.common_interests || []).map(tag => (
              <View key={tag} style={_s.dTagCommon}>
                <Ionicons name="checkmark-circle" size={11} color="#059669" />
                <Text style={_s.dTagCommonT}>{tag}</Text>
              </View>
            ))}
            {otherTags.map(tag => (
              <View key={tag} style={_s.dTagOther}>
                <Text style={_s.dTagOtherT}>{tag}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity onPress={() => onAction?.(person)} activeOpacity={0.85} disabled={action.dis} style={{ marginTop: 12 }}>
            <LinearGradient colors={action.c} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[_s.dActionBtn, action.dis && { opacity: 0.75 }]}>
              <Ionicons name={action.i} size={16} color="#fff" />
              <Text style={_s.dActionBtnT}>{action.l}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Animated.View>
  );
});

const SpeakerGridCard = memo(({ person, cs, onPress }) => {
  const status = cs?.status;
  const press = useRef(new Animated.Value(1)).current;
  const cardW = (W - SPACE.xl * 2 - 10) / 2;

  const onIn = () => Animated.spring(press, { toValue: 0.97, tension: 400, friction: 20, useNativeDriver: true }).start();
  const onOut = () => Animated.spring(press, { toValue: 1, tension: 250, friction: 14, useNativeDriver: true }).start();

  const statusLabel =
    status === 'connected' ? 'Connected' :
    status === 'pending_sent' ? 'Requested' : '';

  return (
    <Animated.View style={{ width: cardW, marginBottom: 10, transform: [{ scale: press }] }}>
      <Pressable onPressIn={onIn} onPressOut={onOut} onPress={() => onPress?.(person)}>
        <View style={_s.sgCard}>
          <View style={_s.sgPhotoWrap}>
            {person.profile_photo_url
              ? <Image source={{ uri: person.profile_photo_url }} style={_s.sgPhoto} />
              : <GradientAvatar name={person.name} size={cardW - 2} radius={0} />}
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={_s.sgOverlay} />
            {!!statusLabel && (
              <View style={[_s.sgStatusPill, status === 'connected' ? { backgroundColor: '#059669' } : { backgroundColor: '#f59e0b' }]}>
                <Text style={_s.sgStatusT}>{statusLabel}</Text>
              </View>
            )}
            <LinearGradient colors={['#7c3aed', '#a78bfa']} style={_s.sgMicBadge}>
              <Ionicons name="chatbubble" size={10} color="#fff" />
            </LinearGradient>
          </View>
          <View style={_s.sgInfo}>
            <Text style={_s.sgName} numberOfLines={1}>{person.name}</Text>
            {!!person.affiliation && <Text style={_s.sgAff} numberOfLines={1}>{person.affiliation}</Text>}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
});

const PersonCard = memo(({ person, isSelf, isSpeaker, cs, activeTag, onPress, onTag }) => {
  const [expanded, setExpanded] = useState(false);
  const press = useRef(new Animated.Value(1)).current;
  const expandAnim = useRef(new Animated.Value(0)).current;
  const status = cs?.status;

  const tags = person.research_interests
    ? person.research_interests.split(',').map(t => t.trim()).filter(Boolean)
    : [];

  const onIn = () => Animated.spring(press, { toValue: 0.98, tension: 400, friction: 20, useNativeDriver: true }).start();
  const onOut = () => Animated.spring(press, { toValue: 1, tension: 250, friction: 14, useNativeDriver: true }).start();

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const next = !expanded;
    setExpanded(next);
    Animated.spring(expandAnim, { toValue: next ? 1 : 0, tension: 200, friction: 18, useNativeDriver: true }).start();
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
    <Animated.View style={{ transform: [{ scale: press }] }}>
      <View style={[_s.card, isSpeaker && _s.cardSpeaker]}>
        {isSpeaker && (
          <LinearGradient colors={['#7c3aed', '#a78bfa', '#c4b5fd']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={_s.speakerBar} />
        )}

        <Pressable onPressIn={onIn} onPressOut={onOut} onPress={toggleExpand}>
          <View style={_s.cardRow1}>
            <View style={_s.avatarOuter}>
              {status === 'connected' && <BreathingBorder color="#10b981" size={64} />}
              <View>
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

            <View style={_s.infoCol}>
              <View style={_s.nameRow}>
                <Text style={_s.name} numberOfLines={1}>{person.name}</Text>
                {isSelf && (
                  <LinearGradient colors={[COLORS.brand, '#1e40af']} style={_s.youPill}>
                    <Text style={_s.youPillT}>YOU</Text>
                  </LinearGradient>
                )}
              </View>

              {!!person.designation && (
                <View style={_s.desigRow}>
                  <Ionicons name="briefcase" size={12} color="#475569" />
                  <Text style={_s.desig} numberOfLines={expanded ? 3 : 1}>{person.designation}</Text>
                </View>
              )}

              {!!person.affiliation && (
                <View style={_s.affRow}>
                  <View style={_s.affDot} />
                  <Text style={_s.aff} numberOfLines={1}>{person.affiliation}</Text>
                </View>
              )}

              {st && (
                <View style={[_s.statusBadge, { backgroundColor: st.bg }]}>
                  <Ionicons name={st.icon} size={11} color={st.color} />
                  <Text style={[_s.statusBadgeT, { color: st.color }]}>{st.label}</Text>
                </View>
              )}
            </View>

            <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
              <View style={_s.chevronBtn}>
                <Ionicons name="chevron-down" size={18} color="#94a3b8" />
              </View>
            </Animated.View>
          </View>

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

        {expanded && (
          <View style={_s.expandedSection}>
            <View style={_s.expandDivider} />

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

            {btn && (
              <TouchableOpacity onPress={() => onPress?.(person)} activeOpacity={0.85} disabled={btn.dis} style={_s.actionWrap}>
                <LinearGradient colors={btn.c} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[_s.actionBtn, btn.dis && { opacity: 0.7 }]}>
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
  );
});

function EmptyState({ tab, hasFilter, onClear }) {
  return (
    <View style={_s.emptyWrap}>
      <LinearGradient colors={['#dbeafe', '#ede9fe']} style={_s.emptyOrb}>
        <Ionicons name={tab === 'Speakers' ? 'mic-off' : 'people'} size={48} color={COLORS.brand} />
      </LinearGradient>
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

export default function NetworkScreen({ tokens, user, onOpenChat, pendingCount, onOpenRequests, onShake }) {
  const [activeTab, setActiveTab] = useState('Attendees');
  const [attendees, setAttendees] = useState(_memCache.attendees || []);
  const [speakers, setSpeakers] = useState(_memCache.speakers || []);
  const [interests, setInterests] = useState(_memCache.interests || []);
  const [discover, setDiscover] = useState(_memCache.discover || null);
  const [spotIdx, setSpotIdx] = useState(0);
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState('');
  const [loading, setLoading] = useState(false);
  const [tabReady, setTabReady] = useState({ Attendees: !!_memCache.attendees, 'For You': !!_memCache.discover, Speakers: !!_memCache.speakers });
  const [refreshing, setRefreshing] = useState(false);
  const [connStatus, setConnStatus] = useState({});
  const [cardTarget, setCardTarget] = useState(null);
  const [speakerTarget, setSpeakerTarget] = useState(null);
  const [searchVisible, setSearchVisible] = useState(false);

  const searchTimer = useRef(null);
  const searchHeight = useRef(new Animated.Value(0)).current;
  const heroFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(heroFade, {
      toValue: 1,
      duration: 800,
      easing: Easing.out(Easing.exp),
      useNativeDriver: true,
    }).start();
  }, []);

  const loadStatuses = useCallback(async (ids) => {
    if (!ids?.length) return;
    const cacheKey = 'conn_status_' + ids.slice().sort().join('_').substring(0, 60);
    const cached = await getCached(cacheKey);
    if (cached) setConnStatus(p => ({ ...p, ...cached }));

    try {
      const r = await fetch(`${API_URL}/chat/check/bulk/`, {
        method: 'POST',
        headers: authH(tokens),
        body: JSON.stringify({ user_ids: ids }),
      });
      const d = await r.json();
      if (d.statuses) {
        setConnStatus(p => ({ ...p, ...d.statuses }));
        setCache(cacheKey, d.statuses);
      }
    } catch {}
  }, [tokens]);

  const fetchAttendeesList = useCallback(async (searchText = '', interestText = '', useLocalCache = false) => {
    const isFiltered = !!(searchText.trim() || interestText);

    // useLocalCache=true only used on manual refresh/filter — seed path now handled at mount
    if (useLocalCache && !isFiltered && _memCache.attendees) {
      setAttendees(_memCache.attendees);
      setInterests(_memCache.interests || []);
    }

    const p = new URLSearchParams();
    if (searchText.trim()) p.append('search', searchText.trim());
    if (interestText) p.append('interest', interestText);

    try {
      const r = await fetch(`${API_URL}/checkins/network/?${p.toString()}`, { headers: authH(tokens) });
      const d = await r.json();
      const list = (d.attendees || [])
        .filter(a => a.role !== 'speaker')
        .map(a => ({ ...a, profile_photo_url: fixMediaUrl(a.profile_photo_url) }));

      setAttendees(list);

      if (!isFiltered) {
        const interests = d.interests || [];
        setInterests(interests);
        _memCache.attendees = list;
        _memCache.interests = interests;
        setNetCache('attendees', { list, interests }); // 30-min cache
      }

      loadStatuses(list.map(a => a.id).filter(id => id !== user?.id));
      return list;
    } catch { return _memCache.attendees || []; }
  }, [tokens, user?.id, loadStatuses]);

  const fetchSpeakersList = useCallback(async (searchText = '', useLocalCache = false) => {
    const isFiltered = !!searchText.trim();

    if (useLocalCache && !isFiltered && _memCache.speakers) {
      setSpeakers(_memCache.speakers);
    }

    const p = new URLSearchParams();
    p.append('role', 'speaker');
    if (searchText.trim()) p.append('search', searchText.trim());

    try {
      const r = await fetch(`${API_URL}/checkins/network/?${p.toString()}`, { headers: authH(tokens) });
      const d = await r.json();
      const list = (d.attendees || [])
        .filter(a => a.role === 'speaker')
        .map(a => ({ ...a, profile_photo_url: fixMediaUrl(a.profile_photo_url) }));

      setSpeakers(list);

      if (!isFiltered) {
        _memCache.speakers = list;
        setNetCache('speakers', list); // 30-min cache
      }

      loadStatuses(list.map(a => a.id).filter(id => id !== user?.id));
      return list;
    } catch { return _memCache.speakers || []; }
  }, [tokens, user?.id, loadStatuses]);

  const fetchDiscoverData = useCallback(async (useLocalCache = false) => {
    if (useLocalCache && _memCache.discover) {
      setDiscover(_memCache.discover);
    }

    try {
      const r = await fetch(`${API_URL}/auth/discover/`, { headers: authH(tokens) });
      const d = await r.json();

      const payload = {
        has_interests: !!d.has_interests,
      my_interests: d.my_interests || [],
      matches: (d.matches || []).map(m => ({
        ...m,
        profile_photo_url: fixMediaUrl(m.profile_photo_url),
        research_interests: m.research_interests || (m.all_interests || []).join(', '),
      })),
      interest_cloud: d.interest_cloud || [],
      match_count: d.match_count || 0,
    };

      setDiscover(payload);
      _memCache.discover = payload;
      setNetCache('discover', payload); // 30-min cache
      loadStatuses(payload.matches.map(m => m.id));
      return payload;
    } catch { return _memCache.discover || null; }
  }, [tokens, loadStatuses]);

  useEffect(() => {
    let alive = true;

    (async () => {
      // Step 1: seed from cache instantly — no spinner if data exists
      const [ca, cs, cd] = await Promise.all([
        getNetCache('attendees'),
        getNetCache('speakers'),
        getNetCache('discover'),
      ]);
      if (ca) { _memCache.attendees = ca.list; _memCache.interests = ca.interests; setAttendees(ca.list); setInterests(ca.interests); }
      if (cs) { _memCache.speakers = cs; setSpeakers(cs); }
      if (cd) { _memCache.discover = cd; setDiscover(cd); }
      if (alive) setTabReady(prev => ({
        ...prev,
        Attendees: prev.Attendees || !!ca,
        'For You': prev['For You'] || !!cd,
        Speakers: prev.Speakers || !!cs,
      }));

      // Only show spinner if nothing was cached
      const hasCached = !!(ca || cs || cd);
      if (!hasCached && alive) setLoading(true);

      // Step 2: refresh from network silently in background
      try {
        await Promise.all([
          fetchAttendeesList('', '', false),
          fetchDiscoverData(false),
          fetchSpeakersList('', false),
        ]);
      } catch {}
      finally {
        if (alive) {
          setLoading(false);
          setTabReady({ Attendees: true, 'For You': true, Speakers: true });
        }
      }
    })();

    return () => { alive = false; };
  }, []);

  const refreshAttendees = async () => {
    setRefreshing(true);
    try {
      await fetchAttendeesList(search, activeTag, false);
    } catch {}
    setRefreshing(false);
  };

  const refreshDiscover = async () => {
    setRefreshing(true);
    try {
      await fetchDiscoverData(false);
    } catch {}
    setRefreshing(false);
  };

  const refreshSpeakers = async () => {
    setRefreshing(true);
    try {
      await fetchSpeakersList(search, false);
    } catch {}
    setRefreshing(false);
  };

  const toggleSearch = () => {
    if (activeTab === 'For You') return;
    const show = !searchVisible;
    setSearchVisible(show);

    Animated.spring(searchHeight, {
      toValue: show ? 1 : 0,
      tension: 200,
      friction: 22,
      useNativeDriver: false,
    }).start();

    if (!show && search) {
      setSearch('');
      if (activeTab === 'Attendees') fetchAttendeesList('', activeTag, false);
      if (activeTab === 'Speakers') fetchSpeakersList('', false);
    }
  };

  const onSearchInput = v => {
    setSearch(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);

    searchTimer.current = setTimeout(() => {
      if (activeTab === 'Attendees') fetchAttendeesList(v, activeTag, false);
      if (activeTab === 'Speakers') fetchSpeakersList(v, false);
    }, 300);
  };

  const clearAll = () => {
    setSearch('');
    setActiveTag('');
    if (activeTab === 'Attendees') fetchAttendeesList('', '', false);
    if (activeTab === 'Speakers') fetchSpeakersList('', false);
  };

  const toggleTag = tag => {
    const next = activeTag === tag ? '' : tag;
    setActiveTag(next);
    fetchAttendeesList(search, next, false);
  };

  const switchTab = t => {
    if (t === activeTab) return;
    setActiveTab(t);

    if (t === 'For You' && searchVisible) {
      setSearchVisible(false);
      searchHeight.setValue(0);
    }
    // NOTE: no fetch on switch — data already loaded, avoid re-render cascade
  };

  const handlePress = person => {
    const c = connStatus[person.id];

    if (c?.status === 'connected' && c?.conversation_id) {
      onOpenChat?.(c.conversation_id);
      return;
    }
    if (c?.status === 'pending_sent') return;
    if (c?.status === 'pending_received') {
      onOpenRequests?.();
      return;
    }

    if (activeTab === 'Speakers') setSpeakerTarget(person);
    else {
      setCardTarget(null);
      setTimeout(() => setCardTarget(person), 50);
    }
  };

  const handleDiscoverAction = person => {
    const c = connStatus[person.id];

    if (c?.status === 'connected' && c?.conversation_id) {
      onOpenChat?.(c.conversation_id);
      return;
    }
    if (c?.status === 'pending_sent') return;
    if (c?.status === 'pending_received') {
      onOpenRequests?.();
      return;
    }

    setCardTarget(null);
    setTimeout(() => setCardTarget(person), 50);
  };

  const shuffleSpotlight = () => {
    const len = discover?.matches?.length || 0;
    if (!len) return;
    setSpotIdx(i => (i + 1) % len);
  };

  const spotlight = discover?.matches?.length
    ? discover.matches[spotIdx % discover.matches.length]
    : null;

  // Stable renderItem callbacks — prevents FlatList re-render when parent state changes
  const renderAttendee = useCallback(({ item: p }) => (
    <PersonCard
      person={p}
      isSelf={p.id === user?.id}
      isSpeaker={false}
      cs={connStatus[p.id]}
      activeTag={activeTag}
      onPress={handlePress}
      onTag={toggleTag}
    />
  ), [connStatus, user?.id, activeTag, handlePress, toggleTag]);

  const renderDiscover = useCallback(({ item }) => (
    <DiscoveryCard
      person={item}
      cs={connStatus[item.id]}
      onAction={handleDiscoverAction}
    />
  ), [connStatus, handleDiscoverAction]);

  const renderSpeaker = useCallback(({ item }) => (
    <SpeakerGridCard
      person={item}
      cs={connStatus[item.id]}
      onPress={handlePress}
    />
  ), [connStatus, handlePress]);

  const showSearch = activeTab !== 'For You';
  const hasFilter = !!(search.trim() || activeTag);
  const sH = searchHeight.interpolate({ inputRange: [0, 1], outputRange: [0, 58] });
  const sO = searchHeight.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0, 1] });
  const tabW = (W - SPACE.xl * 2 - 8) / 3;
  const tabOffset = TABS.indexOf(activeTab) * tabW;

  return (
    <View style={_s.root}>
      <LinearGradient
        colors={['#050d1f', '#0b1a42', '#0d2466']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={_s.header}
      >
        <FloatingOrbs />

        <Animated.View
          style={{
            opacity: heroFade,
            transform: [{ translateY: heroFade.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
          }}
        >
          <View style={_s.headerRow}>
            <View style={_s.headerLeft}>
              <View style={_s.titleWrap}>
                {/* <View style={_s.titleIcon}>
                  <Ionicons name="globe" size={18} color="#fff" />
                </View> */}
                <Text style={_s.headerTitle}>Network</Text>
              </View>
              <Text style={_s.headerSub}>
                {activeTab === 'For You' ? 'Your research radar' : 'Explore & Connect'}
              </Text>
            </View>

            <View style={_s.headerBtns}>
              {showSearch && (
                <TouchableOpacity style={_s.hBtn} onPress={toggleSearch} activeOpacity={0.7}>
                  <Ionicons name={searchVisible ? 'close' : 'search'} size={19} color="#fff" />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={_s.hShakeBtn} onPress={onShake} activeOpacity={0.8}>
                <Text style={{ fontSize: 18 }}>🤝</Text>
                <Text style={_s.hShakeBtnT}>Shake</Text>
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

          {showSearch && (
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
                  <TouchableOpacity onPress={clearAll}>
                    <View style={_s.clearX}>
                      <Ionicons name="close" size={14} color="#64748b" />
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            </Animated.View>
          )}
        </Animated.View>
      </LinearGradient>

      <View style={_s.body}>
        <View style={_s.tabOuter}>
          <View style={_s.tabBar}>
            <View style={[_s.tabSlider, { width: tabW, transform: [{ translateX: tabOffset }] }]}>
              <LinearGradient
                colors={
                  activeTab === 'For You'
                    ? ['#7c3aed', '#4f46e5']
                    : activeTab === 'Speakers'
                    ? ['#7c3aed', '#6d28d9']
                    : [COLORS.brand, '#1e40af']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={_s.tabSliderGrad}
              />
            </View>

            {TABS.map(tab => (
              <TouchableOpacity
                key={tab}
                onPress={() => switchTab(tab)}
                activeOpacity={0.8}
                style={[_s.tabItem, { width: tabW }]}
              >
                <Ionicons
                  name={
                    tab === 'Attendees'
                      ? (activeTab === tab ? 'people' : 'people-outline')
                      : tab === 'For You'
                      ? (activeTab === tab ? 'sparkles' : 'sparkles-outline')
                      : (activeTab === tab ? 'mic' : 'mic-outline')
                  }
                  size={15}
                  color={activeTab === tab ? '#fff' : '#64748b'}
                />
                <Text style={[_s.tabT, activeTab === tab && _s.tabTA]} numberOfLines={1}>
                  {tab}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {activeTab === 'Attendees' && interests.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={_s.chipScroll} style={_s.chipWrap}>
            <TouchableOpacity
              style={[_s.chip, !activeTag && _s.chipOn]}
              onPress={() => {
                setActiveTag('');
                fetchAttendeesList(search, '', false);
              }}
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

        {activeTab === 'Attendees' && hasFilter && !loading && (
          <View style={_s.filterRow}>
            <View style={_s.filterLeft}>
              <View style={_s.filterDot} />
              <Text style={_s.filterText}>
                <Text style={_s.filterBold}>{attendees.length}</Text> result{attendees.length !== 1 ? 's' : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={clearAll} style={_s.filterClear} activeOpacity={0.7}>
              <Ionicons name="close-circle" size={15} color="#ef4444" />
              <Text style={_s.filterClearT}>Clear all</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ flex: 1, position: 'relative' }}>
        <View
          pointerEvents={activeTab === 'Attendees' ? 'auto' : 'none'}
          style={[_s.tabPage, activeTab === 'Attendees' && _s.tabPageActive]}
        >
          {!tabReady.Attendees ? (
            <SkeletonList />
          ) : attendees.length === 0 ? (
            <EmptyState tab="Attendees" hasFilter={hasFilter} onClear={clearAll} />
          ) : (
            <FlatList
              data={attendees}
              keyExtractor={p => p.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={_s.listContent}
              keyboardShouldPersistTaps="handled"
              initialNumToRender={5}
              maxToRenderPerBatch={5}
              windowSize={3}
              removeClippedSubviews
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={refreshAttendees}
                  tintColor={COLORS.brand}
                  colors={[COLORS.brand]}
                />
              }
              renderItem={renderAttendee}
              ListFooterComponent={<View style={{ height: 140 }} />}
            />
          )}
        </View>

        <View
          pointerEvents={activeTab === 'For You' ? 'auto' : 'none'}
          style={[_s.tabPage, activeTab === 'For You' && _s.tabPageActive]}
        >
          {!tabReady['For You'] ? (
            <SkeletonList />
          ) : !discover?.has_interests ? (
            <NoInterestState cloud={discover?.interest_cloud || []} />
          ) : (
            <FlatList
              data={discover?.matches || []}
              keyExtractor={p => p.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={_s.listContent}
              initialNumToRender={5}
              maxToRenderPerBatch={5}
              windowSize={3}
              removeClippedSubviews
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={refreshDiscover}
                  tintColor="#7c3aed"
                  colors={['#7c3aed']}
                />
              }
              ListHeaderComponent={
                <View>
                  {spotlight && (
                    <DiscoverySpotlight
                      person={spotlight}
                      cs={connStatus[spotlight.id]}
                      onAction={handleDiscoverAction}
                      onShuffle={shuffleSpotlight}
                    />
                  )}

                  <View style={_s.dInsightCard}>
                    <View style={_s.dInsightTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={_s.dInsightEyebrow}>Why these people?</Text>
                        <Text style={_s.dInsightTitle}>
                          {discover?.match_count || 0} match{(discover?.match_count || 0) !== 1 ? 'es' : ''} around your work
                        </Text>
                      </View>
                      <View style={_s.dInsightBadge}>
                        <Ionicons name="git-network" size={14} color="#7c3aed" />
                        <Text style={_s.dInsightBadgeT}>{discover?.match_count || 0}</Text>
                      </View>
                    </View>

                    <View style={_s.dMyTopicsWrap}>
                      {(discover?.my_interests || []).map(tag => (
                        <View key={tag} style={_s.dMyTopicChip}>
                          <Ionicons name="flask" size={11} color="#4f46e5" />
                          <Text style={_s.dMyTopicChipT}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  <ConferenceCloud
                    cloud={discover?.interest_cloud || []}
                    myInterests={discover?.my_interests || []}
                    onConnectPerson={handleDiscoverAction}
                    tokens={tokens}
                  />
                </View>
              }
              ListEmptyComponent={
                <View style={_s.emptyWrap}>
                  <LinearGradient colors={['#ede9fe', '#dbeafe']} style={_s.emptyOrb}>
                    <Ionicons name="search" size={48} color="#7c3aed" />
                  </LinearGradient>
                  <Text style={_s.emptyH}>No matches yet</Text>
                  <Text style={_s.emptyP}>No one else has checked in with overlapping interests yet. Check back as more people arrive.</Text>
                </View>
              }
              renderItem={renderDiscover}
              ListFooterComponent={<View style={{ height: 140 }} />}
            />
          )}
        </View>

        <View
          pointerEvents={activeTab === 'Speakers' ? 'auto' : 'none'}
          style={[_s.tabPage, activeTab === 'Speakers' && _s.tabPageActive]}
        >
          {!tabReady.Speakers ? (
            <SkeletonList />
          ) : speakers.length === 0 ? (
            <EmptyState tab="Speakers" hasFilter={!!search.trim()} onClear={clearAll} />
          ) : (
            <FlatList
              data={speakers}
              keyExtractor={p => p.id}
              numColumns={2}
              columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: SPACE.xl }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingTop: SPACE.xs, paddingBottom: 140 }}
              initialNumToRender={6}
              maxToRenderPerBatch={6}
              windowSize={3}
              removeClippedSubviews
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={refreshSpeakers}
                  tintColor="#7c3aed"
                  colors={['#7c3aed']}
                />
              }
              ListHeaderComponent={
                <View style={_s.spBanner2}>
                  <LinearGradient colors={['#f5f3ff', '#ede9fe']} style={_s.spBannerInner}>
                    <View style={_s.spBannerIconWrap}>
                      <Ionicons name="shield-checkmark" size={16} color="#7c3aed" />
                    </View>
                    <View style={_s.spBannerTextWrap}>
                      <Text style={_s.spBannerTitle}>Moderated Requests</Text>
                      <Text style={_s.spBannerDesc}>Speakers review all discussion requests.</Text>
                    </View>
                  </LinearGradient>
                </View>
              }
              renderItem={renderSpeaker}
            />
          )}
        </View>
        </View>
      </View>

      <ContactCardModal
        visible={!!cardTarget}
        onClose={() => setCardTarget(null)}
        onSent={() => {
          if (cardTarget) {
            setConnStatus(p => ({
              ...p,
              [cardTarget.id]: { status: 'pending_sent', conversation_id: null },
            }));
          }
          setCardTarget(null);
        }}
        sender={user}
        receiver={cardTarget}
        tokens={tokens}
      />

      <SpeakerRequestModal
        visible={!!speakerTarget}
        onClose={() => setSpeakerTarget(null)}
        speaker={speakerTarget}
        tokens={tokens}
        onSent={d => {
          if (!speakerTarget) return;
          if (d.already_connected && d.conversation_id) {
            setConnStatus(p => ({
              ...p,
              [speakerTarget.id]: { status: 'connected', conversation_id: d.conversation_id },
            }));
            setSpeakerTarget(null);
            onOpenChat?.(d.conversation_id);
          } else {
            setConnStatus(p => ({
              ...p,
              [speakerTarget.id]: { status: 'pending_sent', conversation_id: null },
            }));
            setSpeakerTarget(null);
          }
        }}
      />
    </View>
  );
}

const _s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#eef2f7' },

  header: {
    paddingTop: Platform.OS === 'ios' ? 58 : 44,
    paddingHorizontal: SPACE.xl,
    paddingBottom: SPACE.xxxl,
    overflow: 'hidden',
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerLeft: { flex: 1 },
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 30, fontWeight: '900', color: '#fff', letterSpacing: -0.8 },
  headerSub: { fontSize: 13, color: '#fff', marginTop: 6, fontWeight: '500' },
  headerBtns: { flexDirection: 'row', gap: 10, marginTop: 2 },
  hBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 21,
    height: 21,
    borderRadius: 11,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2.5,
    borderColor: '#0b1a42',
  },
  hBadgeT: { fontSize: 10, fontWeight: '800', color: '#fff' },
  hShakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(167,139,250,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.35)',
  },
  hShakeBtnT: { fontSize: 12, fontWeight: '800', color: '#a78bfa' },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    ...SHADOW.md,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#0f172a', fontWeight: '500' },
  clearX: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  body: {
    flex: 1,
    marginTop: -18,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: '#eef2f7',
    overflow: 'hidden',
  },

  tabOuter: { paddingHorizontal: SPACE.xl, paddingTop: 22, paddingBottom: SPACE.sm },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 4,
    ...SHADOW.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    position: 'relative',
  },
  tabSlider: {
    position: 'absolute',
    top: 4,
    left: 4,
    bottom: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  tabSliderGrad: { flex: 1, borderRadius: 12 },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 13,
    zIndex: 1,
  },
  tabT: { fontSize: 12, fontWeight: '800', color: '#64748b' },
  tabTA: { color: '#fff', fontWeight: '900' },

  chipWrap: { marginBottom: SPACE.sm, height: 44, maxHeight: 44 },
  chipScroll: { paddingHorizontal: SPACE.xl, gap: 8, flexDirection: 'row', alignItems: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    height: 34,
  },
  chipOn: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  chipT: { fontSize: 12, fontWeight: '600', color: '#475569' },
  chipTOn: { color: '#fff', fontWeight: '700' },

  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACE.xl,
    marginBottom: SPACE.sm,
  },
  filterLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  filterDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.success },
  filterText: { fontSize: 13, color: '#475569', fontWeight: '500' },
  filterBold: { fontWeight: '900', color: '#0f172a' },
  filterClear: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#fee2e2',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterClearT: { fontSize: 12, fontWeight: '700', color: '#ef4444' },

  listContent: { paddingHorizontal: SPACE.xl, paddingTop: SPACE.xs },
  hiddenPage: { display: 'none' },
  tabPage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
    zIndex: 0,
  },
  tabPageActive: {
    opacity: 1,
    zIndex: 1,
  },

  dHero: {
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
    overflow: 'hidden',
    ...SHADOW.md,
  },
  dHeroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  dHeroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  dHeroPillT: { fontSize: 11, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
  dShuffleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  dShuffleBtnT: { fontSize: 11, fontWeight: '800', color: '#fff' },
  dHeroMain: { flexDirection: 'row', alignItems: 'center' },
  dHeroLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  dHeroAvatarWrap: {
    width: 74,
    height: 74,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  dHeroAvatar: { width: 70, height: 70, borderRadius: 22 },
  dHeroName: { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: -0.4 },
  dHeroDesig: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.85)', marginTop: 3 },
  dHeroAff: { fontSize: 13, fontWeight: '600', color: '#bfdbfe', marginTop: 4, lineHeight: 18 },
  dScoreWrap: { marginLeft: 12 },
  dScoreRing: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dScoreNum: { fontSize: 24, fontWeight: '900', color: '#fff', lineHeight: 26 },
  dScoreLab: { fontSize: 11, fontWeight: '700', color: '#c7d2fe', marginTop: 2 },
  dHeroWhy: { fontSize: 14, lineHeight: 22, color: '#e0e7ff', marginTop: 16, fontWeight: '600' },
  dCommonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  dCommonChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16,185,129,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.28)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  dCommonChipT: { fontSize: 12, fontWeight: '800', color: '#d1fae5' },
  dCta: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dCtaT: { fontSize: 15, fontWeight: '900', color: '#fff' },

  dInsightCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    marginBottom: 14,
    ...SHADOW.sm,
  },
  dInsightTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  dInsightEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: '#7c3aed',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  dInsightTitle: { fontSize: 17, fontWeight: '900', color: '#0f172a', marginTop: 4, lineHeight: 22 },
  dInsightBadge: {
    minWidth: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#f5f3ff',
    borderWidth: 1,
    borderColor: '#ddd6fe',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  dInsightBadgeT: { marginTop: 2, fontSize: 11, fontWeight: '900', color: '#7c3aed' },
  dMyTopicsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  dMyTopicChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
  },
  dMyTopicChipT: { fontSize: 12, fontWeight: '800', color: '#4338ca' },

  cloudCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    marginBottom: 14,
    ...SHADOW.md,
    overflow: 'hidden',
  },
  cloudHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  cloudIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: COLORS.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cloudTitle: { fontSize: 15, fontWeight: '900', color: '#0f172a' },
  cloudSub: { fontSize: 11, fontWeight: '600', color: '#64748b', marginTop: 1 },
  cloudLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
    backgroundColor: '#f5f3ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  cloudLegendDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#7c3aed' },
  cloudLegendT: { fontSize: 10, fontWeight: '700', color: '#7c3aed' },
  bubbleField: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
    overflow: 'hidden',
  },
  bubbleHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    marginTop: 4,
  },
  bubbleHintT: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
  },
  bubbleExpanded: {
    marginTop: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
  },
  bubbleExpandedHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  bubbleExpandedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.brand,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  bubbleExpandedPillT: { fontSize: 11, fontWeight: '800', color: '#fff' },
  bubbleExpandedCount: { fontSize: 12, fontWeight: '700', color: '#475569', flex: 1 },
  bubbleCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubblePersonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  bubblePersonPhoto: {
    width: 40,
    height: 40,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  bubblePersonName: { fontSize: 13, fontWeight: '800', color: '#0f172a' },
  bubblePersonAff: { fontSize: 11, fontWeight: '600', color: '#64748b', marginTop: 1 },
  bubblePersonBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleExpandedEmpty: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  bubbleExpandedEmptyT: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    flex: 1,
  },

  noInterestCard: {
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd6fe',
    ...SHADOW.md,
  },
  noInterestOrb: {
    width: 90,
    height: 90,
    borderRadius: 30,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    ...SHADOW.sm,
  },
  noInterestH: { fontSize: 22, fontWeight: '900', color: '#0f172a', textAlign: 'center', lineHeight: 28 },
  noInterestP: { fontSize: 14, fontWeight: '500', color: '#475569', textAlign: 'center', lineHeight: 22, marginTop: 10 },
  noInterestHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    marginTop: 18,
  },
  noInterestHintT: { fontSize: 12, fontWeight: '800', color: '#334155' },

  dCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
    overflow: 'hidden',
    ...SHADOW.md,
  },
  dCardBar: { height: 4 },
  dCardRow: { flexDirection: 'row', alignItems: 'center', padding: 14, paddingBottom: 10 },
  dCardAvatarWrap: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  dCardAvatar: { width: 52, height: 52, borderRadius: 16, borderWidth: 2, borderColor: '#e2e8f0' },
  dCardInfo: { flex: 1 },
  dCardNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  dCardName: { flex: 1, fontSize: 16, fontWeight: '900', color: '#0f172a', letterSpacing: -0.2 },
  dMiniScore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f5f3ff',
    borderWidth: 1,
    borderColor: '#ddd6fe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  dMiniScoreT: { fontSize: 11, fontWeight: '900', color: '#7c3aed' },
  dCardDesig: { fontSize: 13, fontWeight: '700', color: '#475569' },
  dCardAff: { fontSize: 12, fontWeight: '700', color: COLORS.brand, marginTop: 3 },
  dMiniBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dBecause: {
    paddingHorizontal: 14,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
    color: '#334155',
  },
  dTagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingHorizontal: 14, paddingTop: 12 },
  dTagCommon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  dTagCommonT: { fontSize: 11, fontWeight: '900', color: '#166534' },
  dTagOther: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  dTagOtherT: { fontSize: 11, fontWeight: '700', color: '#64748b' },
  dActionBtn: {
    marginHorizontal: 14,
    marginBottom: 14,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dActionBtnT: { fontSize: 14, fontWeight: '900', color: '#fff' },

  spBanner2: { paddingHorizontal: SPACE.xl, marginBottom: SPACE.md },
  spBannerInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ddd6fe',
  },
  spBannerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.sm,
  },
  spBannerTextWrap: { flex: 1 },
  spBannerTitle: { fontSize: 13, fontWeight: '800', color: '#5b21b6', marginBottom: 3 },
  spBannerDesc: { fontSize: 12, color: '#6d28d9', lineHeight: 18, fontWeight: '500' },

  sgCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...SHADOW.md,
  },
  sgPhotoWrap: {
    aspectRatio: 0.85,
    width: '100%',
    position: 'relative',
    backgroundColor: '#f1f5f9',
  },
  sgPhoto: { width: '100%', height: '100%', resizeMode: 'cover' },
  sgOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '42%',
  },
  sgStatusPill: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  sgStatusT: { fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  sgMicBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sgInfo: { padding: 10 },
  sgName: { fontSize: 14, fontWeight: '900', color: '#0f172a', letterSpacing: -0.2 },
  sgAff: { fontSize: 11, fontWeight: '700', color: '#475569', marginTop: 3 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
    overflow: 'hidden',
    ...SHADOW.md,
  },
  cardSpeaker: { borderColor: '#ddd6fe' },
  speakerBar: { height: 4 },
  cardRow1: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 10 },

  avatarOuter: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  avatar: { width: 56, height: 56, borderRadius: 18, borderWidth: 2, borderColor: '#e2e8f0' },
  micBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#fff',
  },
  onlineDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10b981',
    borderWidth: 2.5,
    borderColor: '#fff',
  },

  infoCol: { flex: 1, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name: { fontSize: 17, fontWeight: '800', color: '#0f172a', letterSpacing: -0.3 },
  youPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  youPillT: { fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 1 },

  desigRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  desig: { fontSize: 14, fontWeight: '700', color: '#1e293b', flex: 1 },

  affRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  affDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.brand },
  aff: { fontSize: 13, fontWeight: '700', color: '#334155', flex: 1 },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4,
  },
  statusBadgeT: { fontSize: 11, fontWeight: '700' },

  chevronBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  previewTags: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexWrap: 'wrap',
  },
  previewTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#f0f4ff',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#dbe4ff',
  },
  previewTagDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.brand },
  previewTagT: { fontSize: 11, fontWeight: '600', color: '#3b53c4' },
  previewMore: { backgroundColor: '#f1f5f9', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  previewMoreT: { fontSize: 11, fontWeight: '700', color: '#64748b' },

  expandedSection: { paddingHorizontal: 16, paddingBottom: 16 },
  expandDivider: { height: 1, backgroundColor: '#f1f5f9', marginBottom: 14 },
  expandBlock: { marginBottom: 16 },
  expandLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  expandLabelT: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  tagCountPill: {
    minWidth: 20,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  tagCountT: { fontSize: 10, fontWeight: '800', color: COLORS.brand },
  expandValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
    lineHeight: 22,
    paddingLeft: 22,
  },

  allTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fullTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0f4ff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: '#dbe4ff',
  },
  fullTagActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  fullTagDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.brand },
  fullTagDotActive: { backgroundColor: '#fff' },
  fullTagT: { fontSize: 13, fontWeight: '700', color: '#2d3a8c' },
  fullTagTActive: { color: '#fff' },

  actionWrap: { marginTop: 4, borderRadius: 14, overflow: 'hidden' },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 14,
    paddingHorizontal: 20,
  },
  actionBtnT: { fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },

  skelCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyOrb: {
    width: 120,
    height: 120,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyH: { fontSize: 22, fontWeight: '900', color: '#0f172a', marginBottom: 10, textAlign: 'center' },
  emptyP: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
    marginBottom: 20,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
  },
  emptyBtnT: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
