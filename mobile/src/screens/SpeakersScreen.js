import React, { useEffect, useState, useCallback, useRef, useMemo, memo } from 'react';
import {
  View, Text, TouchableOpacity, Image, StyleSheet,
  Platform, StatusBar, RefreshControl, Dimensions, Animated, Easing, Pressable, FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  COLORS, FONT, SPACE, RADIUS, SHADOW, TOP, BOTTOM, fixMediaUrl,
} from '../theme';
import { apiFetch } from '../api';
import SpeakerDetailScreen from './SpeakerDetailScreen';
import TopicPickerModal from './TopicPickerModal';

const { width: W } = Dimensions.get('window');
const PAD = SPACE.xl;
const STATUS_TOP = TOP || (Platform.OS === 'ios' ? 50 : 38);
const NAVBAR_HEIGHT = STATUS_TOP + 52;
const CARD_WIDTH = Math.floor((W - PAD * 2 - SPACE.md) / 2);
const AVATAR_HEIGHT = Math.floor(CARD_WIDTH * 1.08);
const CARD_TOTAL_HEIGHT = AVATAR_HEIGHT + 145; // Fixed height for exact getItemLayout
const ROW_TOTAL_HEIGHT = CARD_TOTAL_HEIGHT + SPACE.md;

const GRAD_PAIRS = [
  [COLORS.brand, COLORS.brandDark],
  [COLORS.teal, COLORS.brand],
  [COLORS.purple, COLORS.brand],
  [COLORS.accent || COLORS.brand, COLORS.brandDark],
  [COLORS.rose || COLORS.brand, COLORS.purple],
];

function getGrad(idx) {
  return GRAD_PAIRS[(idx || 0) % GRAD_PAIRS.length];
}

const SpeakerGridCard = memo(({ speaker, index, onPress, onChat }) => {
  const [imgOk, setImgOk] = useState(true);
  const [g1, g2] = getGrad(speaker.id || index);
  const photoUrl = speaker.photo_url
    ? typeof fixMediaUrl === 'function' ? fixMediaUrl(speaker.photo_url) : speaker.photo_url
    : null;

  return (
    <View style={st.cardOuter}>
      <Pressable
        onPress={onPress}
        style={[st.cardInner, speaker.is_keynote && st.cardInnerKeynote]}
      >
        <View style={st.avatarWrap}>
          {photoUrl && imgOk ? (
            <Image
              source={{ uri: photoUrl }}
              style={st.avatarImg}
              resizeMode="contain"
              resizeMethod="resize"
              fadeDuration={0}
              onError={() => setImgOk(false)}
            />
          ) : (
            <LinearGradient colors={[g1, g2]} style={st.avatarImg}>
              <Text style={st.avatarInitials}>{speaker.initials}</Text>
            </LinearGradient>
          )}

          {/* Top Badges */}
          <View style={st.topBadges}>
            {speaker.is_keynote ? (
              <View style={st.keynoteBadge}>
                <Ionicons name="star" size={10} color={COLORS.accentDark || COLORS.accent} />
                <Text style={st.keynoteBadgeText}>KEYNOTE</Text>
              </View>
            ) : <View />}
            {speaker.talk_count > 0 && (
              <View style={st.talkBadge}>
                <Ionicons name="mic-outline" size={10} color={COLORS.textInverse} />
                <Text style={st.talkBadgeText}>{speaker.talk_count}</Text>
              </View>
            )}
          </View>

          {/* Country */}
          {!!speaker.country && (
            <View style={st.countryTag}>
              <Ionicons name="globe-outline" size={10} color={COLORS.accentLight || COLORS.accent} />
              <Text style={st.countryTagText} numberOfLines={1}>{speaker.country}</Text>
            </View>
          )}
        </View>

        <View style={st.infoWrap}>
          <Text style={st.cardName} numberOfLines={1}>{speaker.full_name}</Text>
          <Text style={st.cardDesig} numberOfLines={2}>{speaker.designation || 'Distinguished Speaker'}</Text>
          <View style={st.instRow}>
            <Ionicons name="business-outline" size={11} color={COLORS.accent} />
            <Text style={st.cardInst} numberOfLines={1}>{speaker.institute || 'ETD 2026'}</Text>
            <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.45)" />
          </View>
        </View>
      </Pressable>

      {onChat && (
        <TouchableOpacity style={st.chatBtn} onPress={() => onChat(speaker)} activeOpacity={0.7}>
          <Ionicons name="chatbubble-ellipses-outline" size={13} color={COLORS.accent} />
          <Text style={st.chatBtnText}>Chat</Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

const SectionHeader = memo(({ label, count, icon, accentColor, accentBg }) => (
  <View style={st.secHeader}>
    <View style={[st.secIconWrap, { backgroundColor: accentBg }]}>
      <Ionicons name={icon} size={17} color={accentColor} />
    </View>
    <Text style={st.secLabel}>{label}</Text>
    <View style={[st.secCount, { backgroundColor: accentBg }]}>
      <Text style={[st.secCountText, { color: accentColor }]}>{count}</Text>
    </View>
  </View>
));

export default function SpeakersScreen({ tokens, onBack, onOpenChatRoom }) {
  const [keynotes, setKeynotes] = useState([]);
  const [speakers, setSpeakers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [showTopicPicker, setShowTopicPicker] = useState(false);
  const [chatTarget, setChatTarget] = useState(null);

  // Progressive Lazy Load Limit (Starts at 8 rows = 16 speakers, grows as user scrolls)
  const [visibleRowsLimit, setVisibleRowsLimit] = useState(8);

  const scrollY = useRef(new Animated.Value(0)).current;

  const handleChatPress = useCallback((speaker) => {
    setChatTarget(speaker);
    setShowTopicPicker(true);
  }, []);

  const handleTopicConfirm = useCallback(async ({ topic, custom_topic }) => {
    if (!chatTarget) { setShowTopicPicker(false); return; }
    const userId = chatTarget.user_id || chatTarget.user;
    if (!userId) { setShowTopicPicker(false); setChatTarget(null); return; }
    try {
      const res = await apiFetch(`/chat/support/start/${userId}/`, {
        method: 'POST',
        body: JSON.stringify({ topic, custom_topic, message: '' }),
      });
      const data = await res.json();
      if (data.success && data.conversation_id) {
        onOpenChatRoom?.(data.conversation_id);
      }
    } catch (e) {
      console.log('Chat start error', e);
    } finally {
      setShowTopicPicker(false);
      setChatTarget(null);
    }
  }, [chatTarget, onOpenChatRoom]);

  const fetch_ = useCallback(async () => {
    try {
      const res = await apiFetch('/speakers/');
      const data = await res.json();
      setKeynotes(Array.isArray(data.keynotes) ? data.keynotes : []);
      setSpeakers(Array.isArray(data.speakers) ? data.speakers : []);
    } catch (e) {
      console.log('Speakers fetch error', e);
      setKeynotes([]);
      setSpeakers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);
  const onRefresh = () => { setRefreshing(true); fetch_(); };

  const safeKeynotes = Array.isArray(keynotes) ? keynotes : [];
  const safeSpeakers = Array.isArray(speakers) ? speakers : [];
  const totalCount = safeKeynotes.length + safeSpeakers.length;
  const allSpeakers = useMemo(() => [...safeKeynotes, ...safeSpeakers], [safeKeynotes, safeSpeakers]);
  const countriesCount = useMemo(() => [...new Set(allSpeakers.map(s => s.country).filter(Boolean))].length, [allSpeakers]);

  // ── Chunk all items into sections + 2-column rows ──
  const allRowItems = useMemo(() => {
    const items = [];
    if (safeKeynotes.length > 0) {
      items.push({
        type: 'header',
        id: 'hdr-keynotes',
        label: 'Keynote Speakers',
        count: safeKeynotes.length,
        icon: 'star',
        accentColor: COLORS.accent,
        accentBg: COLORS.accentMid || 'rgba(245,158,11,0.18)',
      });
      for (let i = 0; i < safeKeynotes.length; i += 2) {
        items.push({
          type: 'row',
          id: `kn-${i}`,
          items: [safeKeynotes[i], safeKeynotes[i + 1]].filter(Boolean),
        });
      }
    }
    if (safeSpeakers.length > 0) {
      items.push({
        type: 'header',
        id: 'hdr-speakers',
        label: 'Invited Speakers',
        count: safeSpeakers.length,
        icon: 'people-outline',
        accentColor: '#60a5fa',
        accentBg: 'rgba(96,165,250,0.18)',
      });
      for (let i = 0; i < safeSpeakers.length; i += 2) {
        items.push({
          type: 'row',
          id: `sp-${i}`,
          items: [safeSpeakers[i], safeSpeakers[i + 1]].filter(Boolean),
        });
      }
    }
    return items;
  }, [safeKeynotes, safeSpeakers]);

  // Sliced data for progressive stream
  const flatListData = useMemo(() => {
    return allRowItems.slice(0, visibleRowsLimit);
  }, [allRowItems, visibleRowsLimit]);

  const handleEndReached = useCallback(() => {
    if (visibleRowsLimit < allRowItems.length) {
      setVisibleRowsLimit(prev => Math.min(prev + 6, allRowItems.length));
    }
  }, [visibleRowsLimit, allRowItems.length]);

  const renderItem = useCallback(({ item, index }) => {
    if (item.type === 'header') {
      return (
        <View style={st.headerRowContainer}>
          <SectionHeader
            label={item.label}
            count={item.count}
            icon={item.icon}
            accentColor={item.accentColor}
            accentBg={item.accentBg}
          />
        </View>
      );
    }
    return (
      <View style={st.rowContainer}>
        <SpeakerGridCard
          speaker={item.items[0]}
          index={index * 2}
          onPress={() => setSelectedId(item.items[0].id)}
          onChat={handleChatPress}
        />
        {item.items[1] ? (
          <SpeakerGridCard
            speaker={item.items[1]}
            index={index * 2 + 1}
            onPress={() => setSelectedId(item.items[1].id)}
            onChat={handleChatPress}
          />
        ) : (
          <View style={{ width: CARD_WIDTH }} />
        )}
      </View>
    );
  }, [handleChatPress]);

  const renderListHeader = useMemo(() => (
    <View style={st.hero}>
      <View style={st.heroPill}>
        <View style={st.heroPillDot} />
        <Text style={st.heroPillText}>ETD 2026 · IIT DELHI</Text>
      </View>
      <Text style={st.heroTitle}>Meet the{'\n'}Speakers</Text>
      <Text style={st.heroSub}>
        Join {totalCount > 0 ? totalCount : 'our'} distinguished global experts in{'\n'}library science & digital scholarship
      </Text>
      {!loading && totalCount > 0 && (
        <View style={st.statRow}>
          {[
            { label: 'Keynotes', value: safeKeynotes.length, icon: 'star', color: COLORS.accent, bg: COLORS.accentMid || 'rgba(245,158,11,0.18)' },
            { label: 'Speakers', value: safeSpeakers.length, icon: 'mic-outline', color: '#60a5fa', bg: 'rgba(96,165,250,0.18)' },
            { label: 'Countries', value: countriesCount, icon: 'globe-outline', color: COLORS.success, bg: 'rgba(16,185,129,0.18)' },
          ].map((s) => (
            <View key={s.label} style={st.statPill}>
              <View style={[st.statIconBox, { backgroundColor: s.bg }]}>
                <Ionicons name={s.icon} size={15} color={s.color} />
              </View>
              <Text style={st.statValue}>{s.value}</Text>
              <Text style={st.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  ), [totalCount, loading, safeKeynotes.length, safeSpeakers.length, countriesCount]);

  const topicModal = (
    <TopicPickerModal
      visible={showTopicPicker}
      onClose={() => { setShowTopicPicker(false); setChatTarget(null); }}
      onConfirm={handleTopicConfirm}
      title={chatTarget ? `Chat with ${chatTarget.full_name}` : 'Select Topic'}
    />
  );

  if (selectedId !== null) {
    return (
      <>
        <SpeakerDetailScreen
          tokens={tokens} speakerId={selectedId}
          onBack={() => setSelectedId(null)} onOpenChatRoom={onOpenChatRoom}
        />
        {topicModal}
      </>
    );
  }

  const headerBgOpacity = scrollY.interpolate({ inputRange: [35, 100], outputRange: [0, 1], extrapolate: 'clamp' });

  return (
    <View style={st.screen}>
      <StatusBar barStyle="light-content" />

      {/* Static Background - Zero Overdraw */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <LinearGradient
          colors={[COLORS.brandDeeper, COLORS.brandDeep, COLORS.brandDark, COLORS.brandDeeper]}
          locations={[0, 0.38, 0.75, 1]}
          style={StyleSheet.absoluteFillObject}
        />
      </View>

      {/* Header */}
      <View style={st.headerWrap}>
        <Animated.View style={[st.headerBlur, { opacity: headerBgOpacity }]}>
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: COLORS.brandDeep }]} />
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

      <FlatList
        data={flatListData}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={
          !loading && totalCount === 0 ? (
            <View style={st.empty}>
              <View style={st.emptyIconWrap}>
                <Ionicons name="mic-off-outline" size={42} color="rgba(255,255,255,0.45)" />
              </View>
              <Text style={st.emptyTitle}>No speakers announced</Text>
              <Text style={st.emptyText}>Check back closer to the event date.</Text>
            </View>
          ) : null
        }
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={32}
        contentContainerStyle={{
          paddingHorizontal: PAD,
          paddingTop: NAVBAR_HEIGHT + SPACE.sm,
          paddingBottom: 100 + (BOTTOM || 0),
        }}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={5}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.textInverse}
            colors={[COLORS.brand, COLORS.accent]}
          />
        }
      />

      {topicModal}
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.brandDeeper },
  headerWrap: { position: 'absolute', top: 0, left: 0, right: 0, height: NAVBAR_HEIGHT, paddingTop: STATUS_TOP, justifyContent: 'center', zIndex: 100 },
  headerBlur: { ...StyleSheet.absoluteFillObject, borderBottomWidth: 1, borderColor: COLORS.glassBorder, ...SHADOW.md },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: PAD },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.glass, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.glassBorder },
  topTitle: { fontSize: FONT.md, fontWeight: FONT.w8, color: COLORS.textInverse, letterSpacing: 0.3 },
  topSub: { fontSize: FONT.micro, fontWeight: FONT.w7, color: COLORS.accentLight || COLORS.accent, letterSpacing: 1.4, marginTop: 1 },
  hero: { paddingBottom: SPACE.lg, marginTop: SPACE.xs },
  heroPill: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.glassBorder, borderRadius: RADIUS.full, paddingHorizontal: SPACE.md, paddingVertical: 6, alignSelf: 'flex-start', marginBottom: SPACE.md },
  heroPillDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: COLORS.accent },
  heroPillText: { fontSize: FONT.micro, fontWeight: FONT.w8, color: COLORS.textInverse, letterSpacing: 1.1 },
  heroTitle: { fontSize: FONT.hero, fontWeight: FONT.w9, color: COLORS.textInverse, letterSpacing: -1, lineHeight: 44, marginBottom: SPACE.sm },
  heroSub: { fontSize: FONT.sm, color: 'rgba(255,255,255,0.72)', lineHeight: 20, marginBottom: SPACE.xl },
  statRow: { flexDirection: 'row', gap: SPACE.sm },
  statPill: { flex: 1, backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.glassBorder, borderRadius: RADIUS.lg, paddingVertical: SPACE.md, paddingHorizontal: SPACE.sm, alignItems: 'center', justifyContent: 'center' },
  statIconBox: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  statValue: { fontSize: FONT.xl, fontWeight: FONT.w9, color: COLORS.textInverse },
  statLabel: { fontSize: FONT.micro, fontWeight: FONT.w7, color: 'rgba(255,255,255,0.65)', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 2 },
  headerRowContainer: { marginTop: SPACE.lg, marginBottom: SPACE.sm },
  secHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  secIconWrap: { width: 34, height: 34, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  secLabel: { flex: 1, fontSize: FONT.lg, fontWeight: FONT.w8, color: COLORS.textInverse, letterSpacing: -0.3 },
  secCount: { paddingHorizontal: SPACE.sm + 2, paddingVertical: 4, borderRadius: RADIUS.full, minWidth: 28, alignItems: 'center' },
  secCountText: { fontSize: FONT.xs, fontWeight: FONT.w9 },
  rowContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACE.md, height: CARD_TOTAL_HEIGHT },
  cardOuter: { width: CARD_WIDTH, height: CARD_TOTAL_HEIGHT },
  cardInner: { backgroundColor: '#101a33', borderRadius: RADIUS.xl, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  cardInnerKeynote: { borderColor: 'rgba(245,158,11,0.55)', borderWidth: 1.5 },
  avatarWrap: { position: 'relative', width: '100%', height: AVATAR_HEIGHT, backgroundColor: '#070d1d' },
  avatarImg: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  avatarInitials: { fontSize: FONT.xxxl, fontWeight: FONT.w9, color: COLORS.textInverse },
  topBadges: { position: 'absolute', top: SPACE.xs + 2, left: SPACE.xs + 2, right: SPACE.xs + 2, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  keynoteBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: COLORS.accent, paddingHorizontal: 7, paddingVertical: 3, borderRadius: RADIUS.full },
  keynoteBadgeText: { fontSize: 9.5, fontWeight: FONT.w9, color: '#000', letterSpacing: 0.4 },
  talkBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: RADIUS.full },
  talkBadgeText: { fontSize: FONT.micro, fontWeight: FONT.w8, color: COLORS.textInverse },
  countryTag: { position: 'absolute', bottom: SPACE.xs + 2, left: SPACE.xs + 2, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: RADIUS.full, maxWidth: '86%' },
  countryTagText: { fontSize: FONT.micro, fontWeight: FONT.w7, color: COLORS.textInverse },
  infoWrap: { padding: SPACE.sm + 2 },
  cardName: { fontSize: FONT.sm + 1, fontWeight: FONT.w8, color: COLORS.textInverse, letterSpacing: -0.2 },
  cardDesig: { fontSize: FONT.xs, color: 'rgba(255,255,255,0.68)', lineHeight: 15, marginTop: 2, height: 30 },
  instRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  cardInst: { fontSize: FONT.micro, fontWeight: FONT.w7, color: COLORS.brandLight, flex: 1 },
  chatBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 6, paddingVertical: 6, backgroundColor: 'rgba(245,158,11,0.15)', borderRadius: RADIUS.full, borderWidth: 1, borderColor: 'rgba(245,158,11,0.30)' },
  chatBtnText: { fontSize: FONT.micro, fontWeight: FONT.w7, color: COLORS.accent },
  empty: { alignItems: 'center', paddingVertical: 70, paddingHorizontal: SPACE.xl },
  emptyIconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.glassBorder, alignItems: 'center', justifyContent: 'center', marginBottom: SPACE.md },
  emptyTitle: { fontSize: FONT.lg, fontWeight: FONT.w8, color: COLORS.textInverse, marginBottom: 4 },
  emptyText: { fontSize: FONT.sm, color: 'rgba(255,255,255,0.55)', textAlign: 'center' },
});
