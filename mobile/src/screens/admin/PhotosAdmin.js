import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, RefreshControl,
  StyleSheet, Platform, StatusBar, Animated, Easing, Alert, Dimensions,
  Modal, FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, SPACE, RADIUS, fixMediaUrl, TOP, BOTTOM } from '../../theme';
import { apiFetch } from '../../api';
import { PulsingDot } from '../../components';

const { width: W } = Dimensions.get('window');
const PAD = SPACE.xl;
const COLS = 3;
const THUMB = (W - PAD * 2 - SPACE.sm * (COLS - 1)) / COLS;

export default function PhotosAdmin({ onBack }) {
  const [cfg, setCfg] = useState({ upload_open: false, auto_approve: false });
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0, wall_count: 0, sessions: [] });
  const [photos, setPhotos] = useState([]);
  const [tab, setTab] = useState('pending');
  const [sessionFilter, setSessionFilter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [lightbox, setLightbox] = useState(null);

  const fetchStats = useCallback(async () => {
    try {
      const [sRes, stRes] = await Promise.all([
        apiFetch('/photos/admin/settings/'),
        apiFetch('/photos/admin/stats/'),
      ]);
      if (sRes.ok) setCfg(await sRes.json());
      if (stRes.ok) setStats(await stRes.json());
    } catch (e) {}
  }, []);

  const fetchQueue = useCallback(async () => {
    try {
      let url = `/photos/admin/queue/?status=${tab}`;
      if (sessionFilter === 'wall') url += '&session=wall';
      else if (sessionFilter) url += `&session=${sessionFilter}`;
      const res = await apiFetch(url);
      if (res.ok) {
        const data = await res.json();
        setPhotos(data.photos || []);
      }
    } catch (e) {}
  }, [tab, sessionFilter]);

  const fetchAll = useCallback(async () => {
    await Promise.all([fetchStats(), fetchQueue()]);
    setLoading(false);
    setRefreshing(false);
  }, [fetchStats, fetchQueue]);

  useEffect(() => { setLoading(true); fetchAll(); }, [fetchAll]);
  useEffect(() => { setSelected(new Set()); }, [tab, sessionFilter]);

  const toggleSetting = async (key) => {
    try {
      const res = await apiFetch('/photos/admin/settings/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: !cfg[key] }),
      });
      if (res.ok) { setCfg(await res.json()); fetchStats(); }
    } catch (e) {}
  };

  const reviewPhoto = async (id, action, reason = '') => {
    try {
      const res = await apiFetch(`/photos/admin/${id}/review/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason }),
      });
      if (res.ok) {
        setPhotos(prev => prev.filter(p => p.id !== id));
        setSelected(prev => { const s = new Set(prev); s.delete(id); return s; });
        fetchStats();
      }
    } catch (e) {}
  };

  const deletePhoto = async (id) => {
    try {
      await apiFetch(`/photos/admin/${id}/delete/`, { method: 'DELETE' });
      setPhotos(prev => prev.filter(p => p.id !== id));
      setSelected(prev => { const s = new Set(prev); s.delete(id); return s; });
      fetchStats();
    } catch (e) {}
  };

  const batchAction = (action) => {
    if (selected.size === 0) return;
    const label = action === 'approve' ? 'Approve' : action === 'reject' ? 'Reject' : 'Delete';
    Alert.alert(`${label} ${selected.size} photos?`, `This will ${label.toLowerCase()} all selected photos.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: label, style: action === 'delete' ? 'destructive' : 'default', onPress: async () => {
        const ids = Array.from(selected);
        for (const id of ids) {
          if (action === 'delete') await deletePhoto(id);
          else await reviewPhoto(id, action);
        }
      }},
    ]);
  };

  const toggleSelect = (id) => {
    setSelected(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  const selectAll = () => {
    if (selected.size === photos.length) setSelected(new Set());
    else setSelected(new Set(photos.map(p => p.id)));
  };

  const sessionsList = stats.sessions || [];
  const isSelecting = selected.size > 0;

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />

      <LinearGradient colors={[COLORS.brandDeep, COLORS.brand]} style={s.header}>
        <View style={s.blob1} />
        <View style={s.topbar}>
          <TouchableOpacity onPress={onBack} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Photo Moderation</Text>
          <View style={{ width: 42 }} />
        </View>

        {/* Stats */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: PAD, gap: SPACE.sm, paddingBottom: SPACE.sm }}>
          {[
            { label: 'Total', value: stats.total, color: '#fff' },
            { label: 'Pending', value: stats.pending, color: '#fbbf24' },
            { label: 'Approved', value: stats.approved, color: '#34d399' },
            { label: 'Rejected', value: stats.rejected, color: '#f87171' },
          ].map(st => (
            <View key={st.label} style={s.statPill}>
              <Text style={[s.statValue, { color: st.color }]}>{st.value}</Text>
              <Text style={s.statLabel}>{st.label}</Text>
            </View>
          ))}
        </ScrollView>

        {/* Toggles */}
        <View style={s.toggleRow}>
          <TouchableOpacity style={[s.toggle, cfg.upload_open ? s.toggleGreen : s.toggleRed]}
            onPress={() => toggleSetting('upload_open')} activeOpacity={0.85}>
            <Ionicons name={cfg.upload_open ? 'lock-open' : 'lock-closed'} size={16} color="#fff" />
            <Text style={s.toggleText}>{cfg.upload_open ? 'Open' : 'Closed'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.toggle, cfg.auto_approve ? s.toggleAmber : s.toggleDim]}
            onPress={() => toggleSetting('auto_approve')} activeOpacity={0.85}>
            <Ionicons name="flash" size={16} color="#fff" />
            <Text style={s.toggleText}>Auto: {cfg.auto_approve ? 'ON' : 'OFF'}</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={s.tabRow}>
          {[
            { key: 'pending', label: 'Pending', count: stats.pending },
            { key: 'approved', label: 'Approved', count: stats.approved },
            { key: 'rejected', label: 'Rejected', count: stats.rejected },
          ].map(t => (
            <TouchableOpacity key={t.key} style={[s.tabBtn, tab === t.key && s.tabBtnOn]}
              onPress={() => setTab(t.key)} activeOpacity={0.85}>
              <Text style={[s.tabText, tab === t.key && s.tabTextOn]}>{t.label}</Text>
              {t.count > 0 && (
                <View style={[s.tabCount, tab === t.key && s.tabCountOn]}>
                  <Text style={[s.tabCountText, tab === t.key && s.tabCountTextOn]}>{t.count}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      {/* Session filter */}
      {sessionsList.length > 0 && (
        <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: 'rgba(148,163,184,0.15)' }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: PAD, gap: SPACE.sm, paddingVertical: SPACE.sm }}>
            <TouchableOpacity style={[sf.chip, !sessionFilter && sf.chipOn]} onPress={() => setSessionFilter(null)}>
              <Text style={[sf.chipText, !sessionFilter && sf.chipTextOn]}>All</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[sf.chip, sessionFilter === 'wall' && sf.chipOn]} onPress={() => setSessionFilter('wall')}>
              <Text style={[sf.chipText, sessionFilter === 'wall' && sf.chipTextOn]}>General Wall</Text>
            </TouchableOpacity>
            {sessionsList.map(sess => (
              <TouchableOpacity key={sess.id} style={[sf.chip, sessionFilter === sess.id && sf.chipOn]}
                onPress={() => setSessionFilter(sess.id)}>
                <Text style={[sf.chipText, sessionFilter === sess.id && sf.chipTextOn]} numberOfLines={1}>
                  D{sess.day}: {sess.title}
                </Text>
                {sess.pending_photos > 0 && (
                  <View style={sf.badge}><Text style={sf.badgeText}>{sess.pending_photos}</Text></View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Batch action bar */}
      {isSelecting && (
        <View style={s.batchBar}>
          <Text style={s.batchText}>{selected.size} selected</Text>
          <View style={s.batchActions}>
            <TouchableOpacity style={s.batchSelectAll} onPress={selectAll}>
              <Text style={s.batchSelectAllText}>{selected.size === photos.length ? 'Deselect' : 'Select All'}</Text>
            </TouchableOpacity>
            {(tab === 'pending' || tab === 'rejected') && (
              <TouchableOpacity style={[s.batchBtn, { backgroundColor: COLORS.success }]} onPress={() => batchAction('approve')}>
                <Ionicons name="checkmark" size={16} color="#fff" />
                <Text style={s.batchBtnText}>Approve</Text>
              </TouchableOpacity>
            )}
            {(tab === 'pending' || tab === 'approved') && (
              <TouchableOpacity style={[s.batchBtn, { backgroundColor: COLORS.error }]} onPress={() => batchAction('reject')}>
                <Ionicons name="close" size={16} color="#fff" />
                <Text style={s.batchBtnText}>Reject</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[s.batchBtn, { backgroundColor: '#64748b' }]} onPress={() => batchAction('delete')}>
              <Ionicons name="trash" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Photo grid */}
      {loading ? (
        <View style={s.emptyWrap}><PulsingDot color={COLORS.brand} size={11} /><Text style={s.emptyText}>Loading…</Text></View>
      ) : photos.length === 0 ? (
        <View style={s.emptyWrap}>
          <View style={s.emptyIcon}><Ionicons name="images-outline" size={34} color={COLORS.textTer} /></View>
          <Text style={s.emptyTitle}>No {tab} photos</Text>
        </View>
      ) : (
        <FlatList
          data={photos}
          keyExtractor={item => String(item.id)}
          numColumns={COLS}
          columnWrapperStyle={{ gap: SPACE.sm }}
          contentContainerStyle={{ padding: PAD, gap: SPACE.sm, paddingBottom: (isSelecting ? 100 : 40) + BOTTOM }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll(); }} tintColor={COLORS.brand} />}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <AdminThumb
              photo={item}
              isSelected={selected.has(item.id)}
              onTap={() => setLightbox(item)}
              onLongPress={() => toggleSelect(item.id)}
              onSelect={() => toggleSelect(item.id)}
              isSelecting={isSelecting}
            />
          )}
        />
      )}

      {/* Lightbox */}
      {lightbox && (
        <AdminLightbox
          photo={lightbox}
          tab={tab}
          onClose={() => setLightbox(null)}
          onApprove={() => { reviewPhoto(lightbox.id, 'approve'); setLightbox(null); }}
          onReject={() => { reviewPhoto(lightbox.id, 'reject'); setLightbox(null); }}
          onDelete={() => {
            Alert.alert('Delete?', 'Delete permanently?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => { deletePhoto(lightbox.id); setLightbox(null); } },
            ]);
          }}
        />
      )}
    </View>
  );
}

/* ── Grid Thumbnail ──────────────────────────────────────────── */
function AdminThumb({ photo, isSelected, onTap, onLongPress, onSelect, isSelecting }) {
  const statusColor = { pending: '#f59e0b', approved: '#10b981', rejected: '#ef4444' };

  return (
    <TouchableOpacity
      style={[th.wrap, isSelected && th.wrapSelected]}
      onPress={isSelecting ? onSelect : onTap}
      onLongPress={onLongPress}
      activeOpacity={0.88}
    >
      <Image source={{ uri: fixMediaUrl(photo.image_url) }} style={th.img} resizeMode="cover" />
      <View style={[th.statusDot, { backgroundColor: statusColor[photo.status] || '#94a3b8' }]} />
      {!!photo.session_title && (
        <View style={th.sessionDot}><Ionicons name="calendar" size={8} color="#fff" /></View>
      )}
      {isSelected && (
        <View style={th.checkOverlay}>
          <View style={th.checkCircle}><Ionicons name="checkmark" size={16} color="#fff" /></View>
        </View>
      )}
      {isSelecting && !isSelected && <View style={th.dimOverlay} />}
    </TouchableOpacity>
  );
}

/* ── Lightbox ────────────────────────────────────────────────── */
function AdminLightbox({ photo, tab, onClose, onApprove, onReject, onDelete }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, tension: 55, friction: 8, useNativeDriver: true }).start();
  }, []);
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });

  return (
    <Modal visible transparent animationType="fade" presentationStyle="overFullScreen" onRequestClose={onClose}>
      <View style={lx.overlay}>
        <TouchableOpacity style={lx.dismiss} onPress={onClose} activeOpacity={1} />

        <Animated.View style={[lx.card, { transform: [{ scale }] }]}>
          <Image source={{ uri: fixMediaUrl(photo.image_url) }} style={lx.img} resizeMode="contain" />

          <TouchableOpacity style={lx.closeBtn} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>

          <View style={lx.meta}>
            <Text style={lx.uploader}>{photo.uploader}</Text>
            {!!photo.caption && <Text style={lx.caption}>{photo.caption}</Text>}
            {!!photo.session_title && (
              <View style={lx.sessionPill}>
                <Ionicons name="calendar-outline" size={11} color={COLORS.brand} />
                <Text style={lx.sessionText}>{photo.session_title}</Text>
              </View>
            )}
            <Text style={lx.time}>{new Date(photo.created_at).toLocaleString()}</Text>
          </View>

          <View style={lx.actions}>
            {(tab === 'pending' || tab === 'rejected') && (
              <TouchableOpacity style={[lx.actionBtn, { backgroundColor: COLORS.success }]} onPress={onApprove}>
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={lx.actionText}>Approve</Text>
              </TouchableOpacity>
            )}
            {(tab === 'pending' || tab === 'approved') && (
              <TouchableOpacity style={[lx.actionBtn, { backgroundColor: COLORS.error }]} onPress={onReject}>
                <Ionicons name="close" size={20} color="#fff" />
                <Text style={lx.actionText}>Reject</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[lx.actionBtn, { backgroundColor: '#475569' }]} onPress={onDelete}>
              <Ionicons name="trash" size={18} color="#fff" />
              <Text style={lx.actionText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const th = StyleSheet.create({
  wrap: {
    width: THUMB, height: THUMB, borderRadius: 14, overflow: 'hidden',
    backgroundColor: '#e2e8f0',
  },
  wrapSelected: { borderWidth: 3, borderColor: COLORS.brand, borderRadius: 16 },
  img: { width: '100%', height: '100%' },
  statusDot: { position: 'absolute', top: 6, left: 6, width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: '#fff' },
  sessionDot: { position: 'absolute', bottom: 5, right: 5, width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.brand, alignItems: 'center', justifyContent: 'center' },
  checkOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(3,51,182,0.25)', alignItems: 'center', justifyContent: 'center' },
  checkCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.brand, alignItems: 'center', justifyContent: 'center' },
  dimOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.15)' },
});

const lx = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  dismiss: { ...StyleSheet.absoluteFillObject },
  card: { width: W - 28, borderRadius: 24, overflow: 'hidden', backgroundColor: '#0f172a' },
  img: { width: '100%', height: W - 28, backgroundColor: '#1e293b' },
  closeBtn: { position: 'absolute', top: 12, right: 12, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  meta: { padding: SPACE.lg },
  uploader: { fontSize: FONT.md, fontWeight: FONT.w8, color: '#e2e8f0', marginBottom: 4 },
  caption: { fontSize: FONT.sm, color: '#94a3b8', lineHeight: 20, marginBottom: SPACE.xs },
  sessionPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(3,51,182,0.2)', alignSelf: 'flex-start', paddingHorizontal: SPACE.sm, paddingVertical: 5, borderRadius: RADIUS.full, marginBottom: SPACE.xs },
  sessionText: { fontSize: 11, fontWeight: FONT.w7, color: '#93c5fd' },
  time: { fontSize: 10, color: '#64748b', marginTop: SPACE.xs },
  actions: { flexDirection: 'row', gap: SPACE.sm, padding: SPACE.lg, paddingTop: 0 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: SPACE.md, borderRadius: 14 },
  actionText: { fontSize: FONT.sm, fontWeight: FONT.w8, color: '#fff' },
});

const sf = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, borderRadius: RADIUS.full, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: 'rgba(148,163,184,0.2)', maxWidth: 180 },
  chipOn: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  chipText: { fontSize: FONT.xs, fontWeight: FONT.w7, color: COLORS.textSec },
  chipTextOn: { color: '#fff' },
  badge: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { fontSize: 9, fontWeight: FONT.w8, color: '#fff' },
});

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f6fb' },
  header: { paddingTop: TOP + 8, paddingBottom: SPACE.md, overflow: 'hidden' },
  blob1: { position: 'absolute', top: -40, right: -20, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.06)' },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: PAD, marginBottom: SPACE.md },
  backBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FONT.xl, fontWeight: FONT.w8, color: '#fff' },

  statPill: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm, borderRadius: RADIUS.full, minWidth: 70 },
  statValue: { fontSize: FONT.lg, fontWeight: FONT.w9 },
  statLabel: { fontSize: 9, fontWeight: FONT.w7, color: 'rgba(255,255,255,0.55)', letterSpacing: 0.6, marginTop: 2 },

  toggleRow: { flexDirection: 'row', gap: SPACE.sm, paddingHorizontal: PAD, marginBottom: SPACE.md },
  toggle: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.xs, paddingVertical: SPACE.md, borderRadius: RADIUS.full },
  toggleGreen: { backgroundColor: 'rgba(16,185,129,0.35)' },
  toggleRed: { backgroundColor: 'rgba(239,68,68,0.3)' },
  toggleAmber: { backgroundColor: 'rgba(245,158,11,0.35)' },
  toggleDim: { backgroundColor: 'rgba(255,255,255,0.08)' },
  toggleText: { fontSize: FONT.xs, fontWeight: FONT.w8, color: '#fff' },

  tabRow: { flexDirection: 'row', gap: SPACE.xs, paddingHorizontal: PAD, marginBottom: SPACE.sm },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.xs, paddingVertical: SPACE.md, borderRadius: RADIUS.full, backgroundColor: 'rgba(255,255,255,0.08)' },
  tabBtnOn: { backgroundColor: 'rgba(255,255,255,0.2)' },
  tabText: { fontSize: FONT.xs, fontWeight: FONT.w7, color: 'rgba(255,255,255,0.6)' },
  tabTextOn: { color: '#fff' },
  tabCount: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabCountOn: { backgroundColor: 'rgba(255,255,255,0.25)' },
  tabCountText: { fontSize: 9, fontWeight: FONT.w8, color: 'rgba(255,255,255,0.5)' },
  tabCountTextOn: { color: '#fff' },

  batchBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.brandDeep, paddingHorizontal: PAD, paddingVertical: SPACE.md,
  },
  batchText: { fontSize: FONT.sm, fontWeight: FONT.w8, color: '#fff' },
  batchActions: { flexDirection: 'row', gap: SPACE.sm, alignItems: 'center' },
  batchSelectAll: { paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, borderRadius: RADIUS.full, backgroundColor: 'rgba(255,255,255,0.12)' },
  batchSelectAllText: { fontSize: FONT.xs, fontWeight: FONT.w7, color: '#fff' },
  batchBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, borderRadius: RADIUS.full },
  batchBtnText: { fontSize: FONT.xs, fontWeight: FONT.w8, color: '#fff' },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACE.md },
  emptyIcon: { width: 70, height: 70, borderRadius: 35, backgroundColor: COLORS.brandLight, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: FONT.lg, fontWeight: FONT.w8, color: COLORS.text },
  emptyText: { fontSize: FONT.sm, color: COLORS.textTer, textAlign: 'center' },
});
