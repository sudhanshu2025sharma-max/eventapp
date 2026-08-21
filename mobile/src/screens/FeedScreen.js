import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, Platform, TouchableOpacity,
  RefreshControl, ActivityIndicator, Image, Modal, TextInput,
  Alert, ScrollView, Animated, Dimensions, KeyboardAvoidingView,
  Easing, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONT, SPACE, RADIUS, SHADOW, W, H } from '../theme';
import { apiFetch } from '../api';
import { useKeyboardHeight } from '../useKeyboard';

/* ── constants ── */
const REACTIONS = [
  { key: 'like',      emoji: '👍', label: 'Like' },
  { key: 'celebrate', emoji: '🎉', label: 'Celebrate' },
  { key: 'love',      emoji: '❤️', label: 'Love' },
  { key: 'haha',      emoji: '😂', label: 'Haha' },
  { key: 'wow',       emoji: '😮', label: 'Wow' },
  { key: 'sad',       emoji: '😢', label: 'Sad' },
];

const TYPE_META = {
  alert:        { colors: [COLORS.error, '#dc2626'],    icon: 'warning',        tag: 'ALERT' },
  announcement: { colors: [COLORS.brand, COLORS.brandDark], icon: 'megaphone',  tag: 'ANNOUNCEMENT' },
  update:       { colors: [COLORS.warning, COLORS.accentDark], icon: 'refresh-circle', tag: 'UPDATE' },
  general:      { colors: [COLORS.purple, '#6d28d9'],   icon: 'newspaper',      tag: 'POST' },
};

function relativeTime(iso) {
  if (!iso) return '';
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60)    return 'just now';
  if (s < 3600)  return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ─────────── Skeleton shimmer ─────────── */
function Shimmer({ w, h, radius = RADIUS.sm, style }) {
  const anim = useRef(new Animated.Value(-1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(anim, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
    ).start();
  }, []);
  const tx = anim.interpolate({ inputRange: [-1, 1], outputRange: [-w * 1.5, w * 1.5] });
  return (
    <View style={[{ width: w, height: h, borderRadius: radius, backgroundColor: COLORS.bgCard, overflow: 'hidden' }, style]}>
      <Animated.View style={{ ...StyleSheet.absoluteFillObject, transform: [{ translateX: tx }] }}>
        <LinearGradient colors={['transparent', COLORS.borderLight, 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: w, height: '100%' }} />
      </Animated.View>
    </View>
  );
}

function SkeletonCard() {
  return (
    <View style={[s.card, { padding: SPACE.lg }]}>
      <Shimmer w={W * 0.35} h={10} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginTop: SPACE.lg }}>
        <Shimmer w={42} h={42} radius={RADIUS.md} />
        <View style={{ flex: 1, gap: SPACE.xs }}>
          <Shimmer w={W * 0.3} h={10} />
          <Shimmer w={W * 0.2} h={8} />
        </View>
      </View>
      <Shimmer w={W * 0.7} h={14} style={{ marginTop: SPACE.lg }} />
      <Shimmer w={W * 0.85} h={10} style={{ marginTop: SPACE.sm }} />
      <Shimmer w={W * 0.5} h={10} style={{ marginTop: SPACE.xs }} />
      <View style={{ flexDirection: 'row', gap: SPACE.sm, marginTop: SPACE.lg }}>
        {[1, 2, 3].map(i => <Shimmer key={i} w={52} h={34} radius={RADIUS.full} />)}
      </View>
    </View>
  );
}

/* ─────────── Reaction Pill ─────────── */
function ReactionPill({ r, count, active, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;

  const tap = () => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.35, tension: 400, friction: 6, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, tension: 250, friction: 8, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  return (
    <TouchableOpacity onPress={tap} activeOpacity={0.75}>
      <Animated.View style={[
        s.pill,
        active && s.pillActive,
        { transform: [{ scale }] },
      ]}>
        <Text style={s.pillEmoji}>{r.emoji}</Text>
        {count > 0 && <Text style={[s.pillCount, active && s.pillCountActive]}>{count}</Text>}
      </Animated.View>
    </TouchableOpacity>
  );
}

/* ─────────── Session chip ─────────── */
function SessionChip({ session }) {
  if (!session) return null;
  return (
    <TouchableOpacity activeOpacity={0.7} style={s.sessionWrap}>
      <View style={s.sessionInner}>
        <View style={s.sessionIcon}>
          <Ionicons name="calendar-outline" size={14} color={COLORS.brand} />
        </View>
        <Text style={s.sessionText} numberOfLines={1}>Day {session.day} · {session.title}</Text>
        <Ionicons name="chevron-forward" size={14} color={COLORS.textTer} />
      </View>
    </TouchableOpacity>
  );
}

/* ─────────── Post Card ─────────── */
const PostCard = React.memo(({ item, index, onReact, onOpenComments }) => {
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;
  const [expandedReactions, setExpandedReactions] = useState(false);

  useEffect(() => {
    const delay = Math.min(index * 100, 500);
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 450, delay, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 450, delay, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, []);

  const meta = TYPE_META[item.post_type] || TYPE_META.general;

  const totalReactions = useMemo(
    () => Object.values(item.reaction_summary || {}).reduce((a, b) => a + b, 0),
    [item.reaction_summary],
  );

  const topEmojis = useMemo(() => {
    return Object.entries(item.reaction_summary || {})
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k]) => REACTIONS.find(r => r.key === k)?.emoji)
      .filter(Boolean);
  }, [item.reaction_summary]);

  const visibleReactions = expandedReactions ? REACTIONS : REACTIONS.slice(0, 4);

  return (
    <Animated.View style={{ opacity: fadeIn, transform: [{ translateY: slideUp }], marginBottom: SPACE.lg }}>
      <View style={s.card}>
        {/* ── type ribbon ── */}
        <LinearGradient colors={meta.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.ribbon}>
          <View style={s.ribbonLeft}>
            <View style={s.ribbonIcon}>
              <Ionicons name={meta.icon} size={12} color={COLORS.textInverse} />
            </View>
            <Text style={s.ribbonLabel}>{meta.tag}</Text>
          </View>
          <Text style={s.ribbonTime}>{relativeTime(item.published_at)}</Text>
        </LinearGradient>

        {/* ── pinned ── */}
        {item.pinned && (
          <View style={s.pinRow}>
            <Ionicons name="pin" size={11} color={COLORS.accentDark} />
            <Text style={s.pinText}>Pinned</Text>
          </View>
        )}

        {/* ── author ── */}
        <View style={s.author}>
          <LinearGradient colors={meta.colors} style={s.avatar}>
            <Text style={s.avatarLetter}>{(item.author_name || 'E')[0].toUpperCase()}</Text>
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={s.authorName}>{item.author_name || 'ETD 2026'}</Text>
            <Text style={s.authorRole}>{item.author_role || 'Organizer'}</Text>
          </View>
        </View>

        {/* ── content ── */}
        <Text style={s.title}>{item.title}</Text>
        <Text style={s.body}>{item.body}</Text>

        <SessionChip session={item.session} />

        {/* ── image ── */}
        {!!item.image_url && (
          <View style={s.imgWrap}>
            <Image source={{ uri: item.image_url }} style={s.img} resizeMode="cover" />
          </View>
        )}

        {/* ── reaction summary ── */}
        {totalReactions > 0 && (
          <View style={s.summaryRow}>
            <View style={s.summaryBubbles}>
              {topEmojis.map((e, i) => (
                <View key={i} style={[s.summaryBubble, i > 0 && { marginLeft: -6 }]}>
                  <Text style={{ fontSize: FONT.xs + 2 }}>{e}</Text>
                </View>
              ))}
            </View>
            <Text style={s.summaryText}>{totalReactions}</Text>
          </View>
        )}

        <View style={s.sep} />

        {/* ── reactions ── */}
        <View style={s.reactRow}>
          {visibleReactions.map(r => (
            <ReactionPill
              key={r.key}
              r={r}
              count={item.reaction_summary?.[r.key] || 0}
              active={item.my_reaction === r.key}
              onPress={() => onReact(item.id, r.key)}
            />
          ))}
          {!expandedReactions && (
            <TouchableOpacity onPress={() => setExpandedReactions(true)} style={s.moreBtn}>
              <Ionicons name="ellipsis-horizontal" size={14} color={COLORS.textTer} />
            </TouchableOpacity>
          )}
        </View>

        {/* ── comment button ── */}
        <View style={s.bottomBar}>
          <TouchableOpacity style={s.commentBtn} onPress={() => onOpenComments(item)} activeOpacity={0.7}>
            <Ionicons name="chatbubble-outline" size={15} color={COLORS.brand} />
            <Text style={s.commentBtnText}>
              {item.comment_count || 0} {(item.comment_count || 0) === 1 ? 'Comment' : 'Comments'}
            </Text>
          </TouchableOpacity>
          {!item.allow_comments && (
            <View style={s.lockRow}>
              <Ionicons name="lock-closed" size={10} color={COLORS.textTer} />
              <Text style={s.lockLabel}>Closed</Text>
            </View>
          )}
        </View>
      </View>
    </Animated.View>
  );
});

/* ─────────── Comment ─────────── */
function CommentItem({ item, onReply, idx }) {
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideX = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    const d = Math.min((idx || 0) * 60, 360);
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 350, delay: d, useNativeDriver: true }),
      Animated.timing(slideX, { toValue: 0, duration: 350, delay: d, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[s.cCard, { opacity: fadeIn, transform: [{ translateX: slideX }] }]}>
      <View style={s.cRow}>
        <View style={s.cAvatar}>
          <Text style={s.cAvatarLetter}>{(item.user_name || 'U')[0].toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.cMeta}>
            <Text style={s.cName}>{item.user_name}</Text>
            <Text style={s.cTime}>{relativeTime(item.created_at)}</Text>
          </View>
          <Text style={s.cBody}>{item.body}</Text>
          <TouchableOpacity onPress={() => onReply(item)} style={s.cReplyBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-undo-outline" size={12} color={COLORS.brand} />
            <Text style={s.cReplyText}>Reply</Text>
          </TouchableOpacity>
        </View>
      </View>

      {item.replies?.map(r => (
        <View key={r.id} style={s.cReplyCard}>
          <View style={s.cReplyLine} />
          <View style={{ flex: 1 }}>
            <View style={s.cMeta}>
              <Text style={s.cName}>{r.user_name}</Text>
              <Text style={s.cTime}>{relativeTime(r.created_at)}</Text>
            </View>
            <Text style={s.cBody}>{r.body}</Text>
          </View>
        </View>
      ))}
    </Animated.View>
  );
}

/* ═══════════════ MAIN SCREEN ═══════════════ */
export default function FeedScreen({ onBack }) {
  const [posts, setPosts]                   = useState([]);
  const [loading, setLoading]               = useState(true);
  const [refreshing, setRefreshing]         = useState(false);
  const [modalOpen, setModalOpen]           = useState(false);
  const [activePost, setActivePost]         = useState(null);
  const keyboardHeight = useKeyboardHeight();
  const [comments, setComments]             = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [text, setText]                     = useState('');
  const [replyTo, setReplyTo]               = useState(null);
  const [sending, setSending]               = useState(false);

  const sheetY   = useRef(new Animated.Value(H)).current;
  const overlay  = useRef(new Animated.Value(0)).current;
  const scrollY  = useRef(new Animated.Value(0)).current;

  /* ── feed load ── */
  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res  = await apiFetch('/posts/feed/');
      const data = await res.json();
      setPosts(Array.isArray(data.results) ? data.results : []);
    } catch {
      if (!silent) Alert.alert('Error', 'Could not load feed.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const refresh = () => { setRefreshing(true); load(true); };

  /* ── react ── */
  const react = async (postId, type) => {
    const cur = posts.find(p => p.id === postId);
    const removing = cur?.my_reaction === type;

    // optimistic
    setPosts(ps => ps.map(p => {
      if (p.id !== postId) return p;
      const sum = { ...(p.reaction_summary || {}) };
      if (p.my_reaction && sum[p.my_reaction]) sum[p.my_reaction] = Math.max(0, sum[p.my_reaction] - 1);
      if (!removing) sum[type] = (sum[type] || 0) + 1;
      return { ...p, reaction_summary: sum, my_reaction: removing ? null : type };
    }));

    try {
      const res = await apiFetch(`/posts/feed/${postId}/react/`, {
        method: 'POST',
        body: JSON.stringify({ reaction_type: removing ? '' : type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error();
      setPosts(ps => ps.map(p =>
        p.id === postId
          ? { ...p, reaction_summary: data.summary || p.reaction_summary, my_reaction: data.my_reaction ?? null }
          : p,
      ));
    } catch { load(true); }
  };

  /* ── comments ── */
  const openComments = async (post) => {
    setActivePost(post);
    setReplyTo(null);
    setText('');
    setModalOpen(true);
    setCommentsLoading(true);
    Animated.parallel([
      Animated.spring(sheetY, { toValue: 0, tension: 65, friction: 12, useNativeDriver: true }),
      Animated.timing(overlay, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
    try {
      const res  = await apiFetch(`/posts/feed/${post.id}/comments/`);
      const data = await res.json();
      setComments(Array.isArray(data.results) ? data.results : []);
    } catch { setComments([]); }
    finally { setCommentsLoading(false); }
  };

  const closeComments = () => {
    Animated.parallel([
      Animated.timing(sheetY, { toValue: H, duration: 260, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.timing(overlay, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]).start(() => { setModalOpen(false); setActivePost(null); });
  };

  const submitComment = async () => {
    const body = text.trim();
    if (!body || sending || !activePost?.allow_comments) return;
    setSending(true);
    try {
      const res = await apiFetch(`/posts/feed/${activePost.id}/comments/`, {
        method: 'POST',
        body: JSON.stringify({ body, parent_id: replyTo?.id || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || 'Failed');
      if (replyTo?.id) {
        setComments(cs => cs.map(c =>
          c.id === replyTo.id ? { ...c, replies: [...(c.replies || []), data.comment] } : c,
        ));
      } else {
        setComments(cs => [...cs, { ...data.comment, replies: data.comment.replies || [] }]);
      }
      setPosts(ps => ps.map(p =>
        p.id === activePost.id ? { ...p, comment_count: (p.comment_count || 0) + 1 } : p,
      ));
      setText('');
      setReplyTo(null);
    } catch (e) { Alert.alert('Error', e?.message || 'Could not post comment.'); }
    finally { setSending(false); }
  };

  /* ── header opacity driven by scroll ── */
  const headerBorder = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  /* ──── render ──── */
  if (loading) {
    return (
      <View style={s.screen}>
        <View style={s.header}>
          <TouchableOpacity onPress={onBack} style={s.headerIcon}><Ionicons name="arrow-back" size={20} color={COLORS.text} /></TouchableOpacity>
          <View style={{ flex: 1 }}><Text style={s.headerTitle}>Feed</Text></View>
        </View>
        <View style={{ padding: SPACE.lg, gap: SPACE.lg }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      </View>
    );
  }

  return (
    <View style={s.screen}>
      {/* ── header ── */}
      <Animated.View style={[s.header, { borderBottomColor: headerBorder.interpolate({ inputRange: [0, 1], outputRange: ['transparent', COLORS.border] }) }]}>
        <TouchableOpacity onPress={onBack} style={s.headerIcon} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Feed</Text>
          <Text style={s.headerSub}>Updates & announcements</Text>
        </View>
        <TouchableOpacity onPress={refresh} style={s.headerIcon} activeOpacity={0.7}>
          <Ionicons name="refresh" size={18} color={COLORS.brand} />
        </TouchableOpacity>
      </Animated.View>

      {/* ── list ── */}
      <Animated.FlatList
        data={posts}
        keyExtractor={i => String(i.id)}
        contentContainerStyle={{ padding: SPACE.lg, paddingBottom: 95 }}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={COLORS.brand} />}
        renderItem={({ item, index }) => (
          <PostCard item={item} index={index} onReact={react} onOpenComments={openComments} />
        )}
        ListEmptyComponent={
          <View style={s.empty}>
            <View style={s.emptyCircle}>
              <Ionicons name="newspaper-outline" size={40} color={COLORS.brand} />
            </View>
            <Text style={s.emptyTitle}>No posts yet</Text>
            <Text style={s.emptySub}>Conference updates will appear here</Text>
            <TouchableOpacity onPress={refresh} style={s.emptyBtn} activeOpacity={0.7}>
              <Text style={s.emptyBtnText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* ── comments modal ── */}
      <Modal visible={modalOpen} animationType="none" transparent onRequestClose={closeComments}>
        <View style={s.modalWrap}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: COLORS.brandDeeper, opacity: overlay.interpolate({ inputRange: [0, 1], outputRange: [0, 0.45] }) }]}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closeComments} />
          </Animated.View>

          <Animated.View style={[s.sheet, { transform: [{ translateY: sheetY }] }]}>
            {/* handle */}
            <View style={s.sheetHandleWrap}><View style={s.sheetHandle} /></View>

            {/* sheet header */}
            <View style={s.sheetHeader}>
              <View style={s.sheetTitleRow}>
                <Ionicons name="chatbubbles-outline" size={18} color={COLORS.brand} />
                <Text style={s.sheetTitle}>Comments</Text>
                {comments.length > 0 && (
                  <View style={s.badge}><Text style={s.badgeText}>{comments.length}</Text></View>
                )}
              </View>
              <TouchableOpacity onPress={closeComments} style={s.sheetClose} activeOpacity={0.7}>
                <Ionicons name="close" size={18} color={COLORS.textSec} />
              </TouchableOpacity>
            </View>

            {activePost && !activePost.allow_comments && (
              <View style={s.closedBanner}>
                <Ionicons name="lock-closed-outline" size={13} color={COLORS.accentDark} />
                <Text style={s.closedBannerText}>Comments are disabled</Text>
              </View>
            )}

            {commentsLoading ? (
              <View style={s.sheetLoading}>
                <ActivityIndicator size="small" color={COLORS.brand} />
                <Text style={s.sheetLoadingText}>Loading…</Text>
              </View>
            ) : (
              <ScrollView contentContainerStyle={{ padding: SPACE.lg, paddingBottom: keyboardHeight > 0 ? keyboardHeight + 80 : 160 }} showsVerticalScrollIndicator={false}>
                {comments.length ? comments.map((c, i) => (
                  <CommentItem key={c.id} item={c} onReply={setReplyTo} idx={i} />
                )) : (
                  <View style={s.emptyComments}>
                    <View style={s.emptyCommentsCircle}>
                      <Ionicons name="chatbubble-ellipses-outline" size={28} color={COLORS.brand} />
                    </View>
                    <Text style={s.emptyCommentsTitle}>No comments yet</Text>
                    <Text style={s.emptyCommentsSub}>Be the first to share your thoughts</Text>
                  </View>
                )}
              </ScrollView>
            )}

            {activePost?.allow_comments && (
              <View style={[s.inputBar, { marginBottom: keyboardHeight }]}>
                  {replyTo && (
                    <View style={s.replyBar}>
                      <View style={s.replyBarLeft}>
                        <Ionicons name="arrow-undo-outline" size={12} color={COLORS.brand} />
                        <Text style={s.replyBarText} numberOfLines={1}>
                          Replying to <Text style={{ fontWeight: FONT.w7 }}>{replyTo.user_name}</Text>
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => setReplyTo(null)}>
                        <Ionicons name="close-circle" size={16} color={COLORS.textTer} />
                      </TouchableOpacity>
                    </View>
                  )}
                  <View style={s.inputRow}>
                    <TextInput
                      value={text}
                      onChangeText={setText}
                      placeholder={replyTo ? 'Write a reply…' : 'Add a comment…'}
                      placeholderTextColor={COLORS.textTer}
                      style={s.input}
                      multiline
                    />
                    <TouchableOpacity
                      onPress={submitComment}
                      disabled={sending || !text.trim()}
                      style={[s.sendBtn, (!text.trim() || sending) && { opacity: 0.35 }]}
                      activeOpacity={0.7}
                    >
                      {sending
                        ? <ActivityIndicator size="small" color={COLORS.textInverse} />
                        : <Ionicons name="send" size={15} color={COLORS.textInverse} />
                      }
                    </TouchableOpacity>
                  </View>
              </View>
            )}
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

/* ═══════════════ STYLES ═══════════════ */
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },

  /* header */
  header: {
    paddingTop: Platform.OS === 'ios' ? 58 : 42,
    paddingBottom: SPACE.md,
    paddingHorizontal: SPACE.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    backgroundColor: COLORS.bg,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
    zIndex: 10,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.sm,
  },
  headerTitle: { fontSize: FONT.xl, fontWeight: FONT.w9, color: COLORS.text, letterSpacing: -0.3 },
  headerSub:   { fontSize: FONT.xs, color: COLORS.textTer, marginTop: 2 },

  /* card */
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xxl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    ...SHADOW.md,
  },

  /* ribbon */
  ribbon:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm + 2 },
  ribbonLeft:  { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  ribbonIcon:  { width: 24, height: 24, borderRadius: RADIUS.full, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  ribbonLabel: { fontSize: FONT.micro + 1, fontWeight: FONT.w8, color: COLORS.textInverse, letterSpacing: 1 },
  ribbonTime:  { fontSize: FONT.micro + 1, fontWeight: FONT.w6, color: 'rgba(255,255,255,0.75)' },

  /* pin */
  pinRow:  { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, paddingHorizontal: SPACE.lg, paddingTop: SPACE.sm },
  pinText: { fontSize: FONT.xs, fontWeight: FONT.w7, color: COLORS.accentDark },

  /* author */
  author:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACE.lg, paddingTop: SPACE.md, gap: SPACE.md },
  avatar:      { width: 42, height: 42, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  avatarLetter:{ color: COLORS.textInverse, fontSize: FONT.md, fontWeight: FONT.w8 },
  authorName:  { fontSize: FONT.sm, fontWeight: FONT.w7, color: COLORS.text },
  authorRole:  { fontSize: FONT.xs, color: COLORS.textTer, marginTop: 1 },

  /* content */
  title: { fontSize: FONT.lg, fontWeight: FONT.w9, color: COLORS.text, paddingHorizontal: SPACE.lg, marginTop: SPACE.md, lineHeight: 24, letterSpacing: -0.2 },
  body:  { fontSize: FONT.sm, color: COLORS.textSec, paddingHorizontal: SPACE.lg, marginTop: SPACE.sm, lineHeight: 22 },

  /* session */
  sessionWrap:  { paddingHorizontal: SPACE.lg, marginTop: SPACE.md },
  sessionInner: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm + 2, borderRadius: RADIUS.lg, backgroundColor: COLORS.brandLight, borderWidth: 1, borderColor: COLORS.brandMid },
  sessionIcon:  { width: 26, height: 26, borderRadius: RADIUS.sm, backgroundColor: COLORS.brandMid, alignItems: 'center', justifyContent: 'center' },
  sessionText:  { flex: 1, fontSize: FONT.xs, color: COLORS.brand, fontWeight: FONT.w6 },

  /* image */
  imgWrap: { marginTop: SPACE.md, marginHorizontal: SPACE.lg, borderRadius: RADIUS.xl, overflow: 'hidden', backgroundColor: COLORS.bgCard },
  img:     { width: '100%', height: 200 },

  /* reaction summary */
  summaryRow:     { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, paddingHorizontal: SPACE.lg, marginTop: SPACE.md },
  summaryBubbles: { flexDirection: 'row' },
  summaryBubble:  { width: 22, height: 22, borderRadius: RADIUS.full, backgroundColor: COLORS.bgAlt, borderWidth: 2, borderColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  summaryText:    { fontSize: FONT.xs, color: COLORS.textTer, fontWeight: FONT.w6 },

  sep: { height: 1, backgroundColor: COLORS.borderLight, marginHorizontal: SPACE.lg, marginTop: SPACE.md },

  /* reactions */
  reactRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, paddingHorizontal: SPACE.lg, paddingTop: SPACE.md },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.xs + 1,
    borderWidth: 1.5, borderColor: COLORS.border,
    paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
  },
  pillActive:      { borderColor: COLORS.brand, backgroundColor: COLORS.brandLight },
  pillEmoji:       { fontSize: FONT.md },
  pillCount:       { fontSize: FONT.xs, fontWeight: FONT.w7, color: COLORS.textTer },
  pillCountActive: { color: COLORS.brand },
  moreBtn: {
    width: 36, height: 36, borderRadius: RADIUS.full,
    borderWidth: 1.5, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },

  /* bottom bar */
  bottomBar:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md },
  commentBtn:  { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, paddingVertical: SPACE.sm, paddingHorizontal: SPACE.md, backgroundColor: COLORS.brandLight, borderRadius: RADIUS.full },
  commentBtnText: { fontSize: FONT.sm, fontWeight: FONT.w7, color: COLORS.brand },
  lockRow:     { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  lockLabel:   { fontSize: FONT.xs, color: COLORS.textTer },

  /* empty feed */
  empty:       { alignItems: 'center', paddingVertical: SPACE.huge * 2 },
  emptyCircle: { width: 88, height: 88, borderRadius: RADIUS.full, backgroundColor: COLORS.brandLight, alignItems: 'center', justifyContent: 'center', marginBottom: SPACE.lg },
  emptyTitle:  { fontSize: FONT.xl, fontWeight: FONT.w8, color: COLORS.text },
  emptySub:    { marginTop: SPACE.xs, fontSize: FONT.sm, color: COLORS.textTer, textAlign: 'center' },
  emptyBtn:    { marginTop: SPACE.xl, paddingHorizontal: SPACE.xxl, paddingVertical: SPACE.md, backgroundColor: COLORS.brand, borderRadius: RADIUS.full },
  emptyBtnText:{ color: COLORS.textInverse, fontSize: FONT.sm, fontWeight: FONT.w7 },

  /* ── modal ── */
  modalWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    maxHeight: H * 0.88,
    minHeight: H * 0.5,
    ...SHADOW.xl,
  },
  sheetHandleWrap: { alignItems: 'center', paddingTop: SPACE.sm },
  sheetHandle:     { width: 36, height: 4, borderRadius: RADIUS.xs, backgroundColor: COLORS.textMuted },
  sheetHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACE.xl, paddingVertical: SPACE.md },
  sheetTitleRow:   { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  sheetTitle:      { fontSize: FONT.lg, fontWeight: FONT.w8, color: COLORS.text },
  badge:           { backgroundColor: COLORS.brand, paddingHorizontal: SPACE.sm, paddingVertical: SPACE.xxs, borderRadius: RADIUS.full },
  badgeText:       { color: COLORS.textInverse, fontSize: FONT.micro + 1, fontWeight: FONT.w8 },
  sheetClose:      { width: 34, height: 34, borderRadius: RADIUS.full, backgroundColor: COLORS.bgAlt, alignItems: 'center', justifyContent: 'center' },
  sheetLoading:    { padding: SPACE.huge, alignItems: 'center', gap: SPACE.sm },
  sheetLoadingText:{ fontSize: FONT.sm, color: COLORS.textTer },

  closedBanner:     { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginHorizontal: SPACE.xl, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm + 2, backgroundColor: COLORS.accentLight, borderRadius: RADIUS.md },
  closedBannerText: { fontSize: FONT.sm, color: COLORS.accentDark, fontWeight: FONT.w6 },

  /* comments */
  cCard:        { marginBottom: SPACE.lg },
  cRow:         { flexDirection: 'row', gap: SPACE.sm },
  cAvatar:      { width: 32, height: 32, borderRadius: RADIUS.sm + 2, backgroundColor: COLORS.brandLight, alignItems: 'center', justifyContent: 'center' },
  cAvatarLetter:{ fontSize: FONT.sm, fontWeight: FONT.w8, color: COLORS.brand },
  cMeta:        { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.xxs },
  cName:        { fontSize: FONT.sm, fontWeight: FONT.w7, color: COLORS.text },
  cTime:        { fontSize: FONT.xs, color: COLORS.textTer },
  cBody:        { fontSize: FONT.sm + 1, color: COLORS.textSec, lineHeight: 20 },
  cReplyBtn:    { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, marginTop: SPACE.xs, alignSelf: 'flex-start', paddingVertical: SPACE.xxs, paddingHorizontal: SPACE.sm, borderRadius: RADIUS.sm, backgroundColor: COLORS.brandLight },
  cReplyText:   { fontSize: FONT.xs, color: COLORS.brand, fontWeight: FONT.w7 },

  cReplyCard: {
    marginTop: SPACE.sm,
    marginLeft: SPACE.xxxl + SPACE.sm,
    flexDirection: 'row',
    gap: SPACE.sm,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
    backgroundColor: COLORS.bgAlt,
    borderRadius: RADIUS.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.brandLight,
  },
  cReplyLine: {},

  emptyComments:       { alignItems: 'center', paddingVertical: SPACE.huge },
  emptyCommentsCircle: { width: 64, height: 64, borderRadius: RADIUS.full, backgroundColor: COLORS.brandLight, alignItems: 'center', justifyContent: 'center', marginBottom: SPACE.md },
  emptyCommentsTitle:  { fontSize: FONT.md, fontWeight: FONT.w7, color: COLORS.text },
  emptyCommentsSub:    { marginTop: SPACE.xxs, fontSize: FONT.sm, color: COLORS.textTer },

  /* input bar */
  inputBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: SPACE.md,
    paddingTop: SPACE.md,
    paddingBottom: Platform.OS === 'ios' ? SPACE.xxxl : SPACE.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    backgroundColor: COLORS.surface,
    ...SHADOW.md,
  },
  replyBar:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACE.sm, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, backgroundColor: COLORS.brandLight, borderRadius: RADIUS.md, borderLeftWidth: 3, borderLeftColor: COLORS.brand },
  replyBarLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, flex: 1, marginRight: SPACE.sm },
  replyBarText: { fontSize: FONT.xs, color: COLORS.textSec },
  inputRow:     { flexDirection: 'row', alignItems: 'flex-end', gap: SPACE.sm },
  input: {
    flex: 1, minHeight: 44, maxHeight: 100,
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.xl,
    paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm + 2,
    fontSize: FONT.sm, color: COLORS.text, backgroundColor: COLORS.bg,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: RADIUS.full,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.brand,
    ...SHADOW.brand,
  },
});