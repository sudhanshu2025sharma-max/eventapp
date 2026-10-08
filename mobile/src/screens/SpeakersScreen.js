import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Image, StyleSheet,
  Platform, StatusBar, RefreshControl, Dimensions, Animated, Easing, Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  COLORS, FONT, SPACE, RADIUS, SHADOW, API_URL, API_HEADERS, TOP, BOTTOM, fixMediaUrl,
} from '../theme';
import SpeakerDetailScreen from './SpeakerDetailScreen';

const { width: W } = Dimensions.get('window');
const PAD = SPACE.xl;
const STATUS_TOP = TOP || (Platform.OS === 'ios' ? 50 : 38);
const NAVBAR_HEIGHT = STATUS_TOP + 52;
const CARD_WIDTH = (W - PAD * 2 - SPACE.md) / 2;

const GRAD_PAIRS = [
  [COLORS.brand, COLORS.brandDark],
  [COLORS.teal, COLORS.brand],
  [COLORS.purple, COLORS.brand],
  [COLORS.accent, COLORS.accentDark],
  [COLORS.rose, COLORS.purple],
];

function getGrad(idx) {
  return GRAD_PAIRS[(idx || 0) % GRAD_PAIRS.length];
}

// ── Animated Counter for Hero Stats ───────────────────────────────────────
function AnimatedStatNumber({ value, style }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    anim.setValue(0);
    const id = anim.addListener(({ value: v }) => setDisplay(Math.round(v)));
    Animated.timing(anim, {
      toValue: value || 0,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => anim.removeListener(id);
  }, [value, anim]);

  return <Text style={style}>{display}</Text>;
}

// ── Skeletons ─────────────────────────────────────────────────────────────
const SkeletonPulse = ({ width, height, borderRadius = RADIUS.md, style }) => {
  const anim = useRef(new Animated.Value(0.16)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.36, duration: 850, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.16, duration: 850, useNativeDriver: true }),
      ])
    ).start();
  }, [anim]);
  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: COLORS.textInverse, opacity: anim },
        style,
      ]}
    />
  );
};

const SkeletonGrid = () => (
  <View style={st.gridContainer}>
    {[1, 2, 3, 4, 5, 6].map((i) => (
      <View key={i} style={{ width: CARD_WIDTH, marginBottom: SPACE.lg }}>
        <SkeletonPulse width={CARD_WIDTH} height={CARD_WIDTH * 1.15} borderRadius={RADIUS.xl} />
        <View style={{ marginTop: SPACE.sm, gap: 6, paddingHorizontal: 4 }}>
          <SkeletonPulse width="80%" height={15} borderRadius={RADIUS.xs} />
          <SkeletonPulse width="55%" height={12} borderRadius={RADIUS.xs} />
        </View>
      </View>
    ))}
  </View>
);

// ── iOS-Safe Immersive Background Aura (No CSS filter blur bug) ───────────
const BackgroundAura = () => {
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 5500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 5500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [floatAnim]);

  const translateY1 = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 26] });
  const scale1 = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] });
  const translateX2 = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -22] });
  const scale2 = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [1.1, 0.95] });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={[COLORS.brandDeeper, COLORS.brandDeep, COLORS.brandDark, COLORS.brandDeeper]}
        locations={[0, 0.38, 0.75, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <Animated.View
        style={[
          st.orb1,
          { transform: [{ translateY: translateY1 }, { scale: scale1 }] },
        ]}
      />
      <Animated.View
        style={[
          st.orb2,
          { transform: [{ translateX: translateX2 }, { scale: scale2 }] },
        ]}
      />
      <Animated.View
        style={[
          st.orb3,
          { transform: [{ scale: scale1 }] },
        ]}
      />
    </View>
  );
};

// ── Animated 2-Column Speaker Card ────────────────────────────────────────
function SpeakerGridCard({ speaker, index, onPress }) {
  const [imgOk, setImgOk] = useState(true);
  const scale = useRef(new Animated.Value(1)).current;
  const entrance = useRef(new Animated.Value(0)).current;

  const [g1, g2] = getGrad(speaker.id || index);
  const photoUrl = speaker.photo_url
    ? typeof fixMediaUrl === 'function'
      ? fixMediaUrl(speaker.photo_url)
      : speaker.photo_url
    : null;

  useEffect(() => {
    Animated.spring(entrance, {
      toValue: 1,
      tension: 50,
      friction: 8,
      delay: Math.min((index % 10) * 65, 420),
      useNativeDriver: true,
    }).start();
  }, [entrance, index]);

  const onPressIn = () => {
    Animated.spring(scale, {
      toValue: 0.95,
      useNativeDriver: true,
      speed: 38,
      bounciness: 4,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 28,
      bounciness: 6,
    }).start();
  };

  const translateY = entrance.interpolate({ inputRange: [0, 1], outputRange: [32, 0] });

  return (
    <Animated.View
      style={{
        width: CARD_WIDTH,
        marginBottom: SPACE.lg,
        opacity: entrance,
        transform: [{ translateY }, { scale }],
      }}
    >
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[
          st.cardInner,
          speaker.is_keynote && st.cardInnerKeynote,
        ]}
      >
        {/* Uncropped Portrait Stage */}
        <View style={st.avatarWrap}>
          {photoUrl && imgOk ? (
            <View style={st.portraitStage}>
              <Image
                source={{ uri: photoUrl }}
                style={StyleSheet.absoluteFillObject}
                blurRadius={18}
                resizeMode="cover"
              />
              <View style={st.portraitTint} />
              <Image
                source={{ uri: photoUrl }}
                style={st.avatarImg}
                resizeMode="contain"
                onError={() => setImgOk(false)}
              />
            </View>
          ) : (
            <LinearGradient colors={[g1, g2]} style={st.avatarImg}>
              <Text style={st.avatarInitials}>{speaker.initials}</Text>
            </LinearGradient>
          )}

          <LinearGradient
            colors={['transparent', 'rgba(7,6,20,0.75)']}
            style={st.avatarScrim}
          />

          {/* Top Floating Badges */}
          <View style={st.topBadges}>
            {speaker.is_keynote ? (
              <View style={st.keynoteBadge}>
                <Ionicons name="star" size={10} color={COLORS.accentDark} />
                <Text style={st.keynoteBadgeText}>KEYNOTE</Text>
              </View>
            ) : (
              <View />
            )}

            {speaker.talk_count > 0 && (
              <View style={st.talkBadge}>
                <Ionicons name="mic-outline" size={10} color={COLORS.textInverse} />
                <Text style={st.talkBadgeText}>{speaker.talk_count}</Text>
              </View>
            )}
          </View>

          {/* Country Tag on Image Bottom */}
          {!!speaker.country && (
            <View style={st.countryTag}>
              <Ionicons name="globe-outline" size={10} color={COLORS.accentLight} />
              <Text style={st.countryTagText} numberOfLines={1}>{speaker.country}</Text>
            </View>
          )}
        </View>

        {/* Speaker Info */}
        <View style={st.infoWrap}>
          <Text style={st.cardName} numberOfLines={1}>{speaker.full_name}</Text>
          <Text style={st.cardDesig} numberOfLines={2}>
            {speaker.designation || 'Distinguished Speaker'}
          </Text>

          <View style={st.instRow}>
            <Ionicons name="business-outline" size={11} color={COLORS.accent} />
            <Text style={st.cardInst} numberOfLines={1}>
              {speaker.institute || 'ETD 2026'}
            </Text>
            <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.45)" />
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ── Section Header ────────────────────────────────────────────────────────
function SectionHeader({ label, count, icon, accentColor, accentBg }) {
  return (
    <View style={st.secHeader}>
      <View style={[st.secIconWrap, { backgroundColor: accentBg }]}>
        <Ionicons name={icon} size={17} color={accentColor} />
      </View>
      <Text style={st.secLabel}>{label}</Text>
      <View style={[st.secCount, { backgroundColor: accentBg }]}>
        <Text style={[st.secCountText, { color: accentColor }]}>{count}</Text>
      </View>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────
export default function SpeakersScreen({ tokens, onBack, onOpenChatRoom }) {
  const [keynotes, setKeynotes] = useState([]);
  const [speakers, setSpeakers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const scrollY = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/speakers/`, { headers: API_HEADERS });
      const data = await res.json();
      setKeynotes(data.keynotes || []);
      setSpeakers(data.speakers || []);
    } catch (e) {
      console.log('Speakers fetch error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetch_();
  }, [fetch_]);

  const onRefresh = () => {
    setRefreshing(true);
    fetch_();
  };

  if (selectedId !== null) {
    return (
      <SpeakerDetailScreen
        tokens={tokens}
        speakerId={selectedId}
        onBack={() => setSelectedId(null)}
        onOpenChatRoom={onOpenChatRoom}
      />
    );
  }

  const totalCount = keynotes.length + speakers.length;
  const countriesCount = [
    ...new Set([...keynotes, ...speakers].map((s) => s.country).filter(Boolean)),
  ].length;

  const headerBgOpacity = scrollY.interpolate({
    inputRange: [35, 100],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const heroTranslateY = scrollY.interpolate({
    inputRange: [-80, 0, 160],
    outputRange: [-15, 0, 28],
    extrapolate: 'clamp',
  });

  const heroOpacity = scrollY.interpolate({
    inputRange: [0, 180],
    outputRange: [1, 0.35],
    extrapolate: 'clamp',
  });

  return (
    <View style={st.screen}>
      <StatusBar barStyle="light-content" />
      <BackgroundAura />

      {/* Sticky Top Header */}
      <View style={st.headerWrap}>
        <Animated.View style={[st.headerBlur, { opacity: headerBgOpacity }]}>
          <LinearGradient
            colors={[COLORS.brandDeeper, COLORS.brandDeep]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>

        <View style={st.topbar}>
          <TouchableOpacity onPress={onBack} style={st.backBtn} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={20} color={COLORS.textInverse} />
          </TouchableOpacity>

          <Animated.View style={{ alignItems: 'center', opacity: headerBgOpacity }}>
            <Text style={st.topTitle}>Speakers</Text>
            <Text style={st.topSub}>ETD 2026</Text>
          </Animated.View>

          <View style={{ width: 40 }} />
        </View>
      </View>

      <Animated.ScrollView
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingHorizontal: PAD,
          paddingTop: NAVBAR_HEIGHT + SPACE.sm,
          paddingBottom: 100 + BOTTOM,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.textInverse}
          />
        }
      >
        {/* Immersive Hero Section */}
        <Animated.View
          style={[
            st.hero,
            { opacity: heroOpacity, transform: [{ translateY: heroTranslateY }] },
          ]}
        >
          <View style={st.heroPill}>
            <Animated.View style={[st.heroPillDot, { opacity: pulseAnim }]} />
            <Text style={st.heroPillText}>ETD 2026 · IIT DELHI</Text>
          </View>

          <Text style={st.heroTitle}>Meet the{'\n'}Speakers</Text>
          <Text style={st.heroSub}>
            Join {totalCount > 0 ? totalCount : 'our'} distinguished global experts in{'\n'}library science & digital scholarship
          </Text>

          {/* Animated Bento Stats */}
          {!loading && totalCount > 0 && (
            <View style={st.statRow}>
              {[
                {
                  label: 'Keynotes',
                  value: keynotes.length,
                  icon: 'star',
                  color: COLORS.accent,
                  bg: COLORS.accentMid,
                },
                {
                  label: 'Speakers',
                  value: speakers.length,
                  icon: 'mic-outline',
                  color: '#60a5fa',
                  bg: 'rgba(96,165,250,0.18)',
                },
                {
                  label: 'Countries',
                  value: countriesCount,
                  icon: 'globe-outline',
                  color: COLORS.success,
                  bg: 'rgba(16,185,129,0.18)',
                },
              ].map((s) => (
                <View key={s.label} style={st.statPill}>
                  <View style={[st.statIconBox, { backgroundColor: s.bg }]}>
                    <Ionicons name={s.icon} size={15} color={s.color} />
                  </View>
                  <AnimatedStatNumber value={s.value} style={st.statValue} />
                  <Text style={st.statLabel}>{s.label}</Text>
                </View>
              ))}
            </View>
          )}
        </Animated.View>

        {/* Speaker Grids */}
        {loading ? (
          <SkeletonGrid />
        ) : (
          <View>
            {keynotes.length > 0 && (
              <View style={{ marginBottom: SPACE.xl }}>
                <SectionHeader
                  label="Keynote Speakers"
                  count={keynotes.length}
                  icon="star"
                  accentColor={COLORS.accent}
                  accentBg={COLORS.accentMid}
                />
                <View style={st.gridContainer}>
                  {keynotes.map((sp, i) => (
                    <SpeakerGridCard
                      key={sp.id}
                      speaker={sp}
                      index={i}
                      onPress={() => setSelectedId(sp.id)}
                    />
                  ))}
                </View>
              </View>
            )}

            {speakers.length > 0 && (
              <View style={{ marginBottom: SPACE.xl }}>
                <SectionHeader
                  label="Invited Speakers"
                  count={speakers.length}
                  icon="people-outline"
                  accentColor="#60a5fa"
                  accentBg="rgba(96,165,250,0.18)"
                />
                <View style={st.gridContainer}>
                  {speakers.map((sp, i) => (
                    <SpeakerGridCard
                      key={sp.id}
                      speaker={sp}
                      index={i}
                      onPress={() => setSelectedId(sp.id)}
                    />
                  ))}
                </View>
              </View>
            )}

            {keynotes.length === 0 && speakers.length === 0 && (
              <View style={st.empty}>
                <View style={st.emptyIconWrap}>
                  <Ionicons name="mic-off-outline" size={42} color="rgba(255,255,255,0.45)" />
                </View>
                <Text style={st.emptyTitle}>No speakers announced</Text>
                <Text style={st.emptyText}>Check back closer to the event date.</Text>
              </View>
            )}
          </View>
        )}
      </Animated.ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.brandDeeper,
  },

  // iOS-Safe Ambient Orbs
  orb1: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(3,51,182,0.32)',
    top: -80,
    right: -90,
  },
  orb2: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(245,158,11,0.10)',
    top: 240,
    left: -90,
  },
  orb3: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(20,184,166,0.10)',
    bottom: 60,
    right: -90,
  },

  // Pinned Header
  headerWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: NAVBAR_HEIGHT,
    paddingTop: STATUS_TOP,
    justifyContent: 'center',
    zIndex: 100,
  },
  headerBlur: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.brandDeep,
    borderBottomWidth: 1,
    borderColor: COLORS.glassBorder,
    ...SHADOW.md,
  },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PAD,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.glass,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  topTitle: {
    fontSize: FONT.md,
    fontWeight: FONT.w8,
    color: COLORS.textInverse,
    letterSpacing: 0.3,
  },
  topSub: {
    fontSize: FONT.micro,
    fontWeight: FONT.w7,
    color: COLORS.accentLight,
    letterSpacing: 1.4,
    marginTop: 1,
  },

  // Hero Section
  hero: {
    paddingBottom: SPACE.xl,
    marginTop: SPACE.xs,
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    backgroundColor: COLORS.glass,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACE.md,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    marginBottom: SPACE.md,
  },
  heroPillDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: COLORS.accent,
  },
  heroPillText: {
    fontSize: FONT.micro,
    fontWeight: FONT.w8,
    color: COLORS.textInverse,
    letterSpacing: 1.1,
  },
  heroTitle: {
    fontSize: FONT.hero,
    fontWeight: FONT.w9,
    color: COLORS.textInverse,
    letterSpacing: -1,
    lineHeight: 44,
    marginBottom: SPACE.sm,
  },
  heroSub: {
    fontSize: FONT.sm,
    color: 'rgba(255,255,255,0.72)',
    lineHeight: 20,
    marginBottom: SPACE.xl,
  },

  // Hero Stats
  statRow: {
    flexDirection: 'row',
    gap: SPACE.sm,
  },
  statPill: {
    flex: 1,
    backgroundColor: COLORS.glass,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statIconBox: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  statValue: {
    fontSize: FONT.xl,
    fontWeight: FONT.w9,
    color: COLORS.textInverse,
  },
  statLabel: {
    fontSize: FONT.micro,
    fontWeight: FONT.w7,
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 2,
  },

  // Section Header
  secHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    marginBottom: SPACE.md,
  },
  secIconWrap: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secLabel: {
    flex: 1,
    fontSize: FONT.lg,
    fontWeight: FONT.w8,
    color: COLORS.textInverse,
    letterSpacing: -0.3,
  },
  secCount: {
    paddingHorizontal: SPACE.sm + 2,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    minWidth: 28,
    alignItems: 'center',
  },
  secCountText: {
    fontSize: FONT.xs,
    fontWeight: FONT.w9,
  },

  // Grid Layout
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  // Speaker Grid Card
  cardInner: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  cardInnerKeynote: {
    borderColor: 'rgba(245,158,11,0.45)',
  },
  avatarWrap: {
    position: 'relative',
    width: '100%',
    height: CARD_WIDTH * 1.06,
    backgroundColor: COLORS.brandDeep,
  },
  portraitStage: {
    flex: 1,
    overflow: 'hidden',
  },
  portraitTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7,6,20,0.25)',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: FONT.xxxl,
    fontWeight: FONT.w9,
    color: COLORS.textInverse,
  },
  avatarScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '38%',
  },

  topBadges: {
    position: 'absolute',
    top: SPACE.sm,
    left: SPACE.sm,
    right: SPACE.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  keynoteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.accentLight,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  keynoteBadgeText: {
    fontSize: 9.5,
    fontWeight: FONT.w9,
    color: COLORS.accentDark,
    letterSpacing: 0.4,
  },
  talkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(7,6,20,0.65)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  talkBadgeText: {
    fontSize: FONT.micro,
    fontWeight: FONT.w8,
    color: COLORS.textInverse,
  },
  countryTag: {
    position: 'absolute',
    bottom: SPACE.sm,
    left: SPACE.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(7,6,20,0.62)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    maxWidth: '86%',
  },
  countryTagText: {
    fontSize: FONT.micro,
    fontWeight: FONT.w7,
    color: COLORS.textInverse,
  },

  infoWrap: {
    padding: SPACE.md,
  },
  cardName: {
    fontSize: FONT.base,
    fontWeight: FONT.w8,
    color: COLORS.textInverse,
    letterSpacing: -0.2,
  },
  cardDesig: {
    fontSize: FONT.xs,
    color: 'rgba(255,255,255,0.68)',
    lineHeight: 16,
    marginTop: 3,
    height: 32,
  },
  instRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: SPACE.sm,
    paddingTop: SPACE.xs + 2,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.10)',
  },
  cardInst: {
    fontSize: FONT.micro,
    fontWeight: FONT.w7,
    color: COLORS.brandLight,
    flex: 1,
  },

  // Empty State
  empty: {
    alignItems: 'center',
    paddingVertical: 70,
    paddingHorizontal: SPACE.xl,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.glass,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACE.md,
  },
  emptyTitle: {
    fontSize: FONT.lg,
    fontWeight: FONT.w8,
    color: COLORS.textInverse,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: FONT.sm,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
  },
});
