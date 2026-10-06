import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StatusBar,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SPACE, RADIUS, SHADOW, fixMediaUrl } from '../theme';
import { apiFetch } from '../api';
import TopicPickerModal from './TopicPickerModal';

const CACHE_KEY = '@staff_directory_cache';
const CACHE_TTL = 10 * 60 * 1000;

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_MARGIN = 12;
const CARD_WIDTH = (SCREEN_W - CARD_MARGIN * 3) / 2;

const TIER_COLORS = {
  librarian: '#4f46e5',
  deputy: '#0891b2',
  assistant: '#059669',
  staff: '#d97706',
};

export default function StaffScreen({ onBack, onOpenStaffDetail, onOpenGroupChat, onOpenChatRoom, user }) {
  const [loading, setLoading] = useState(true);
  const [staffList, setStaffList] = useState([]);
  const [connectingId, setConnectingId] = useState(null);

  // Topic Picker State
  const [targetStaff, setTargetStaff] = useState(null);
  const [showTopicPicker, setShowTopicPicker] = useState(false);

  const isStaffUser = user && ['super_admin', 'mgmt_admin', 'team_head', 'staff'].includes(user.role);

  useEffect(() => { fetchStaff(); }, []);

  const fetchStaff = async () => {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, ts } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL && data.length > 0) {
          setStaffList(data);
          setLoading(false);
          fetchFromServer();
          return;
        }
      }
      await fetchFromServer();
    } catch (err) {
      setLoading(false);
    }
  };

  const fetchFromServer = async () => {
    try {
      const res = await apiFetch('/auth/staff/');
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && data.staff) {
          setStaffList(data.staff);
          await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
            data: data.staff, ts: Date.now(),
          }));
        }
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  // 1. User Taps Chat Button -> Open Topic Picker
  const handleInitiateChat = (staffMember) => {
    setTargetStaff(staffMember);
    setShowTopicPicker(true);
  };

  // 2. Topic Confirmed -> Start Chat Session
  const handleTopicConfirmed = async ({ topic, custom_topic, message }) => {
    if (!targetStaff) return;
    const staffUserId = targetStaff.user_id || targetStaff.id;
    setShowTopicPicker(false);
    setConnectingId(staffUserId);

    try {
      const res = await apiFetch(`/chat/support/start/${staffUserId}/`, {
        method: 'POST',
        body: JSON.stringify({
          topic,
          custom_topic,
          message,
        }),
      });

      const data = await res.json();
      if (data.success && data.conversation_id) {
        if (onOpenChatRoom) {
          onOpenChatRoom(data.conversation_id);
        }
      } else {
        Alert.alert('Chat Error', data.error || 'Could not start chat session.');
      }
    } catch {
      Alert.alert('Network Error', 'Could not reach chat server.');
    } finally {
      setConnectingId(null);
      setTargetStaff(null);
    }
  };

  const renderStaffCard = useCallback(({ item }) => {
    const photoUrl = fixMediaUrl(item.photo_url);
    const tierColor = TIER_COLORS[item.tier] || '#4f46e5';
    const initials = (item.first_name?.[0] || '') + (item.last_name?.[0] || '');
    const fullBadgeTitle = item.designation || 'Organizing Team';
    const staffUserId = item.user_id || item.id;

    return (
      <View style={styles.card}>
        {/* Top Full Designation Badge */}
        <View style={[styles.tierBar, { backgroundColor: tierColor }]}>
          <Text style={styles.tierBarText} numberOfLines={1}>{fullBadgeTitle}</Text>
        </View>

        {/* Big Avatar Container (Preserves Full Headshot) */}
        <TouchableOpacity
          activeOpacity={0.85}
          style={{ alignItems: 'center', width: '100%' }}
          onPress={() => onOpenStaffDetail && onOpenStaffDetail(item)}
        >
          <View style={styles.avatarContainer}>
            {photoUrl ? (
              <Image
                source={{ uri: photoUrl }}
                style={styles.avatar}
                resizeMode="contain"
              />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: tierColor }]}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            )}
          </View>

          <Text style={styles.name} numberOfLines={2}>{item.full_name}</Text>
          <Text style={styles.department} numberOfLines={1}>{item.department || 'Central Library, IIT Delhi'}</Text>
        </TouchableOpacity>

        {/* Direct Chat Button */}
        <TouchableOpacity
          onPress={() => handleInitiateChat(item)}
          disabled={connectingId === staffUserId}
          style={styles.chatBtn}
          activeOpacity={0.8}
        >
          {connectingId === staffUserId ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="chatbubbles-outline" size={14} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.chatBtnText}>Chat</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  }, [onOpenStaffDetail, connectingId]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1e1b4b" />

      {/* Topic Picker Modal */}
      <TopicPickerModal
        visible={showTopicPicker}
        onClose={() => {
          setShowTopicPicker(false);
          setTargetStaff(null);
        }}
        onConfirm={handleTopicConfirmed}
        title={targetStaff ? `Connect with ${targetStaff.first_name || targetStaff.full_name}` : 'Select Topic'}
      />

      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.topTitle}>Events Team</Text>
          <Text style={styles.topSub}>Central Library, IIT Delhi</Text>
        </View>
      </View>

      {isStaffUser && (
        <TouchableOpacity
          style={styles.groupBanner}
          activeOpacity={0.85}
          onPress={() => onOpenGroupChat && onOpenGroupChat()}
        >
          <View style={styles.groupIconCircle}>
            <Ionicons name="megaphone" size={20} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.groupTitle}>Staff Coordination Group</Text>
            <Text style={styles.groupSub}>Broadcast &amp; chat with all organizers</Text>
          </View>
          <Ionicons name="arrow-forward-circle" size={24} color="#fff" />
        </TouchableOpacity>
      )}

      {loading && staffList.length === 0 ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#4f46e5" />
          <Text style={styles.loadingText}>Loading Team...</Text>
        </View>
      ) : (
        <FlatList
          data={staffList}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderStaffCard}
          numColumns={2}
          columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: CARD_MARGIN }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="people-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No Team Members</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  topBar: {
    backgroundColor: '#1e1b4b',
    paddingTop: 20, paddingBottom: 16, paddingHorizontal: SPACE.lg,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  backBtn: { padding: 4 },
  topTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  topSub: { fontSize: 12, color: '#c7d2fe', marginTop: 2 },
  groupBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#4f46e5',
    marginHorizontal: SPACE.lg, marginTop: SPACE.md,
    padding: SPACE.md, borderRadius: RADIUS.lg, gap: 12,
    ...SHADOW.sm,
  },
  groupIconCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  groupTitle: { fontSize: 14, fontWeight: '700', color: '#fff' },
  groupSub: { fontSize: 11, color: '#c7d2fe', marginTop: 2 },
  listContent: { paddingVertical: SPACE.md, paddingBottom: 40 },
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#fff',
    borderRadius: RADIUS.lg,
    padding: 12,
    marginBottom: CARD_MARGIN,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    ...SHADOW.sm,
    overflow: 'hidden',
  },
  tierBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    paddingVertical: 5,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  tierBarText: {
    color: '#fff', fontSize: 9, fontWeight: '700', letterSpacing: 0.3, textAlign: 'center',
  },
  avatarContainer: {
    marginTop: 20,
    width: 90,
    height: 104,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 28 },
  name: {
    fontSize: 13, fontWeight: '700', color: '#1e293b',
    textAlign: 'center', marginTop: 8, minHeight: 34,
  },
  department: {
    fontSize: 10, color: '#64748b',
    textAlign: 'center', marginTop: 2, marginBottom: 10,
  },
  chatBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.brand,
    height: 36,
    borderRadius: RADIUS.md,
  },
  chatBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#64748b' },
  emptyBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#64748b', marginTop: 12 },
});
