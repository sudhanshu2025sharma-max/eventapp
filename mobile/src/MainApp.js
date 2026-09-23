import StaffGroupChatScreen from './screens/StaffGroupChatScreen';
import StaffScreen from './screens/StaffScreen';
import StaffDetailScreen from './screens/StaffDetailScreen';
import VoiceCallScreen from './screens/VoiceCallScreen';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, Pressable, StyleSheet, Platform, Animated, Modal, BackHandler, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS, FONT, SPACE, RADIUS, SHADOW, API_URL, API_HEADERS } from './theme';
import { apiFetch, setTokens as setApiTokens } from './api';

// Screen Imports
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
import AcceptedPapersScreen from './screens/AcceptedPapersScreen';
import FeedScreen from './screens/FeedScreen';
import PollsScreen from './screens/PollsScreen';
import RecapScreen from './screens/RecapScreen';
import IdeathonScreen from './screens/IdeathonScreen';
import ShakeConnectScreen from './screens/ShakeConnectScreen';
import CheckpointScreen from './screens/CheckpointScreen';

const BASE_TABS = [
  { key: 'home',     iconOn: 'home',        iconOff: 'home-outline',        label: 'Home' },
  { key: 'schedule', iconOn: 'calendar',    iconOff: 'calendar-outline',    label: 'Schedule' },
  { key: 'feed',     iconOn: 'newspaper',   iconOff: 'newspaper-outline',   label: 'Feed',    accent: true },
  { key: 'network',  iconOn: 'people',      iconOff: 'people-outline',      label: 'Network' },
  { key: 'profile',  iconOn: 'person',      iconOff: 'person-outline',      label: 'Profile' },
];

const ADMIN_TAB = { key: 'admin', iconOn: 'shield-checkmark', iconOff: 'shield-checkmark-outline', label: 'Admin' };

function getTabs(role) {
  const isAdmin = role === 'super_admin' || role === 'mgmt_admin' || role === 'team_head' || role === 'staff';
  if (!isAdmin) return BASE_TABS;
  return BASE_TABS.slice(0, 4).concat(ADMIN_TAB);
}

function AnimatedTabButton({ tab, isActive, badge, onTab }) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 0.85, friction: 5, tension: 300, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 3, duration: 100, useNativeDriver: true })
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 3, tension: 200, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, friction: 4, tension: 200, useNativeDriver: true })
    ]).start();
  };

  return (
    <Pressable
      style={st.tabItem}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onTab(tab.key);
      }}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[st.tabInner, { transform: [{ scale }, { translateY }] }]}>
        <View style={[st.iconBox, isActive && st.iconBoxActive]}>
          <Ionicons
            name={isActive ? tab.iconOn : tab.iconOff}
            size={22}
            color={isActive ? COLORS.primary : COLORS.textSec}
          />
          {badge > 0 && (
            <View style={st.badgeDot}>
              <Text style={st.badgeText}>{badge > 99 ? '99+' : badge}</Text>
            </View>
          )}
        </View>
        <Text style={[st.tabLabel, isActive && st.tabLabelActive]} numberOfLines={1}>
          {tab.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

function AnimatedFAB({ tab, isActive, onTab }) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressTranslate = useRef(new Animated.Value(0)).current;
  const rotateX = useRef(new Animated.Value(0)).current;

  const hoverAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(hoverAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(hoverAnim, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const hoverTranslate = hoverAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -4],
  });

  const glowScale = hoverAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  });

  const rotateXDeg = rotateX.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '12deg'],
  });

  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 0.88, friction: 6, tension: 350, useNativeDriver: true }),
      Animated.timing(pressTranslate, { toValue: 6, duration: 80, useNativeDriver: true }),
      Animated.timing(rotateX, { toValue: 1, duration: 80, useNativeDriver: true })
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 3, tension: 180, useNativeDriver: true }),
      Animated.spring(pressTranslate, { toValue: 0, friction: 3, tension: 180, useNativeDriver: true }),
      Animated.timing(rotateX, { toValue: 0, duration: 150, useNativeDriver: true })
    ]).start();
  };

  return (
    <Pressable 
      style={st.fabWrapper}
      onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); onTab(tab.key); }}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[
        st.fabShadowLayer, 
        { transform: [{ translateY: hoverTranslate }, { scale: glowScale }] }
      ]}>
        <Animated.View style={[
          st.fabButton,
          { transform: [{ perspective: 800 }, { translateY: pressTranslate }, { scale }, { rotateX: rotateXDeg }] }
        ]}>
          <Ionicons name={isActive ? tab.iconOn : tab.iconOff} size={26} color={COLORS.surface} />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

function BottomTabBar({ active, onTab, tabs, networkBadge }) {
  return (
    <View style={st.barWrapper} pointerEvents="box-none">
      <View style={st.barContainer}>
        {tabs.map((t) => {
          if (t.accent) {
            return <AnimatedFAB key={t.key} tab={t} isActive={active === t.key} onTab={onTab} />;
          }
          return (
            <AnimatedTabButton 
              key={t.key} 
              tab={t} 
              isActive={active === t.key} 
              badge={t.key === 'network' ? networkBadge : 0} 
              onTab={onTab} 
            />
          );
        })}
      </View>
    </View>
  );
}

function WarningModal({ visible, text, onAcknowledge, loading }) {
  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={() => {}}>
      <View style={wm.overlay}>
        <View style={wm.card}>
          <View style={wm.iconWrap}>
            <Ionicons name="warning" size={38} color="#f59e0b" />
          </View>
          <Text style={wm.title}>Notice from Organizers</Text>
          <Text style={wm.body}>{text || 'Please adhere to event guidelines.'}</Text>
          <Text style={wm.hint}>Please acknowledge this notice to continue using the app.</Text>
          <TouchableOpacity 
            style={[wm.btn, loading && { opacity: 0.7 }]} 
            disabled={loading}
            onPress={() => {
              try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (_) {}
              onAcknowledge?.();
            }}
            activeOpacity={0.8}
          >
            <Text style={wm.btnTxt}>{loading ? 'Acknowledging...' : 'I Understand'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [subParams, setSubParams] = useState({});
  const [user, setUser] = useState(initialUser);
  const [activeCall, setActiveCall] = useState(null);

  useEffect(() => {
    if (initialUser) {
      setUser(initialUser);
    }
  }, [initialUser]);
  const tokensRef = useRef(tokens);
  const callWsRef = useRef(null);
  
  useEffect(() => { tokensRef.current = tokens; }, [tokens]);
  
  const [warningVisible, setWarningVisible] = useState(false);
  const [warningText, setWarningText] = useState('');
  const [pendingRequests, setPendingRequests] = useState(0);
  const [chatUnread, setChatUnread] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [ackLoading, setAckLoading] = useState(false);

  const isOrganizer = ['super_admin', 'mgmt_admin', 'team_head', 'staff'].includes(user?.role);
  const tabs = getTabs(user.role);

  useEffect(() => { if (tokens) setApiTokens(tokens); }, [tokens]);
  useEffect(() => { if (refreshUser) refreshUser(tokens); }, []);

  useEffect(() => {
    if (user?.warning_note && !user?.warning_acknowledged) {
      setWarningText(user.warning_note);
      setWarningVisible(true);
    } else {
      setWarningVisible(false);
    }
  }, [user?.warning_note, user?.warning_acknowledged]);

  const handleAcknowledgeWarning = async () => {
    try {
      setAckLoading(true);
      const res = await apiFetch('/auth/warning/acknowledge/', {
        method: 'POST',
        body: JSON.stringify({ response: 'I Understand' }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        setUser(data.user);
        if (setUserProp) setUserProp(data.user);
      }
      setWarningVisible(false);
    } catch (err) {
      console.warn('[Warning Ack Error]', err);
      setWarningVisible(false);
    } finally {
      setAckLoading(false);
    }
  };

  useEffect(() => {
    if (!tokens?.access || !isOrganizer) return;

    let ws = null;
    let reconnectTimeout = null;

    function connectCallSocket() {
      try {
        ws = new WebSocket(`${API_ROOT.replace('https://', 'wss://').replace('http://', 'ws://')}/ws/call/?token=${tokens.access}`);
        callWsRef.current = ws;

        ws.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.type === 'incoming_call') {
              try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } catch (_) {}
              setActiveCall({
                mode: 'incoming',
                targetUser: data.caller,
                incomingSessionId: data.session_id,
              });
            }
          } catch (err) {
            console.warn('[Call Listen Error]', err);
          }
        };

        ws.onclose = () => {
          reconnectTimeout = setTimeout(connectCallSocket, 5000);
        };
      } catch (err) {
        console.warn('[Call WS Conn Error]', err);
      }
    }

    connectCallSocket();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) ws.close();
    };
  }, [tokens?.access, isOrganizer]);

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
        await apiFetch('/auth/me/'); 
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

  useEffect(() => {
    const s = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const h = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { s.remove(); h.remove(); };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (activeCall) return true;
      if (keyboardVisible) {
        Keyboard.dismiss();
        return true;
      }
      if (subScreen === 'staff_detail' || subScreen === 'staff_group_chat') {
        setSubScreen('staff_team');
        return true;
      }
      if (subScreen) {
        closeSubScreen();
        return true;
      }
      if (tab !== 'home') {
        setTab('home');
        return true;
      }
      return false;
    });
    return () => handler.remove();
  }, [keyboardVisible, subScreen, tab, activeCall]);

  const openSubScreen = (name, params = {}) => {
    setSubParams(params);
    setSubScreen(name);
  };

  const closeSubScreen = () => {
    setSubScreen(null);
    setSubParams({});
  };

  const openChat = (convId) => {
    openSubScreen('chat_room', { conversationId: convId });
  };

  const handleProfileUpdated = (updatedUser) => {
    setUser(updatedUser);
    if (setUserProp) setUserProp(updatedUser);
  };

  useEffect(() => {
    if (!notificationRoute) return;
    const { type, screen, subscreen, conversationId } = notificationRoute;

    if (type === 'chat' && conversationId) {
      openChat(conversationId);
    } else if (type === 'chat_request') {
      openSubScreen('connection_requests');
    } else if (type === 'announcement' || type === 'notification') {
      openSubScreen('notifications');
    } else if (type === 'schedule') { setTab('schedule'); setSubScreen(null); }
    else if (type === 'qr') { setTab('qr'); setSubScreen(null); }
    else if (type === 'feed') { setTab('feed'); setSubScreen(null); }

    if (clearNotificationRoute) clearNotificationRoute();
  }, [notificationRoute]);

  const renderSubScreenContent = () => {
    if (subScreen === 'notifications') return <NotificationsScreen tokens={tokens} onBack={closeSubScreen} />;
    if (subScreen === 'edit_profile') return <EditProfileScreen user={user} tokens={tokens} onBack={closeSubScreen} onProfileUpdated={handleProfileUpdated} />;
    if (subScreen === 'change_password') return <ChangePasswordScreen user={user} tokens={tokens} onDone={closeSubScreen} onLogout={onLogout} />;
    if (subScreen === 'sponsors') return <SponsorsScreen tokens={tokens} onBack={closeSubScreen} />;
    if (subScreen === 'speakers') return <SpokersScreen tokens={tokens} onBack={closeSubScreen} />;
    if (subScreen === 'chat_list') return <ChatListScreen tokens={tokens} onBack={closeSubScreen} onOpenChat={(convId) => openSubScreen('chat_room', { conversationId: convId })} onOpenRequests={() => openSubScreen('connection_requests')} pendingCount={pendingRequests} />;
    if (subScreen === 'chat_room') return <ChatRoomScreen tokens={tokens} user={user} conversationId={subParams.conversationId} onBack={() => setSubScreen('chat_list')} onDisconnected={() => setSubScreen('chat_list')} />;
    if (subScreen === 'connection_requests') return <ConnectionRequestsScreen tokens={tokens} onBack={closeSubScreen} onOpenChat={(convId) => openSubScreen('chat_room', { conversationId: convId })} />;
    
    if (subScreen === 'staff_team') {
      return (
        <StaffScreen
          onBack={closeSubScreen}
          user={user}
          onOpenStaffDetail={(staff) => {
            setSelectedStaff(staff);
            setSubScreen('staff_detail');
          }}
          onOpenGroupChat={() => {
            setSubScreen('staff_group_chat');
          }}
        />
      );
    }

    if (subScreen === 'staff_group_chat') {
      return (
        <StaffGroupChatScreen
          user={user}
          onBack={() => setSubScreen('staff_team')}
        />
      );
    }

    if (subScreen === 'staff_detail') {
      return (
        <StaffDetailScreen
          staff={selectedStaff}
          currentUser={user}
          onBack={() => setSubScreen('staff_team')}
          onOpenChat={(staffMember) => {
            openSubScreen('chat_list');
          }}
          onInitiateVoiceCall={(target) => {
            setActiveCall({
              mode: 'outgoing',
              targetUser: target,
            });
          }}
        />
      );
    }

    if (subScreen === 'leaderboard') return <LeaderboardScreen onBack={() => setSubScreen(null)} />;
    if (subScreen === 'papers') return <AcceptedPapersScreen onBack={() => setSubScreen(null)} onOpenSchedule={() => { setSubScreen(null); setTab('schedule'); }} initialSearch={subParams.search} />;
    if (subScreen === 'photos') return <PhotosScreen onBack={() => setSubScreen(null)} onOpenCheckpoint={() => openSubScreen('checkpoint')} onOpenStaffTeam={() => openSubScreen('staff_team')} />;
    if (subScreen === 'polls') return <PollsScreen onBack={() => setSubScreen(null)} />;
    if (subScreen === 'shake_connect') return <ShakeConnectScreen tokens={tokens} user={user} onConnected={(convId) => { if (convId) openSubScreen('chat_room', { conversationId: convId }); else closeSubScreen(); }} onBack={() => setSubScreen(null)} />;
    if (subScreen === 'ideathon') return <IdeathonScreen onBack={() => setSubScreen(null)} onOpenPolls={() => setSubScreen('polls')} />;
    if (subScreen === 'recap') return <RecapScreen tokens={tokens} onBack={closeSubScreen} />;
    if (subScreen === 'checkpoint' || subScreen === 'selfie_spots') return <CheckpointScreen tokens={tokens} onBack={closeSubScreen} />;

    return null;
  };

  const SCREENS = {
    home: (
      <HomeTab
        user={user} tokens={tokens}
        onOpenNotifications={() => openSubScreen('notifications')}
        onOpenSponsors={() => openSubScreen('sponsors')}
        onOpenSpeakers={() => openSubScreen('speakers')}
        onOpenChats={() => openSubScreen('chat_list')}
        onOpenRecap={() => openSubScreen('recap')}
        onOpenQR={() => setTab('qr')}
        onOpenSchedule={() => setTab('schedule')}
        onOpenLeaderboard={() => openSubScreen('leaderboard')}
        onOpenPapers={() => openSubScreen('papers')}
        onOpenPhotos={() => openSubScreen('photos')}
        onOpenPolls={() => openSubScreen('polls')}
        onOpenIdeathon={() => openSubScreen('ideathon')}
        onOpenCheckpoint={() => openSubScreen('checkpoint')}
        onOpenStaffTeam={() => openSubScreen('staff_team')}
        onOpenFeed={() => setTab('feed')}
        onOpenProfile={() => setTab('profile')}
        chatBadge={pendingRequests + chatUnread}
      />
    ),
    schedule: <ScheduleTab tokens={tokens} onOpenPaper={(paperId) => openSubScreen('papers', { search: paperId })} />,
    qr: <QRScreen user={user} tokens={tokens} />,
    network: (
      <NetworkScreen
        tokens={tokens} user={user} pendingCount={pendingRequests}
        onOpenRequests={() => openSubScreen('connection_requests')}
        onOpenChat={openChat}
        onEditProfile={() => setSubScreen('edit_profile')}
        onShake={() => openSubScreen('shake_connect')}
        onOpenQR={() => setTab('qr')}
      />
    ),
    profile: (
      <ProfileTab
        user={user} tokens={tokens} onLogout={onLogout}
        onEditProfile={() => openSubScreen('edit_profile')}
        onChangePassword={() => openSubScreen('change_password')}
        onOpenNotifications={() => openSubScreen('notifications')}
        onOpenChats={() => openSubScreen('chat_list')}
        onOpenRecap={() => openSubScreen('recap')}
        onOpenLeaderboard={() => openSubScreen('leaderboard')}
        onOpenSchedule={() => setTab('schedule')}
        onOpenStaffTeam={() => openSubScreen('staff_team')}
        onOpenChatRoom={(convId) => openSubScreen('chat_room', { conversationId: convId })}
      />
    ),
    admin: <AdminTab user={user} tokens={tokens} onLogout={onLogout} />,
    feed: <FeedScreen onBack={() => setTab('home')} />,
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {subScreen ? renderSubScreenContent() : (SCREENS[tab] || SCREENS.home)}

      {activeCall && (
        <Modal visible={true} animationType="slide" hardwareAccelerated>
          <VoiceCallScreen
            callMode={activeCall.mode}
            targetUser={activeCall.targetUser}
            incomingSessionId={activeCall.incomingSessionId}
            tokens={tokens}
            currentUser={user}
            onEndCall={() => setActiveCall(null)}
          />
        </Modal>
      )}

      <WarningModal
        visible={warningVisible}
        text={warningText}
        onAcknowledge={handleAcknowledgeWarning}
        loading={ackLoading}
      />

      {!subScreen && (
        <BottomTabBar active={tab} onTab={setTab} tabs={tabs} networkBadge={pendingRequests} />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  barWrapper: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? SPACE.xxl : SPACE.xl,
    left: SPACE.lg,
    right: SPACE.lg,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99, 
  },
  barContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.95)', 
    borderRadius: RADIUS.full,
    height: 72,
    paddingHorizontal: SPACE.sm,
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    ...SHADOW.xl, 
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    zIndex: 2,
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconBoxActive: {
    backgroundColor: COLORS.primaryLight,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: FONT.w6,
    color: COLORS.textSec,
  },
  tabLabelActive: {
    color: COLORS.primary,
    fontWeight: FONT.w8,
  },
  badgeDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: COLORS.danger,
    borderRadius: RADIUS.full,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.surface,
  },
  badgeText: {
    color: COLORS.surface,
    fontSize: 8,
    fontWeight: FONT.w8,
  },
  fabWrapper: {
    width: 68,
    height: 68,
    top: -24, 
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  fabShadowLayer: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: COLORS.primary,
    ...SHADOW.accent,
  },
  fabButton: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: COLORS.surface,
    ...SHADOW.accent,
  },
});

const wm = StyleSheet.create({
  overlay: { 
    flex: 1, 
    backgroundColor: 'rgba(15, 23, 42, 0.75)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: SPACE.xl 
  },
  card: { 
    backgroundColor: COLORS.surface, 
    borderRadius: RADIUS.xxl, 
    padding: SPACE.xxxl, 
    width: '100%', 
    maxWidth: 350, 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    ...SHADOW.xl
  },
  iconWrap: { 
    width: 72, 
    height: 72, 
    borderRadius: 36, 
    backgroundColor: COLORS.warningLight, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: SPACE.xl,
    borderWidth: 4,
    borderColor: COLORS.surface,
    ...SHADOW.accent
  },
  title: { 
    fontSize: FONT.xxl, 
    fontWeight: FONT.w9, 
    color: COLORS.text, 
    marginBottom: SPACE.sm, 
    textAlign: 'center' 
  },
  body: { 
    fontSize: FONT.md, 
    color: COLORS.brandDeeper, 
    lineHeight: 24, 
    textAlign: 'center', 
    marginBottom: SPACE.lg 
  },
  hint: { 
    fontSize: FONT.sm, 
    color: COLORS.brandDeeper, 
    textAlign: 'center', 
    marginBottom: SPACE.xxl 
  },
  btn: { 
    backgroundColor: COLORS.warning, 
    borderRadius: RADIUS.xl, 
    paddingVertical: SPACE.lg, 
    paddingHorizontal: SPACE.xxxl, 
    width: '100%', 
    alignItems: 'center',
    borderBottomWidth: 4,
    borderBottomColor: COLORS.accentDark,
  },
  btnTxt: { 
    color: COLORS.textInverse, 
    fontWeight: FONT.w8, 
    fontSize: FONT.lg,
    textTransform: 'uppercase',
    letterSpacing: 1
  },
});
