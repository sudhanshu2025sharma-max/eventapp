import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, RefreshControl,
  StyleSheet, Platform, ActivityIndicator, Image, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, SPACE, RADIUS, API_URL, API_HEADERS, TOP, BOTTOM } from '../theme';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function NotificationDetail({ notif, onBack }) {
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
          <Text style={d.title}>{notif.title}</Text>
          <Text style={d.body}>{notif.body}</Text>

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

export default function NotificationsScreen({ tokens, onBack }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selected, setSelected] = useState(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/notifications/my/`, {
        headers: { ...API_HEADERS, Authorization: `Bearer ${tokens.access}` },
      });
      const data = await res.json();
      if (data.notifications) {
        setNotifications(data.notifications);
        setUnreadCount(data.unread_count || 0);
      }
    } catch (err) {
      console.log('notifications fetch failed:', err.message);
    }
    setLoading(false);
    setRefreshing(false);
  }, [tokens]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const markAsReadInBackground = async (notificationId) => {
    try {
      await fetch(`${API_URL}/notifications/mark-read/`, {
        method: 'POST',
        headers: { ...API_HEADERS, Authorization: `Bearer ${tokens.access}` },
        body: JSON.stringify({ notification_ids: [notificationId] }),
      });
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
        n.notification_id === notif.notification_id ? { ...n, read: true } : n
      )
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    // background API call
    markAsReadInBackground(notif.notification_id);
  };

  const markAllRead = async () => {
    try {
      await fetch(`${API_URL}/notifications/mark-all-read/`, {
        method: 'POST',
        headers: { ...API_HEADERS, Authorization: `Bearer ${tokens.access}` },
      });
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
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllRead} style={s.markBtn}>
            <Text style={s.markTxt}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

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
