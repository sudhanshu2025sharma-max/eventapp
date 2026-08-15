import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Animated, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, SPACE, RADIUS, API_URL, API_HEADERS } from './theme';
import { apiFetch, setTokens as setApiTokens } from './api';
import HomeTab from './screens/HomeTab';
import ScheduleTab from './screens/ScheduleTab';
import QRScreen from './screens/QRScreen';
import NetworkScreen from './screens/NetworkScreen';
import ProfileTab from './screens/ProfileTab';
import NotificationsScreen from './screens/NotificationsScreen';
import AdminTab from './screens/admin/AdminTab';
import EditProfileScreen from './screens/EditProfileScreen';
import ChangePasswordScreen from './screens/ChangePasswordScreen';
import SponsorsScreen from './screens/SponsorsScreen';
import SpokersScreen from './screens/SpokersScreen';
import ChatListScreen from './screens/ChatListScreen';
import ChatRoomScreen from './screens/ChatRoomScreen';
import ConnectionRequestsScreen from './screens/ConnectionRequestsScreen';
import LeaderboardScreen from './screens/LeaderboardScreen';
import PhotosScreen from './screens/PhotosScreen';
import FeedScreen from './screens/FeedScreen';

const BASE_TABS = [
  { key: 'home',     iconOn: 'home',     iconOff: 'home-outline',     label: 'Home' },
  { key: 'schedule', iconOn: 'calendar', iconOff: 'calendar-outline', label: 'Schedule' },
  { key: 'network',  iconOn: 'people',   iconOff: 'people-outline',   label: 'Network' },
  { key: 'profile',  iconOn: 'person',   iconOff: 'person-outline',   label: 'Profile' },
];
const ADMIN_TAB = { key: 'admin', iconOn: 'shield-checkmark', iconOff: 'shield-checkmark-outline', label: 'Admin' };

function getTabs(role) {
  const isAdmin = role === 'super_admin' || role === 'mgmt_admin';
  if (!isAdmin) return BASE_TABS;
  return BASE_TABS.slice(0, 3).concat(ADMIN_TAB);
}

function BottomTabBar({ active, onTab, tabs, networkBadge }) {
  const scales = useRef(tabs.map(() => new Animated.Value(1))).current;

  const press = (key, i) => {
    Animated.sequence([
      Animated.timing(scales[i], { toValue: 0.82, duration: 80, useNativeDriver: true }),
      Animated.spring(scales[i], { toValue: 1, tension: 200, friction: 8, useNativeDriver: true }),
    ]).start();
    onTab(key);
  };

  return (
    <View style={st.bar}>
      {tabs.map((t, i) => {
        const on = active === t.key;
        return (
          <TouchableOpacity key={t.key} style={st.tabItem} onPress={() => press(t.key, i)} activeOpacity={1}>
            <Animated.View style={{ alignItems: 'center', transform: [{ scale: scales[i] }] }}>
              <View style={[st.iconWrap, on && st.iconWrapOn]}>
                <Ionicons name={on ? t.iconOn : t.iconOff} size={20} color={on ? COLORS.brand : COLORS.textTer} />
                {t.key === 'network' && networkBadge > 0 && (
                  <View style={st.tabBadge}>
                    <Text style={st.tabBadgeText}>{networkBadge > 9 ? '9+' : networkBadge}</Text>
                  </View>
                )}
              </View>
              <Text style={[st.tabLabel, on && st.tabLabelOn]}>{t.label}</Text>
            </Animated.View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function MainApp({
  user: initialUser,
  tokens,
  onLogout,
  setUser: setUserProp,
  refreshUser,
  notificationRoute,
  clearNotificationRoute,
}) {
  const [tab, setTab] = useState('home');
  const [subScreen, setSubScreen] = useState(null);
  const [subParams, setSubParams] = useState({});
  const [user, setUser] = useState(initialUser);
  const tokensRef = useRef(tokens);
  useEffect(() => { tokensRef.current = tokens; }, [tokens]);
  const [warningVisible, setWarningVisible] = useState(false);
  const [warningText, setWarningText] = useState('');
  const [pendingRequests, setPendingRequests] = useState(0);
  const [chatUnread, setChatUnread] = useState(0);

  const tabs = getTabs(user.role);

  useEffect(() => {
    if (tokens) setApiTokens(tokens);
  }, [tokens]);

  useEffect(() => {
    if (refreshUser) refreshUser(tokens);
  }, []);

  useEffect(() => {
    if (user.warning_note) {
      setWarningText(user.warning_note);
      setWarningVisible(true);
    }
  }, [user.warning_note]);

  const fetchBadges = useCallback(async () => {
    const t = tokensRef.current;
    if (!t?.access) return;
    try {
      const auth = { ...API_HEADERS, Authorization: `Bearer ${t.access}` };
      const [reqRes, convRes] = await Promise.all([
        fetch(`${API_URL}/chat/requests/count/`, { headers: auth }),
        fetch(`${API_URL}/chat/conversations/`, { headers: auth }),
      ]);
      if (reqRes.status === 401 || convRes.status === 401) {
        const refreshed = await apiFetch('/auth/me/');
        return;
      }
      const reqData = await reqRes.json();
      const convData = await convRes.json();
      setPendingRequests(reqData.pending_count || 0);
      setChatUnread(convData.total_unread || 0);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    const d = setTimeout(fetchBadges, 500);
    const t = setInterval(fetchBadges, 30000);
    return () => { clearTimeout(d); clearInterval(t); };
  }, [fetchBadges]);

  const handleProfileUpdated = (updatedUser) => {
    setUser(updatedUser);
    if (setUserProp) setUserProp(updatedUser);
  };

  const openSubScreen = (name, params = {}) => {
    setSubParams(params);
    setSubScreen(name);
  };

  const closeSubScreen = () => {
    setSubScreen(null);
    setSubParams({});
    fetchBadges();
  };

  const openChat = (conversationId) => openSubScreen('chat_room', { conversationId });

  useEffect(() => {
    if (!notificationRoute) return;

    if (notificationRoute.type === 'chat_room' && notificationRoute.conversationId) {
      setSubParams({ conversationId: notificationRoute.conversationId });
      setSubScreen('chat_room');
      if (clearNotificationRoute) clearNotificationRoute();
      return;
    }

    if (notificationRoute.type === 'connection_requests') {
      setSubParams({});
      setSubScreen('connection_requests');
      if (clearNotificationRoute) clearNotificationRoute();
      return;
    }

    if (notificationRoute.type === 'schedule') {
      setTab('schedule');
      setSubScreen(null);
      if (clearNotificationRoute) clearNotificationRoute();
      return;
    }

    if (notificationRoute.type === 'qr') {
      setTab('qr');
      setSubScreen(null);
      if (clearNotificationRoute) clearNotificationRoute();
      return;
    }

    if (notificationRoute.type === 'notifications') {
      setSubParams({});
      setSubScreen('notifications');
      if (clearNotificationRoute) clearNotificationRoute();
      return;
    }

    if (notificationRoute.type === 'feed') {
      setTab('feed');
      setSubScreen(null);
      if (clearNotificationRoute) clearNotificationRoute();
      return;
    }
  }, [notificationRoute]);

  if (subScreen === 'notifications') {
    return <NotificationsScreen tokens={tokens} onBack={closeSubScreen} />;
  }
  if (subScreen === 'edit_profile') {
    return (
      <EditProfileScreen
        user={user}
        tokens={tokens}
        onBack={closeSubScreen}
        onProfileUpdated={handleProfileUpdated}
      />
    );
  }
  if (subScreen === 'change_password') {
    return (
      <ChangePasswordScreen
        user={user}
        tokens={tokens}
        onDone={closeSubScreen}
        onLogout={onLogout}
      />
    );
  }
  if (subScreen === 'sponsors') {
    return <SponsorsScreen tokens={tokens} onBack={closeSubScreen} />;
  }
  if (subScreen === 'speakers') {
    return <SpokersScreen tokens={tokens} onBack={closeSubScreen} />;
  }
  if (subScreen === 'chat_list') {
    return (
      <ChatListScreen
        tokens={tokens}
        onBack={closeSubScreen}
        onOpenChat={(convId) => openSubScreen('chat_room', { conversationId: convId })}
        onOpenRequests={() => openSubScreen('connection_requests')}
        pendingCount={pendingRequests}
      />
    );
  }
  if (subScreen === 'chat_room') {
    return (
      <ChatRoomScreen
        tokens={tokens}
        conversationId={subParams.conversationId}
        onBack={closeSubScreen}
      />
    );
  }
  if (subScreen === 'connection_requests') {
    return (
      <ConnectionRequestsScreen
        tokens={tokens}
        onBack={closeSubScreen}
        onOpenChat={(convId) => openSubScreen('chat_room', { conversationId: convId })}
      />
    );
  }
  if (subScreen === 'leaderboard') {
    return <LeaderboardScreen onBack={() => setSubScreen(null)} />;
  }
  if (subScreen === 'photos') {
    return <PhotosScreen onBack={() => setSubScreen(null)} />;
  }


  const SCREENS = {
    home: (
      <HomeTab
        user={user}
        tokens={tokens}
        onOpenNotifications={() => openSubScreen('notifications')}
        onOpenSponsors={() => openSubScreen('sponsors')}
        onOpenSpeakers={() => openSubScreen('speakers')}
        onOpenChats={() => openSubScreen('chat_list')}
        onOpenQR={() => setTab('qr')}
        onOpenSchedule={() => setTab('schedule')}
        onOpenLeaderboard={() => openSubScreen('leaderboard')}
        onOpenPhotos={() => openSubScreen('photos')}
        onOpenFeed={() => setTab('feed')}
        onOpenProfile={() => setTab('profile')}
        chatBadge={pendingRequests + chatUnread}
      />
    ),
    schedule: <ScheduleTab tokens={tokens} />,
    qr: <QRScreen user={user} tokens={tokens} />,
    network: (
      <NetworkScreen
        tokens={tokens}
        user={user}
        pendingCount={pendingRequests}
        onOpenRequests={() => openSubScreen('connection_requests')}
        onOpenChat={openChat}
      />
    ),
    profile: (
      <ProfileTab
        user={user}
        tokens={tokens}
        onLogout={onLogout}
        onEditProfile={() => openSubScreen('edit_profile')}
        onChangePassword={() => openSubScreen('change_password')}
        onOpenNotifications={() => openSubScreen('notifications')}
        onOpenChats={() => openSubScreen('chat_list')}
      />
    ),
    admin: <AdminTab user={user} tokens={tokens} onLogout={onLogout} />,
    feed: <FeedScreen onBack={() => setTab('home')} />,
  };

  return (
    <View style={{ flex: 1 }}>
      {SCREENS[tab] || SCREENS.home}

      <Modal visible={warningVisible} transparent animationType="fade" onRequestClose={() => setWarningVisible(false)}>
        <View style={wm.overlay}>
          <View style={wm.card}>
            <View style={wm.iconWrap}>
              <Ionicons name="warning" size={32} color="#f59e0b" />
            </View>
            <Text style={wm.title}>Warning from Admin</Text>
            <Text style={wm.body}>{warningText}</Text>
            <Text style={wm.hint}>Please review your conduct at the conference.</Text>
            <TouchableOpacity style={wm.btn} onPress={() => setWarningVisible(false)} activeOpacity={0.8}>
              <Text style={wm.btnTxt}>I Understand</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <BottomTabBar active={tab} onTab={setTab} tabs={tabs} networkBadge={pendingRequests} />
    </View>
  );
}

const wm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: 24, padding: 28, width: '100%', maxWidth: 360, alignItems: 'center' },
  iconWrap: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#fef3c7', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '900', color: '#0F172A', marginBottom: 12, textAlign: 'center' },
  body: { fontSize: 15, color: '#475569', lineHeight: 22, textAlign: 'center', marginBottom: 12 },
  hint: { fontSize: 12, color: '#94a3b8', textAlign: 'center', marginBottom: 20 },
  btn: { backgroundColor: '#f59e0b', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, width: '100%', alignItems: 'center' },
  btnTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

const st = StyleSheet.create({
  bar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.borderLight, paddingBottom: Platform.OS === 'ios' ? 24 : 28, paddingTop: SPACE.sm, paddingHorizontal: SPACE.sm },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  iconWrap: { width: 36, height: 28, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  iconWrapOn: { backgroundColor: COLORS.brandLight },
  tabLabel: { fontSize: 10, fontWeight: FONT.w5, color: COLORS.textTer, marginTop: 3 },
  tabLabelOn: { color: COLORS.brand, fontWeight: FONT.w7 },
  tabBadge: {
    position: 'absolute', top: -4, right: -4,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: COLORS.error,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 2, borderWidth: 2, borderColor: COLORS.surface,
  },
  tabBadgeText: { fontSize: 8, fontWeight: FONT.w8, color: '#fff' },
});
