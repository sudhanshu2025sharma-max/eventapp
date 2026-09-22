import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  Image, ActivityIndicator, KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACE, RADIUS, fixMediaUrl } from '../theme';
import { apiFetch } from '../api';

export default function StaffGroupChatScreen({ onBack, user }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef(null);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 4000); // Polling every 4s
    return () => clearInterval(interval);
  }, []);

  const fetchMessages = async () => {
    try {
      const res = await apiFetch('/chat/staff-group/');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setMessages(data.messages || []);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setText('');
    setSending(true);

    try {
      const res = await apiFetch('/chat/staff-group/', {
        method: 'POST',
        body: JSON.stringify({ content: trimmed }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.message) {
          setMessages((prev) => [...prev, data.message]);
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }) => {
    const isMe = item.is_me;
    const photoUrl = fixMediaUrl(item.sender?.photo_url);

    return (
      <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowOther]}>
        {!isMe && (
          photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.senderAvatar} />
          ) : (
            <View style={styles.avatarPh}>
              <Text style={styles.avatarPhTxt}>{item.sender?.full_name?.[0] || 'S'}</Text>
            </View>
          )
        )}
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
          {!isMe && (
            <View style={styles.senderHeader}>
              <Text style={styles.senderName}>{item.sender?.full_name}</Text>
              {item.sender?.designation ? (
                <Text style={styles.senderDesig} numberOfLines={1}> &bull; {item.sender.designation}</Text>
              ) : null}
            </View>
          )}
          <Text style={[styles.msgContent, isMe ? styles.msgContentMe : styles.msgContentOther]}>
            {item.content}
          </Text>
          <Text style={[styles.msgTime, isMe ? styles.msgTimeMe : styles.msgTimeOther]}>
            {item.created_at}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1e1b4b" />
      
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Staff Coordination</Text>
          <Text style={styles.headerSub}>Organizing Committee Channel</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.innerContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        {loading && messages.length === 0 ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#4f46e5" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderMessage}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Ionicons name="chatbubbles-outline" size={48} color="#cbd5e1" />
                <Text style={styles.emptyTxt}>No messages yet. Send a message to coordinate with the team!</Text>
              </View>
            }
          />
        )}

        {/* Input Bar */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Message all organizers..."
            placeholderTextColor="#94a3b8"
            value={text}
            onChangeText={setText}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, !text.trim() && { opacity: 0.5 }]}
            onPress={handleSend}
            disabled={!text.trim() || sending}
          >
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  innerContainer: { flex: 1 },
  header: {
    backgroundColor: '#1e1b4b',
    paddingTop: 48,
    paddingBottom: 16,
    paddingHorizontal: SPACE.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 12, color: '#c7d2fe', marginTop: 2 },
  listContent: { padding: SPACE.md, paddingBottom: 20 },
  msgRow: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end', gap: 8 },
  msgRowMe: { justifyContent: 'flex-end' },
  msgRowOther: { justifyContent: 'flex-start' },
  senderAvatar: { width: 32, height: 32, borderRadius: 16, marginBottom: 2 },
  avatarPh: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#4f46e5', alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  avatarPhTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },
  bubble: { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  bubbleMe: { backgroundColor: '#4f46e5', borderBottomRightRadius: 2 },
  bubbleOther: { backgroundColor: '#fff', borderBottomLeftRadius: 2, borderWidth: 1, borderColor: '#e2e8f0' },
  senderHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  senderName: { fontSize: 12, fontWeight: '700', color: '#4f46e5' },
  senderDesig: { fontSize: 10, color: '#64748b', flexShrink: 1 },
  msgContent: { fontSize: 14, lineHeight: 20 },
  msgContentMe: { color: '#fff' },
  msgContentOther: { color: '#1e293b' },
  msgTime: { fontSize: 10, marginTop: 4, textAlign: 'right' },
  msgTimeMe: { color: '#c7d2fe' },
  msgTimeOther: { color: '#94a3b8' },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyBox: { alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTxt: { fontSize: 13, color: '#94a3b8', textAlign: 'center', marginTop: 12 },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    alignItems: 'center',
    gap: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10, // flush safe padding on iOS
  },
  input: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    color: '#1e293b',
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
