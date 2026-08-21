import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, StyleSheet,
  Platform, StatusBar, Linking, Animated, Dimensions, Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, SPACE, RADIUS, SHADOW, API_URL, API_HEADERS, TOP } from '../theme';

const { width: W, height: H } = Dimensions.get('window');
const PAD = SPACE.xl;

// ── Gradient & Color Utilities ────────────────────────────────────────────
const GRAD_PAIRS = [
  ['#6366f1','#8b5cf6'], ['#0333b6','#06b6d4'], ['#0d9f6e','#06b6d4'],
  ['#dc2626','#f59e0b'], ['#7c3aed','#db2777'], ['#0891b2','#0d9f6e'],
];

// ── Animated Components ───────────────────────────────────────────────────

// Staggered Bento Card with tactile press animation
function BentoCard({ children, delay = 0, style, onPress, colSpan = 1 }) {
  const entranceAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(entranceAnim, { toValue: 1, tension: 50, friction: 8, delay, useNativeDriver: true }).start();
  }, [entranceAnim, delay]);

  const onPressIn = () => { if (onPress) Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true, speed: 40 }).start(); };
  const onPressOut = () => { if (onPress) Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 30 }).start(); };

  const Wrapper = onPress ? TouchableOpacity : View;
  
  return (
    <Animated.View style={[{ 
      flex: colSpan, 
      opacity: entranceAnim, 
      transform: [
        { translateY: entranceAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) },
        { scale: scaleAnim }
      ] 
    }]}>
      <Wrapper activeOpacity={1} onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} style={[st.bentoCard, style]}>
        {children}
      </Wrapper>
    </Animated.View>
  );
}

// ── Skeleton Loader ───────────────────────────────────────────────────────
const SkeletonPulse = ({ width, height, borderRadius = RADIUS.md, style }) => {
  const anim = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 0.7, duration: 800, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0.3, duration: 800, useNativeDriver: true })
    ])).start();
  }, [anim]);
  return <Animated.View style={[{ width, height, borderRadius, backgroundColor: COLORS.border, opacity: anim }, style]} />;
};

const DetailSkeleton = () => (
  <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
    <View style={{ height: 350, backgroundColor: COLORS.brandDeep, alignItems: 'center', paddingTop: 100 }}>
      <SkeletonPulse width={120} height={120} borderRadius={60} style={{ marginBottom: SPACE.lg }} />
      <SkeletonPulse width={200} height={28} borderRadius={RADIUS.sm} style={{ marginBottom: SPACE.sm }} />
      <SkeletonPulse width={150} height={16} borderRadius={RADIUS.sm} />
    </View>
    <View style={{ padding: PAD, gap: SPACE.md, marginTop: -30 }}>
      <SkeletonPulse width="100%" height={150} borderRadius={RADIUS.xl} />
      <View style={{ flexDirection: 'row', gap: SPACE.md }}>
        <SkeletonPulse width="47%" height={120} borderRadius={RADIUS.xl} />
        <SkeletonPulse width="47%" height={120} borderRadius={RADIUS.xl} />
      </View>
      <SkeletonPulse width="100%" height={100} borderRadius={RADIUS.xl} />
    </View>
  </View>
);

// ── Background Aura ───────────────────────────────────────────────────────
const HeroAura = () => {
  const floatAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(floatAnim, { toValue: 1, duration: 8000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(floatAnim, { toValue: 0, duration: 8000, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
    ])).start();
  }, [floatAnim]);

  const scale = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.2] });
  const rotate = floatAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '20deg'] });

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient colors={['#050e2d', '#0a1a5e', '#0333b6']} style={StyleSheet.absoluteFill} />
      <Animated.View style={[st.auraBlob, { backgroundColor: 'rgba(99,102,241,0.15)', top: -80, right: -80, transform: [{ scale }, { rotate }] }]} />
      <Animated.View style={[st.auraBlob, { backgroundColor: 'rgba(245,158,11,0.1)', bottom: -40, left: -60, transform: [{ scale }] }]} />
    </View>
  );
};

// ── Main Screen ───────────────────────────────────────────────────────────
export default function SpeakerDetailScreen({ speakerId, onBack }) {
  const [speaker, setSpeaker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [imgOk, setImgOk] = useState(true);
  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/speakers/${speakerId}/`, { headers: API_HEADERS });
        const data = await res.json();
        setSpeaker(data);
      } catch (e) {
        console.log('Speaker detail error', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [speakerId]);

  if (loading) return <DetailSkeleton />;

  if (!speaker) {
    return (
      <View style={st.errorState}>
        <Ionicons name="person-remove-outline" size={64} color="rgba(255,255,255,0.2)" />
        <Text style={st.errorText}>Speaker profile not found.</Text>
        <TouchableOpacity onPress={onBack} style={st.errorBtn}>
          <Text style={st.errorBtnText}>Return to Speakers</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const [g1, g2] = GRAD_PAIRS[speaker.id % GRAD_PAIRS.length];
  const hasSocial = speaker.linkedin_url || speaker.twitter_url || speaker.google_scholar_url || speaker.researchgate_url || speaker.website_url;
  
  // Parallax & Sticky Header Interpolations
  const headerOpacity = scrollY.interpolate({ inputRange: [100, 200], outputRange: [0, 1], extrapolate: 'clamp' });
  const avatarScale = scrollY.interpolate({ inputRange: [-100, 0, 150], outputRange: [1.2, 1, 0.7], extrapolate: 'clamp' });
  const avatarTranslateY = scrollY.interpolate({ inputRange: [0, 150], outputRange: [0, 50], extrapolate: 'clamp' });
  const avatarOpacity = scrollY.interpolate({ inputRange: [50, 150], outputRange: [1, 0], extrapolate: 'clamp' });

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <StatusBar barStyle="light-content" />

      {/* --- Sticky Blur Header --- */}
      <Animated.View style={[st.stickyHeader, { opacity: headerOpacity }]}>
        <LinearGradient colors={['rgba(5,14,45,0.95)', 'rgba(5,14,45,0.8)']} style={StyleSheet.absoluteFillObject} />
        <Text style={st.stickyName} numberOfLines={1}>{speaker.full_name}</Text>
      </Animated.View>

      {/* --- Floating Back Button --- */}
      <TouchableOpacity onPress={onBack} style={st.backBtn}>
        <Ionicons name="chevron-back" size={24} color="#fff" />
      </TouchableOpacity>

      <Animated.ScrollView
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* --- Hero Section --- */}
        <View style={st.heroWrap}>
          <HeroAura />
          
          <Animated.View style={[st.heroAvatarWrap, { opacity: avatarOpacity, transform: [{ scale: avatarScale }, { translateY: avatarTranslateY }] }]}>
            {speaker.photo_url && imgOk ? (
              <Image source={{ uri: speaker.photo_url }} style={st.heroAvatarImg} onError={() => setImgOk(false)} />
            ) : (
              <LinearGradient colors={[g1, g2]} style={st.heroAvatarImg}>
                <Text style={st.heroAvatarInitials}>{speaker.initials}</Text>
              </LinearGradient>
            )}
            {speaker.is_keynote && (
              <View style={st.keynoteBadge}>
                <Ionicons name="star" size={12} color="#fde68a" />
              </View>
            )}
          </Animated.View>

          <View style={st.heroInfo}>
            <Text style={st.heroName}>{speaker.full_name}</Text>
            {!!speaker.designation && <Text style={st.heroDesig}>{speaker.designation}</Text>}
            
            <View style={st.heroMetaRow}>
              {!!speaker.institute && (
                <View style={st.heroMetaPill}>
                  <Ionicons name="business" size={12} color="rgba(255,255,255,0.6)" />
                  <Text style={st.heroMetaText} numberOfLines={1}>{speaker.institute}</Text>
                </View>
              )}
              {!!speaker.country && (
                <View style={st.heroMetaPill}>
                  <Ionicons name="globe" size={12} color="rgba(255,255,255,0.6)" />
                  <Text style={st.heroMetaText}>{speaker.country}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* --- Bento Box Content --- */}
        <View style={st.contentGrid}>
          
          {/* Bio Bento */}
          {!!speaker.bio && (
            <BentoCard delay={0}>
              <View style={st.bentoHeader}>
                <View style={[st.iconBox, { backgroundColor: COLORS.brandLight }]}><Ionicons name="person" size={16} color={COLORS.brand} /></View>
                <Text style={st.bentoTitle}>About</Text>
              </View>
              <Text style={st.bioText}>{speaker.bio}</Text>
            </BentoCard>
          )}

          {/* Connect & Contact Row (2 Columns) */}
          <View style={st.bentoRow}>
            {(speaker.email || speaker.website_url) && (
              <BentoCard delay={80} style={{ padding: SPACE.md }}>
                <Text style={st.bentoSmallTitle}>Contact</Text>
                <View style={{ gap: SPACE.sm, marginTop: SPACE.sm }}>
                  {!!speaker.email && (
                    <TouchableOpacity style={st.socialBtn} onPress={() => Linking.openURL(`mailto:${speaker.email}`).catch(()=>{})}>
                      <View style={[st.socialIconBox, { backgroundColor: '#0d9f6e20' }]}><Ionicons name="mail" size={14} color="#0d9f6e" /></View>
                      <Text style={st.socialBtnTxt}>Email</Text>
                    </TouchableOpacity>
                  )}
                  {!!speaker.website_url && (
                    <TouchableOpacity style={st.socialBtn} onPress={() => Linking.openURL(speaker.website_url).catch(()=>{})}>
                      <View style={[st.socialIconBox, { backgroundColor: COLORS.brandLight }]}><Ionicons name="globe" size={14} color={COLORS.brand} /></View>
                      <Text style={st.socialBtnTxt}>Website</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </BentoCard>
            )}

            {hasSocial && (
              <BentoCard delay={160} style={{ padding: SPACE.md }}>
                <Text style={st.bentoSmallTitle}>Connect</Text>
                <View style={{ gap: SPACE.sm, marginTop: SPACE.sm }}>
                  {!!speaker.linkedin_url && (
                    <TouchableOpacity style={st.socialBtn} onPress={() => Linking.openURL(speaker.linkedin_url).catch(()=>{})}>
                      <View style={[st.socialIconBox, { backgroundColor: '#0a66c220' }]}><Ionicons name="logo-linkedin" size={14} color="#0a66c2" /></View>
                      <Text style={st.socialBtnTxt}>LinkedIn</Text>
                    </TouchableOpacity>
                  )}
                  {!!speaker.twitter_url && (
                    <TouchableOpacity style={st.socialBtn} onPress={() => Linking.openURL(speaker.twitter_url).catch(()=>{})}>
                      <View style={[st.socialIconBox, { backgroundColor: '#1da1f220' }]}><Ionicons name="logo-twitter" size={14} color="#1da1f2" /></View>
                      <Text style={st.socialBtnTxt}>Twitter</Text>
                    </TouchableOpacity>
                  )}
                  {!!speaker.google_scholar_url && (
                    <TouchableOpacity style={st.socialBtn} onPress={() => Linking.openURL(speaker.google_scholar_url).catch(()=>{})}>
                      <View style={[st.socialIconBox, { backgroundColor: '#4285f420' }]}><Ionicons name="school" size={14} color="#4285f4" /></View>
                      <Text style={st.socialBtnTxt}>Scholar</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </BentoCard>
            )}
          </View>

          {/* Talks Bento */}
          {speaker.talks && speaker.talks.length > 0 && (
            <BentoCard delay={240}>
              <View style={st.bentoHeader}>
                <View style={[st.iconBox, { backgroundColor: '#7c3aed20' }]}><Ionicons name="mic" size={16} color="#7c3aed" /></View>
                <Text style={st.bentoTitle}>Sessions ({speaker.talks.length})</Text>
              </View>
              
              <View style={{ gap: SPACE.md }}>
                {speaker.talks.map((t, i) => (
                  <TouchableOpacity key={t.id} activeOpacity={0.7} style={st.talkCard}>
                    <View style={st.talkNumWrap}><Text style={st.talkNum}>0{i + 1}</Text></View>
                    <View style={{ flex: 1 }}>
                      {!!t.track && <View style={st.trackPill}><Text style={st.trackTxt}>{t.track}</Text></View>}
                      <Text style={st.talkTitle}>{t.title}</Text>
                      
                      {(!!t.talk_date || !!t.talk_time) && (
                        <View style={st.talkMetaRow}>
                          {!!t.talk_date && <View style={st.talkMetaItem}><Ionicons name="calendar" size={12} color={COLORS.textTer} /><Text style={st.talkMetaTxt}>{t.talk_date}</Text></View>}
                          {!!t.talk_time && <View style={st.talkMetaItem}><Ionicons name="time" size={12} color={COLORS.textTer} /><Text style={st.talkMetaTxt}>{t.talk_time}</Text></View>}
                        </View>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={COLORS.border} />
                  </TouchableOpacity>
                ))}
              </View>
            </BentoCard>
          )}

        </View>
      </Animated.ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  // Aura & Backgrounds
  auraBlob: { position: 'absolute', width: 300, height: 300, borderRadius: 150, filter: [{ blur: 40 }] },
  
  // Headers & Nav
  stickyHeader: { position: 'absolute', top: 0, left: 0, right: 0, height: TOP + 50, zIndex: 50, justifyContent: 'flex-end', paddingBottom: SPACE.md, paddingHorizontal: 70, alignItems: 'center' },
  stickyName: { fontSize: FONT.md, fontWeight: FONT.w8, color: '#fff' },
  backBtn: { position: 'absolute', top: TOP, left: PAD, zIndex: 100, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  
  // Hero Section
  heroWrap: { position: 'relative', overflow: 'hidden', paddingTop: TOP + 40, paddingBottom: SPACE.xxl + SPACE.xl, alignItems: 'center' },
  heroAvatarWrap: { position: 'relative', marginBottom: SPACE.lg, ...SHADOW.lg },
  heroAvatarImg: { width: 140, height: 140, borderRadius: 70, borderWidth: 4, borderColor: 'rgba(255,255,255,0.2)' },
  heroAvatarInitials: { fontSize: 48, fontWeight: FONT.w9, color: '#fff' },
  keynoteBadge: { position: 'absolute', bottom: 0, right: 10, width: 32, height: 32, borderRadius: 16, backgroundColor: '#f59e0b', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#050e2d', ...SHADOW.sm },
  
  heroInfo: { paddingHorizontal: PAD, alignItems: 'center' },
  heroName: { fontSize: 32, fontWeight: FONT.w9, color: '#fff', textAlign: 'center', letterSpacing: -0.5, marginBottom: 4 },
  heroDesig: { fontSize: FONT.base, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginBottom: SPACE.md },
  heroMetaRow: { flexDirection: 'row', gap: SPACE.sm, flexWrap: 'wrap', justifyContent: 'center' },
  heroMetaPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: SPACE.md, paddingVertical: 6, borderRadius: RADIUS.full, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  heroMetaText: { fontSize: 11, fontWeight: FONT.w6, color: '#fff' },

  // Bento Box Layout
  contentGrid: { padding: PAD, marginTop: -40, gap: SPACE.md },
  bentoRow: { flexDirection: 'row', gap: SPACE.md },
  bentoCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACE.xl, ...SHADOW.sm, borderWidth: 1, borderColor: COLORS.borderLight, overflow: 'hidden' },
  bentoHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginBottom: SPACE.lg },
  iconBox: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bentoTitle: { fontSize: FONT.lg, fontWeight: FONT.w8, color: COLORS.text, letterSpacing: -0.3 },
  bentoSmallTitle: { fontSize: FONT.sm, fontWeight: FONT.w7, color: COLORS.textSec, textTransform: 'uppercase', letterSpacing: 1 },

  // Bio & Text
  bioText: { fontSize: FONT.sm, color: COLORS.textSec, lineHeight: 22 },

  // Social & Contact Buttons
  socialBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, backgroundColor: COLORS.bgAlt, padding: 8, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderLight },
  socialIconBox: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  socialBtnTxt: { fontSize: 11, fontWeight: FONT.w7, color: COLORS.text },

  // Talks
  talkCard: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, backgroundColor: COLORS.bg, padding: SPACE.md, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderLight },
  talkNumWrap: { width: 36, height: 36, borderRadius: 12, backgroundColor: COLORS.brandLight, alignItems: 'center', justifyContent: 'center' },
  talkNum: { fontSize: 12, fontWeight: FONT.w9, color: COLORS.brand },
  trackPill: { alignSelf: 'flex-start', backgroundColor: COLORS.border, paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.xs, marginBottom: 4 },
  trackTxt: { fontSize: 9, fontWeight: FONT.w8, color: COLORS.textSec, textTransform: 'uppercase' },
  talkTitle: { fontSize: FONT.sm, fontWeight: FONT.w7, color: COLORS.text, lineHeight: 18, marginBottom: SPACE.xs },
  talkMetaRow: { flexDirection: 'row', gap: SPACE.md },
  talkMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  talkMetaTxt: { fontSize: 10, fontWeight: FONT.w6, color: COLORS.textTer },

  // Error State
  errorState: { flex: 1, backgroundColor: '#050e2d', alignItems: 'center', justifyContent: 'center', padding: PAD },
  errorText: { color: 'rgba(255,255,255,0.7)', fontSize: FONT.md, marginTop: SPACE.lg, marginBottom: SPACE.xl },
  errorBtn: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: SPACE.xl, paddingVertical: SPACE.md, borderRadius: RADIUS.full, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  errorBtnText: { color: '#fff', fontWeight: FONT.w7, fontSize: FONT.sm },
});