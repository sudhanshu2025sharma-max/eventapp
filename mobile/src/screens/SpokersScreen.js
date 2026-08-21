import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, StyleSheet,
  Platform, StatusBar, RefreshControl, Dimensions, Animated, Easing
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, SPACE, RADIUS, SHADOW, API_URL, API_HEADERS, TOP } from '../theme';
import SpeakerDetailScreen from './SpeakerDetailScreen';

const { width: W, height: H } = Dimensions.get('window');
const PAD = SPACE.xl;
const CARD_WIDTH = (W - PAD * 2 - SPACE.md) / 2; // 2-column grid calculation

// Gradient pairs for initials avatars
const GRAD_PAIRS = [
  ['#6366f1','#8b5cf6'], ['#0333b6','#06b6d4'], ['#0d9f6e','#06b6d4'],
  ['#dc2626','#f59e0b'], ['#7c3aed','#db2777'], ['#0891b2','#0d9f6e'],
  ['#d97706','#dc2626'],
];

function getGrad(idx) { return GRAD_PAIRS[idx % GRAD_PAIRS.length]; }

// ── Skeletons ─────────────────────────────────────────────────────────────
const SkeletonPulse = ({ width, height, borderRadius = RADIUS.md, style }) => {
  const anim = useRef(new Animated.Value(0.15)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 0.4, duration: 1000, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0.15, duration: 1000, useNativeDriver: true })
    ])).start();
  }, [anim]);
  return <Animated.View style={[{ width, height, borderRadius, backgroundColor: 'rgba(255,255,255,0.8)', opacity: anim }, style]} />;
};

const SkeletonGrid = () => (
  <View style={st.gridContainer}>
    {[1, 2, 3, 4, 5, 6].map(i => (
      <View key={i} style={{ width: CARD_WIDTH, marginBottom: SPACE.lg }}>
        <SkeletonPulse width={CARD_WIDTH} height={CARD_WIDTH * 1.1} borderRadius={RADIUS.xl} />
        <View style={{ marginTop: SPACE.sm, gap: 6, paddingHorizontal: 4 }}>
          <SkeletonPulse width="80%" height={16} borderRadius={4} />
          <SkeletonPulse width="60%" height={12} borderRadius={4} />
        </View>
      </View>
    ))}
  </View>
);

// ── Animated Background Blobs ─────────────────────────────────────────────
const BackgroundAura = () => {
  const floatAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(floatAnim, { toValue: 1, duration: 6000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(floatAnim, { toValue: 0, duration: 6000, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
    ])).start();
  }, [floatAnim]);

  const scale1 = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.2] });
  const scale2 = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [1.2, 1] });
  const rotate = floatAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '15deg'] });

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient colors={['#050e2d', '#0a1a5e', '#050e2d']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <Animated.View style={[st.blob, st.blob1, { transform: [{ scale: scale1 }, { rotate }] }]} />
      <Animated.View style={[st.blob, st.blob2, { transform: [{ scale: scale2 }] }]} />
      <Animated.View style={[st.blob, st.blob3, { transform: [{ scale: scale1 }] }]} />
    </View>
  );
};

// ── Animated Grid Card ────────────────────────────────────────────────────
function SpeakerGridCard({ speaker, index, onPress }) {
  const [imgOk, setImgOk] = useState(true);
  const [pressed, setPressed] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const entrance = useRef(new Animated.Value(0)).current;
  const [g1, g2] = getGrad(index);

  useEffect(() => {
    Animated.spring(entrance, { toValue: 1, tension: 50, friction: 8, delay: (index % 10) * 80, useNativeDriver: true }).start();
  }, [entrance, index]);

  const onPressIn = () => {
    setPressed(true);
    Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, speed: 40 }).start();
  };
  const onPressOut = () => {
    setPressed(false);
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start();
  };

  const translateY = entrance.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });
  const opacity = entrance.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <TouchableOpacity
        activeOpacity={1} onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}
        style={[st.gridCard, { width: CARD_WIDTH }]}
      >
        <Animated.View style={[st.cardInner, pressed && st.cardPressed, { transform: [{ scale }] }]}>
          
          {/* Avatar Area */}
          <View style={st.avatarWrap}>
            {speaker.photo_url && imgOk ? (
              <Image source={{ uri: speaker.photo_url }} style={st.avatarImg} onError={() => setImgOk(false)} />
            ) : (
              <LinearGradient colors={[g1, g2]} style={st.avatarImg}>
                <Text style={st.avatarInitials}>{speaker.initials}</Text>
              </LinearGradient>
            )}
            
            {/* Top Right Badges */}
            <View style={st.topBadges}>
              {speaker.is_keynote && (
                <View style={st.keynoteBadge}><Ionicons name="star" size={10} color="#fff" /></View>
              )}
            </View>

            {/* Bottom Floating Badges */}
            {speaker.talk_count > 0 && (
              <View style={st.talkBadge}>
                <Ionicons name="mic" size={10} color="#fff" />
                <Text style={st.talkBadgeText}>{speaker.talk_count}</Text>
              </View>
            )}

            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.5)']} style={st.avatarScrim} />
          </View>

          {/* Text Info */}
          <View style={st.infoWrap}>
            <Text style={st.cardName} numberOfLines={1}>{speaker.full_name}</Text>
            <Text style={st.cardDesig} numberOfLines={2}>{speaker.designation}</Text>
            <View style={st.instRow}>
              <Ionicons name="location" size={10} color={COLORS.brandLight} />
              <Text style={st.cardInst} numberOfLines={1}>{speaker.institute || 'Unknown'}</Text>
            </View>
          </View>
          
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Section Header ────────────────────────────────────────────────────────
function SectionHeader({ label, count, icon, accent }) {
  return (
    <View style={st.secHeader}>
      <View style={[st.secIconWrap, { backgroundColor: accent + '25' }]}>
        <Ionicons name={icon} size={18} color={accent} />
      </View>
      <Text style={st.secLabel}>{label}</Text>
      <View style={[st.secCount, { backgroundColor: accent + '25' }]}>
        <Text style={[st.secCountText, { color: accent }]}>{count}</Text>
      </View>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────
export default function SpeakersScreen({ tokens, onBack }) {
  const [keynotes, setKeynotes] = useState([]);
  const [speakers, setSpeakers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  
  const scrollY = useRef(new Animated.Value(0)).current;

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

  useEffect(() => { fetch_(); }, [fetch_]);

  const onRefresh = () => { setRefreshing(true); fetch_(); };

  if (selectedId !== null) {
    return <SpeakerDetailScreen speakerId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  const headerOpacity = scrollY.interpolate({ inputRange: [40, 100], outputRange: [0, 1], extrapolate: 'clamp' });
  const totalCount = keynotes.length + speakers.length;
  const countriesCount = [...new Set([...keynotes, ...speakers].map(s => s.country).filter(Boolean))].length;

  return (
    <View style={{ flex: 1, backgroundColor: '#050e2d' }}>
      <StatusBar barStyle="light-content" />
      <BackgroundAura />

      {/* Sticky Glass Header */}
      <View style={st.headerWrap}>
        <Animated.View style={[st.headerBlur, { opacity: headerOpacity }]} />
        <View style={st.topbar}>
          <TouchableOpacity onPress={onBack} style={st.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Animated.View style={{ alignItems: 'center', opacity: headerOpacity }}>
            <Text style={st.topTitle}>Speakers</Text>
            <Text style={st.topSub}>ETD 2026</Text>
          </Animated.View>
          <View style={{ width: 44 }} />
        </View>
      </View>

      <Animated.ScrollView
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingHorizontal: PAD, paddingTop: TOP + 60, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
      >
        {/* Dynamic Hero Area */}
        <View style={st.hero}>
          <View style={st.heroPill}>
            <View style={st.heroPillDot} />
            <Text style={st.heroPillText}>ETD 2026 · IIT Delhi</Text>
          </View>
          <Text style={st.heroTitle}>Meet the{'\n'}Speakers</Text>
          <Text style={st.heroSub}>
            Join {totalCount > 0 ? totalCount : 'our'} distinguished experts in{'\n'}library science & information technology
          </Text>
          
          {/* Bento Box Stats */}
          {!loading && totalCount > 0 && (
            <View style={st.statRow}>
              {[
                { label: 'Keynotes', value: keynotes.length, icon: 'star', color: '#f59e0b' },
                { label: 'Speakers', value: speakers.length, icon: 'mic', color: '#60a5fa' },
                { label: 'Countries', value: countriesCount, icon: 'globe', color: '#10b981' },
              ].map(s => (
                <View key={s.label} style={st.statPill}>
                  <View style={[st.statIconBox, { backgroundColor: s.color + '25' }]}>
                    <Ionicons name={s.icon} size={16} color={s.color} />
                  </View>
                  <Text style={st.statValue}>{s.value}</Text>
                  <Text style={st.statLabel}>{s.label}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {loading ? (
          <SkeletonGrid />
        ) : (
          <View>
            {/* Keynotes Section */}
            {keynotes.length > 0 && (
              <View style={{ marginBottom: SPACE.xxl }}>
                <SectionHeader label="Keynote Speakers" count={keynotes.length} icon="star" accent="#f59e0b" />
                <View style={st.gridContainer}>
                  {keynotes.map((sp, i) => (
                    <SpeakerGridCard key={sp.id} speaker={sp} index={i} onPress={() => setSelectedId(sp.id)} />
                  ))}
                </View>
              </View>
            )}

            {/* Invited Speakers Section */}
            {speakers.length > 0 && (
              <View style={{ marginBottom: SPACE.xxl }}>
                <SectionHeader label="Invited Speakers" count={speakers.length} icon="people" accent="#60a5fa" />
                <View style={st.gridContainer}>
                  {speakers.map((sp, i) => (
                    <SpeakerGridCard key={sp.id} speaker={sp} index={i} onPress={() => setSelectedId(sp.id)} />
                  ))}
                </View>
              </View>
            )}

            {/* Empty State */}
            {keynotes.length === 0 && speakers.length === 0 && (
              <View style={st.empty}>
                <View style={st.emptyIconWrap}>
                  <Ionicons name="mic-off-outline" size={48} color="rgba(255,255,255,0.4)" />
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
  // Background Blobs
  blob: { position: 'absolute', opacity: 0.7, filter: [{ blur: 50 }] },
  blob1: { width: 350, height: 350, borderRadius: 175, backgroundColor: 'rgba(99,102,241,0.12)', top: -100, right: -100 },
  blob2: { width: 250, height: 250, borderRadius: 125, backgroundColor: 'rgba(245,158,11,0.08)', top: 250, left: -100 },
  blob3: { width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(6,182,212,0.1)', bottom: 50, right: -80 },

  // Header
  headerWrap: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100 },
  headerBlur: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,14,45,0.9)', borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: TOP, paddingBottom: SPACE.sm, paddingHorizontal: PAD },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  topTitle: { fontSize: FONT.md, fontWeight: FONT.w8, color: '#fff', letterSpacing: 0.5 },
  topSub: { fontSize: 10, color: 'rgba(255,255,255,0.5)', letterSpacing: 1.5, marginTop: 2, textTransform: 'uppercase' },

  // Hero Section
  hero: { paddingBottom: SPACE.xl, marginTop: SPACE.sm },
  heroPill: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: RADIUS.full, paddingHorizontal: SPACE.md, paddingVertical: 6, alignSelf: 'flex-start', marginBottom: SPACE.lg },
  heroPillDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#60a5fa' },
  heroPillText: { fontSize: 11, fontWeight: FONT.w8, color: 'rgba(255,255,255,0.8)', letterSpacing: 1, textTransform: 'uppercase' },
  heroTitle: { fontSize: 42, fontWeight: FONT.w9, color: '#fff', letterSpacing: -1, lineHeight: 46, marginBottom: SPACE.sm },
  heroSub: { fontSize: FONT.base, color: 'rgba(255,255,255,0.6)', lineHeight: 22, marginBottom: SPACE.xl },
  
  // Hero Stats
  statRow: { flexDirection: 'row', gap: SPACE.sm },
  statPill: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: RADIUS.lg, padding: SPACE.sm, alignItems: 'center', justifyContent: 'center', gap: 4 },
  statIconBox: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  statValue: { fontSize: FONT.xl, fontWeight: FONT.w9, color: '#fff' },
  statLabel: { fontSize: 9, fontWeight: FONT.w7, color: 'rgba(255,255,255,0.5)', letterSpacing: 0.5, textTransform: 'uppercase' },

  // Section Header
  secHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginBottom: SPACE.lg },
  secIconWrap: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  secLabel: { flex: 1, fontSize: FONT.xl, fontWeight: FONT.w8, color: '#fff', letterSpacing: -0.5 },
  secCount: { paddingHorizontal: SPACE.sm, paddingVertical: 4, borderRadius: RADIUS.full, minWidth: 28, alignItems: 'center' },
  secCountText: { fontSize: 12, fontWeight: FONT.w9 },

  // Grid Layout
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  
  // Grid Card
  gridCard: { marginBottom: SPACE.lg },
  cardInner: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: RADIUS.xl, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  cardPressed: { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.2)' },
  
  avatarWrap: { position: 'relative', width: '100%', aspectRatio: 0.9 },
  avatarImg: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  avatarInitials: { fontSize: 32, fontWeight: FONT.w9, color: '#fff' },
  avatarScrim: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%' },
  
  topBadges: { position: 'absolute', top: SPACE.sm, right: SPACE.sm, flexDirection: 'row', gap: 4 },
  keynoteBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#f59e0b', alignItems: 'center', justifyContent: 'center', ...SHADOW.sm, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  talkBadge: { position: 'absolute', bottom: SPACE.sm, left: SPACE.sm, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.full, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  talkBadgeText: { fontSize: 9, fontWeight: FONT.w8, color: '#fff' },

  infoWrap: { padding: SPACE.md, paddingTop: SPACE.sm },
  cardName: { fontSize: FONT.md, fontWeight: FONT.w8, color: '#fff', marginBottom: 2, letterSpacing: -0.2 },
  cardDesig: { fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 16, marginBottom: SPACE.xs, height: 32 },
  instRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  cardInst: { fontSize: 10, color: 'rgba(255,255,255,0.4)', flex: 1 },

  // Empty State
  empty: { alignItems: 'center', paddingVertical: 80, paddingHorizontal: SPACE.xl },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', marginBottom: SPACE.lg },
  emptyTitle: { fontSize: FONT.lg, fontWeight: FONT.w8, color: '#fff', marginBottom: SPACE.xs },
  emptyText: { fontSize: FONT.sm, color: 'rgba(255,255,255,0.4)', textAlign: 'center' },
});