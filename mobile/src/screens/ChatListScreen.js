import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, Platform, TouchableOpacity, Pressable,
  FlatList, RefreshControl, Image, Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, SPACE, RADIUS, TOP, API_URL, API_HEADERS, fixMediaUrl } from '../theme';
import { GradientAvatar, FadeIn } from '../components';

const POLL_MS = 30000;

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

// --- ANIMATED SKELETON LOADER ---
// Shimmers gracefully to keep users engaged while fetching data
function SkeletonCard() {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View style={[s.convCard, { opacity }]}>
      <View style={s.convRow}>
        <View style={s.skelAvatar} />
        <View style={{ flex: 1, marginLeft: SPACE.md, justifyContent: 'center' }}>
          <View style={s.skelHeaderRow}>
            <View style={s.skelTitleLine} />
            <View style={s.skelTimeLine} />
          </View>
          <View style={s.skelChipLine} />
          <View style={s.skelSubLine} />
        </View>
      </View>
    </Animated.View>
  );
}

// --- INTERACTIVE CHAT CARD ---
function AnimatedChatCard({ conv, hasUnread, other, lastMsg, onOpenChat, delay }) {
  const pressAnim = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    Animated.spring(pressAnim, { toValue: 1, tension: 400, friction: 15, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    Animated.spring(pressAnim, { toValue: 0, tension: 400, friction: 15, useNativeDriver: true }).start();
  };

  const scale = pressAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.96] });

  return (
    <FadeIn delay={delay}>
      <Pressable
        onPress={() => onOpenChat(conv.id)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <Animated.View style={[
          s.convCard, 
          hasUnread && s.convCardUnread,
          { transform: [{ scale }] }
        ]}>
          <View style={s.convRow}>
            
            {/* Avatar with Status Ring */}
            <View style={s.avatarContainer}>
              {other?.profile_photo_url ? (
                <Image source={{ uri: other.profile_photo_url }} style={s.convPhoto} />
              ) : (
                <GradientAvatar name={other?.name || '?'} size={56} radius={20} />
              )}
              {hasUnread && <View style={s.unreadDot} />}
            </View>

            <View style={s.convContent}>
              <View style={s.convTopRow}>
                <Text style={[s.convName, hasUnread && s.convNameBold]} numberOfLines={1}>
                  {other?.name || 'Unknown'}
                </Text>
                <Text style={[s.convTime, hasUnread && { color: COLORS.brand }]}>
                  {timeAgo(conv.last_message_at || conv.created_at)}
                </Text>
              </View>

              {conv.topic_display && (
                <View style={[s.topicChip, hasUnread && s.topicChipUnread]}>
                  <Text style={[s.topicChipText, hasUnread && { color: '#fff' }]}>{conv.topic_display}</Text>
                </View>
              )}

              <View style={s.convPreviewRow}>
                <Text style={[s.convPreview, hasUnread && s.convPreviewBold]} numberOfLines={2}>
                  {lastMsg
                    ? (lastMsg.message_type === 'image' ? '📷 Photo message' : lastMsg.content)
                    : 'Say hello and start the conversation 👋'}
                </Text>
                
                {hasUnread && (
                  <View style={s.unreadBadge}>
                    <Text style={s.unreadBadgeText}>{conv.unread_count}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </Animated.View>
      </Pressable>
    </FadeIn>
  );
}

// --- ENGAGEMENT BANNER ---
function PendingBanner({ count, onPress }) {
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 1500, useNativeDriver: true })
      ])
    ).start();
  }, []);

  const scale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] });
  const opacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] });

  if (count <= 0) return null;

  return (
    <Animated.View style={{ transform: [{ scale }], opacity, paddingHorizontal: SPACE.xl, marginBottom: SPACE.sm }}>
      <TouchableOpacity style={s.pendingBanner} onPress={onPress} activeOpacity={0.8}>
        <View style={s.pendingIconWrap}>
          <Ionicons name="people" size={20} color="#fff" />
        </View>
        <View style={{ flex: 1, marginLeft: SPACE.sm }}>
          <Text style={s.pendingBannerTitle}>{count} New Request{count > 1 ? 's' : ''}</Text>
          <Text style={s.pendingBannerSub}>People want to connect with you!</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function ChatListScreen({ tokens, onBack, onOpenChat, onOpenRequests, pendingCount }) {
  const [conversations, setConversations] = useState([]);
  const [totalUnread,   setTotalUnread]   = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/chat/conversations/`, {
        headers: { ...API_HEADERS, Authorization: `Bearer ${tokens?.access}` },
      });
      const data = await res.json();
      setConversations((data.conversations || []).map(c => ({
        ...c,
        other_user: c.other_user ? {
          ...c.other_user,
          profile_photo_url: fixMediaUrl(c.other_user.profile_photo_url),
        } : c.other_user,
      })));
      setTotalUnread(data.total_unread || 0);
    } catch { /* silent */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [tokens]);

  useEffect(() => {
    load();
    const t = setInterval(() => load(false), POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const renderItem = ({ item: conv, index }) => {
    return (
      <AnimatedChatCard 
        conv={conv}
        other={conv.other_user}
        lastMsg={conv.last_message}
        hasUnread={conv.unread_count > 0}
        onOpenChat={onOpenChat}
        delay={index * 30} 
      />
    );
  };

  return (
    <View style={s.bg}>
      {/* Interactive Header */}
      <View style={s.header}>
        <View style={s.headerTop}>
          <TouchableOpacity style={s.backBtn} onPress={onBack} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <View style={s.headerTextWrap}>
            <Text style={s.title}>Messages</Text>
            <Text style={s.sub}>{totalUnread > 0 ? `You have ${totalUnread} new messages` : 'Your network hub'}</Text>
          </View>
        </View>
      </View>

      {/* FOMO Engagement Banner */}
      <PendingBanner count={pendingCount} onPress={onOpenRequests} />

      {loading ? (
        <View style={s.skeletonContainer}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={c => c.id}
          renderItem={renderItem}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.brand} />
          }
          ListEmptyComponent={
            <View style={s.center}>
              <View style={s.emptyIconWrap}>
                <Ionicons name="paper-plane" size={42} color={COLORS.brand} />
              </View>
              <Text style={s.emptyTitle}>It's quiet here...</Text>
              <Text style={s.emptySub}>
                Don't be shy! Head over to the Network tab and send your first contact card to start a conversation.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#F8FAFC' },

  header: {
    paddingTop: TOP, 
    paddingBottom: SPACE.lg,
    paddingHorizontal: SPACE.xl,
    backgroundColor: '#F8FAFC',
  },
  headerTop: { flexDirection: 'row', alignItems: 'center' },
  backBtn: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: COLORS.surface,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.borderLight,
  },
  headerTextWrap: { flex: 1, marginLeft: SPACE.lg },
  title: { fontSize: FONT.xxl, fontWeight: FONT.w9, color: COLORS.text, letterSpacing: -0.5 },
  sub:   { fontSize: FONT.sm, color: COLORS.textSec, marginTop: 2, fontWeight: FONT.w5 },

  pendingBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.brand,
    borderRadius: RADIUS.xl,
    padding: SPACE.md,
  },
  pendingIconWrap: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center'
  },
  pendingBannerTitle: { color: '#fff', fontWeight: FONT.w8, fontSize: FONT.md },
  pendingBannerSub: { color: 'rgba(255,255,255,0.8)', fontSize: FONT.xs, marginTop: 2 },

  skeletonContainer: { padding: SPACE.xl },
  skelAvatar: { width: 56, height: 56, borderRadius: 20, backgroundColor: COLORS.borderLight },
  skelHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  skelTitleLine: { width: '55%'.replace('%', ''), width: 120, height: 14, borderRadius: 4, backgroundColor: COLORS.borderLight },
  skelTimeLine: { width: 35, height: 10, borderRadius: 4, backgroundColor: COLORS.borderLight },
  skelChipLine: { width: 80, height: 18, borderRadius: 6, backgroundColor: COLORS.borderLight, marginBottom: 8 },
  skelSubLine: { width: '85%'.replace('%', ''), height: 12, borderRadius: 4, backgroundColor: COLORS.borderLight },

  listContent: { padding: SPACE.xl, paddingBottom: 120 },

  // CLEAN FLAT CARD DESIGN (No ugly shadows on load/render)
  convCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl, 
    padding: SPACE.lg, 
    marginBottom: SPACE.md,
    borderWidth: 1, 
    borderColor: COLORS.borderLight,
    elevation: 0, // Zero Android shadow
    shadowOpacity: 0, // Zero iOS shadow
  },
  convCardUnread: {
    borderColor: COLORS.brand + '50',
    backgroundColor: COLORS.brand + '06',
  },
  convRow: { flexDirection: 'row', alignItems: 'flex-start' },
  
  avatarContainer: { position: 'relative' },
  convPhoto: { width: 56, height: 56, borderRadius: 20 },
  unreadDot: {
    position: 'absolute', top: -2, right: -2,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: COLORS.error,
    borderWidth: 3, borderColor: COLORS.surface,
  },

  convContent: { flex: 1, marginLeft: SPACE.md, paddingTop: 2 },
  convTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  convName:     { fontSize: FONT.md, fontWeight: FONT.w7, color: COLORS.text, flex: 1, paddingRight: SPACE.sm },
  convNameBold: { fontWeight: FONT.w9, color: COLORS.text },
  convTime:     { fontSize: FONT.xs, color: COLORS.textTer, fontWeight: FONT.w6 },

  topicChip: {
    alignSelf: 'flex-start', marginBottom: SPACE.sm,
    backgroundColor: COLORS.brandLight,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  topicChipUnread: { backgroundColor: COLORS.brand },
  topicChipText: { fontSize: 10, fontWeight: FONT.w8, color: COLORS.brand, textTransform: 'uppercase', letterSpacing: 0.5 },

  convPreviewRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  convPreview:      { fontSize: FONT.sm, color: COLORS.textSec, flex: 1, lineHeight: 20 },
  convPreviewBold:  { color: COLORS.text, fontWeight: FONT.w7 },
  
  unreadBadge: {
    minWidth: 24, height: 24, borderRadius: 12,
    backgroundColor: COLORS.brand,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 6, marginLeft: SPACE.md,
  },
  unreadBadgeText: { fontSize: 11, fontWeight: FONT.w8, color: '#fff' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACE.xxxl, marginTop: 40 },
  emptyIconWrap: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: COLORS.brandLight,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACE.lg,
  },
  emptyTitle: { fontSize: FONT.xl, fontWeight: FONT.w8, color: COLORS.text, marginBottom: SPACE.sm },
  emptySub:   { fontSize: FONT.sm, color: COLORS.textSec, textAlign: 'center', lineHeight: 22 },
});