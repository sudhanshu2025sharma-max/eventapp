import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, Image, StyleSheet,
  Platform, StatusBar, RefreshControl, Dimensions, Animated, Easing, Pressable, ScrollView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  COLORS, FONT, SPACE, RADIUS, SHADOW, API_URL, API_HEADERS, TOP, fixMediaUrl,
} from '../theme';
import SpeakerDetailScreen from './SpeakerDetailScreen';

const { width: W } = Dimensions.get('window');
const PAD = SPACE.xl;
const STATUS_TOP = TOP || (Platform.OS === 'ios' ? 50 : 38);
const COL_WIDTH = (W - PAD * 2 - SPACE.md) / 2;

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

function resolvePhoto(url) {
  if (!url) return null;
  return typeof fixMediaUrl === 'function' ? fixMediaUrl(url) : url;
}

// ── Live Animated Audio Equalizer Bars ────────────────────────────────────
function EqualizerBars({ color = COLORS.accent, count = 4, height = 12 }) {
  const bars = useRef(
    Array.from({ length: count }, () => new Animated.Value(0.3))
  ).current;

  useEffect(() => {
    const animations = bars.map((bar, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(bar, {
            toValue: 1,
            duration: 380 + i * 90,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(bar, {
            toValue: 0.25,
            duration: 380 + i * 90,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      )
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, [bars]);

  return (
    <View style={[st.eqRow, { height }]}>
      {bars.map((bar, idx) => (
        <Animated.View
          key={idx}
          style={[
            st.eqBar,
            {
              height,
              backgroundColor: color,
              transform: [{ scaleY: bar }],
            },
          ]}
        />
      ))}
    </View>
  );
}

// ── Animated Number Counter ───────────────────────────────────────────────
function AnimatedCounter({ value, style }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    anim.setValue(0);
    const id = anim.addListener(({ value: v }) => setDisplay(Math.round(v)));
    Animated.timing(anim, {
      toValue: value || 0,
      duration: 850,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => anim.removeListener(id);
  }, [value, anim]);

  return <Text style={style}>{display}</Text>;
}

// ── Skeletons ─────────────────────────────────────────────────────────────
const SkeletonPulse = ({ width, height, borderRadius = RADIUS.md, style }) => {
  const anim = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.75, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.35, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  return (
    <Animated.View
      style={[{ width, height, borderRadius, backgroundColor: COLORS.border, opacity: anim }, style]}
    />
  );
};

const SkeletonWaterfall = () => (
  <View style={{ paddingHorizontal: PAD, paddingTop: SPACE.xl }}>
    <SkeletonPulse width="100%" height={164} borderRadius={RADIUS.xxl} style={{ marginBottom: SPACE.xl }} />
    <View style={st.masonryWrap}>
      <View style={st.masonryCol}>
        <SkeletonPulse width={COL_WIDTH} height={230} borderRadius={RADIUS.xl} />
        <SkeletonPulse width={COL_WIDTH} height={230} borderRadius={RADIUS.xl} />
      </View>
      <View style={[st.masonryCol, { marginTop: 28 }]}>
        <SkeletonPulse width={COL_WIDTH} height={230} borderRadius={RADIUS.xl} />
        <SkeletonPulse width={COL_WIDTH} height={230} borderRadius={RADIUS.xl} />
      </View>
    </View>
  </View>
);

// ── Live Auto-Cycling Spotlight Stage in Header ───────────────────────────
function LiveStageHero({ pool, totalCount, keynotesCount, countriesCount, onSelectSpeaker }) {
  const [idx, setIdx] = useState(0);
  const [imgOk, setImgOk] = useState(true);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const radarAnim = useRef(new Animated.Value(0)).current;

  const activeSpeaker = pool.length > 0 ? pool[idx % pool.length] : null;

  const triggerNext = useCallback(
    (manual = false) => {
      if (pool.length <= 1) return;
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: -12, duration: 180, useNativeDriver: true }),
      ]).start(() => {
        setImgOk(true);
        setIdx((prev) => (prev + 1) % pool.length);
        slideAnim.setValue(14);
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
          Animated.spring(slideAnim, { toValue: 0, speed: 18, bounciness: 6, useNativeDriver: true }),
        ]).start();
      });
    },
    [pool.length, fadeAnim, slideAnim]
  );

  useEffect(() => {
    if (pool.length <= 1) return;
    const timer = setInterval(() => triggerNext(false), 4500);
    return () => clearInterval(timer);
  }, [pool.length, triggerNext]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(radarAnim, {
        toValue: 1,
        duration: 2800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [radarAnim]);

  const radarScale1 = radarAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.45] });
  const radarOpacity1 = radarAnim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.45, 0.15, 0] });

  const photoUrl = activeSpeaker ? resolvePhoto(activeSpeaker.photo_url) : null;
  const grad = getGrad(activeSpeaker?.id || idx);

  return (
    <View style={st.heroStageWrap}>
      {/* Top Kicker Row */}
      <View style={st.stageHeaderRow}>
        <View style={st.liveBroadcastPill}>
          <EqualizerBars color={COLORS.accent} count={4} height={11} />
          <Text style={st.liveBroadcastText}>SPEAKER SPOTLIGHT</Text>
        </View>

        {pool.length > 1 && (
          <TouchableOpacity
            onPress={() => triggerNext(true)}
            activeOpacity={0.8}
            style={st.shuffleBtn}
          >
            <Ionicons name="sparkles-outline" size={12} color={COLORS.accentLight} />
            <Text style={st.shuffleText}>
              {idx + 1} / {pool.length}
            </Text>
            <Ionicons name="chevron-forward" size={12} color={COLORS.textInverse} />
          </TouchableOpacity>
        )}
      </View>

      {/* Auto-Morphing Glass Spotlight Stage */}
      {activeSpeaker && (
        <Pressable
          onPress={() => onSelectSpeaker(activeSpeaker.id)}
          style={st.stageGlassCard}
        >
          <Animated.View
            style={[
              st.stageInnerRow,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            {/* Left: Portrait with Concentric Radar Pulse */}
            <View style={st.stagePortraitBox}>
              <Animated.View
                style={[
                  st.radarRing,
                  {
                    opacity: radarOpacity1,
                    transform: [{ scale: radarScale1 }],
                  },
                ]}
              />
              <View style={st.stageAvatarFrame}>
                {photoUrl && imgOk ? (
                  <View style={st.uncroppedStage}>
                    <Image
                      source={{ uri: photoUrl }}
                      style={StyleSheet.absoluteFillObject}
                      blurRadius={16}
                      resizeMode="cover"
                    />
                    <View style={st.uncroppedTint} />
                    <Image
                      source={{ uri: photoUrl }}
                      style={st.uncroppedImg}
                      resizeMode="contain"
                      onError={() => setImgOk(false)}
                    />
                  </View>
                ) : (
                  <LinearGradient colors={grad} style={st.uncroppedStage}>
                    <Text style={st.stageInitials}>{activeSpeaker.initials}</Text>
                  </LinearGradient>
                )}
              </View>
            </View>

            {/* Right: Live Speaker Telemetry */}
            <View style={st.stageInfoCol}>
              <View style={st.stageBadgeRow}>
                {activeSpeaker.is_keynote ? (
                  <View style={st.stageKeynoteTag}>
                    <Ionicons name="star" size={10} color={COLORS.accentDark} />
                    <Text style={st.stageKeynoteTagTxt}>KEYNOTE</Text>
                  </View>
                ) : (
                  <View style={st.stageInvitedTag}>
                    <Ionicons name="mic-outline" size={10} color={COLORS.brandLight} />
                    <Text style={st.stageInvitedTagTxt}>FEATURED</Text>
                  </View>
                )}

                {activeSpeaker.talk_count > 0 && (
                  <Text style={st.stageTalkCount}>
                    {activeSpeaker.talk_count} {activeSpeaker.talk_count === 1 ? 'Session' : 'Sessions'}
                  </Text>
                )}
              </View>

              <Text style={st.stageSpeakerName} numberOfLines={1}>
                {activeSpeaker.full_name}
              </Text>

              {!!activeSpeaker.designation && (
                <Text style={st.stageSpeakerDesig} numberOfLines={1}>
                  {activeSpeaker.designation}
                </Text>
              )}

              <View style={st.stageInstRow}>
                <Ionicons name="business-outline" size={12} color={COLORS.accentLight} />
                <Text style={st.stageInstText} numberOfLines={1}>
                  {activeSpeaker.institute || activeSpeaker.country || 'ETD 2026'}
                </Text>
              </View>

              <View style={st.stageActionLink}>
                <Text style={st.stageActionText}>Open Speaker Profile</Text>
                <Ionicons name="arrow-forward" size={13} color={COLORS.accent} />
              </View>
            </View>
          </Animated.View>
        </Pressable>
      )}

      {/* Minimal Glass Telemetry Strip */}
      {totalCount > 0 && (
        <View style={st.telemetryStrip}>
          <View style={st.telemetryItem}>
            <View style={[st.telemetryDot, { backgroundColor: COLORS.accent }]} />
            <AnimatedCounter value={keynotesCount} style={st.telemetryVal} />
            <Text style={st.telemetryLbl}>Keynotes</Text>
          </View>

          <View style={st.telemetryDivider} />

          <View style={st.telemetryItem}>
            <View style={[st.telemetryDot, { backgroundColor: COLORS.teal }]} />
            <AnimatedCounter value={totalCount} style={st.telemetryVal} />
            <Text style={st.telemetryLbl}>Total Speakers</Text>
          </View>

          <View style={st.telemetryDivider} />

          <View style={st.telemetryItem}>
            <View style={[st.telemetryDot, { backgroundColor: COLORS.success }]} />
            <AnimatedCounter value={countriesCount} style={st.telemetryVal} />
            <Text style={st.telemetryLbl}>Countries</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ── Full-Width VIP Keynote Pass Card with Shimmer & Orbit ─────────────────
function KeynotePassCard({ speaker, index, onPress }) {
  const [imgOk, setImgOk] = useState(true);
  const scale = useRef(new Animated.Value(1)).current;
  const entrance = useRef(new Animated.Value(0)).current;
  const orbit = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;

  const photoUrl = resolvePhoto(speaker.photo_url);
  const grad = getGrad(speaker.id || index);

  useEffect(() => {
    Animated.spring(entrance, {
      toValue: 1,
      tension: 48,
      friction: 8,
      delay: index * 90,
      useNativeDriver: true,
    }).start();

    const orbitLoop = Animated.loop(
      Animated.timing(orbit, {
        toValue: 1,
        duration: 16000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(1800),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    orbitLoop.start();
    shimmerLoop.start();
    return () => {
      orbitLoop.stop();
      shimmerLoop.stop();
    };
  }, [entrance, index, orbit, shimmer]);

  const rotateDeg = orbit.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const shimmerTranslateX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-W, W],
  });

  return (
    <Animated.View
      style={{
        marginBottom: SPACE.md,
        opacity: entrance,
        transform: [
          { translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) },
          { scale },
        ],
      }}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 38 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 28 }).start()}
        style={st.vipCardWrap}
      >
        <LinearGradient
          colors={[COLORS.brandDeeper, COLORS.brandDeep, COLORS.brand]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={st.vipCardGrad}
        >
          {/* Animated Shimmer Sweep */}
          <Animated.View
            pointerEvents="none"
            style={[
              st.shimmerBeam,
              { transform: [{ translateX: shimmerTranslateX }, { rotate: '20deg' }] },
            ]}
          />

          {/* Left: Portrait with Rotating Orbital Ring */}
          <View style={st.vipPortraitStage}>
            <Animated.View
              style={[
                st.vipOrbitRing,
                { transform: [{ rotate: rotateDeg }] },
              ]}
            />
            <View style={st.vipPortraitFrame}>
              {photoUrl && imgOk ? (
                <View style={st.uncroppedStage}>
                  <Image
                    source={{ uri: photoUrl }}
                    style={StyleSheet.absoluteFillObject}
                    blurRadius={16}
                    resizeMode="cover"
                  />
                  <View style={st.uncroppedTint} />
                  <Image
                    source={{ uri: photoUrl }}
                    style={st.uncroppedImg}
                    resizeMode="contain"
                    onError={() => setImgOk(false)}
                  />
                </View>
              ) : (
                <LinearGradient colors={grad} style={st.uncroppedStage}>
                  <Text style={st.vipInitials}>{speaker.initials}</Text>
                </LinearGradient>
              )}
            </View>

            <View style={st.vipCrownPill}>
              <Ionicons name="star" size={10} color={COLORS.accentDark} />
              <Text style={st.vipCrownText}>KEYNOTE</Text>
            </View>
          </View>

          {/* Right: VIP Speaker Details */}
          <View style={st.vipDetailsCol}>
            <View style={st.vipMetaTop}>
              {!!speaker.country && (
                <View style={st.vipCountryChip}>
                  <Ionicons name="globe-outline" size={11} color={COLORS.accentLight} />
                  <Text style={st.vipCountryText}>{speaker.country}</Text>
                </View>
              )}
              {speaker.talk_count > 0 && (
                <View style={st.vipTalkChip}>
                  <EqualizerBars color={COLORS.accentLight} count={3} height={9} />
                  <Text style={st.vipTalkText}>{speaker.talk_count}</Text>
                </View>
              )}
            </View>

            <Text style={st.vipName} numberOfLines={2}>{speaker.full_name}</Text>

            {!!speaker.designation && (
              <Text style={st.vipDesig} numberOfLines={2}>{speaker.designation}</Text>
            )}

            {!!speaker.institute && (
              <View style={st.vipInstRow}>
                <Ionicons name="business-outline" size={12} color={COLORS.brandLight} />
                <Text style={st.vipInstText} numberOfLines={1}>{speaker.institute}</Text>
              </View>
            )}

            <View style={st.vipFooterBtn}>
              <Text style={st.vipFooterBtnTxt}>View Keynote Profile</Text>
              <View style={st.vipArrowCircle}>
                <Ionicons name="arrow-forward" size={12} color={COLORS.brandDeep} />
              </View>
            </View>
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

// ── Breathing Offset Waterfall Card for Invited Speakers ──────────────────
function WaterfallSpeakerCard({ speaker, index, column, onPress }) {
  const [imgOk, setImgOk] = useState(true);
  const scale = useRef(new Animated.Value(1)).current;
  const entrance = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  const photoUrl = resolvePhoto(speaker.photo_url);
  const grad = getGrad(speaker.id || index);

  useEffect(() => {
    Animated.spring(entrance, {
      toValue: 1,
      tension: 50,
      friction: 8,
      delay: Math.min(index * 65, 420),
      useNativeDriver: true,
    }).start();

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 2800 + (index % 3) * 400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2800 + (index % 3) * 400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [entrance, floatAnim, index]);

  const floatY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: column === 'left' ? [0, -5] : [-5, 0],
  });

  const enterY = entrance.interpolate({
    inputRange: [0, 1],
    outputRange: [30, 0],
  });

  return (
    <Animated.View
      style={{
        marginBottom: SPACE.md,
        opacity: entrance,
        transform: [
          { translateY: Animated.add(enterY, floatY) },
          { scale },
        ],
      }}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 38 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 28 }).start()}
        style={st.waterfallCard}
      >
        {/* Uncropped Portrait Stage */}
        <View style={st.waterfallPortraitWrap}>
          {photoUrl && imgOk ? (
            <View style={st.uncroppedStage}>
              <Image
                source={{ uri: photoUrl }}
                style={StyleSheet.absoluteFillObject}
                blurRadius={18}
                resizeMode="cover"
              />
              <View style={st.uncroppedTint} />
              <Image
                source={{ uri: photoUrl }}
                style={st.uncroppedImg}
                resizeMode="contain"
                onError={() => setImgOk(false)}
              />
            </View>
          ) : (
            <LinearGradient colors={grad} style={st.uncroppedStage}>
              <Text style={st.waterfallInitials}>{speaker.initials}</Text>
            </LinearGradient>
          )}

          {/* Top Floating Session Equalizer Pill */}
          {speaker.talk_count > 0 && (
            <View style={st.waterfallTalkPill}>
              <EqualizerBars color={COLORS.accent} count={3} height={9} />
              <Text style={st.waterfallTalkTxt}>{speaker.talk_count}</Text>
            </View>
          )}

          {/* Country Pill Overlapping the Portrait Bottom */}
          {!!speaker.country && (
            <View style={st.waterfallCountryPill}>
              <Ionicons name="location-outline" size={10} color={COLORS.brand} />
              <Text style={st.waterfallCountryTxt} numberOfLines={1}>{speaker.country}</Text>
            </View>
          )}
        </View>

        {/* Editorial Typography Block */}
        <View style={st.waterfallBody}>
          <Text style={st.waterfallName} numberOfLines={2}>{speaker.full_name}</Text>

          {!!speaker.designation && (
            <Text style={st.waterfallDesig} numberOfLines={2}>{speaker.designation}</Text>
          )}

          <View style={st.waterfallFooter}>
            <Text style={st.waterfallInst} numberOfLines={1}>
              {speaker.institute || 'ETD 2026'}
            </Text>
            <View style={st.waterfallGoBtn}>
              <Ionicons name="arrow-up-outline" size={12} color={COLORS.brand} style={{ transform: [{ rotate: '45deg' }] }} />
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ── Section Header ────────────────────────────────────────────────────────
function SectionHeader({ title, subtitle, count, icon, badgeBg, badgeColor }) {
  return (
    <View style={st.secHeader}>
      <View style={[st.secIconBox, { backgroundColor: badgeBg }]}>
        <Ionicons name={icon} size={18} color={badgeColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={st.secTitle}>{title}</Text>
        {!!subtitle && <Text style={st.secSub}>{subtitle}</Text>}
      </View>
      <View style={[st.secCountPill, { backgroundColor: badgeBg }]}>
        <Text style={[st.secCountText, { color: badgeColor }]}>{count}</Text>
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

  const ambientAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ambientAnim, {
          toValue: 1,
          duration: 4500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(ambientAnim, {
          toValue: 0,
          duration: 4500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [ambientAnim]);

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

  const spotlightPool = useMemo(() => [...keynotes, ...speakers], [keynotes, speakers]);

  const [leftColSpeakers, rightColSpeakers] = useMemo(() => {
    const left = [];
    const right = [];
    speakers.forEach((sp, idx) => {
      if (idx % 2 === 0) left.push({ sp, idx });
      else right.push({ sp, idx });
    });
    return [left, right];
  }, [speakers]);

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

  const totalCount = spotlightPool.length;
  const countriesCount = [
    ...new Set(spotlightPool.map((s) => s.country).filter(Boolean)),
  ].length;

  const orb1Y = ambientAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 16] });
  const orb2X = ambientAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -18] });

  return (
    <View style={st.container}>
      <StatusBar barStyle="light-content" />

      {/* Main Standard ScrollView - No sticky nav */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: SPACE.huge * 2 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.brand} />
        }
      >
        {/* Curved Brand Stage Header containing the Navigation */}
        <LinearGradient
          colors={[COLORS.brandDeeper, COLORS.brandDeep, COLORS.brand]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={st.header}
        >
          <Animated.View style={[st.ambientOrb1, { transform: [{ translateY: orb1Y }] }]} />
          <Animated.View style={[st.ambientOrb2, { transform: [{ translateX: orb2X }] }]} />

          {/* Navigation Top Bar (Scrolls with Header) */}
          <View style={st.topbar}>
            <TouchableOpacity onPress={onBack} style={st.backBtn} activeOpacity={0.8}>
              <Ionicons name="arrow-back" size={19} color={COLORS.textInverse} />
            </TouchableOpacity>

            <View style={{ alignItems: 'center' }}>
              <Text style={st.topTitle}>Speakers</Text>
              <Text style={st.topSub}>ETD 2026 • IIT DELHI</Text>
            </View>

            <View style={{ width: 38 }} />
          </View>

          {/* Hero Content */}
          <View style={st.heroContentWrap}>
            <Text style={st.heroHeading}>Voices of ETD 2026</Text>
            <Text style={st.heroSubheading}>
              Global pioneers shaping the future of electronic theses & digital libraries
            </Text>

            {!loading && spotlightPool.length > 0 && (
              <LiveStageHero
                pool={spotlightPool}
                totalCount={totalCount}
                keynotesCount={keynotes.length}
                countriesCount={countriesCount}
                onSelectSpeaker={(id) => setSelectedId(id)}
              />
            )}
          </View>
        </LinearGradient>

        {/* Main Body */}
        {loading ? (
          <SkeletonWaterfall />
        ) : (
          <View style={st.bodyContent}>
            {/* 1. VIP Keynote Stage Passes */}
            {keynotes.length > 0 && (
              <View style={st.sectionWrap}>
                <SectionHeader
                  title="Keynote Headliners"
                  subtitle="Plenary sessions & distinguished guests"
                  count={keynotes.length}
                  icon="star"
                  badgeBg={COLORS.accentLight}
                  badgeColor={COLORS.accentDark}
                />

                {keynotes.map((sp, i) => (
                  <KeynotePassCard
                    key={sp.id}
                    speaker={sp}
                    index={i}
                    onPress={() => setSelectedId(sp.id)}
                  />
                ))}
              </View>
            )}

            {/* 2. Breathing Offset Waterfall Grid for Invited Speakers */}
            {speakers.length > 0 && (
              <View style={st.sectionWrap}>
                <SectionHeader
                  title="Invited Speakers"
                  subtitle="Tap any card to explore talks & request discussion"
                  count={speakers.length}
                  icon="compass-outline"
                  badgeBg={COLORS.brandLight}
                  badgeColor={COLORS.brand}
                />

                <View style={st.masonryWrap}>
                  {/* Left Waterfall Column */}
                  <View style={st.masonryCol}>
                    {leftColSpeakers.map(({ sp, idx }) => (
                      <WaterfallSpeakerCard
                        key={sp.id}
                        speaker={sp}
                        index={idx}
                        column="left"
                        onPress={() => setSelectedId(sp.id)}
                      />
                    ))}
                  </View>

                  {/* Offset Right Waterfall Column */}
                  <View style={[st.masonryCol, st.masonryColOffset]}>
                    {rightColSpeakers.map(({ sp, idx }) => (
                      <WaterfallSpeakerCard
                        key={sp.id}
                        speaker={sp}
                        index={idx}
                        column="right"
                        onPress={() => setSelectedId(sp.id)}
                      />
                    ))}
                  </View>
                </View>
              </View>
            )}

            {/* Empty State */}
            {keynotes.length === 0 && speakers.length === 0 && (
              <View style={st.emptyBox}>
                <View style={st.emptyIconCircle}>
                  <Ionicons name="mic-off-outline" size={32} color={COLORS.brand} />
                </View>
                <Text style={st.emptyTitle}>Speaker Lineup Coming Soon</Text>
                <Text style={st.emptySub}>Pull down to refresh as speakers are announced.</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  // Equalizer Bars
  eqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  eqBar: {
    width: 2.5,
    borderRadius: 2,
  },

  // Header & Top Nav (Scrolls with page now)
  header: {
    paddingTop: STATUS_TOP + SPACE.sm,
    paddingBottom: SPACE.xxl,
    borderBottomLeftRadius: RADIUS.xxxl,
    borderBottomRightRadius: RADIUS.xxxl,
    overflow: 'hidden',
    backgroundColor: COLORS.brandDeep,
    ...SHADOW.lg,
  },
  topbar: {
    paddingHorizontal: PAD,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACE.lg,
    zIndex: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(15,23,42,0.42)',
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    fontSize: FONT.md,
    fontWeight: FONT.w8,
    color: COLORS.textInverse,
    letterSpacing: 0.2,
  },
  topSub: {
    fontSize: FONT.micro,
    fontWeight: FONT.w7,
    color: COLORS.accentLight,
    letterSpacing: 1.2,
    marginTop: 1,
  },
  heroContentWrap: {
    paddingHorizontal: PAD,
    zIndex: 10,
  },
  ambientOrb1: {
    position: 'absolute',
    top: -30,
    right: -20,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  ambientOrb2: {
    position: 'absolute',
    bottom: -40,
    left: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: COLORS.accentMid,
  },
  heroHeading: {
    fontSize: FONT.xxl,
    fontWeight: FONT.w9,
    color: COLORS.textInverse,
    letterSpacing: -0.5,
  },
  heroSubheading: {
    fontSize: FONT.xs,
    color: 'rgba(255,255,255,0.78)',
    marginTop: 3,
    lineHeight: 18,
  },

  // Live Auto-Cycling Stage Hero
  heroStageWrap: {
    marginTop: SPACE.md,
  },
  stageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACE.sm,
  },
  liveBroadcastPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15,23,42,0.45)',
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    paddingHorizontal: SPACE.md,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  liveBroadcastText: {
    fontSize: FONT.micro,
    fontWeight: FONT.w9,
    color: COLORS.accentLight,
    letterSpacing: 0.9,
  },
  shuffleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.glass,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    paddingHorizontal: SPACE.sm + 2,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  shuffleText: {
    fontSize: FONT.micro,
    fontWeight: FONT.w8,
    color: COLORS.textInverse,
  },
  stageGlassCard: {
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.glass,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    padding: SPACE.md,
    overflow: 'hidden',
  },
  stageInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
  },
  stagePortraitBox: {
    width: 92,
    height: 114,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarRing: {
    position: 'absolute',
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 1.5,
    borderColor: COLORS.accent,
  },
  stageAvatarFrame: {
    width: 88,
    height: 110,
    borderRadius: RADIUS.lg,
    padding: 2.5,
    backgroundColor: COLORS.surface,
    ...SHADOW.md,
  },
  uncroppedStage: {
    flex: 1,
    borderRadius: RADIUS.md - 2,
    overflow: 'hidden',
    backgroundColor: COLORS.brandDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uncroppedTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.22)',
  },
  uncroppedImg: {
    width: '100%',
    height: '100%',
  },
  stageInitials: {
    fontSize: FONT.xxl,
    fontWeight: FONT.w9,
    color: COLORS.textInverse,
  },
  stageInfoCol: {
    flex: 1,
  },
  stageBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  stageKeynoteTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.accentLight,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  stageKeynoteTagTxt: {
    fontSize: 8,
    fontWeight: FONT.w9,
    color: COLORS.accentDark,
    letterSpacing: 0.4,
  },
  stageInvitedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(15,23,42,0.38)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  stageInvitedTagTxt: {
    fontSize: 8,
    fontWeight: FONT.w8,
    color: COLORS.brandLight,
    letterSpacing: 0.4,
  },
  stageTalkCount: {
    fontSize: FONT.micro,
    fontWeight: FONT.w7,
    color: COLORS.accentLight,
  },
  stageSpeakerName: {
    fontSize: FONT.lg,
    fontWeight: FONT.w9,
    color: COLORS.textInverse,
    letterSpacing: -0.3,
  },
  stageSpeakerDesig: {
    fontSize: FONT.xs,
    color: COLORS.brandLight,
    marginTop: 2,
  },
  stageInstRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 5,
  },
  stageInstText: {
    fontSize: FONT.xs,
    fontWeight: FONT.w6,
    color: 'rgba(255,255,255,0.85)',
    flex: 1,
  },
  stageActionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  stageActionText: {
    fontSize: FONT.xs,
    fontWeight: FONT.w8,
    color: COLORS.accentLight,
  },

  // Telemetry Strip
  telemetryStrip: {
    marginTop: SPACE.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(15,23,42,0.36)',
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACE.sm + 2,
    paddingHorizontal: SPACE.sm,
  },
  telemetryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  telemetryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  telemetryVal: {
    fontSize: FONT.sm,
    fontWeight: FONT.w9,
    color: COLORS.textInverse,
  },
  telemetryLbl: {
    fontSize: FONT.micro,
    fontWeight: FONT.w7,
    color: 'rgba(255,255,255,0.72)',
  },
  telemetryDivider: {
    width: 1,
    height: 14,
    backgroundColor: COLORS.glassBorder,
  },

  // Body Sections
  bodyContent: {
    paddingHorizontal: PAD,
    paddingTop: SPACE.xl,
    gap: SPACE.xl,
  },
  sectionWrap: {
    gap: SPACE.sm,
  },
  secHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    marginBottom: SPACE.sm,
  },
  secIconBox: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secTitle: {
    fontSize: FONT.lg,
    fontWeight: FONT.w9,
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  secSub: {
    fontSize: FONT.xs,
    color: COLORS.textSec,
    marginTop: 1,
  },
  secCountPill: {
    paddingHorizontal: SPACE.sm + 3,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  secCountText: {
    fontSize: FONT.xs,
    fontWeight: FONT.w9,
  },

  // Full-Width VIP Keynote Pass Cards
  vipCardWrap: {
    borderRadius: RADIUS.xxl,
    overflow: 'hidden',
    ...SHADOW.lg,
  },
  vipCardGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACE.md + 2,
    gap: SPACE.lg,
    overflow: 'hidden',
  },
  shimmerBeam: {
    position: 'absolute',
    top: -60,
    bottom: -60,
    width: 65,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  vipPortraitStage: {
    width: 108,
    height: 134,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vipOrbitRing: {
    position: 'absolute',
    width: 116,
    height: 116,
    borderRadius: 58,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(245,158,11,0.5)',
  },
  vipPortraitFrame: {
    width: 100,
    height: 126,
    borderRadius: RADIUS.lg,
    padding: 2.5,
    backgroundColor: COLORS.accentLight,
  },
  vipInitials: {
    fontSize: FONT.xxl,
    fontWeight: FONT.w9,
    color: COLORS.textInverse,
  },
  vipCrownPill: {
    position: 'absolute',
    bottom: -6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.accentLight,
    borderWidth: 1,
    borderColor: COLORS.accent,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    ...SHADOW.sm,
  },
  vipCrownText: {
    fontSize: 8,
    fontWeight: FONT.w9,
    color: COLORS.accentDark,
    letterSpacing: 0.5,
  },
  vipDetailsCol: {
    flex: 1,
  },
  vipMetaTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  vipCountryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  vipCountryText: {
    fontSize: FONT.micro,
    fontWeight: FONT.w7,
    color: COLORS.accentLight,
  },
  vipTalkChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(15,23,42,0.4)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  vipTalkText: {
    fontSize: FONT.micro,
    fontWeight: FONT.w8,
    color: COLORS.textInverse,
  },
  vipName: {
    fontSize: FONT.lg,
    fontWeight: FONT.w9,
    color: COLORS.textInverse,
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  vipDesig: {
    fontSize: FONT.xs,
    color: COLORS.brandLight,
    marginTop: 3,
    lineHeight: 16,
  },
  vipInstRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  vipInstText: {
    fontSize: FONT.xs,
    fontWeight: FONT.w6,
    color: 'rgba(255,255,255,0.85)',
    flex: 1,
  },
  vipFooterBtn: {
    marginTop: SPACE.sm + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    borderRadius: RADIUS.full,
    paddingLeft: SPACE.md,
    paddingRight: 5,
    paddingVertical: 4,
  },
  vipFooterBtnTxt: {
    fontSize: FONT.xs,
    fontWeight: FONT.w8,
    color: COLORS.textInverse,
  },
  vipArrowCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Breathing Offset Waterfall Grid
  masonryWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  masonryCol: {
    width: COL_WIDTH,
  },
  masonryColOffset: {
    marginTop: 28,
  },
  waterfallCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.md,
  },
  waterfallPortraitWrap: {
    width: '100%',
    height: COL_WIDTH * 1.08,
    backgroundColor: COLORS.brandDeep,
    position: 'relative',
  },
  waterfallInitials: {
    fontSize: FONT.xxxl,
    fontWeight: FONT.w9,
    color: COLORS.textInverse,
  },
  waterfallTalkPill: {
    position: 'absolute',
    top: SPACE.sm,
    right: SPACE.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(15,23,42,0.72)',
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  waterfallTalkTxt: {
    fontSize: FONT.micro,
    fontWeight: FONT.w9,
    color: COLORS.textInverse,
  },
  waterfallCountryPill: {
    position: 'absolute',
    bottom: SPACE.sm,
    left: SPACE.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    maxWidth: '86%',
    ...SHADOW.sm,
  },
  waterfallCountryTxt: {
    fontSize: FONT.micro,
    fontWeight: FONT.w8,
    color: COLORS.brand,
  },
  waterfallBody: {
    padding: SPACE.md,
  },
  waterfallName: {
    fontSize: FONT.base,
    fontWeight: FONT.w8,
    color: COLORS.text,
    letterSpacing: -0.2,
    lineHeight: 19,
  },
  waterfallDesig: {
    fontSize: FONT.xs,
    color: COLORS.textSec,
    marginTop: 3,
    lineHeight: 16,
  },
  waterfallFooter: {
    marginTop: SPACE.sm,
    paddingTop: SPACE.xs + 2,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACE.xs,
  },
  waterfallInst: {
    flex: 1,
    fontSize: FONT.micro,
    fontWeight: FONT.w7,
    color: COLORS.brand,
  },
  waterfallGoBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Empty State
  emptyBox: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xxl,
    padding: SPACE.xxl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.sm,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACE.md,
  },
  emptyTitle: {
    fontSize: FONT.md,
    fontWeight: FONT.w8,
    color: COLORS.text,
  },
  emptySub: {
    fontSize: FONT.xs,
    color: COLORS.textSec,
    textAlign: 'center',
    marginTop: 4,
  },
});