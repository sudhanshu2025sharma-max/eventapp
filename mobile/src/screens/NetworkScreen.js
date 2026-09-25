import React, { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';

import ContactCardModal from './ContactCardModal';
import SpeakerRequestModal from './SpeakerRequestModal';
import InfiniteMenu from '../components/InfiniteMenu';

// Network cache — 30 min TTL
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

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  if (!global.nativeFabricUIManager) UIManager.setLayoutAnimationEnabledExperimental(true);
}

const _memCache = {
  attendees: null,
  speakers: null,
  interests: null,
  discover: null,
};

const TABS = ['Attendees', 'Universe', 'For You', 'Speakers'];
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
        </View>
      ))}
    </View>
  );
}

function BubbleNode({ tag, count, isMine, maxCount, idx, onTap, expanded }) {
  const float = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0)).current;

  const minR = 24, maxR = 40;
  const ratio = maxCount > 0 ? count / maxCount : 0.5;
  const radius = minR + ratio * (maxR - minR);

  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      tension: 120,
      friction: 8,
      delay: idx * 50,
      useNativeDriver: true,
    }).start();

    const dur = 2200 + idx * 250;
    Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const bgColor = isMine
    ? `rgba(124,58,237,${0.12 + ratio * 0.18})`
    : `rgba(59,130,246,${0.08 + ratio * 0.12})`;

  const borderColor = isMine ? '#7c3aed' : `rgba(59,130,246,${0.25 + ratio * 0.25})`;
  const textColor = isMine ? '#5b21b6' : '#1e40af';

  return (
    <Animated.View
      style={{
        transform: [
          { scale },
          { translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, idx % 2 === 0 ? -6 : 6] }) },
        ],
      }}
    >
      <TouchableOpacity
        onPress={() => onTap?.(tag)}
        activeOpacity={0.75}
        style={{ alignItems: 'center', margin: 3 }}
      >
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
      </TouchableOpacity>
    </Animated.View>
  );
}

function ConferenceCloud({ cloud, myInterests = [], onConnectPerson, tokens }) {
  const [expandedTag, setExpandedTag] = useState(null);
  const [tagPeople, setTagPeople] = useState([]);
  const [tagLoading, setTagLoading] = useState(false);

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

  return (
    <View style={_s.cloudCard}>
      <View style={_s.cloudHead}>
        <LinearGradient colors={['#4f46e5', '#7c3aed']} style={_s.cloudIconWrap}>
          <Ionicons name="planet" size={16} color="#fff" />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={_s.cloudTitle}>Research Universe</Text>
          <Text style={_s.cloudSub}>Tap any bubble to see researchers</Text>
        </View>
      </View>

      <View style={_s.bubbleField}>
        {top.slice(0, 12).map(([tag, count], idx) => (
          <BubbleNode
            key={tag}
            tag={tag}
            count={count}
            isMine={mine.includes(String(tag).toLowerCase())}
            maxCount={maxCount}
            idx={idx}
            onTap={toggleTag}
            expanded={expandedTag === tag}
          />
        ))}
      </View>

      {expandedTag && (
        <View style={_s.bubbleExpanded}>
          <View style={_s.bubbleExpandedHead}>
            <LinearGradient colors={['#4f46e5', '#7c3aed']} style={_s.bubbleExpandedPill}>
              <Ionicons name="flash" size={11} color="#fff" />
              <Text style={_s.bubbleExpandedPillT}>{expandedTag}</Text>
            </LinearGradient>
            <TouchableOpacity onPress={() => setExpandedTag(null)} style={_s.bubbleCloseBtn}>
              <Ionicons name="close" size={14} color="#64748b" />
            </TouchableOpacity>
          </View>

          {tagLoading && (
            <View style={{ padding: 16, alignItems: 'center' }}>
              <Shimmer w={200} h={14} r={7} />
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

const DiscoverySpotlight = memo(({ person, cs, onAction, onShuffle }) => {
  if (!person) return null;

  const status = cs?.status;
  const cta = (() => {
    if (status === 'connected') return { l: 'Message now', i: 'chatbubble', c: ['#059669', '#10b981'], dis: false };
    if (status === 'pending_sent') return { l: 'Request sent', i: 'hourglass-outline', c: ['#f59e0b', '#fbbf24'], dis: true };
    if (status === 'pending_received') return { l: 'Open requests', i: 'mail-unread', c: ['#ef4444', '#dc2626'], dis: false };
    return { l: 'Connect instantly', i: 'person-add', c: ['#7c3aed', '#4f46e5'], dis: false };
  })();

  const headline = person.match_score >= 4 ? 'Research Twin' : person.match_score >= 2 ? 'Strong Match' : 'Fresh Connection';
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
      </View>

      <Text style={_s.dHeroWhy}>
        You both care about <Text style={{ fontWeight: '900' }}>{reasons || 'similar research areas'}</Text>.
      </Text>

      <TouchableOpacity onPress={() => onAction?.(person)} activeOpacity={0.85} disabled={cta.dis} style={{ marginTop: 14 }}>
        <LinearGradient colors={cta.c} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[_s.dCta, cta.dis && { opacity: 0.75 }]}>
          <Ionicons name={cta.i} size={17} color="#fff" />
          <Text style={_s.dCtaT}>{cta.l}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </LinearGradient>
  );
});

const DiscoveryCard = memo(({ person, cs, onAction }) => {
  const status = cs?.status;
  const action = (() => {
    if (status === 'connected') return { l: 'Message', i: 'chatbubble', c: ['#059669', '#10b981'], dis: false };
    if (status === 'pending_sent') return { l: 'Requested', i: 'hourglass-outline', c: ['#f59e0b', '#fbbf24'], dis: true };
    if (status === 'pending_received') return { l: 'Open Requests', i: 'mail-unread', c: ['#ef4444', '#dc2626'], dis: false };
    return { l: 'Connect', i: 'person-add', c: [COLORS.brand, '#1e40af'], dis: false };
  })();

  return (
    <View style={_s.dCard}>
      <View style={_s.dCardRow}>
        <View style={_s.dCardAvatarWrap}>
          {status === 'connected' && <BreathingBorder color="#10b981" size={60} />}
          {person.profile_photo_url
            ? <Image source={{ uri: person.profile_photo_url }} style={_s.dCardAvatar} />
            : <GradientAvatar name={person.name} size={52} radius={16} />}
        </View>

        <View style={_s.dCardInfo}>
          <Text style={_s.dCardName} numberOfLines={1}>{person.name}</Text>
          {!!person.designation && <Text style={_s.dCardDesig} numberOfLines={1}>{person.designation}</Text>}
          {!!person.affiliation && <Text style={_s.dCardAff} numberOfLines={1}>{person.affiliation}</Text>}
        </View>

        <TouchableOpacity onPress={() => onAction?.(person)} disabled={action.dis} activeOpacity={0.8}>
          <LinearGradient colors={action.c} style={[_s.dMiniBtn, action.dis && { opacity: 0.7 }]}>
            <Ionicons name={action.i} size={16} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
});

const SpeakerGridCard = memo(({ person, cs, onPress }) => {
  const status = cs?.status;
  const cardW = (W - SPACE.xl * 2 - 10) / 2;

  const statusLabel =
    status === 'connected' ? 'Connected' :
    status === 'pending_sent' ? 'Requested' : '';

  return (
    <View style={{ width: cardW, marginBottom: 12 }}>
      <TouchableOpacity activeOpacity={0.85} onPress={() => onPress?.(person)}>
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
              <Ionicons name="mic" size={11} color="#fff" />
            </LinearGradient>
          </View>
          <View style={_s.sgInfo}>
            <Text style={_s.sgName} numberOfLines={1}>{person.name}</Text>
            {!!person.affiliation && <Text style={_s.sgAff} numberOfLines={1}>{person.affiliation}</Text>}
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
});

const PersonCard = memo(({ person, isSelf, isSpeaker, cs, activeTag, onPress, onTag }) => {
  const [expanded, setExpanded] = useState(false);
  const status = cs?.status;

  const tags = person.research_interests
    ? String(person.research_interests).split(',').map(t => t.trim()).filter(Boolean)
    : [];

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  const btn = (() => {
    if (isSelf) return null;
    if (status === 'connected') return { l: 'Message', i: 'chatbubble', c: ['#059669', '#10b981'], tc: '#fff' };
    if (status === 'pending_sent') return { l: 'Requested', i: 'hourglass-outline', c: ['#fbbf24', '#f59e0b'], tc: '#78350f', dis: true };
    if (status === 'pending_received') return { l: 'Accept / Decline', i: 'mail-unread', c: ['#ef4444', '#dc2626'], tc: '#fff' };
    if (isSpeaker) return { l: 'Request Discussion', i: 'chatbubble-ellipses', c: ['#7c3aed', '#6d28d9'], tc: '#fff' };
    return { l: 'Connect', i: 'person-add', c: [COLORS.brand, '#1e40af'], tc: '#fff' };
  })();

  return (
    <View style={[_s.card, isSpeaker && _s.cardSpeaker]}>
      {isSpeaker && (
        <LinearGradient colors={['#7c3aed', '#a78bfa']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={_s.speakerBar} />
      )}

      <Pressable onPress={toggleExpand}>
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
              <Text style={_s.desig} numberOfLines={expanded ? 3 : 1}>{person.designation}</Text>
            )}

            {!!person.affiliation && (
              <Text style={_s.aff} numberOfLines={1}>{person.affiliation}</Text>
            )}
          </View>

          <View style={_s.chevronBtn}>
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color="#94a3b8" />
          </View>
        </View>

        {!expanded && tags.length > 0 && (
          <View style={_s.previewTags}>
            {tags.slice(0, 3).map((t, i) => (
              <View key={`${t}-${i}`} style={_s.previewTag}>
                <View style={_s.previewTagDot} />
                <Text style={_s.previewTagT} numberOfLines={1}>{t}</Text>
              </View>
            ))}
          </View>
        )}
      </Pressable>

      {expanded && (
        <View style={_s.expandedSection}>
          <View style={_s.expandDivider} />

          {tags.length > 0 && (
            <View style={_s.expandBlock}>
              <Text style={_s.expandLabelT}>Research Interests</Text>
              <View style={_s.allTags}>
                {tags.map((t, i) => (
                  <TouchableOpacity
                    key={`${t}-${i}`}
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
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
});

function CheckInGateScreen({ onOpenQR, onRefresh, checking }) {
  return (
    <View style={_s.gateContainer}>
      <LinearGradient colors={['#050d1f', '#0f172a', '#1e1b4b']} style={StyleSheet.absoluteFill} />
      <FloatingOrbs />

      <View style={_s.gateCard}>
        <LinearGradient colors={['#38bdf8', '#6366f1', '#a855f7']} style={_s.gateIconGlow}>
          <View style={_s.gateIconInner}>
            <Ionicons name="qr-code" size={44} color="#fff" />
          </View>
        </LinearGradient>

        <View style={_s.gatePill}>
          <Ionicons name="lock-closed" size={12} color="#38bdf8" />
          <Text style={_s.gatePillText}>CHECK-IN GATED</Text>
        </View>

        <Text style={_s.gateTitle}>Unlock Conference Networking</Text>
        <Text style={_s.gateDesc}>
          The Attendee Directory, 3D Radial Universe, and Speaker Discussion radar are reserved for verified attendees.
          {'\n\n'}Please present your QR badge at the registration desk in the main hall.
        </Text>

        <TouchableOpacity onPress={onOpenQR} activeOpacity={0.85} style={_s.gatePrimaryBtn}>
          <LinearGradient colors={[COLORS.brand, '#4f46e5']} style={_s.gatePrimaryGrad}>
            <Ionicons name="ticket" size={18} color="#fff" />
            <Text style={_s.gatePrimaryBtnT}>Show My QR Badge</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" style={{ marginLeft: 'auto' }} />
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity onPress={onRefresh} disabled={checking} activeOpacity={0.75} style={_s.gateSecondaryBtn}>
          <Ionicons name="refresh" size={16} color="#94a3b8" />
          <Text style={_s.gateSecondaryBtnT}>{checking ? 'Checking verification...' : "I'm Checked In — Refresh"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function NetworkScreen({
  tokens,
  user,
  onOpenChat,
  pendingCount,
  onOpenRequests,
  onShake,
  onOpenQR,
}) {
  const [activeTab, setActiveTab] = useState('Attendees');
  const [isCheckedIn, setIsCheckedIn] = useState(true);
  const [gateLoading, setGateLoading] = useState(false);

  const [attendees, setAttendees] = useState(_memCache.attendees || []);
  const [speakers, setSpeakers] = useState(_memCache.speakers || []);
  const [interests, setInterests] = useState(_memCache.interests || []);
  const [discover, setDiscover] = useState(_memCache.discover || null);
  const [spotIdx, setSpotIdx] = useState(0);
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [connStatus, setConnStatus] = useState({});
  const [cardTarget, setCardTarget] = useState(null);
  const [speakerTarget, setSpeakerTarget] = useState(null);
  const [searchVisible, setSearchVisible] = useState(false);

  const searchTimer = useRef(null);

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

  const verifyCheckInStatus = useCallback(async () => {
    try {
      setGateLoading(true);
      const r = await fetch(`${API_URL}/checkins/status/`, { headers: authH(tokens) });
      const d = await r.json();
      if (d.success) {
        setIsCheckedIn(!!d.checked_in);
      }
    } catch {}
    finally {
      setGateLoading(false);
    }
  }, [tokens]);

  const fetchAttendeesList = useCallback(async (searchText = '', interestText = '', useLocalCache = false) => {
    const isFiltered = !!(searchText.trim() || interestText);

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
      if (d.is_checked_in !== undefined) {
        setIsCheckedIn(d.is_checked_in);
      }
      const list = (d.attendees || [])
        .filter(a => a.role !== 'speaker')
        .map(a => ({ ...a, profile_photo_url: fixMediaUrl(a.profile_photo_url) }));

      setAttendees(list);

      if (!isFiltered) {
        const interests = d.interests || [];
        setInterests(interests);
        _memCache.attendees = list;
        _memCache.interests = interests;
        setNetCache('attendees', { list, interests });
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
        .map(a => ({ ...a, profile_photo_url: fixMediaUrl(a.profile_photo_url) }));

      setSpeakers(list);

      if (!isFiltered) {
        _memCache.speakers = list;
        setNetCache('speakers', list);
      }

      loadStatuses(list.map(a => a.id).filter(id => id !== user?.id));
      return list;
    } catch { return _memCache.speakers || []; }
  }, [tokens, user?.id, loadStatuses]);

  const fetchDiscoverData = useCallback(async () => {
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
      setNetCache('discover', payload);
      loadStatuses(payload.matches.map(m => m.id));
      return payload;
    } catch { return _memCache.discover || null; }
  }, [tokens, loadStatuses]);

  useEffect(() => {
    (async () => {
      await verifyCheckInStatus();
      const [ca, cs, cd] = await Promise.all([
        getNetCache('attendees'),
        getNetCache('speakers'),
        getNetCache('discover'),
      ]);
      if (ca) { _memCache.attendees = ca.list; setAttendees(ca.list); setInterests(ca.interests); }
      if (cs) { _memCache.speakers = cs; setSpeakers(cs); }
      if (cd) { _memCache.discover = cd; setDiscover(cd); }

      setLoading(true);
      await Promise.all([
        fetchAttendeesList('', '', false),
        fetchDiscoverData(),
        fetchSpeakersList('', false),
      ]);
      setLoading(false);
    })();
  }, []);

  const refreshAttendees = async () => {
    setRefreshing(true);
    await fetchAttendeesList(search, activeTag, false);
    setRefreshing(false);
  };

  const refreshSpeakers = async () => {
    setRefreshing(true);
    await fetchSpeakersList(search, false);
    setRefreshing(false);
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

  // Normalize person so ContactCardModal always has photo + name fields
  const normalizePerson = (person) => {
    if (!person) return null;
    const photo = fixMediaUrl(person.profile_photo_url || person.photo || null);
    return {
      ...person,
      id: person.id,
      name: person.name || `${person.first_name || ''} ${person.last_name || ''}`.trim() || person.email || 'Attendee',
      first_name: person.first_name || (person.name || '').split(' ')[0] || '',
      last_name: person.last_name || (person.name || '').split(' ').slice(1).join(' ') || '',
      profile_photo_url: photo,
      photo,
      affiliation: person.affiliation || '',
      designation: person.designation || '',
      research_interests: person.research_interests || '',
      role: person.role || 'participant',
      email: person.email || '',
    };
  };

  // Clear → reopen so ContactCardModal fully remounts (fixes 2nd open bug)
  const openContactCard = (person) => {
    const p = normalizePerson(person);
    if (!p) return;
    setSpeakerTarget(null);
    setCardTarget(null);
    setTimeout(() => setCardTarget(p), 60);
  };

  const openSpeakerCard = (person) => {
    const p = normalizePerson(person);
    if (!p) return;
    setCardTarget(null);
    setSpeakerTarget(null);
    setTimeout(() => setSpeakerTarget(p), 60);
  };

  const handlePersonPress = person => {
    if (!person) return;
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

    // Speakers → moderated request modal; everyone else → same attendee ContactCard
    if (person.role === 'speaker' || activeTab === 'Speakers') {
      openSpeakerCard(person);
    } else {
      openContactCard(person);
    }
  };

  const universeParticipants = useMemo(() => {
    const map = new Map();
    [...attendees, ...speakers].forEach(p => {
      if (p?.id && !map.has(p.id)) map.set(p.id, p);
    });
    return Array.from(map.values());
  }, [attendees, speakers]);

  if (!isCheckedIn) {
    return (
      <CheckInGateScreen
        onOpenQR={onOpenQR}
        onRefresh={verifyCheckInStatus}
        checking={gateLoading}
      />
    );
  }

  const tabW = (W - SPACE.xl * 2 - 8) / TABS.length;
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

        <View style={_s.headerRow}>
          <View style={_s.headerLeft}>
            <Text style={_s.headerTitle}>Network</Text>
            <Text style={_s.headerSub}>
              {activeTab === 'Universe' ? '3D Radial Universe' : activeTab === 'For You' ? 'Your Research Radar' : 'Explore & Connect'}
            </Text>
          </View>

          <View style={_s.headerBtns}>
            {activeTab !== 'For You' && activeTab !== 'Universe' && (
              <TouchableOpacity style={_s.hBtn} onPress={() => setSearchVisible(!searchVisible)} activeOpacity={0.7}>
                <Ionicons name={searchVisible ? 'close' : 'search'} size={19} color="#fff" />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={_s.hShakeBtn} onPress={onShake} activeOpacity={0.8}>
              <Text style={{ fontSize: 16 }}>🤝</Text>
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

        {searchVisible && activeTab !== 'Universe' && activeTab !== 'For You' && (
          <View style={_s.searchBox}>
            <Ionicons name="search" size={17} color="#94a3b8" />
            <TextInput
              style={_s.searchInput}
              placeholder={`Search ${activeTab.toLowerCase()}...`}
              placeholderTextColor="#64748b"
              value={search}
              onChangeText={onSearchInput}
              returnKeyType="search"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={clearAll}>
                <Ionicons name="close" size={16} color="#64748b" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </LinearGradient>

      <View style={_s.body}>
        <View style={_s.tabOuter}>
          <View style={_s.tabBar}>
            <View style={[_s.tabSlider, { width: tabW, transform: [{ translateX: tabOffset }] }]}>
              <LinearGradient
                colors={
                  activeTab === 'Universe'
                    ? ['#0284c7', '#6366f1']
                    : activeTab === 'For You'
                    ? ['#7c3aed', '#4f46e5']
                    : activeTab === 'Speakers'
                    ? ['#7c3aed', '#6d28d9']
                    : [COLORS.brand, '#1e40af']
                }
                style={_s.tabSliderGrad}
              />
            </View>

            {TABS.map(tab => (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.8}
                style={[_s.tabItem, { width: tabW }]}
              >
                <Ionicons
                  name={
                    tab === 'Attendees'
                      ? 'people'
                      : tab === 'Universe'
                      ? 'planet'
                      : tab === 'For You'
                      ? 'sparkles'
                      : 'mic'
                  }
                  size={14}
                  color={activeTab === tab ? '#fff' : '#64748b'}
                />
                <Text style={[_s.tabT, activeTab === tab && _s.tabTA]} numberOfLines={1}>
                  {tab}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* TAB 1: ATTENDEES */}
        {activeTab === 'Attendees' && (
          <View style={{ flex: 1 }}>
            {interests.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={_s.chipScroll} style={_s.chipWrap}>
                <TouchableOpacity
                  style={[_s.chip, !activeTag && _s.chipOn]}
                  onPress={() => { setActiveTag(''); fetchAttendeesList(search, '', false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[_s.chipT, !activeTag && _s.chipTOn]}>All</Text>
                </TouchableOpacity>

                {interests.map(tag => (
                  <TouchableOpacity
                    key={tag}
                    style={[_s.chip, activeTag === tag && _s.chipOn]}
                    onPress={() => toggleTag(tag)}
                    activeOpacity={0.7}
                  >
                    <Text style={[_s.chipT, activeTag === tag && _s.chipTOn]}>{tag}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {loading ? (
              <SkeletonList />
            ) : (
              <FlatList
                data={attendees}
                keyExtractor={(p, idx) => p?.id ? String(p.id) : `att-${idx}`}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={_s.listContent}
                initialNumToRender={8}
                maxToRenderPerBatch={10}
                windowSize={5}
                removeClippedSubviews={true}
                updateCellsBatchingPeriod={50}
                refreshControl={
                  <RefreshControl refreshing={refreshing} onRefresh={refreshAttendees} tintColor={COLORS.brand} />
                }
                renderItem={({ item: p }) => (
                  <PersonCard
                    person={p}
                    isSelf={p.id === user?.id}
                    isSpeaker={false}
                    cs={connStatus[p.id]}
                    activeTag={activeTag}
                    onPress={handlePersonPress}
                    onTag={toggleTag}
                  />
                )}
                ListFooterComponent={<View style={{ height: 140 }} />}
              />
            )}
          </View>
        )}

        {/* TAB 2: UNIVERSE */}
        {activeTab === 'Universe' && (
          <InfiniteMenu
            items={universeParticipants}
            connStatus={connStatus}
            onSelectPerson={handlePersonPress}
            onOpenAction={handlePersonPress}
          />
        )}

        {/* TAB 3: FOR YOU */}
        {activeTab === 'For You' && (
          <FlatList
            data={discover?.matches || []}
            keyExtractor={(p, idx) => p?.id ? String(p.id) : `disc-${idx}`}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={_s.listContent}
            ListHeaderComponent={
              <View>
                {discover?.matches?.[spotIdx] && (
                  <DiscoverySpotlight
                    person={discover.matches[spotIdx]}
                    cs={connStatus[discover.matches[spotIdx].id]}
                    onAction={handlePersonPress}
                    onShuffle={() => setSpotIdx(i => (i + 1) % (discover.matches.length || 1))}
                  />
                )}
                <ConferenceCloud
                  cloud={discover?.interest_cloud || []}
                  myInterests={discover?.my_interests || []}
                  onConnectPerson={handlePersonPress}
                  tokens={tokens}
                />
              </View>
            }
            renderItem={({ item }) => (
              <DiscoveryCard
                person={item}
                cs={connStatus[item.id]}
                onAction={handlePersonPress}
              />
            )}
            ListFooterComponent={<View style={{ height: 140 }} />}
          />
        )}

        {/* TAB 4: SPEAKERS */}
        {activeTab === 'Speakers' && (
          <FlatList
            data={speakers}
            keyExtractor={(p, idx) => p?.id ? String(p.id) : `spk-${idx}`}
            numColumns={2}
            columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: SPACE.xl }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: SPACE.xs, paddingBottom: 140 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={refreshSpeakers} tintColor="#7c3aed" />
            }
            renderItem={({ item }) => (
              <SpeakerGridCard
                person={item}
                cs={connStatus[item.id]}
                onPress={handlePersonPress}
              />
            )}
          />
        )}
      </View>

      <ContactCardModal
        key={cardTarget ? `card-${cardTarget.id}` : 'card-closed'}
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
        key={speakerTarget ? `spk-${speakerTarget.id}` : 'spk-closed'}
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
  root: { flex: 1, backgroundColor: '#ffffff' },
  header: {
    paddingTop: Platform.OS === 'ios' ? 58 : 44,
    paddingHorizontal: SPACE.xl,
    paddingBottom: SPACE.xxxl,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerLeft: { flex: 1 },
  headerTitle: { fontSize: 30, fontWeight: '900', color: '#fff', letterSpacing: -0.8 },
  headerSub: { fontSize: 13, color: '#fff', marginTop: 4, fontWeight: '500' },
  headerBtns: { flexDirection: 'row', gap: 8 },
  hBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hBadgeT: { fontSize: 9, fontWeight: '800', color: '#fff' },
  hShakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
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
    height: 46,
    marginTop: 12,
    ...SHADOW.md,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#0f172a' },
  body: {
    flex: 1,
    marginTop: -18,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  tabOuter: { paddingHorizontal: SPACE.xl, paddingTop: 18, paddingBottom: SPACE.sm },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 4,
    ...SHADOW.md,
    position: 'relative',
  },
  tabSlider: {
    position: 'absolute',
    top: 4,
    left: 4,
    bottom: 4,
    borderRadius: 12,
  },
  tabSliderGrad: { flex: 1, borderRadius: 12 },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    zIndex: 1,
  },
  tabT: { fontSize: 11, fontWeight: '800', color: '#64748b' },
  tabTA: { color: '#fff', fontWeight: '900' },
  chipWrap: { marginBottom: SPACE.sm, height: 38 },
  chipScroll: { paddingHorizontal: SPACE.xl, gap: 6, flexDirection: 'row', alignItems: 'center' },
  chip: {
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipOn: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  chipT: { fontSize: 11, fontWeight: '700', color: '#475569' },
  chipTOn: { color: '#fff' },
  listContent: { paddingHorizontal: SPACE.xl, paddingTop: SPACE.xs },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
    overflow: 'hidden',
    ...SHADOW.md,
  },
  cardSpeaker: { borderColor: '#ddd6fe' },
  speakerBar: { height: 4 },
  cardRow1: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  avatarOuter: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatar: { width: 52, height: 52, borderRadius: 16 },
  micBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCol: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  youPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  youPillT: { fontSize: 8, fontWeight: '900', color: '#fff' },
  desig: { fontSize: 13, fontWeight: '600', color: '#334155' },
  aff: { fontSize: 12, fontWeight: '600', color: COLORS.brand },
  chevronBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  previewTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 14, paddingBottom: 12 },
  previewTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0f4ff',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  previewTagDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.brand },
  previewTagT: { fontSize: 11, fontWeight: '600', color: '#3b53c4' },
  expandedSection: { paddingHorizontal: 14, paddingBottom: 14 },
  expandDivider: { height: 1, backgroundColor: '#f1f5f9', marginBottom: 12 },
  expandBlock: { marginBottom: 12 },
  expandLabelT: { fontSize: 11, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: 6 },
  allTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  fullTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#f0f4ff',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#dbe4ff',
  },
  fullTagActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  fullTagDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: COLORS.brand },
  fullTagDotActive: { backgroundColor: '#fff' },
  fullTagT: { fontSize: 12, fontWeight: '700', color: '#2d3a8c' },
  fullTagTActive: { color: '#fff' },
  actionWrap: { marginTop: 4 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  actionBtnT: { fontSize: 14, fontWeight: '800' },
  dHero: { borderRadius: 22, padding: 16, marginBottom: 14, ...SHADOW.md },
  dHeroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  dHeroPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  dHeroPillT: { fontSize: 11, fontWeight: '800', color: '#fff' },
  dShuffleBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dShuffleBtnT: { fontSize: 11, fontWeight: '700', color: '#fff' },
  dHeroMain: { flexDirection: 'row', alignItems: 'center' },
  dHeroLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  dHeroAvatarWrap: { width: 64, height: 64, borderRadius: 20 },
  dHeroAvatar: { width: 64, height: 64, borderRadius: 20 },
  dHeroName: { fontSize: 19, fontWeight: '900', color: '#fff' },
  dHeroDesig: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  dHeroAff: { fontSize: 12, fontWeight: '600', color: '#bfdbfe' },
  dHeroWhy: { fontSize: 13, color: '#e0e7ff', marginTop: 12 },
  dCta: { borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  dCtaT: { fontSize: 14, fontWeight: '900', color: '#fff' },
  dCard: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 10, ...SHADOW.sm },
  dCardRow: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  dCardAvatarWrap: { width: 52, height: 52, marginRight: 10 },
  dCardAvatar: { width: 52, height: 52, borderRadius: 16 },
  dCardInfo: { flex: 1 },
  dCardName: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  dCardDesig: { fontSize: 12, fontWeight: '600', color: '#475569' },
  dCardAff: { fontSize: 11, fontWeight: '600', color: COLORS.brand },
  dMiniBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cloudCard: { backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', padding: 14, marginBottom: 14, ...SHADOW.sm },
  cloudHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cloudIconWrap: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  cloudTitle: { fontSize: 14, fontWeight: '900', color: '#0f172a' },
  cloudSub: { fontSize: 11, color: '#64748b' },
  bubbleField: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' },
  bubbleExpanded: { marginTop: 10, backgroundColor: '#f8fafc', borderRadius: 14, padding: 10 },
  bubbleExpandedHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  bubbleExpandedPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  bubbleExpandedPillT: { fontSize: 10, fontWeight: '800', color: '#fff' },
  bubbleCloseBtn: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  bubblePersonRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  bubblePersonPhoto: { width: 36, height: 36, borderRadius: 12 },
  bubblePersonName: { fontSize: 12, fontWeight: '800', color: '#0f172a' },
  bubblePersonAff: { fontSize: 10, color: '#64748b' },
  bubblePersonBtn: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sgCard: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0', ...SHADOW.md },
  sgPhotoWrap: { aspectRatio: 0.88, width: '100%', position: 'relative' },
  sgPhoto: { width: '100%', height: '100%' },
  sgOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%' },
  sgStatusPill: { position: 'absolute', top: 6, left: 6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  sgStatusT: { fontSize: 8, fontWeight: '800', color: '#fff' },
  sgMicBadge: { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  sgInfo: { padding: 8 },
  sgName: { fontSize: 13, fontWeight: '800', color: '#0f172a' },
  sgAff: { fontSize: 10, fontWeight: '600', color: '#475569', marginTop: 2 },
  skelCard: { backgroundColor: '#fff', borderRadius: 20, padding: 14, marginBottom: 12 },
  gateContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  gateCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    ...SHADOW.xl,
  },
  gateIconGlow: {
    width: 84,
    height: 84,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    ...SHADOW.accent,
  },
  gateIconInner: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 12,
  },
  gatePillText: { fontSize: 10, fontWeight: '900', color: '#38bdf8', letterSpacing: 1 },
  gateTitle: { fontSize: 20, fontWeight: '900', color: '#fff', textAlign: 'center', marginBottom: 10 },
  gateDesc: { fontSize: 13, color: '#94a3b8', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  gatePrimaryBtn: { width: '100%', borderRadius: 16, overflow: 'hidden', marginBottom: 12 },
  gatePrimaryGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  gatePrimaryBtnT: { fontSize: 14, fontWeight: '800', color: '#fff' },
  gateSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  gateSecondaryBtnT: { fontSize: 12, fontWeight: '700', color: '#94a3b8' },
});
