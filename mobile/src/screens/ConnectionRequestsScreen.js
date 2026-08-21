import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Platform, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Image, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS, FONT, SPACE, RADIUS, TOP, API_URL, API_HEADERS, fixMediaUrl } from '../theme';
import { GradientAvatar, FadeIn } from '../components';

const TABS = ['Received', 'Sent'];

export default function ConnectionRequestsScreen({ tokens, onBack, onOpenChat }) {
  const [activeTab,  setActiveTab]  = useState('Received');
  const [received,   setReceived]   = useState([]);
  const [sent,       setSent]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [responding, setResponding] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const auth = { ...API_HEADERS, Authorization: `Bearer ${tokens?.access}` };
      const [inRes, outRes] = await Promise.all([
        fetch(`${API_URL}/chat/requests/inbox/`, { headers: auth }),
        fetch(`${API_URL}/chat/requests/sent/`,  { headers: auth }),
      ]);
      const inData  = await inRes.json();
      const outData = await outRes.json();
      const fixPerson = (r, key) => ({
        ...r,
        [key]: r[key] ? { ...r[key], profile_photo_url: fixMediaUrl(r[key].profile_photo_url) } : r[key],
      });
      setReceived((inData.requests || []).map(r => fixPerson(r, 'sender')));
      setSent((outData.requests || []).map(r => fixPerson(r, 'receiver')));
    } catch { /* silent */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [tokens]);

  useEffect(() => { load(); }, [load]);

  const respond = async (requestId, action) => {
    setResponding(requestId);
    try {
      const res  = await fetch(`${API_URL}/chat/requests/${requestId}/respond/`, {
        method: 'POST',
        headers: { ...API_HEADERS, Authorization: `Bearer ${tokens?.access}` },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.success) {
        setReceived(prev => prev.filter(r => r.id !== requestId));
        if (action === 'accepted') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          if (data.conversation_id && onOpenChat) onOpenChat(data.conversation_id);
        }
      }
    } catch { /* silent */ }
    finally { setResponding(null); }
  };

  const withdraw = async (requestId) => {
    Alert.alert('Withdraw Request', 'Are you sure you want to withdraw this request?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Withdraw', style: 'destructive',
        onPress: async () => {
          setResponding(requestId);
          try {
            const res = await fetch(`${API_URL}/chat/requests/${requestId}/withdraw/`, {
              method: 'POST',
              headers: { ...API_HEADERS, Authorization: `Bearer ${tokens?.access}` },
            });
            const data = await res.json();
            if (data.success) setSent(prev => prev.filter(r => r.id !== requestId));
          } catch { /* silent */ }
          finally { setResponding(null); }
        }
      }
    ]);
  };

  const currentList = activeTab === 'Received' ? received : sent;

  const statusColor = (status) => {
    if (status === 'accepted') return COLORS.success;
    if (status === 'declined') return COLORS.error;
    if (status === 'later')    return COLORS.accent;
    return COLORS.textTer;
  };

  const statusLabel = (status) => {
    if (status === 'accepted') return '✓ Accepted';
    if (status === 'declined') return '✗ Declined';
    if (status === 'later')    return '⏸ Later';
    return '⏳ Pending';
  };

  return (
    <View style={s.bg}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: SPACE.md }}>
          <Text style={s.title}>Connections</Text>
          <Text style={s.sub}>{received.length} pending · {sent.length} sent</Text>
        </View>
      </View>

      {/* Tab toggle */}
      <View style={s.tabRow}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[s.tab, activeTab === tab && s.tabActive]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.75}
          >
            <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>{tab}</Text>
            {tab === 'Received' && received.length > 0 && (
              <View style={s.tabBadge}>
                <Text style={s.tabBadgeText}>{received.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={COLORS.brand} /></View>
      ) : currentList.length === 0 ? (
        <View style={s.center}>
          <View style={s.emptyIcon}>
            <Ionicons name={activeTab === 'Received' ? 'mail-open-outline' : 'paper-plane-outline'} size={32} color={COLORS.brand} />
          </View>
          <Text style={s.emptyTitle}>
            {activeTab === 'Received' ? 'No pending requests' : 'No sent requests'}
          </Text>
          <Text style={s.emptySub}>
            {activeTab === 'Received'
              ? 'Contact cards sent to you will appear here.'
              : 'Cards you send to others will appear here.'}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.brand} />}
        >
          {currentList.map((req, i) => {
            const person = activeTab === 'Received' ? req.sender : req.receiver;
            return (
              <FadeIn key={req.id} delay={i * 40}>
                <View style={s.card}>
                  <View style={s.senderRow}>
                    {person.profile_photo_url ? (
                      <Image source={{ uri: person.profile_photo_url }} style={s.photo} />
                    ) : (
                      <GradientAvatar name={person.name} size={50} radius={15} />
                    )}
                    <View style={{ flex: 1, marginLeft: SPACE.md }}>
                      <Text style={s.senderName}>{person.name}</Text>
                      {person.designation ? <Text style={s.senderDesig}>{person.designation}</Text> : null}
                      {person.affiliation ? (
                        <View style={s.affRow}>
                          <Ionicons name="business-outline" size={10} color={COLORS.textTer} />
                          <Text style={s.senderAff} numberOfLines={1}>{person.affiliation}</Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={[s.typeBadge, req.request_type === 'speaker' && s.typeBadgeSpeaker]}>
                      <Text style={[s.typeBadgeText, req.request_type === 'speaker' && { color: COLORS.purple }]}>
                        {req.request_type === 'speaker' ? '🎤 Speaker' : '📇 Contact'}
                      </Text>
                    </View>
                  </View>

                  {/* Research interests */}
                  {person.research_interest_list?.length > 0 && (
                    <View style={s.tagsRow}>
                      <Ionicons name="flask-outline" size={11} color={COLORS.brand} />
                      <View style={s.tags}>
                        {person.research_interest_list.slice(0, 3).map(t => (
                          <View key={t} style={s.tag}><Text style={s.tagText}>{t}</Text></View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Topic */}
                  <View style={s.topicRow}>
                    <Ionicons name="chatbubble-ellipses-outline" size={12} color={COLORS.brand} />
                    <Text style={s.topicLabel}>Topic:</Text>
                    <Text style={s.topicValue}>{req.topic_display}</Text>
                  </View>

                  {/* Message */}
                  {req.message ? (
                    <View style={s.msgBox}>
                      <Text style={s.msgText}>{req.message}</Text>
                    </View>
                  ) : null}

                  {/* Received actions */}
                  {activeTab === 'Received' && (
                    <View style={s.actions}>
                      <TouchableOpacity
                        style={s.acceptBtn}
                        onPress={() => respond(req.id, 'accepted')}
                        disabled={responding === req.id}
                        activeOpacity={0.8}
                      >
                        {responding === req.id
                          ? <ActivityIndicator size="small" color="#fff" />
                          : <><Ionicons name="checkmark" size={15} color="#fff" /><Text style={s.acceptBtnText}>Accept</Text></>}
                      </TouchableOpacity>
                      {req.request_type === 'speaker' && (
                        <TouchableOpacity
                          style={s.laterBtn}
                          onPress={() => respond(req.id, 'later')}
                          disabled={responding === req.id}
                          activeOpacity={0.75}
                        >
                          <Text style={s.laterBtnText}>Later</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={s.declineBtn}
                        onPress={() => respond(req.id, 'declined')}
                        disabled={responding === req.id}
                        activeOpacity={0.75}
                      >
                        <Ionicons name="close" size={15} color={COLORS.error} />
                        <Text style={s.declineBtnText}>Decline</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Sent status + withdraw */}
                  {activeTab === 'Sent' && (
                    <View style={s.sentStatus}>
                      <View style={[s.statusPill, { borderColor: statusColor(req.status) + '40' }]}>
                        <Text style={[s.statusText, { color: statusColor(req.status) }]}>
                          {statusLabel(req.status)}
                        </Text>
                      </View>
                      {req.status === 'pending' && (
                        <TouchableOpacity
                          style={s.withdrawBtn}
                          onPress={() => withdraw(req.id)}
                          disabled={responding === req.id}
                          activeOpacity={0.75}
                        >
                          <Text style={s.withdrawBtnText}>Withdraw</Text>
                        </TouchableOpacity>
                      )}
                      {req.status === 'accepted' && req.conversation_id && (
                        <TouchableOpacity
                          style={s.openChatBtn}
                          onPress={() => onOpenChat && onOpenChat(req.conversation_id)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="chatbubble-outline" size={14} color={COLORS.success} />
                          <Text style={s.openChatBtnText}>Open Chat</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              </FadeIn>
            );
          })}
          <View style={{ height: 80 }} />
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#f0f4f9' },
  header: {
    paddingTop: TOP, paddingBottom: SPACE.md, paddingHorizontal: SPACE.xl,
    backgroundColor: '#f0f4f9',
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.borderLight,
  },
  title: { fontSize: FONT.lg, fontWeight: FONT.w8, color: COLORS.text },
  sub:   { fontSize: FONT.xs, color: COLORS.textTer, marginTop: 1 },

  tabRow: {
    flexDirection: 'row', gap: 0,
    paddingHorizontal: SPACE.xl, paddingVertical: SPACE.md,
    backgroundColor: '#f0f4f9',
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACE.sm, paddingVertical: SPACE.md,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive:     { borderBottomColor: COLORS.brand },
  tabText:       { fontSize: FONT.sm, fontWeight: FONT.w6, color: COLORS.textTer },
  tabTextActive: { color: COLORS.brand, fontWeight: FONT.w7 },
  tabBadge: {
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: COLORS.error,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeText: { fontSize: 9, fontWeight: FONT.w8, color: '#fff' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACE.xxxl, gap: SPACE.md },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 24, backgroundColor: COLORS.brandLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: SPACE.sm,
  },
  emptyTitle: { fontSize: FONT.lg, fontWeight: FONT.w7, color: COLORS.text },
  emptySub:   { fontSize: FONT.sm, color: COLORS.textTer, textAlign: 'center', lineHeight: 20 },

  list: { padding: SPACE.xl },

  card: {
    backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 24,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)',
    padding: SPACE.lg, marginBottom: SPACE.md,
    ...Platform.select({
      ios: { shadowColor: '#002182', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
      android: { elevation: 0 },
    }),
  },
  senderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACE.md },
  photo:     { width: 50, height: 50, borderRadius: 15 },
  senderName:  { fontSize: FONT.sm, fontWeight: FONT.w7, color: COLORS.text },
  senderDesig: { fontSize: FONT.xs, color: COLORS.textSec, marginTop: 1 },
  affRow:      { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  senderAff:   { fontSize: FONT.xs, color: COLORS.textTer, flex: 1 },

  typeBadge: {
    backgroundColor: COLORS.brandLight,
    paddingHorizontal: SPACE.sm, paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  typeBadgeSpeaker: { backgroundColor: COLORS.purpleLight },
  typeBadgeText: { fontSize: 9, fontWeight: FONT.w7, color: COLORS.brand },

  tagsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.xs, marginBottom: SPACE.sm },
  tags:    { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.xs, flex: 1 },
  tag:     { backgroundColor: COLORS.brandLight, paddingHorizontal: SPACE.sm, paddingVertical: 2, borderRadius: RADIUS.full },
  tagText: { fontSize: 9, fontWeight: FONT.w5, color: COLORS.brand },

  topicRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, marginBottom: SPACE.sm },
  topicLabel: { fontSize: FONT.xs, fontWeight: FONT.w6, color: COLORS.textSec },
  topicValue: { fontSize: FONT.xs, fontWeight: FONT.w7, color: COLORS.brand, flex: 1 },

  msgBox: {
    backgroundColor: COLORS.borderLight, borderRadius: RADIUS.md,
    padding: SPACE.md, marginBottom: SPACE.md,
    borderLeftWidth: 3, borderLeftColor: COLORS.brand,
  },
  msgText: { fontSize: FONT.xs, color: COLORS.textSec, lineHeight: 18 },

  actions: { flexDirection: 'row', gap: SPACE.sm, marginTop: SPACE.xs },
  acceptBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACE.xs, backgroundColor: COLORS.success,
    borderRadius: RADIUS.lg, paddingVertical: SPACE.md,
  },
  acceptBtnText: { fontSize: FONT.sm, fontWeight: FONT.w7, color: '#fff' },
  laterBtn: {
    paddingHorizontal: SPACE.lg, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.accentLight, borderRadius: RADIUS.lg, paddingVertical: SPACE.md,
  },
  laterBtnText: { fontSize: FONT.sm, fontWeight: FONT.w6, color: COLORS.accent },
  declineBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACE.xs, paddingHorizontal: SPACE.lg,
    backgroundColor: COLORS.errorLight, borderRadius: RADIUS.lg, paddingVertical: SPACE.md,
  },
  declineBtnText: { fontSize: FONT.sm, fontWeight: FONT.w6, color: COLORS.error },

  sentStatus: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginTop: SPACE.xs },
  statusPill: {
    borderWidth: 1, borderRadius: RADIUS.full,
    paddingHorizontal: SPACE.md, paddingVertical: 4,
  },
  statusText: { fontSize: FONT.xs, fontWeight: FONT.w7 },
  withdrawBtn: {
    paddingHorizontal: SPACE.md, paddingVertical: 4,
    backgroundColor: COLORS.errorLight, borderRadius: RADIUS.full,
  },
  withdrawBtnText: { fontSize: FONT.xs, fontWeight: FONT.w6, color: COLORS.error },
  openChatBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: SPACE.md, paddingVertical: 4,
    backgroundColor: COLORS.successLight, borderRadius: RADIUS.full,
  },
  openChatBtnText: { fontSize: FONT.xs, fontWeight: FONT.w6, color: COLORS.success },
});
