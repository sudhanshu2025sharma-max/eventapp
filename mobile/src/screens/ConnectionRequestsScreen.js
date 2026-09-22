import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Platform, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Image, Alert, StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { COLORS, FONT, SPACE, RADIUS, SHADOW, TOP, fixMediaUrl } from '../theme';
import { GradientAvatar, FadeIn } from '../components';
import { apiFetch } from '../api';

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
      const [inRes, outRes] = await Promise.all([
        apiFetch('/chat/requests/inbox/'),
        apiFetch('/chat/requests/sent/'),
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
  }, []);

  useEffect(() => { load(); }, [load]);

  const respond = async (requestId, action) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    setResponding(requestId);
    try {
      const res = await apiFetch(`/chat/requests/${requestId}/action/`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setReceived(prev => prev.filter(r => r.id !== requestId));
        if (action === 'accepted') {
          try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
          if (data.conversation_id && onOpenChat) {
            onOpenChat(data.conversation_id);
          } else {
            Alert.alert('Connected', 'You can now start messaging from your Chats tab.');
          }
        }
      } else {
        Alert.alert('Notice', data.error || 'Action could not be completed.');
      }
    } catch {
      Alert.alert('Error', 'Connection failed. Please try again.');
    } finally {
      setResponding(null);
    }
  };

  const withdraw = async (requestId) => {
    Alert.alert('Withdraw Request', 'Are you sure you want to withdraw this connection request?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Withdraw', style: 'destructive',
        onPress: async () => {
          setResponding(requestId);
          try {
            const res = await apiFetch(`/chat/requests/${requestId}/withdraw/`, {
              method: 'POST',
            });
            const data = await res.json();
            if (res.ok && data.success) {
              setSent(prev => prev.filter(r => r.id !== requestId));
            } else {
              Alert.alert('Notice', data.error || 'Could not withdraw request.');
            }
          } catch {
            Alert.alert('Error', 'Network error.');
          } finally {
            setResponding(null);
          }
        }
      }
    ]);
  };

  const currentList = activeTab === 'Received' ? received : sent;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <LinearGradient colors={[COLORS.brandDeep, COLORS.brand]} style={s.header}>
        <View style={s.headerRow}>
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Connection Requests</Text>
            <Text style={s.headerSub}>Manage your chat requests</Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={s.tabRow}>
          {TABS.map(tab => {
            const count = tab === 'Received' ? received.length : sent.length;
            const active = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => {
                  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                  setActiveTab(tab);
                }}
                style={[s.tabBtn, active && s.tabBtnOn]}
                activeOpacity={0.8}
              >
                <Text style={[s.tabText, active && s.tabTextOn]}>{tab}</Text>
                {count > 0 && (
                  <View style={[s.badge, active && s.badgeOn]}>
                    <Text style={[s.badgeText, active && s.badgeTextOn]}>{count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </LinearGradient>

      {/* Body */}
      {loading ? (
        <View style={s.centerBox}>
          <ActivityIndicator size="large" color={COLORS.brand} />
          <Text style={s.loadingText}>Loading requests...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.brand} />}
          showsVerticalScrollIndicator={false}
        >
          {currentList.length === 0 ? (
            <View style={s.emptyBox}>
              <Ionicons name="mail-open-outline" size={54} color={COLORS.textTer} />
              <Text style={s.emptyTitle}>No {activeTab} Requests</Text>
              <Text style={s.emptySub}>
                {activeTab === 'Received'
                  ? 'When delegates or officers request to connect, they will appear here.'
                  : 'You have no pending requests sent.'}
              </Text>
            </View>
          ) : (
            currentList.map(req => {
              const person = activeTab === 'Received' ? req.sender : req.receiver;
              const isProcessing = responding === req.id;

              return (
                <FadeIn key={req.id}>
                  <View style={s.card}>
                    <View style={s.personRow}>
                      {person?.profile_photo_url ? (
                        <Image source={{ uri: person.profile_photo_url }} style={s.avatar} />
                      ) : (
                        <GradientAvatar name={person?.full_name || '?'} size={48} radius={16} />
                      )}

                      <View style={{ flex: 1 }}>
                        <Text style={s.name}>{person?.full_name || 'Delegate'}</Text>
                        {person?.designation ? (
                          <Text style={s.designation}>{person.designation}</Text>
                        ) : null}
                        {person?.affiliation ? (
                          <Text style={s.aff}>{person.affiliation}</Text>
                        ) : null}
                      </View>
                    </View>

                    {/* Topic & Message */}
                    <View style={s.topicBox}>
                      <View style={s.topicTag}>
                        <Ionicons name="chatbubble-ellipses-outline" size={12} color={COLORS.brand} />
                        <Text style={s.topicTagText}>{req.topic_display || req.topic || 'Networking'}</Text>
                      </View>
                      {req.message ? (
                        <Text style={s.messageText}>"{req.message}"</Text>
                      ) : null}
                    </View>

                    {/* Actions */}
                    {activeTab === 'Received' ? (
                      <View style={s.actionsRow}>
                        <TouchableOpacity
                          onPress={() => respond(req.id, 'accepted')}
                          style={[s.actBtn, s.btnAccept]}
                          disabled={isProcessing}
                          activeOpacity={0.85}
                        >
                          {isProcessing ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <>
                              <Ionicons name="checkmark-circle" size={16} color="#fff" />
                              <Text style={s.btnAcceptText}>Accept &amp; Chat</Text>
                            </>
                          )}
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => respond(req.id, 'declined')}
                          style={[s.actBtn, s.btnDecline]}
                          disabled={isProcessing}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="close-circle-outline" size={16} color={COLORS.error} />
                          <Text style={s.btnDeclineText}>Decline</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={s.actionsRow}>
                        <View style={s.statusPill}>
                          <Text style={s.statusPillText}>Status: Pending Approval</Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => withdraw(req.id)}
                          style={s.btnWithdraw}
                          disabled={isProcessing}
                          activeOpacity={0.75}
                        >
                          <Text style={s.btnWithdrawText}>Withdraw</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </FadeIn>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    paddingTop: TOP + 8,
    paddingBottom: SPACE.lg,
    paddingHorizontal: SPACE.xl,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginBottom: SPACE.lg },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: FONT.w9, color: '#fff' },
  headerSub: { fontSize: FONT.xs, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  tabRow: { flexDirection: 'row', gap: SPACE.sm, backgroundColor: 'rgba(255,255,255,0.12)', padding: 4, borderRadius: RADIUS.full },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: RADIUS.full },
  tabBtnOn: { backgroundColor: '#fff' },
  tabText: { fontSize: FONT.sm, fontWeight: FONT.w7, color: 'rgba(255,255,255,0.85)' },
  tabTextOn: { color: COLORS.brand },
  badge: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: RADIUS.full },
  badgeOn: { backgroundColor: COLORS.brand },
  badgeText: { fontSize: 10, fontWeight: FONT.w9, color: '#fff' },
  badgeTextOn: { color: '#fff' },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACE.xxl },
  loadingText: { marginTop: SPACE.md, fontSize: FONT.sm, color: COLORS.textSec },
  emptyBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, paddingHorizontal: SPACE.xl },
  emptyTitle: { fontSize: FONT.lg, fontWeight: FONT.w8, color: COLORS.text, marginTop: SPACE.md },
  emptySub: { fontSize: FONT.xs, color: COLORS.textTer, textAlign: 'center', marginTop: 6, lineHeight: 18 },
  scroll: { padding: SPACE.xl, gap: SPACE.md, paddingBottom: 100 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: SPACE.lg, borderWidth: 1, borderColor: '#e2e8f0', ...SHADOW.sm },
  personRow: { flexDirection: 'row', gap: SPACE.md, alignItems: 'center' },
  avatar: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#f1f5f9' },
  name: { fontSize: FONT.base, fontWeight: FONT.w8, color: COLORS.text },
  designation: { fontSize: 11, fontWeight: FONT.w6, color: COLORS.brand, marginTop: 1 },
  aff: { fontSize: 10, color: COLORS.textTer, marginTop: 1 },
  topicBox: { backgroundColor: '#f8fafc', borderRadius: 14, padding: SPACE.md, marginTop: SPACE.md, borderWidth: 1, borderColor: '#f1f5f9' },
  topicTag: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: COLORS.brandLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full, marginBottom: 4 },
  topicTagText: { fontSize: 10, fontWeight: FONT.w7, color: COLORS.brand },
  messageText: { fontSize: 11, color: COLORS.textSec, fontStyle: 'italic', marginTop: 4, lineHeight: 16 },
  actionsRow: { flexDirection: 'row', gap: SPACE.sm, marginTop: SPACE.md, alignItems: 'center' },
  actBtn: { flex: 1, height: 44, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  btnAccept: { backgroundColor: COLORS.brand, ...SHADOW.brand },
  btnAcceptText: { fontSize: FONT.xs, fontWeight: FONT.w8, color: '#fff' },
  btnDecline: { backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fecaca' },
  btnDeclineText: { fontSize: FONT.xs, fontWeight: FONT.w7, color: COLORS.error },
  statusPill: { flex: 1, backgroundColor: '#f1f5f9', paddingVertical: 8, paddingHorizontal: 12, borderRadius: RADIUS.md },
  statusPillText: { fontSize: 11, fontWeight: FONT.w6, color: COLORS.textTer },
  btnWithdraw: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.md, borderWidth: 1, borderColor: '#fecaca' },
  btnWithdrawText: { fontSize: 11, fontWeight: FONT.w7, color: COLORS.error },
});
