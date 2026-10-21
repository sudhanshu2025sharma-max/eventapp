import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, RefreshControl,
  StyleSheet, Platform, ActivityIndicator, Image, Linking, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, SPACE, RADIUS, TOP, BOTTOM } from '../theme';
import { apiFetch } from '../api';
import { getScreenSnapshot, setScreenSnapshot } from '../cache';
import { registerForPushNotifications, getPushPermissionState, openNotificationSettings } from '../notifications';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function NotificationDetail({ notif, onBack }) {
  if (!notif) return null;
  return (
    <View style={{ flex: 1, backgroundColor: '#f0f4f9' }}>
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Details</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: SPACE.xl, paddingBottom: 100 + BOTTOM }}
        showsVerticalScrollIndicator={false}
      >
        {notif.cover_image_url ? (
          <Image source={{ uri: notif.cover_image_url }} style={d.cover} resizeMode="cover" />
        ) : null}

        <View style={d.card}>
          <Text style={d.time}>{timeAgo(notif.delivered_at || notif.created_at)}</Text>
          <Text style={d.title}>{notif.title || 'Notification'}</Text>
          <Text style={d.body}>{notif.body || ''}</Text>

          {!!notif.attachments?.length && (
            <View style={d.sec}>
              <View style={d.secHead}>
                <Ionicons name="attach" size={16} color={COLORS.brand} />
                <Text style={d.secTitle}>Attachments ({notif.attachments.length})</Text>
              </View>

              {notif.attachments.map((a) => (
                <TouchableOpacity
                  key={String(a.id)}
                  style={d.fileRow}
                  activeOpacity={0.75}
                  onPress={() => Linking.openURL(a.url)}
                >
                  <View style={d.fileIcon}>
                    <Ionicons name="document-outline" size={18} color={COLORS.brand} />
                  </View>
                  <Text style={d.fileName} numberOfLines={1}>{a.filename}</Text>
                  <Ionicons name="open-outline" size={16} color={COLORS.textTer} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

export default function NotificationsScreen({ userId, onBack }) {
  const [notifications, setNotifications] = useState(() => getScreenSnapshot('notifications', userId)?.notifications || []);
  const [loading, setLoading] = useState(() => !getScreenSnapshot('notifications', userId));
  const [loadError, setLoadError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(() => getScreenSnapshot('notifications', userId)?.unreadCount || 0);
  const [selected, setSelected] = useState(null);
  const [pushBusy, setPushBusy] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoadError('');
      const res = await apiFetch('/notifications/my/', { timeoutMs: 15000 });
      if (!res.ok) throw new Error(`Could not load notifications (HTTP ${res.status}). Pull down to retry.`);
      const data = await res.json();
      if (Array.isArray(data.notifications)) {
        setNotifications(data.notifications);
        setUnreadCount(data.unread_count || 0);
      } else throw new Error('The server returned an invalid notification inbox.');
    } catch (err) {
      setLoadError(err.message || 'Could not load notifications. Please retry.');
    }
    setLoading(false);
    setRefreshing(false);
  }, [userId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (!loading && !loadError) setScreenSnapshot('notifications', userId, { notifications, unreadCount });
  }, [notifications, unreadCount, loading, loadError, userId]);

  const retryPushSetup = async () => {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      const permState = await getPushPermissionState();
      if (permState === 'denied') {
        await openNotificationSettings();
        return;
      }
      const token = await registerForPushNotifications();
      if (token) {
        Alert.alert('Notifications active', 'Token: ' + token.substring(0, 30) + '...');
      } else {
        const { getPushRegistrationError } = require('../notifications');
        const err = getPushRegistrationError();
        Alert.alert('Push Debug', 'Token is null.\nError: ' + (err || 'none') + '\n\nAre you in Expo Go? Push does NOT work in Expo Go. Use the preview APK.');
      }
    } catch (error) {
      Alert.alert('Notifications', 'Could not set up notifications. Please check your device settings.');
    } finally { setPushBusy(false); }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const markAsReadInBackground = async (notificationId) => {
    try {
      const res = await apiFetch('/notifications/mark-read/', {
        method: 'POST',
        timeoutMs: 15000,
        body: JSON.stringify({ notification_ids: [notificationId] }),
      });
      if (!res.ok) throw new Error(`Mark read failed (HTTP ${res.status}).`);
    } catch (err) {
      console.log('mark read failed:', err.message);
    }
  };

  const openNotif = (notif) => {
    // Open immediately — do not wait for network
    setSelected(notif);

    if (notif.read) return;

    // optimistic local update
    setNotifications((prev) =>
      prev.map((n) =>
        (n.notification_id || n.id) === (notif.notification_id || notif.id) ? { ...n, read: true } : n
      )
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    // background API call
    markAsReadInBackground(notif.notification_id || notif.id);
  };

  const markAllRead = async () => {
    try {
      const res = await apiFetch('/notifications/mark-all-read/', {
        method: 'POST',
        timeoutMs: 15000,
      });
      if (!res.ok) throw new Error(`Mark all read failed (HTTP ${res.status}).`);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.log('mark all read failed:', err.message);
    }
  };

  if (selected) {
    return <NotificationDetail notif={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f0f4f9' }}>
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Notifications</Text>
          <Text style={s.sub}>{unreadCount} unread</Text>
        </View>
        <TouchableOpacity onPress={retryPushSetup} disabled={pushBusy} accessibilityLabel="Set up notification alerts" style={s.markBtn}>
          {pushBusy ? <ActivityIndicator color={COLORS.brand} size="small" /> : <Ionicons name="notifications-outline" size={20} color={COLORS.brand} />}
        </TouchableOpacity>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllRead} style={s.markBtn}>
            <Text style={s.markTxt}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {!!loadError && <TouchableOpacity onPress={fetchNotifications} style={{ padding: SPACE.lg }}><Text style={{ color: COLORS.error }}>{loadError} Tap to retry.</Text></TouchableOpacity>}

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.brand} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <Ionicons name="notifications-off-outline" size={48} color={COLORS.textTer} />
          <Text style={{ marginTop: 12, fontWeight: '600', color: COLORS.text }}>No notifications</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: SPACE.xl }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.brand]}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {notifications.map((n) => (
            <TouchableOpacity
              key={n.id}
              activeOpacity={0.82}
              onPress={() => openNotif(n)}
              style={[s.card, !n.read && s.unread]}
            >
              {n.cover_image_url ? (
                <Image source={{ uri: n.cover_image_url }} style={s.thumb} resizeMode="cover" />
              ) : null}

              <View style={s.row}>
                <View style={[s.icon, !n.read && { backgroundColor: COLORS.brandLight }]}>
                  <Ionicons
                    name={n.read ? 'notifications-outline' : 'notifications'}
                    size={18}
                    color={n.read ? COLORS.textTer : COLORS.brand}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <View style={s.titleRow}>
                    <Text style={[s.title, !n.read && s.titleUnread]} numberOfLines={1}>
                      {n.title}
                    </Text>
                    {!n.read && <View style={s.dot} />}
                  </View>

                  <Text style={s.body} numberOfLines={2}>{n.body}</Text>

                  <View style={s.metaRow}>
                    <Text style={s.time}>{timeAgo(n.delivered_at || n.created_at)}</Text>
                    {!!n.attachments?.length && (
                      <View style={s.badge}>
                        <Ionicons name="attach" size={11} color={COLORS.brand} />
                        <Text style={s.badgeTxt}>
                          {n.attachments.length} file{n.attachments.length > 1 ? 's' : ''}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                <Ionicons name="chevron-forward" size={16} color={COLORS.border} />
              </View>
            </TouchableOpacity>
          ))}
          <View style={{ height: 100 + BOTTOM }} />
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: TOP + 8,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: '#f0f4f9',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#fff',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.brand,
    letterSpacing: -0.3,
  },
  sub: {
    fontSize: 11,
    color: COLORS.textTer,
    marginTop: 2,
  },
  markBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fff',
  },
  markTxt: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.brand,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  unread: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.brand,
  },
  thumb: {
    width: '100%',
    height: 120,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f0f4f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSec,
    flex: 1,
    marginRight: 8,
  },
  titleUnread: {
    color: COLORS.text,
    fontWeight: '700',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.brand,
  },
  body: {
    fontSize: 13,
    color: COLORS.textSec,
    lineHeight: 19,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  time: {
    fontSize: 11,
    color: COLORS.textTer,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.brandLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
  },
  badgeTxt: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.brand,
  },
});

const d = StyleSheet.create({
  cover: {
    width: '100%',
    height: 200,
    borderRadius: 20,
    marginBottom: 16,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#fff',
  },
  time: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textTer,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.text,
    marginBottom: 12,
    lineHeight: 28,
  },
  body: {
    fontSize: 15,
    color: COLORS.textSec,
    lineHeight: 24,
  },
  sec: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    paddingTop: 16,
  },
  secHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  secTitle: {
    fontWeight: '700',
    color: COLORS.text,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f0f4f9',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  fileIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
});
