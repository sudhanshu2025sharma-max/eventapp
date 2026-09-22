import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Platform, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONT, RADIUS, SHADOW, SPACE } from '../../theme';
import { apiFetch } from '../../api';

const STATUS_META = {
  ringing:  { label: 'Ringing',   color: '#F59E0B', bg: '#FEF3C7', icon: 'call-outline' },
  active:   { label: 'Active',    color: '#10B981', bg: '#D1FAE5', icon: 'radio' },
  ended:    { label: 'Completed', color: '#6366F1', bg: '#E0E7FF', icon: 'checkmark-circle' },
  missed:   { label: 'Missed',    color: '#EF4444', bg: '#FEE2E2', icon: 'close-circle' },
};

function formatDuration(secs) {
  if (secs == null) return '—';
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export default function CallLogsAdmin({ tokens, onBack }) {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, ended: 0, missed: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const fetchLogs = useCallback(async (p = 1, append = false) => {
    try {
      const url = `/chat/call-logs/?page=${p}${statusFilter ? `&status=${statusFilter}` : ''}`;
      const res = await apiFetch(url);
      const data = await res.json();
      if (data.success) {
        setLogs(prev => append ? [...prev, ...data.logs] : data.logs);
        setStats({
          total: data.total,
          active: data.logs.filter(l => l.status === 'active').length,
          ended: data.logs.filter(l => l.status === 'ended').length,
          missed: data.logs.filter(l => l.status === 'missed').length,
        });
        setHasMore(data.logs.length >= 20);
        setPage(p);
      }
    } catch (e) {
      console.warn('[CallLogs Fetch Error]', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    setLoading(true);
    fetchLogs(1, false);
  }, [statusFilter]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLogs(1, false);
  };

  const loadMore = () => {
    if (!loading && hasMore) fetchLogs(page + 1, true);
  };

  const renderLog = ({ item }) => {
    const meta = STATUS_META[item.status] || STATUS_META.ended;
    return (
      <View style={s.card}>
        <View style={s.cardHeader}>
          <View style={[s.statusBadge, { backgroundColor: meta.bg }]}>
            <Ionicons name={meta.icon} size={12} color={meta.color} />
            <Text style={[s.statusText, { color: meta.color }]}>{meta.label}</Text>
          </View>
          <Text style={s.timeText}>{item.created_at}</Text>
        </View>

        <View style={s.callerRow}>
          <View style={s.userBlock}>
            <View style={s.avatar}>
              <Text style={s.avatarLetter}>{(item.caller.name || '?').charAt(0).toUpperCase()}</Text>
            </View>
            <View style={s.userInfo}>
              <Text style={s.userName} numberOfLines={1}>{item.caller.name}</Text>
              <Text style={s.userEmail} numberOfLines={1}>{item.caller.email}</Text>
            </View>
          </View>

          <View style={s.arrowWrap}>
            <Ionicons name="arrow-forward" size={16} color={COLORS.brand} />
          </View>

          <View style={s.userBlock}>
            <View style={[s.avatar, { backgroundColor: '#EDE9FE' }]}>
              <Text style={[s.avatarLetter, { color: '#7C3AED' }]}>{(item.callee.name || '?').charAt(0).toUpperCase()}</Text>
            </View>
            <View style={s.userInfo}>
              <Text style={s.userName} numberOfLines={1}>{item.callee.name}</Text>
              <Text style={s.userEmail} numberOfLines={1}>{item.callee.email}</Text>
            </View>
          </View>
        </View>

        <View style={s.cardFooter}>
          <Ionicons name="time-outline" size={14} color={COLORS.textSec} />
          <Text style={s.durationText}>{formatDuration(item.duration_secs)}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      <LinearGradient colors={['#0F172A', '#1E293B']} style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>📞 Call Logs</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      {/* Stats Row */}
      <View style={s.statsRow}>
        <View style={s.statPill}>
          <Text style={[s.statNum, { color: COLORS.brand }]}>{stats.total}</Text>
          <Text style={s.statLbl}>Total</Text>
        </View>
        <View style={s.statPill}>
          <Text style={[s.statNum, { color: '#10B981' }]}>{stats.active}</Text>
          <Text style={s.statLbl}>Active</Text>
        </View>
        <View style={s.statPill}>
          <Text style={[s.statNum, { color: '#6366F1' }]}>{stats.ended}</Text>
          <Text style={s.statLbl}>Done</Text>
        </View>
        <View style={s.statPill}>
          <Text style={[s.statNum, { color: '#EF4444' }]}>{stats.missed}</Text>
          <Text style={s.statLbl}>Missed</Text>
        </View>
      </View>

      {/* Filter Chips */}
      <View style={s.filterRow}>
        {['', 'active', 'ended', 'missed', 'ringing'].map(f => (
          <TouchableOpacity
            key={f}
            style={[s.chip, statusFilter === f && s.chipActive]}
            onPress={() => setStatusFilter(f)}
          >
            <Text style={[s.chipText, statusFilter === f && s.chipTextActive]}>
              {f === '' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && !refreshing ? (
        <ActivityIndicator size="large" color={COLORS.brand} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={logs}
          keyExtractor={item => item.id}
          renderItem={renderLog}
          contentContainerStyle={s.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="call-outline" size={48} color={COLORS.border} />
              <Text style={s.emptyText}>No call logs yet</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 52 : 36, paddingBottom: SPACE.lg, paddingHorizontal: SPACE.md,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#FFF', fontSize: FONT.lg, fontWeight: '700' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', padding: SPACE.md, gap: 8 },
  statPill: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACE.sm, alignItems: 'center', flex: 1, ...SHADOW.sm },
  statNum: { fontSize: FONT.xl, fontWeight: '800' },
  statLbl: { fontSize: 10, color: COLORS.textSec, marginTop: 2, textTransform: 'uppercase' },
  filterRow: { flexDirection: 'row', paddingHorizontal: SPACE.md, gap: 6, marginBottom: SPACE.sm, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  chipActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  chipText: { fontSize: FONT.xs, color: COLORS.textSec, fontWeight: '600' },
  chipTextActive: { color: '#FFF' },
  listContent: { padding: SPACE.md, paddingBottom: 100 },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACE.md, marginBottom: SPACE.sm, ...SHADOW.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACE.sm },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  timeText: { fontSize: 11, color: COLORS.textSec },
  callerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  userBlock: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.brandLight, justifyContent: 'center', alignItems: 'center' },
  avatarLetter: { fontSize: 14, fontWeight: '700', color: COLORS.brand },
  userInfo: { flex: 1 },
  userName: { fontSize: FONT.sm, fontWeight: '600', color: COLORS.text },
  userEmail: { fontSize: 10, color: COLORS.textSec },
  arrowWrap: { paddingHorizontal: 8 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: SPACE.sm, paddingTop: SPACE.sm, borderTopWidth: 1, borderTopColor: COLORS.border },
  durationText: { fontSize: FONT.sm, fontWeight: '600', color: COLORS.text },
  empty: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyText: { fontSize: FONT.base, color: COLORS.textSec },
});
