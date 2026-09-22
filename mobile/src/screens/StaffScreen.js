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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SPACE, RADIUS, SHADOW, fixMediaUrl } from '../theme';
import { apiFetch } from '../api';

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

const TIER_LABELS = {
  librarian: 'Chair',
  deputy: 'Deputy',
  assistant: 'Assistant',
  staff: 'Staff',
};

export default function StaffScreen({ onBack, onOpenStaffDetail, onOpenGroupChat, user }) {
  const [loading, setLoading] = useState(true);
  const [staffList, setStaffList] = useState([]);

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

  const renderStaffCard = useCallback(({ item }) => {
    const photoUrl = fixMediaUrl(item.photo_url);
    const tierColor = TIER_COLORS[item.tier] || '#4f46e5';
    const initials = (item.first_name?.[0] || '') + (item.last_name?.[0] || '');

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => onOpenStaffDetail && onOpenStaffDetail(item)}
      >
        <View style={[styles.tierBar, { backgroundColor: tierColor }]}>
          <Text style={styles.tierBarText}>{TIER_LABELS[item.tier] || 'Team'}</Text>
        </View>

        <View style={styles.avatarContainer}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.avatar} resizeMode="cover" />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: tierColor }]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
        </View>

        <Text style={styles.name} numberOfLines={2}>{item.full_name}</Text>
        <Text style={styles.designation} numberOfLines={2}>{item.designation}</Text>
        {item.department ? (
          <Text style={styles.department} numberOfLines={1}>{item.department}</Text>
        ) : null}
      </TouchableOpacity>
    );
  }, [onOpenStaffDetail]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1e1b4b" />

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
            <Text style={styles.groupSub}>Broadcast & chat with all organizers</Text>
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
    paddingTop: 48, paddingBottom: 16, paddingHorizontal: SPACE.lg,
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
    paddingVertical: 4,
    alignItems: 'center',
  },
  tierBarText: {
    color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.5,
  },
  avatarContainer: {
    marginTop: 22,
    width: 90,
    height: 90,
    borderRadius: 45,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
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
    fontSize: 14, fontWeight: '700', color: '#1e293b',
    textAlign: 'center', marginTop: 10, minHeight: 36,
  },
  designation: {
    fontSize: 11, color: '#4f46e5', fontWeight: '600',
    textAlign: 'center', marginTop: 2, minHeight: 28,
  },
  department: {
    fontSize: 10, color: '#64748b',
    textAlign: 'center', marginTop: 2,
  },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#64748b' },
  emptyBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#64748b', marginTop: 12 },
});
