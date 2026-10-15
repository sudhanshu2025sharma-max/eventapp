import { apiFetch } from '../api';
import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, StyleSheet,
  Platform, StatusBar, Linking, Animated, Easing, Alert, Modal,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  COLORS, FONT, SPACE, RADIUS, SHADOW, API_URL, API_HEADERS, TOP, fixMediaUrl,
} from '../theme';
import SpeakerRequestModal from './SpeakerRequestModal';

const PAD = SPACE.xl;
const STATUS_TOP = TOP || (Platform.OS === 'ios' ? 50 : 38);

const GRAD_PAIRS = [
  [COLORS.brand, COLORS.brandDark],
  [COLORS.teal, COLORS.brand],
  [COLORS.purple, COLORS.brand],
  [COLORS.accent, COLORS.accentDark],
  [COLORS.rose, COLORS.purple],
];

/* ─── Bento Card ─── */
function BentoCard({ children, delay = 0, style, onPress }) {
  const entranceAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(entranceAnim, {
      toValue: 1, tension: 52, friction: 8, delay, useNativeDriver: true,
    }).start();
  }, [entranceAnim, delay]);

  const onPressIn = () => {
    if (onPress) Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, speed: 40 }).start();
  };
  const onPressOut = () => {
    if (onPress) Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 30 }).start();
  };

  const Wrapper = onPress ? TouchableOpacity : View;

  const handleOpenChat = async () => {
    // 1. If conversation_id is already present on speaker or connection request
    if (speaker?.conversation_id) {
      onOpenChatRoom?.(speaker.conversation_id);
      return;
    }
    if (connectionStatus?.conversation_id) {
      onOpenChatRoom?.(connectionStatus.conversation_id);
      return;
    }

    // 2. Fetch or create conversation using speaker's linked user ID
    const targetUserId = speaker?.user_id || speaker?.user || connectionStatus?.user_id;
    if (!targetUserId) {
      alert('This speaker has not linked their participant account yet.');
      return;
    }

    try {
      const res = await apiFetch(`/chat/support/start/${targetUserId}/`, {
        method: 'POST',
        body: JSON.stringify({ topic: 'session_discuss', custom_topic: '', message: '' }),
      });
      const data = await res.json();
      if (data.success && data.conversation_id) {
        onOpenChatRoom?.(data.conversation_id);
      } else if (data.conversation_id) {
        onOpenChatRoom?.(data.conversation_id);
      } else {
        alert(data.error || 'Unable to open conversation.');
      }
    } catch (e) {
      console.log('Error opening speaker chat:', e);
      alert('Network error opening chat.');
    }
  };


  return (
    <Animated.View
      style={{
        flex: 1,
        opacity: entranceAnim,
        transform: [
          { translateY: entranceAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
          { scale: scaleAnim },
        ],
      }}
    >
      <Wrapper
        activeOpacity={0.9}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[st.bentoCard, style]}
      >
        {children}
      </Wrapper>
    </Animated.View>
  );
}

/* ─── Skeleton ─── */
const SkeletonPulse = ({ width, height, borderRadius = RADIUS.md, style }) => {
  const anim = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [anim]);
  return (
    <Animated.View
      style={[{ width, height, borderRadius, backgroundColor: COLORS.border, opacity: anim }, style]}
    />
  );
};

const DetailSkeleton = () => (
  <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
    <StatusBar barStyle="light-content" />
    <LinearGradient colors={[COLORS.brandDeep, COLORS.brandDark, COLORS.brand]} style={st.header}>
      <View style={st.topbar}>
        <SkeletonPulse width={38} height={38} borderRadius={19} style={{ backgroundColor: COLORS.glass }} />
        <SkeletonPulse width={120} height={18} borderRadius={RADIUS.sm} style={{ backgroundColor: COLORS.glass }} />
        <View style={{ width: 38 }} />
      </View>
      <View style={[st.heroCard, { flexDirection: 'row', gap: SPACE.lg, alignItems: 'center' }]}>
        <SkeletonPulse width={116} height={146} borderRadius={RADIUS.xl} style={{ backgroundColor: COLORS.glass }} />
        <View style={{ flex: 1, gap: SPACE.sm }}>
          <SkeletonPulse width="85%" height={22} borderRadius={RADIUS.xs} style={{ backgroundColor: COLORS.glass }} />
          <SkeletonPulse width="65%" height={14} borderRadius={RADIUS.xs} style={{ backgroundColor: COLORS.glass }} />
          <SkeletonPulse width="75%" height={24} borderRadius={RADIUS.full} style={{ backgroundColor: COLORS.glass }} />
          <SkeletonPulse width="100%" height={38} borderRadius={RADIUS.full} style={{ backgroundColor: COLORS.glass }} />
        </View>
      </View>
    </LinearGradient>
    <View style={{ padding: PAD, gap: SPACE.md }}>
      <SkeletonPulse width="100%" height={120} borderRadius={RADIUS.xl} />
      <View style={{ flexDirection: 'row', gap: SPACE.md }}>
        <SkeletonPulse width="48%" height={110} borderRadius={RADIUS.xl} />
        <SkeletonPulse width="48%" height={110} borderRadius={RADIUS.xl} />
      </View>
    </View>
  </View>
);

/* ─── Expandable Bio (no LayoutAnimation) ─── */
const ExpandableBio = ({ text, isLong }) => {
  const [expanded, setExpanded] = useState(false);
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const toggle = () => {
    Animated.spring(rotateAnim, {
      toValue: expanded ? 0 : 1, tension: 60, friction: 8, useNativeDriver: true,
    }).start();
    setExpanded(!expanded);
  };

  const rotate = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  return (
    <>
      <Text style={st.bioText} numberOfLines={!expanded && isLong ? 4 : undefined}>
        {text}
      </Text>
      {isLong && (
        <TouchableOpacity activeOpacity={0.75} onPress={toggle} style={st.readMoreBtn}>
          <Text style={st.readMoreTxt}>{expanded ? 'Show less' : 'Read full bio'}</Text>
          <Animated.View style={{ transform: [{ rotate }] }}>
            <Ionicons name="chevron-down" size={14} color={COLORS.brand} />
          </Animated.View>
        </TouchableOpacity>
      )}
    </>
  );
};

/* ═══════════════════════ MAIN ═══════════════════════ */
export default function SpeakerDetailScreen({tokens, speakerId, onBack, onOpenChatRoom}) {
  const [speaker, setSpeaker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [imgOk, setImgOk] = useState(true);
  const [connStatus, setConnStatus] = useState(null);
  const [chatId, setChatId] = useState(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [zoomVisible, setZoomVisible] = useState(false);

  const ambientAnim = useRef(new Animated.Value(0)).current;
  const portraitFloat = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(ambientAnim, { toValue: 1, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(ambientAnim, { toValue: 0, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(portraitFloat, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(portraitFloat, { toValue: 0, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, [ambientAnim, portraitFloat]);

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

  const targetUserId = speaker?.user_id || speaker?.user;

  useEffect(() => {
    if (!targetUserId || !tokens?.access) return;
    (async () => {
      try {
        const r = await fetch(`${API_URL}/chat/check/bulk/`, {
          method: 'POST',
          headers: { ...API_HEADERS, Authorization: `Bearer ${tokens.access}` },
          body: JSON.stringify({ user_ids: [targetUserId] }),
        });
        const d = await r.json();
        const stt = d.statuses?.[targetUserId] || d.statuses?.[String(targetUserId)];
        if (stt) {
          setConnStatus(stt.status);
          setChatId(stt.conversation_id || null);
        }
      } catch (e) {}
    })();
  }, [targetUserId, tokens]);

  if (loading) return <DetailSkeleton />;

  if (!speaker) {
    return (
      <View style={st.errorState}>
        <StatusBar barStyle="dark-content" />
        <Ionicons name="person-remove-outline" size={56} color={COLORS.textTer} />
        <Text style={st.errorText}>Speaker profile not found.</Text>
        <TouchableOpacity onPress={onBack} style={st.errorBtn}>
          <Text style={st.errorBtnText}>Return to Speakers</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const photoUrl = speaker.photo_url ? fixMediaUrl(speaker.photo_url) : null;
  const hasValidPhoto = Boolean(photoUrl && imgOk);

  const modalSpeaker = {
    id: targetUserId,
    name: speaker.full_name,
    first_name: speaker.first_name || (speaker.full_name || '').split(' ')[0] || '',
    last_name: speaker.last_name || (speaker.full_name || '').split(' ').slice(1).join(' ') || '',
    profile_photo_url: photoUrl,
    photo_url: photoUrl,
    photo: photoUrl,
    designation: speaker.designation || '',
    affiliation: speaker.institute || '',
  };

  let btnText = 'Profile Unlinked';
  let btnIcon = 'person-outline';
  let btnColors = [COLORS.textTer, COLORS.textSec];
  let btnDisabled = true;

  if (targetUserId) {
    if (connStatus === 'connected') {
      btnText = 'Message';
      btnIcon = 'chatbubble-ellipses-outline';
      btnColors = [COLORS.success, COLORS.teal];
      btnDisabled = false;
    } else if (connStatus === 'pending_sent') {
      btnText = 'Requested';
      btnIcon = 'time-outline';
      btnColors = [COLORS.accent, COLORS.accentDark];
      btnDisabled = true;
    } else if (connStatus === 'pending_received') {
      btnText = 'Accept Request';
      btnIcon = 'mail-unread-outline';
      btnColors = [COLORS.danger, COLORS.rose];
      btnDisabled = false;
    } else {
      btnText = 'Request Discussion';
      btnIcon = 'person-add-outline';
      btnColors = [COLORS.accent, COLORS.accentDark];
      btnDisabled = false;
    }
  }

  const handleConnectPress = async () => {
    if (btnDisabled) return;
    if (connStatus === 'connected') {
      if (chatId) {
        onOpenChatRoom?.(chatId);
        return;
      }
      // If chatId is not yet cached, fetch/create it directly
      try {
        const res = await apiFetch(`/chat/support/start/${targetUserId}/`, {
          method: 'POST',
          body: JSON.stringify({ topic: 'session_discuss', custom_topic: '', message: '' }),
        });
        const data = await res.json();
        const cid = data.conversation_id || data.id;
        if (cid) {
          setChatId(cid);
          onOpenChatRoom?.(cid);
          return;
        }
      } catch (err) {
        console.log('Error opening chat for connected speaker:', err);
      }
      return;
    }
    if (connStatus === 'pending_received') {
      Alert.alert(
        'Pending Request',
        'This speaker already sent you a request. Open the Messages / Requests tab to accept it.'
      );
      return;
    }
    setShowRequestModal(true);
  };

  const gradColors = GRAD_PAIRS[(speaker.id || 0) % GRAD_PAIRS.length];
  const hasContact = Boolean(speaker.email || speaker.website_url);
  const hasSocial = Boolean(
    speaker.linkedin_url || speaker.twitter_url || speaker.google_scholar_url || speaker.researchgate_url
  );
  const isBioLong = (speaker.bio || '').length > 220;

  const orb1Y = ambientAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 14] });
  const orb2X = ambientAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -16] });
  const photoTranslateY = portraitFloat.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });

  return (
    <View style={st.container}>
      <StatusBar barStyle="light-content" />

      {/* ═══════════════════════════════════════════════════
          FIXED HEADER — never scrolls away
          Top bar + hero card stay pinned exactly like the screenshot
         ═══════════════════════════════════════════════════ */}
      <LinearGradient
        colors={[COLORS.brandDeeper, COLORS.brandDeep, COLORS.brand]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={st.header}
      >
        <Animated.View style={[st.ambientOrb1, { transform: [{ translateY: orb1Y }] }]} />
        <Animated.View style={[st.ambientOrb2, { transform: [{ translateX: orb2X }] }]} />

        {/* Top Navigation Bar */}
        <View style={st.topbar}>
          <TouchableOpacity onPress={onBack} style={st.iconBtn} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={19} color={COLORS.textInverse} />
          </TouchableOpacity>

          <Text style={st.headerTitle}>Speaker Profile</Text>

          {speaker.talks?.length > 0 ? (
            <View style={st.sessionPill}>
              <Ionicons name="mic-outline" size={12} color={COLORS.accentLight} />
              <Text style={st.sessionPillText}>{speaker.talks.length}</Text>
            </View>
          ) : (
            <View style={{ width: 36 }} />
          )}
        </View>

        {/* Glassmorphic Hero Card */}
        <View style={st.heroCard}>
          {/* Portrait */}
          <Animated.View style={[st.portraitCol, { transform: [{ translateY: photoTranslateY }] }]}>
            <Pressable
              onPress={() => hasValidPhoto && setZoomVisible(true)}
              style={st.portraitFrame}
            >
              {hasValidPhoto ? (
                <View style={st.portraitInner}>
                  <Image
                    source={{ uri: photoUrl }}
                    style={StyleSheet.absoluteFillObject}
                    blurRadius={18}
                    resizeMode="cover"
                  />
                  <View style={st.portraitBackdropTint} />
                  <Image
                    source={{ uri: photoUrl }}
                    style={st.portraitImg}
                    resizeMode="contain"
                    onError={() => setImgOk(false)}
                  />
                  <View style={st.zoomBadge}>
                    <Ionicons name="expand-outline" size={11} color={COLORS.textInverse} />
                  </View>
                </View>
              ) : (
                <LinearGradient colors={gradColors} style={st.portraitInner}>
                  <Text style={st.portraitInitials}>{speaker.initials}</Text>
                </LinearGradient>
              )}
            </Pressable>

            {speaker.is_keynote && (
              <View style={st.keynoteBadge}>
                <Ionicons name="star" size={10} color={COLORS.accentDark} />
                <Text style={st.keynoteText}>KEYNOTE</Text>
              </View>
            )}
          </Animated.View>

          {/* Details */}
          <View style={st.detailsCol}>
            <Text style={st.heroName} numberOfLines={2}>{speaker.full_name}</Text>

            {!!speaker.designation && (
              <Text style={st.heroDesig} numberOfLines={2}>{speaker.designation}</Text>
            )}

            <View style={st.metaStack}>
              {!!speaker.institute && (
                <View style={st.metaRow}>
                  <Ionicons name="business-outline" size={13} color={COLORS.accentLight} />
                  <Text style={st.metaText} numberOfLines={2}>{speaker.institute}</Text>
                </View>
              )}
              {!!speaker.country && (
                <View style={st.metaRow}>
                  <Ionicons name="location-outline" size={13} color={COLORS.accentLight} />
                  <Text style={st.metaText} numberOfLines={1}>{speaker.country}</Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              activeOpacity={0.86}
              onPress={handleConnectPress}
              style={[st.connectBtn, btnDisabled && { opacity: 0.7 }]}
              disabled={btnDisabled}
            >
              <LinearGradient
                colors={btnColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={st.connectBtnGrad}
              >
                <Ionicons name={btnIcon} size={15} color={COLORS.textInverse} />
                <Text style={st.connectBtnText} numberOfLines={1}>{btnText}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      {/* ═══════════════════════════════════════════════════
          SCROLLABLE CONTENT — only this part scrolls
         ═══════════════════════════════════════════════════ */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={st.scrollContent}
        bounces
      >
        {!!speaker.bio && (
          <BentoCard delay={40}>
            <View style={st.bentoHeader}>
              <View style={[st.iconBox, { backgroundColor: COLORS.brandLight }]}>
                <Ionicons name="person-outline" size={16} color={COLORS.brand} />
              </View>
              <Text style={st.bentoTitle}>About Speaker</Text>
            </View>
            <ExpandableBio text={speaker.bio} isLong={isBioLong} />
          </BentoCard>
        )}

        {(hasContact || hasSocial) && (
          <View style={st.bentoRow}>
            {hasContact && (
              <BentoCard delay={100} style={{ padding: SPACE.lg }}>
                <Text style={st.bentoSmallTitle}>Contact</Text>
                <View style={st.socialCol}>
                  {!!speaker.email && (
                    <TouchableOpacity
                      style={st.socialBtn}
                      onPress={() => Linking.openURL(`mailto:${speaker.email}`).catch(() => {})}
                    >
                      <View style={[st.socialIconBox, { backgroundColor: COLORS.successLight }]}>
                        <Ionicons name="mail-outline" size={14} color={COLORS.success} />
                      </View>
                      <Text style={st.socialBtnTxt} numberOfLines={1}>Email</Text>
                      <Ionicons name="open-outline" size={12} color={COLORS.textTer} />
                    </TouchableOpacity>
                  )}
                  {!!speaker.website_url && (
                    <TouchableOpacity
                      style={st.socialBtn}
                      onPress={() => Linking.openURL(speaker.website_url).catch(() => {})}
                    >
                      <View style={[st.socialIconBox, { backgroundColor: COLORS.brandLight }]}>
                        <Ionicons name="globe-outline" size={14} color={COLORS.brand} />
                      </View>
                      <Text style={st.socialBtnTxt} numberOfLines={1}>Website</Text>
                      <Ionicons name="open-outline" size={12} color={COLORS.textTer} />
                    </TouchableOpacity>
                  )}
                </View>
              </BentoCard>
            )}

            {hasSocial && (
              <BentoCard delay={160} style={{ padding: SPACE.lg }}>
                <Text style={st.bentoSmallTitle}>Social Networking</Text>
                <View style={st.socialCol}>
                  {!!speaker.linkedin_url && (
                    <TouchableOpacity
                      style={st.socialBtn}
                      onPress={() => Linking.openURL(speaker.linkedin_url).catch(() => {})}
                    >
                      <View style={[st.socialIconBox, { backgroundColor: COLORS.brandLight }]}>
                        <Ionicons name="logo-linkedin" size={14} color={COLORS.brand} />
                      </View>
                      <Text style={st.socialBtnTxt} numberOfLines={1}>LinkedIn</Text>
                      <Ionicons name="open-outline" size={12} color={COLORS.textTer} />
                    </TouchableOpacity>
                  )}
                  {!!speaker.google_scholar_url && (
                    <TouchableOpacity
                      style={st.socialBtn}
                      onPress={() => Linking.openURL(speaker.google_scholar_url).catch(() => {})}
                    >
                      <View style={[st.socialIconBox, { backgroundColor: COLORS.purpleLight }]}>
                        <Ionicons name="school-outline" size={14} color={COLORS.purple} />
                      </View>
                      <Text style={st.socialBtnTxt} numberOfLines={1}>Scholar</Text>
                      <Ionicons name="open-outline" size={12} color={COLORS.textTer} />
                    </TouchableOpacity>
                  )}
                  {!!speaker.researchgate_url && (
                    <TouchableOpacity
                      style={st.socialBtn}
                      onPress={() => Linking.openURL(speaker.researchgate_url).catch(() => {})}
                    >
                      <View style={[st.socialIconBox, { backgroundColor: COLORS.tealLight }]}>
                        <Ionicons name="library-outline" size={14} color={COLORS.teal} />
                      </View>
                      <Text style={st.socialBtnTxt} numberOfLines={1}>ResearchGate</Text>
                      <Ionicons name="open-outline" size={12} color={COLORS.textTer} />
                    </TouchableOpacity>
                  )}
                  {!!speaker.twitter_url && (
                    <TouchableOpacity
                      style={st.socialBtn}
                      onPress={() => Linking.openURL(speaker.twitter_url).catch(() => {})}
                    >
                      <View style={[st.socialIconBox, { backgroundColor: COLORS.brandLight }]}>
                        <Ionicons name="logo-twitter" size={14} color={COLORS.brand} />
                      </View>
                      <Text style={st.socialBtnTxt} numberOfLines={1}>Twitter</Text>
                      <Ionicons name="open-outline" size={12} color={COLORS.textTer} />
                    </TouchableOpacity>
                  )}
                </View>
              </BentoCard>
            )}
          </View>
        )}

        {speaker.talks?.length > 0 && (
          <BentoCard delay={220}>
            <View style={st.bentoHeader}>
              <View style={[st.iconBox, { backgroundColor: COLORS.brandLight }]}>
                <Ionicons name="mic-outline" size={16} color={COLORS.brand} />
              </View>
              <Text style={st.bentoTitle}>Sessions ({speaker.talks.length})</Text>
            </View>

            <View style={{ gap: SPACE.md }}>
              {speaker.talks.map((t, i) => (
                <View key={t.id || i} style={st.talkCard}>
                  <View style={st.talkNumWrap}>
                    <Text style={st.talkNum}>{String(i + 1).padStart(2, '0')}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    {!!t.track && (
                      <View style={st.trackPill}>
                        <Text style={st.trackTxt}>{t.track}</Text>
                      </View>
                    )}
                    <Text style={st.talkTitle}>{t.title}</Text>
                    {(!!t.talk_date || !!t.talk_time) && (
                      <View style={st.talkMetaRow}>
                        {!!t.talk_date && (
                          <View style={st.talkMetaItem}>
                            <Ionicons name="calendar-outline" size={12} color={COLORS.brand} />
                            <Text style={st.talkMetaTxt}>{t.talk_date}</Text>
                          </View>
                        )}
                        {!!t.talk_time && (
                          <View style={st.talkMetaItem}>
                            <Ionicons name="time-outline" size={12} color={COLORS.brand} />
                            <Text style={st.talkMetaTxt}>{t.talk_time}</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </BentoCard>
        )}
      </ScrollView>

      {/* Fullscreen Photo Lightbox */}
      <Modal
        visible={zoomVisible}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        onRequestClose={() => setZoomVisible(false)}
      >
        <Pressable style={st.modalBackdrop} onPress={() => setZoomVisible(false)}>
          <View style={st.modalCard}>
            {hasValidPhoto && (
              <Image source={{ uri: photoUrl }} style={st.modalImg} resizeMode="contain" />
            )}
            <View style={st.modalFooter}>
              <View style={{ flex: 1 }}>
                <Text style={st.modalName} numberOfLines={1}>{speaker.full_name}</Text>
                {!!speaker.institute && (
                  <Text style={st.modalSub} numberOfLines={1}>{speaker.institute}</Text>
                )}
              </View>
              <TouchableOpacity onPress={() => setZoomVisible(false)} style={st.modalCloseBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={18} color={COLORS.text} />
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>

      {Boolean(targetUserId) && (
        <SpeakerRequestModal
          visible={showRequestModal}
          onClose={() => setShowRequestModal(false)}
          speaker={modalSpeaker}
          tokens={tokens}
          onSent={(d) => {
            if (d?.already_connected && d?.conversation_id) {
              setConnStatus('connected');
              setChatId(d.conversation_id);
              setShowRequestModal(false);
              onOpenChatRoom?.(d.conversation_id);
            } else {
              setConnStatus('pending_sent');
              setShowRequestModal(false);
            }
          }}
        />
      )}
    </View>
  );
}

/* ═══════════════════════ STYLES ═══════════════════════ */
const st = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  /* ── Fixed Brand Header ── */
  header: {
    paddingTop: STATUS_TOP,
    paddingBottom: SPACE.xl,
    borderBottomLeftRadius: RADIUS.xxl,
    borderBottomRightRadius: RADIUS.xxl,
    overflow: 'hidden',
    zIndex: 10,
    ...SHADOW.lg,
  },
  ambientOrb1: {
    position: 'absolute',
    top: -30,
    right: -20,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  ambientOrb2: {
    position: 'absolute',
    bottom: -30,
    left: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.accentMid,
  },
  topbar: {
    paddingHorizontal: PAD,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.glass,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FONT.lg,
    fontWeight: FONT.w8,
    color: COLORS.textInverse,
    letterSpacing: -0.2,
  },
  sessionPill: {
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
  sessionPillText: {
    fontSize: FONT.xs,
    fontWeight: FONT.w8,
    color: COLORS.textInverse,
  },

  /* ── Hero Card ── */
  heroCard: {
    marginHorizontal: PAD,
    marginTop: SPACE.md,
    padding: SPACE.md,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.glass,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.lg,
  },
  portraitCol: {
    alignItems: 'center',
  },
  portraitFrame: {
    width: 114,
    height: 144,
    borderRadius: RADIUS.lg,
    padding: 3,
    backgroundColor: COLORS.surface,
    ...SHADOW.md,
  },
  portraitInner: {
    flex: 1,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    backgroundColor: COLORS.brandDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  portraitBackdropTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.25)',
  },
  portraitImg: {
    width: '100%',
    height: '100%',
  },
  portraitInitials: {
    fontSize: FONT.xxxl,
    fontWeight: FONT.w9,
    color: COLORS.textInverse,
  },
  zoomBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(15,23,42,0.55)',
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keynoteBadge: {
    marginTop: -10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.accentLight,
    borderWidth: 1,
    borderColor: COLORS.accent,
    paddingHorizontal: SPACE.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    ...SHADOW.sm,
  },
  keynoteText: {
    fontSize: FONT.micro,
    fontWeight: FONT.w9,
    color: COLORS.accentDark,
    letterSpacing: 0.4,
  },
  detailsCol: {
    flex: 1,
    justifyContent: 'center',
  },
  heroName: {
    fontSize: FONT.xl,
    fontWeight: FONT.w9,
    color: COLORS.textInverse,
    letterSpacing: -0.3,
    lineHeight: 25,
  },
  heroDesig: {
    fontSize: FONT.xs,
    fontWeight: FONT.w6,
    color: COLORS.brandLight,
    marginTop: 3,
    lineHeight: 17,
  },
  metaStack: {
    marginTop: SPACE.sm,
    gap: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    flex: 1,
    fontSize: FONT.xs,
    fontWeight: FONT.w6,
    color: 'rgba(255,255,255,0.86)',
  },
  connectBtn: {
    marginTop: SPACE.md,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
    alignSelf: 'flex-start',
    ...SHADOW.sm,
  },
  connectBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: SPACE.lg,
    borderRadius: RADIUS.full,
  },
  connectBtnText: {
    color: COLORS.textInverse,
    fontWeight: FONT.w8,
    fontSize: FONT.xs,
  },

  /* ── Scrollable Content ── */
  scrollContent: {
    paddingHorizontal: PAD,
    paddingTop: SPACE.lg,
    paddingBottom: SPACE.huge * 2,
    gap: SPACE.md,
  },
  bentoRow: {
    flexDirection: 'row',
    gap: SPACE.md,
    width: '100%',
  },
  bentoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACE.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    ...SHADOW.sm,
  },
  bentoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    marginBottom: SPACE.sm,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bentoTitle: {
    fontSize: FONT.md,
    fontWeight: FONT.w8,
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  bentoSmallTitle: {
    fontSize: FONT.xs,
    fontWeight: FONT.w8,
    color: COLORS.brand,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: SPACE.sm,
  },
  bioText: {
    fontSize: FONT.sm,
    color: COLORS.textSec,
    lineHeight: 21,
  },
  readMoreBtn: {
    marginTop: SPACE.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  readMoreTxt: {
    fontSize: FONT.xs,
    fontWeight: FONT.w8,
    color: COLORS.brand,
  },

  socialCol: {
    gap: SPACE.sm,
  },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    backgroundColor: COLORS.bg,
    paddingHorizontal: SPACE.sm + 2,
    paddingVertical: SPACE.sm + 1,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  socialIconBox: {
    width: 26,
    height: 26,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialBtnTxt: {
    fontSize: FONT.xs,
    fontWeight: FONT.w7,
    color: COLORS.text,
    flex: 1,
  },

  talkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    backgroundColor: COLORS.bg,
    padding: SPACE.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  talkNumWrap: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  talkNum: {
    fontSize: FONT.xs,
    fontWeight: FONT.w9,
    color: COLORS.brand,
  },
  trackPill: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.brandLight,
    paddingHorizontal: SPACE.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.xs,
    marginBottom: 4,
  },
  trackTxt: {
    fontSize: FONT.micro,
    fontWeight: FONT.w8,
    color: COLORS.brand,
    textTransform: 'uppercase',
  },
  talkTitle: {
    fontSize: FONT.sm,
    fontWeight: FONT.w7,
    color: COLORS.text,
    lineHeight: 19,
    marginBottom: SPACE.xs,
  },
  talkMetaRow: {
    flexDirection: 'row',
    gap: SPACE.md,
  },
  talkMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  talkMetaTxt: {
    fontSize: FONT.xs,
    fontWeight: FONT.w6,
    color: COLORS.textSec,
  },

  /* ── Modal ── */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: PAD,
  },
  modalCard: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xxl,
    padding: SPACE.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.xl,
  },
  modalImg: {
    width: '100%',
    height: 360,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.brandDeep,
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: SPACE.md,
    paddingHorizontal: SPACE.xs,
  },
  modalName: {
    fontSize: FONT.md,
    fontWeight: FONT.w8,
    color: COLORS.text,
  },
  modalSub: {
    fontSize: FONT.xs,
    color: COLORS.textSec,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.bgAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ── Error ── */
  errorState: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: PAD,
  },
  errorText: {
    color: COLORS.textSec,
    fontSize: FONT.md,
    marginTop: SPACE.lg,
    marginBottom: SPACE.xl,
  },
  errorBtn: {
    backgroundColor: COLORS.brand,
    paddingHorizontal: SPACE.xl,
    paddingVertical: SPACE.md,
    borderRadius: RADIUS.full,
  },
  errorBtnText: {
    color: COLORS.textInverse,
    fontWeight: FONT.w7,
    fontSize: FONT.sm,
  },
});