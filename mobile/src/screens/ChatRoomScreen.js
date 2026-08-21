import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Platform, FlatList, TextInput,
  TouchableOpacity, Image, ActivityIndicator, KeyboardAvoidingView,
  Modal, Dimensions, Alert, ActionSheetIOS, Clipboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONT, SPACE, RADIUS, TOP, API_URL, API_HEADERS, fixMediaUrl } from '../theme';
import { GradientAvatar } from '../components';

const POLL_MS = 3000;
const { width: SW, height: SH } = Dimensions.get('window');

const REACTIONS = [
  { key: 'thumbs_up', emoji: '👍' },
  { key: 'heart',     emoji: '❤️' },
  { key: 'celebrate', emoji: '🎉' },
  { key: 'thinking',  emoji: '🤔' },
];

const REPORT_REASONS = ['spam', 'harassment', 'offensive', 'other'];

function Tick({ delivered, read }) {
  if (!delivered) return null;
  return (
    <Text style={{ fontSize: 10, color: read ? '#60a5fa' : COLORS.textTer, marginLeft: 2 }}>
      {read ? '✓✓' : '✓'}
    </Text>
  );
}

function formatDateHeader(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function groupMessagesByDate(messages) {
  const groups = [];
  let currentDate = null;
  for (const msg of messages) {
    const msgDate = new Date(msg.created_at).toDateString();
    if (msgDate !== currentDate) {
      currentDate = msgDate;
      groups.push({ type: 'date_header', id: `header_${msgDate}`, date: msg.created_at });
    }
    groups.push({ type: 'message', id: msg.id, ...msg });
  }
  return groups;
}

export default function ChatRoomScreen({ tokens, conversationId, onBack, onDisconnected }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [conversation, setConversation]   = useState(null);
  const [messages,     setMessages]       = useState([]);
  const [myUserId,     setMyUserId]       = useState(null);
  const [text,         setText]           = useState('');
  const [sending,      setSending]        = useState(false);
  const [loading,      setLoading]        = useState(true);
  const [viewImage,    setViewImage]      = useState(null);
  const [replyTo,      setReplyTo]        = useState(null);   // message object being replied to
  const [reactionTarget, setReactionTarget] = useState(null); // message for reaction picker
  const [reportTarget,   setReportTarget]  = useState(null);  // message for report modal
  const [reportReason,   setReportReason]  = useState('spam');
  const [isMuted,      setIsMuted]        = useState(false);

  const listRef  = useRef(null);
  const pollRef  = useRef(null);
  const prevCount = useRef(0);

  const fetchMessages = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/chat/conversations/${conversationId}/messages/`,
        { headers: { ...API_HEADERS, Authorization: `Bearer ${tokens?.access}` } }
      );
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages || []);
      const conv = data.conversation || null;
      if (conv?.other_user?.profile_photo_url) {
        conv.other_user.profile_photo_url = fixMediaUrl(conv.other_user.profile_photo_url);
      }
      setConversation(conv);
      if (data.my_user_id) setMyUserId(data.my_user_id);
      if (data.conversation) setIsMuted(data.conversation.is_muted);
    } catch { /* silent */ }
    finally { if (!silent) setLoading(false); }
  }, [conversationId, tokens]);

  const markRead = useCallback(async () => {
    try {
      await fetch(`${API_URL}/chat/conversations/${conversationId}/messages/read/`, {
        method: 'POST',
        headers: { ...API_HEADERS, Authorization: `Bearer ${tokens?.access}` },
      });
    } catch { /* silent */ }
  }, [conversationId, tokens]);

  useEffect(() => {
    fetchMessages();
    markRead();
    pollRef.current = setInterval(() => {
      fetchMessages(true);
      markRead();
    }, POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [fetchMessages, markRead]);

  useEffect(() => {
    if (messages.length > prevCount.current) {
      prevCount.current = messages.length;
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const isMe = (msg) => {
    if (myUserId) return msg.sender_id === myUserId;
    if (!conversation?.other_user) return false;
    return msg.sender_id !== conversation.other_user.id;
  };

  // ── Send ──────────────────────────────────────────────────────────────
  const sendText = async () => {
    if (!text.trim() || sending) return;
    const content = text.trim();
    const replyId = replyTo?.id;
    setText('');
    setReplyTo(null);
    setSending(true);

    const tempMsg = {
      id: 'temp_' + Date.now(), sender_id: myUserId, content,
      image_url: null, message_type: 'text', reply_to: null,
      reactions: [], delivered: false, read: false, read_at: null,
      is_deleted: false, created_at: new Date().toISOString(), _temp: true,
    };
    setMessages(prev => [...prev, tempMsg]);

    try {
      const body = { content };
      if (replyId) body.reply_to = replyId;
      const res = await fetch(
        `${API_URL}/chat/conversations/${conversationId}/messages/send/`,
        { method: 'POST', headers: { ...API_HEADERS, Authorization: `Bearer ${tokens?.access}` }, body: JSON.stringify(body) }
      );
      if (res.ok) await fetchMessages(true);
    } catch { /* silent */ }
    finally { setSending(false); }
  };

  const pickAndSend = async (fromCamera) => {
    let result;
    if (fromCamera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return;
      result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    }
    if (result.canceled) return;
    const asset = result.assets[0];
    setSending(true);
    try {
      const form = new FormData();
      form.append('image', { uri: asset.uri, name: asset.fileName || 'photo.jpg', type: asset.mimeType || 'image/jpeg' });
      await fetch(`${API_URL}/chat/conversations/${conversationId}/messages/send/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokens?.access}`, 'ngrok-skip-browser-warning': 'true' },
        body: form,
      });
      await fetchMessages(true);
    } catch { /* silent */ }
    finally { setSending(false); }
  };

  // ── Actions ────────────────────────────────────────────────────────────
  const handleReaction = async (msg, reactionKey) => {
    setReactionTarget(null);
    try {
      await fetch(
        `${API_URL}/chat/conversations/${conversationId}/messages/${msg.id}/react/`,
        { method: 'POST', headers: { ...API_HEADERS, Authorization: `Bearer ${tokens?.access}` }, body: JSON.stringify({ reaction: reactionKey }) }
      );
      await fetchMessages(true);
    } catch { /* silent */ }
  };

  const handleDeleteMessage = async (msg) => {
    Alert.alert('Delete Message', 'This message will be removed for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await fetch(
              `${API_URL}/chat/conversations/${conversationId}/messages/${msg.id}/delete/`,
              { method: 'POST', headers: { ...API_HEADERS, Authorization: `Bearer ${tokens?.access}` } }
            );
            await fetchMessages(true);
          } catch { /* silent */ }
        }
      }
    ]);
  };

  const handleReport = async () => {
    if (!reportTarget) return;
    try {
      await fetch(
        `${API_URL}/chat/conversations/${conversationId}/messages/${reportTarget.id}/report/`,
        { method: 'POST', headers: { ...API_HEADERS, Authorization: `Bearer ${tokens?.access}` }, body: JSON.stringify({ reason: reportReason }) }
      );
    } catch { /* silent */ }
    setReportTarget(null);
    Alert.alert('Reported', 'This message has been reported to the admin team.');
  };

  const handleToggleMute = async () => {
    try {
      const res = await fetch(
        `${API_URL}/chat/conversations/${conversationId}/mute/`,
        { method: 'POST', headers: { ...API_HEADERS, Authorization: `Bearer ${tokens?.access}` } }
      );
      const data = await res.json();
      setIsMuted(data.muted);
    } catch { /* silent */ }
  };

  const openMessageMenu = (msg) => {
    const mine = isMe(msg);
    if (msg.is_deleted) return;

    const options = ['React', 'Reply'];
    if (!mine) options.push('Report');
    if (!mine) options.push('Copy');
    if (mine) options.push('Delete');
    options.push('Cancel');

    const cancelIdx = options.indexOf('Cancel');
    const destructiveIdx = options.indexOf('Delete');

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: cancelIdx, destructiveButtonIndex: destructiveIdx >= 0 ? destructiveIdx : undefined },
        (idx) => {
          const action = options[idx];
          if (action === 'React') setReactionTarget(msg);
          else if (action === 'Reply') setReplyTo(msg);
          else if (action === 'Report') setReportTarget(msg);
          else if (action === 'Copy') Clipboard.setString(msg.content || '');
          else if (action === 'Delete') handleDeleteMessage(msg);
        }
      );
    } else {
      // Android — use Alert with buttons (ActionSheetIOS not available)
      Alert.alert('Message Options', '', [
        { text: 'React 😊', onPress: () => setReactionTarget(msg) },
        { text: 'Reply', onPress: () => setReplyTo(msg) },
        ...(!mine ? [{ text: 'Report', onPress: () => setReportTarget(msg) }] : []),
        ...(!mine ? [{ text: 'Copy', onPress: () => Clipboard.setString(msg.content || '') }] : []),
        ...(mine ? [{ text: 'Delete', style: 'destructive', onPress: () => handleDeleteMessage(msg) }] : []),
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────
  const grouped = groupMessagesByDate(messages);

  const renderItem = ({ item }) => {
    if (item.type === 'date_header') {
      return (
        <View style={s.dateHeader}>
          <View style={s.dateHeaderLine} />
          <Text style={s.dateHeaderText}>{formatDateHeader(item.date)}</Text>
          <View style={s.dateHeaderLine} />
        </View>
      );
    }

    const mine = isMe(item);
    const isTemp = item._temp;
    const deleted = item.is_deleted;

    return (
      <TouchableOpacity
        onLongPress={() => openMessageMenu(item)}
        activeOpacity={0.85}
        delayLongPress={350}
        style={[s.msgRow, mine ? s.msgRowMe : s.msgRowThem]}
      >
        {/* Other user avatar */}
        {!mine && conversation?.other_user && (
          conversation.other_user.profile_photo_url ? (
            <Image source={{ uri: conversation.other_user.profile_photo_url }} style={s.msgAvatar} />
          ) : (
            <GradientAvatar name={conversation.other_user.name} size={30} radius={9} style={{ marginRight: SPACE.sm, alignSelf: 'flex-end' }} />
          )
        )}

        <View style={{ maxWidth: '72%' }}>
          {/* Reply preview */}
          {item.reply_to && !deleted && (
            <View style={[s.replyPreview, mine ? s.replyPreviewMe : s.replyPreviewThem]}>
              <Text style={s.replyPreviewName}>{item.reply_to.sender_name}</Text>
              <Text style={s.replyPreviewText} numberOfLines={1}>
                {item.reply_to.message_type === 'image' ? '📷 Photo' : item.reply_to.content}
              </Text>
            </View>
          )}

          {/* Bubble */}
          {deleted ? (
            <View style={[s.bubble, mine ? s.bubbleMe : s.bubbleThem, s.bubbleDeleted]}>
              <Ionicons name="ban-outline" size={12} color={COLORS.textTer} />
              <Text style={s.deletedText}>Message deleted</Text>
            </View>
          ) : item.message_type === 'image' && item.image_url ? (
            <TouchableOpacity
              style={[s.bubble, mine ? s.bubbleMe : s.bubbleThem, { padding: 4 }]}
              onPress={() => setViewImage(item.image_url)}
              onLongPress={() => openMessageMenu(item)}
              activeOpacity={0.85}
            >
              <Image source={{ uri: item.image_url }} style={s.msgImage} />
            </TouchableOpacity>
          ) : (
            <View style={[s.bubble, mine ? s.bubbleMe : s.bubbleThem, isTemp && { opacity: 0.65 }]}>
              <Text style={[s.bubbleText, mine ? s.bubbleTextMe : s.bubbleTextThem]}>
                {item.content}
              </Text>
            </View>
          )}

          {/* Reactions row */}
          {item.reactions && item.reactions.length > 0 && (
            <TouchableOpacity
              style={[s.reactionsRow, mine ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }]}
              onPress={() => setReactionTarget(item)}
            >
              {item.reactions.map(r => (
                <View key={r.key} style={s.reactionPill}>
                  <Text style={s.reactionEmoji}>{r.emoji}</Text>
                  {r.count > 1 && <Text style={s.reactionCount}>{r.count}</Text>}
                </View>
              ))}
            </TouchableOpacity>
          )}

          {/* Meta row */}
          <View style={[s.metaRow, mine ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }]}>
            <Text style={s.metaTime}>
              {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {mine && !isTemp && <Tick delivered={item.delivered} read={item.read} />}
            {mine && isTemp && <Text style={{ fontSize: 10, color: COLORS.textTer, marginLeft: 2 }}>⏳</Text>}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const handleDisconnect = () => {
    if (!other?.id || disconnecting) return;
    setMenuOpen(false);
    Alert.alert(
      'Remove Connection?',
      `You will no longer be connected with ${other.name}. Your chat history will be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setDisconnecting(true);
            try {
              const r = await fetch(`${API_URL}/chat/disconnect/`, {
                method: 'POST',
                headers: { ...API_HEADERS, Authorization: `Bearer ${tokens?.access}` },
                body: JSON.stringify({ user_id: other.id }),
              });
              const d = await r.json();
              if (d.success) {
                onDisconnected?.();
              } else {
                Alert.alert('Error', d.error || 'Could not disconnect.');
                setDisconnecting(false);
              }
            } catch {
              Alert.alert('Error', 'Network error.');
              setDisconnecting(false);
            }
          },
        },
      ]
    );
  };

  const other = conversation?.other_user;

  return (
    <View style={s.bg}>

      {/* ── Header ── */}
      <LinearGradient colors={[COLORS.brandDeep, COLORS.brand]} style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        {other ? (
          other.profile_photo_url ? (
            <Image source={{ uri: other.profile_photo_url }} style={s.headerPhoto} />
          ) : (
            <GradientAvatar name={other.name} size={40} radius={13} style={{ borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' }} />
          )
        ) : null}
        <View style={s.headerInfo}>
          <Text style={s.headerName} numberOfLines={1}>{other?.name || 'Chat'}</Text>
          {conversation?.topic_display ? (
            <Text style={s.headerTopic}>{conversation.topic_display}</Text>
          ) : null}
        </View>
        <TouchableOpacity style={s.muteBtn} onPress={handleToggleMute} activeOpacity={0.75}>
          <Ionicons
            name={isMuted ? 'notifications-off' : 'notifications'}
            size={18}
            color={isMuted ? COLORS.accent : 'rgba(255,255,255,0.7)'}
          />
        </TouchableOpacity>
        <TouchableOpacity style={s.muteBtn} onPress={() => setMenuOpen(true)} activeOpacity={0.75}>
          <Ionicons name="ellipsis-vertical" size={18} color="rgba(255,255,255,0.85)" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Disconnect menu modal */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <TouchableOpacity style={s.menuOverlay} activeOpacity={1} onPress={() => setMenuOpen(false)}>
          <View style={s.menuCard}>
            <View style={s.menuHeader}>
              <Text style={s.menuHeaderT}>Conversation Options</Text>
            </View>
            <TouchableOpacity style={s.menuRow} onPress={handleDisconnect} activeOpacity={0.7}>
              <View style={s.menuIconWrap}>
                <Ionicons name="person-remove" size={18} color="#dc2626" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.menuRowT}>Remove Connection</Text>
                <Text style={s.menuRowSub}>Delete chat and disconnect from this person</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={[s.menuRow, { borderBottomWidth: 0 }]} onPress={() => setMenuOpen(false)} activeOpacity={0.7}>
              <View style={[s.menuIconWrap, { backgroundColor: '#f1f5f9' }]}>
                <Ionicons name="close" size={18} color="#64748b" />
              </View>
              <Text style={[s.menuRowT, { color: '#64748b' }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Topic banner */}
      {conversation?.topic_display && (
        <View style={s.topicBanner}>
          <Ionicons name="chatbubble-ellipses-outline" size={12} color={COLORS.brand} />
          <Text style={s.topicBannerText}>
            <Text style={{ fontWeight: FONT.w7 }}>{conversation.topic_display}</Text>
          </Text>
        </View>
      )}

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={COLORS.brand} /></View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <FlatList
            ref={listRef}
            data={grouped}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={s.listContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={s.emptyWrap}>
                <Text style={{ fontSize: 32, marginBottom: SPACE.md }}>👋</Text>
                <Text style={s.emptyTitle}>No messages yet</Text>
                <Text style={s.emptySubtitle}>Start the conversation!</Text>
              </View>
            }
          />

          {/* Reply preview bar */}
          {replyTo && (
            <View style={s.replyBar}>
              <View style={s.replyBarInner}>
                <View style={s.replyBarAccent} />
                <View style={{ flex: 1 }}>
                  <Text style={s.replyBarName}>{isMe(replyTo) ? 'You' : other?.name}</Text>
                  <Text style={s.replyBarContent} numberOfLines={1}>
                    {replyTo.message_type === 'image' ? '📷 Photo' : replyTo.content}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setReplyTo(null)} style={{ padding: SPACE.sm }}>
                  <Ionicons name="close" size={18} color={COLORS.textSec} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Input bar */}
          <View style={s.inputBar}>
            <TouchableOpacity style={s.mediaBtn} onPress={() => pickAndSend(false)} disabled={sending} activeOpacity={0.7}>
              <Ionicons name="image-outline" size={20} color={COLORS.brand} />
            </TouchableOpacity>
            <TouchableOpacity style={s.mediaBtn} onPress={() => pickAndSend(true)} disabled={sending} activeOpacity={0.7}>
              <Ionicons name="camera-outline" size={20} color={COLORS.brand} />
            </TouchableOpacity>
            <TextInput
              style={s.input}
              placeholder="Type a message..."
              placeholderTextColor={COLORS.textTer}
              value={text}
              onChangeText={setText}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              style={[s.sendBtn, (!text.trim() || sending) && s.sendBtnDisabled]}
              onPress={sendText}
              disabled={!text.trim() || sending}
              activeOpacity={0.8}
            >
              {sending
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="paper-plane" size={16} color="#fff" />}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* ── Reaction Picker Modal ── */}
      <Modal visible={!!reactionTarget} transparent animationType="fade" onRequestClose={() => setReactionTarget(null)}>
        <TouchableOpacity style={s.reactionOverlay} activeOpacity={1} onPress={() => setReactionTarget(null)}>
          <View style={s.reactionPicker}>
            <Text style={s.reactionPickerTitle}>React to message</Text>
            <View style={s.reactionPickerRow}>
              {REACTIONS.map(r => {
                const alreadyReacted = reactionTarget?.reactions?.some(
                  existing => existing.key === r.key && existing.user_ids?.includes(myUserId)
                );
                return (
                  <TouchableOpacity
                    key={r.key}
                    style={[s.reactionPickerItem, alreadyReacted && s.reactionPickerItemActive]}
                    onPress={() => handleReaction(reactionTarget, r.key)}
                    activeOpacity={0.7}
                  >
                    <Text style={s.reactionPickerEmoji}>{r.emoji}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Report Modal ── */}
      <Modal visible={!!reportTarget} transparent animationType="slide" onRequestClose={() => setReportTarget(null)}>
        <View style={s.reportOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setReportTarget(null)} />
          <View style={s.reportSheet}>
            <View style={s.reportHandle} />
            <Text style={s.reportTitle}>Report Message</Text>
            <Text style={s.reportSubtitle}>Why are you reporting this message?</Text>
            {REPORT_REASONS.map(reason => (
              <TouchableOpacity
                key={reason}
                style={[s.reportOption, reportReason === reason && s.reportOptionActive]}
                onPress={() => setReportReason(reason)}
                activeOpacity={0.75}
              >
                <View style={[s.reportRadio, reportReason === reason && s.reportRadioActive]}>
                  {reportReason === reason && <View style={s.reportRadioDot} />}
                </View>
                <Text style={[s.reportOptionText, reportReason === reason && { color: COLORS.brand, fontWeight: FONT.w7 }]}>
                  {reason.charAt(0).toUpperCase() + reason.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={s.reportBtn} onPress={handleReport} activeOpacity={0.85}>
              <Text style={s.reportBtnText}>Submit Report</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setReportTarget(null)} style={{ alignItems: 'center', paddingVertical: SPACE.md }}>
              <Text style={{ fontSize: FONT.sm, color: COLORS.textTer }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Image Viewer ── */}
      <Modal visible={!!viewImage} transparent animationType="fade" onRequestClose={() => setViewImage(null)}>
        <View style={s.imageViewer}>
          <TouchableOpacity style={s.imageViewerClose} onPress={() => setViewImage(null)}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          {viewImage && (
            <Image source={{ uri: viewImage }} style={s.imageViewerImg} resizeMode="contain" />
          )}
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#f0f4f9' },

  header: {
    paddingTop: TOP,
    paddingBottom: SPACE.md,
    paddingHorizontal: SPACE.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerPhoto: { width: 40, height: 40, borderRadius: 13, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  headerInfo: { flex: 1 },
  headerName:  { fontSize: FONT.md, fontWeight: FONT.w7, color: '#fff' },
  headerTopic: { fontSize: FONT.xs, color: 'rgba(255,255,255,0.6)', marginTop: 1 },
  muteBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },

  topicBanner: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.xs,
    backgroundColor: COLORS.brandLight,
    paddingHorizontal: SPACE.xl, paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  topicBannerText: { fontSize: FONT.xs, color: COLORS.brand },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  listContent: { padding: SPACE.lg, paddingBottom: SPACE.md },

  dateHeader: {
    flexDirection: 'row', alignItems: 'center',
    marginVertical: SPACE.lg, gap: SPACE.sm,
  },
  dateHeaderLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dateHeaderText: { fontSize: FONT.xs, fontWeight: FONT.w6, color: COLORS.textTer, paddingHorizontal: SPACE.sm },

  emptyWrap: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: FONT.lg, fontWeight: FONT.w7, color: COLORS.textSec },
  emptySubtitle: { fontSize: FONT.sm, color: COLORS.textTer, marginTop: 4 },

  msgRow:     { flexDirection: 'row', marginBottom: SPACE.md, alignItems: 'flex-end' },
  msgRowMe:   { justifyContent: 'flex-end' },
  msgRowThem: { justifyContent: 'flex-start' },
  msgAvatar:  { width: 30, height: 30, borderRadius: 9, marginRight: SPACE.sm },

  replyPreview: {
    borderRadius: 10, padding: SPACE.sm,
    marginBottom: 3, borderLeftWidth: 3,
  },
  replyPreviewMe: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderLeftColor: 'rgba(255,255,255,0.6)',
  },
  replyPreviewThem: {
    backgroundColor: COLORS.brandLight,
    borderLeftColor: COLORS.brand,
  },
  replyPreviewName: { fontSize: 10, fontWeight: FONT.w7, color: COLORS.brand, marginBottom: 2 },
  replyPreviewText: { fontSize: FONT.xs, color: COLORS.textSec },

  bubble: {
    paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md,
    borderRadius: 20, maxWidth: '100%',
  },
  bubbleMe: {
    backgroundColor: COLORS.brand,
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: COLORS.borderLight,
  },
  bubbleDeleted: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.xs,
    backgroundColor: COLORS.borderLight,
    borderBottomLeftRadius: 20, borderBottomRightRadius: 20,
  },
  deletedText: { fontSize: FONT.xs, color: COLORS.textTer, fontStyle: 'italic' },
  bubbleText:     { fontSize: FONT.sm, lineHeight: 20 },
  bubbleTextMe:   { color: '#fff' },
  bubbleTextThem: { color: COLORS.text },
  msgImage: { width: 200, height: 200, borderRadius: 14 },

  reactionsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 3,
    marginTop: 3,
  },
  reactionPill: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.full, paddingHorizontal: SPACE.sm, paddingVertical: 2,
  },
  reactionEmoji: { fontSize: 14 },
  reactionCount: { fontSize: 10, fontWeight: FONT.w7, color: COLORS.textSec },

  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  metaTime: { fontSize: 10, color: COLORS.textTer },

  replyBar: {
    backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: COLORS.border,
    paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm,
  },
  replyBarInner: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.sm,
    backgroundColor: COLORS.brandLight, borderRadius: RADIUS.md, padding: SPACE.sm,
  },
  replyBarAccent: { width: 3, height: '100%', minHeight: 36, backgroundColor: COLORS.brand, borderRadius: 2 },
  replyBarName:    { fontSize: FONT.xs, fontWeight: FONT.w7, color: COLORS.brand },
  replyBarContent: { fontSize: FONT.xs, color: COLORS.textSec },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm,
    paddingBottom: Platform.OS === 'ios' ? 28 : 28,
    backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: COLORS.borderLight,
    gap: SPACE.xs,
  },
  mediaBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: COLORS.brandLight,
    alignItems: 'center', justifyContent: 'center',
  },
  input: {
    flex: 1, minHeight: 38, maxHeight: 120,
    backgroundColor: COLORS.borderLight, borderRadius: 18,
    paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm,
    fontSize: FONT.sm, color: COLORS.text,
    borderWidth: 1, borderColor: COLORS.border,
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.brand,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: COLORS.textMuted },

  // Reaction picker
  reactionOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center',
  },
  reactionPicker: {
    backgroundColor: '#fff', borderRadius: 24,
    padding: SPACE.xl, alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 20 },
      android: { elevation: 10 },
    }),
  },
  reactionPickerTitle: {
    fontSize: FONT.sm, fontWeight: FONT.w7, color: COLORS.textSec, marginBottom: SPACE.lg,
  },
  reactionPickerRow: { flexDirection: 'row', gap: SPACE.md },
  reactionPickerItem: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.borderLight,
    alignItems: 'center', justifyContent: 'center',
  },
  reactionPickerItemActive: {
    backgroundColor: COLORS.brandLight,
    borderWidth: 2, borderColor: COLORS.brand,
  },
  reactionPickerEmoji: { fontSize: 28 },

  // Report sheet
  reportOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  reportSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: SPACE.xl,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  reportHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: SPACE.lg,
  },
  reportTitle:    { fontSize: FONT.lg, fontWeight: FONT.w8, color: COLORS.text, marginBottom: SPACE.xs },
  reportSubtitle: { fontSize: FONT.sm, color: COLORS.textTer, marginBottom: SPACE.xl },
  reportOption: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.md,
    paddingVertical: SPACE.md, paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.lg, marginBottom: SPACE.xs,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  reportOptionActive: { backgroundColor: COLORS.brandLight, borderColor: COLORS.brand },
  reportOptionText:   { fontSize: FONT.sm, color: COLORS.text },
  reportRadio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  reportRadioActive: { borderColor: COLORS.brand },
  reportRadioDot:    { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.brand },
  reportBtn: {
    backgroundColor: COLORS.error, borderRadius: RADIUS.xl,
    paddingVertical: SPACE.lg, alignItems: 'center', marginTop: SPACE.lg,
  },
  reportBtnText: { fontSize: FONT.md, fontWeight: FONT.w7, color: '#fff' },

  // Image viewer
  imageViewer: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.96)',
    justifyContent: 'center', alignItems: 'center',
  },
  imageViewerClose: {
    position: 'absolute', top: Platform.OS === 'ios' ? 54 : 40, right: 20,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center', zIndex: 10,
  },
  imageViewerImg: { width: SW - 32, height: SH * 0.72 },

  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  menuCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 30,
    paddingTop: 8,
  },
  menuHeader: {
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  menuHeaderT: {
    fontSize: 14,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  menuIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuRowT: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  menuRowSub: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 3,
  },
});
