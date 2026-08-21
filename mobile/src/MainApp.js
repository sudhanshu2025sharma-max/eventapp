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
import FeedScreen from './screens/FeedScreen';
import PollsScreen from './screens/PollsScreen';
import RecapScreen from './screens/RecapScreen';
import IdeathonScreen from './screens/IdeathonScreen';
import ShakeConnectScreen from './screens/ShakeConnectScreen';
import SelfieSpotsScreen from './screens/SelfieSpotsScreen';

const BASE_TABS = [
  { key: 'home',     iconOn: 'home',        iconOff: 'home-outline',        label: 'Home' },
  { key: 'schedule', iconOn: 'calendar',    iconOff: 'calendar-outline',    label: 'Schedule' },
  { key: 'feed',     iconOn: 'newspaper',   iconOff: 'newspaper-outline',   label: 'Feed',    accent: true },
  { key: 'network',  iconOn: 'people',      iconOff: 'people-outline',      label: 'Network' },
  { key: 'profile',  iconOn: 'person',      iconOff: 'person-outline',      label: 'Profile' },
];

const ADMIN_TAB = { key: 'admin', iconOn: 'shield-checkmark', iconOff: 'shield-checkmark-outline', label: 'Admin' };

function getTabs(role) {
  const isAdmin = role === 'super_admin' || role === 'mgmt_admin';
  if (!isAdmin) return BASE_TABS;
  return BASE_TABS.slice(0, 4).concat(ADMIN_TAB);
}

// --- FIXED 3D ANIMATED TAB BUTTON ---
function AnimatedTabButton({ tab, isActive, badge, onTab }) {
  const selectAnim = useRef(new Animated.Value(isActive ? 1 : 0)).current;
  const pressAnim = useRef(new Animated.Value(0)).current; 

  useEffect(() => {
    Animated.spring(selectAnim, {
      toValue: isActive ? 1 : 0,
      tension: 250,
      friction: 18,
      useNativeDriver: true,
    }).start();
  }, [isActive]);

  const handlePressIn = () => {
    Animated.spring(pressAnim, { toValue: 1, tension: 300, friction: 12, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressAnim, { toValue: 0, tension: 300, friction: 12, useNativeDriver: true }).start();
  };

  const scale = pressAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.85] });
  const rotateX = pressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '30deg'] }); 
  const iconTranslateY = selectAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  const textOpacity = selectAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const textTranslateY = selectAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });
  const textScale = selectAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  const dotScale = selectAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1.2] });

  return (
    <Pressable 
      style={st.tabItem} 
      onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); onTab(tab.key); }}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[
        st.iconWrap, 
        { transform: [{ perspective: 500 }, { scale }, { rotateX }, { translateY: iconTranslateY }] }
      ]}>
        <Ionicons 
          name={isActive ? tab.iconOn : tab.iconOff} 
          size={24} 
          color={isActive ? COLORS.brand : COLORS.textTer} 
        />
        {badge > 0 && (
          <View style={st.tabBadge}>
            <Text style={st.tabBadgeText}>{badge > 9 ? '9+' : badge}</Text>
          </View>
        )}
      </Animated.View>

      <Animated.View style={[
        st.textWrap,
        { opacity: textOpacity, transform: [{ translateY: textTranslateY }, { scale: textScale }] }
      ]}>
        <Text style={st.tabLabelActive}>{tab.label}</Text>
      </Animated.View>
      
      {isActive && (
        <Animated.View style={[
          st.activeDot,
          { opacity: selectAnim, transform: [{ scale: dotScale }] }
        ]} />
      )}
    </Pressable>
  );
}

// --- DYNAMIC BREATHING FAB ---
function AnimatedFAB({ tab, isActive, onTab }) {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const pressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const handlePressIn = () => {
    Animated.spring(pressAnim, { toValue: 1, tension: 400, friction: 10, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressAnim, { toValue: 0, tension: 300, friction: 15, useNativeDriver: true }).start();
  };

  const hoverTranslate = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  const pressTranslate = pressAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 10] });
  const scale = pressAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.9] });
  const rotateX = pressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '25deg'] });
  const glowScale = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });

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
          { transform: [{ perspective: 800 }, { translateY: pressTranslate }, { scale }, { rotateX }] }
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

// --- ANIMATED WARNING MODAL ---
function WarningModal({ visible, text, onClose }) {
  const [show, setShow] = useState(visible);
  const scale = useRef(new Animated.Value(1.1)).current; 
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setShow(true);
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, friction: 12, tension: 250, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scale, { toValue: 0.9, duration: 200, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => setShow(false));
    }
  }, [visible]);

  if (!show) return null;

  return (
    <Modal transparent animationType="none" visible={show} onRequestClose={onClose}>
      <View style={wm.overlay}>
        <Animated.View style={[wm.card, { opacity, transform: [{ scale }, { perspective: 800 }] }]}>
          <View style={wm.iconWrap}>
            <Ionicons name="warning" size={36} color={COLORS.warning} />
          </View>
          <Text style={wm.title}>Warning from Admin</Text>
          <Text style={wm.body}>{text}</Text>
          <Text style={wm.hint}>Please review your conduct at the conference.</Text>
          <TouchableOpacity style={wm.btn} onPress={onClose} activeOpacity={0.7}>
            <Text style={wm.btnTxt}>I Understand</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

// --- MAIN APP COMPONENT ---
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
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const tabs = getTabs(user.role);

  useEffect(() => { if (tokens) setApiTokens(tokens); }, [tokens]);
  useEffect(() => { if (refreshUser) refreshUser(tokens); }, []);

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

  // Android hardware back button
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (keyboardVisible) {
        Keyboard.dismiss();
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
  }, [keyboardVisible, subScreen, tab]);

  const handleProfileUpdated = (updatedUser) => {
    setUser(updatedUser);
    if (setUserProp) setUserProp(updatedUser);
  };

  const openSubScreen = (name, params = {}) => { setSubParams(params); setSubScreen(name); };
  const closeSubScreen = () => { setSubScreen(null); setSubParams({}); fetchBadges(); };
  const openChat = (conversationId) => openSubScreen('chat_room', { conversationId });

  // Route Handling
  useEffect(() => {
    if (!notificationRoute) return;
    const { type, conversationId } = notificationRoute;

    if (type === 'chat_room' && conversationId) openSubScreen('chat_room', { conversationId });
    else if (type === 'connection_requests') openSubScreen('connection_requests');
    else if (type === 'notifications') openSubScreen('notifications');
    else if (type === 'poll') openSubScreen('polls');
    else if (type === 'ideathon') openSubScreen('ideathon');
    else if (type === 'selfie_spots') openSubScreen('selfie_spots');
    else if (type === 'schedule') { setTab('schedule'); setSubScreen(null); }
    else if (type === 'qr') { setTab('qr'); setSubScreen(null); }
    else if (type === 'feed') { setTab('feed'); setSubScreen(null); }

    if (clearNotificationRoute) clearNotificationRoute();
  }, [notificationRoute]);

  // Sub-screens Routing
  if (subScreen === 'notifications') return <NotificationsScreen tokens={tokens} onBack={closeSubScreen} />;
  if (subScreen === 'edit_profile') return <EditProfileScreen user={user} tokens={tokens} onBack={closeSubScreen} onProfileUpdated={handleProfileUpdated} />;
  if (subScreen === 'change_password') return <ChangePasswordScreen user={user} tokens={tokens} onDone={closeSubScreen} onLogout={onLogout} />;
  if (subScreen === 'sponsors') return <SponsorsScreen tokens={tokens} onBack={closeSubScreen} />;
  if (subScreen === 'speakers') return <SpokersScreen tokens={tokens} onBack={closeSubScreen} />;
  if (subScreen === 'chat_list') return <ChatListScreen tokens={tokens} onBack={closeSubScreen} onOpenChat={(convId) => openSubScreen('chat_room', { conversationId: convId })} onOpenRequests={() => openSubScreen('connection_requests')} pendingCount={pendingRequests} />;
  if (subScreen === 'chat_room') return <ChatRoomScreen tokens={tokens} user={user} conversationId={subParams.conversationId} onBack={() => setSubScreen('chat_list')} onDisconnected={() => setSubScreen('chat_list')} />;
  if (subScreen === 'connection_requests') return <ConnectionRequestsScreen tokens={tokens} onBack={closeSubScreen} onOpenChat={(convId) => openSubScreen('chat_room', { conversationId: convId })} />;
  if (subScreen === 'leaderboard') return <LeaderboardScreen onBack={() => setSubScreen(null)} />;
  if (subScreen === 'photos') return <PhotosScreen onBack={() => setSubScreen(null)} onOpenSelfieSpots={() => openSubScreen('selfie_spots')} />;
  if (subScreen === 'polls') return <PollsScreen onBack={() => setSubScreen(null)} />;
  if (subScreen === 'shake_connect') return <ShakeConnectScreen tokens={tokens} user={user} onConnected={(convId) => { if (convId) openSubScreen('chat_room', { conversationId: convId }); else closeSubScreen(); }} onBack={() => setSubScreen(null)} />;
  if (subScreen === 'ideathon') return <IdeathonScreen onBack={() => setSubScreen(null)} onOpenPolls={() => setSubScreen('polls')} />;
  if (subScreen === 'recap') return <RecapScreen tokens={tokens} onBack={closeSubScreen} />;
  if (subScreen === 'selfie_spots') return <SelfieSpotsScreen tokens={tokens} onBack={closeSubScreen} />;

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
        onOpenPhotos={() => openSubScreen('photos')}
        onOpenPolls={() => openSubScreen('polls')}
        onOpenIdeathon={() => openSubScreen('ideathon')}
        onOpenSelfieSpots={() => openSubScreen('selfie_spots')}
        onOpenFeed={() => setTab('feed')}
        onOpenProfile={() => setTab('profile')}
        chatBadge={pendingRequests + chatUnread}
      />
    ),
    schedule: <ScheduleTab tokens={tokens} />,
    qr: <QRScreen user={user} tokens={tokens} />,
    network: (
      <NetworkScreen
        tokens={tokens} user={user} pendingCount={pendingRequests}
        onOpenRequests={() => openSubScreen('connection_requests')}
        onOpenChat={openChat}
        onEditProfile={() => setSubScreen('edit_profile')}
        onShake={() => openSubScreen('shake_connect')}
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
      />
    ),
    admin: <AdminTab user={user} tokens={tokens} onLogout={onLogout} />,
    feed: <FeedScreen onBack={() => setTab('home')} />,
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {SCREENS[tab] || SCREENS.home}

      <WarningModal visible={warningVisible} text={warningText} onClose={() => setWarningVisible(false)} />

      <BottomTabBar active={tab} onTab={setTab} tabs={tabs} networkBadge={pendingRequests} />
    </View>
  );
}

// --- STYLES ---

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
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    position: 'absolute',
    bottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabelActive: {
    fontSize: FONT.xs,
    fontWeight: FONT.w8,
    color: COLORS.brand,
    letterSpacing: 0.2,
  },
  activeDot: {
    position: 'absolute',
    bottom: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.brand,
    ...SHADOW.brand, 
  },
  tabBadge: {
    position: 'absolute', 
    top: -8, 
    right: -12,
    minWidth: 20, 
    height: 20, 
    borderRadius: 10,
    backgroundColor: COLORS.rose,
    alignItems: 'center', 
    justifyContent: 'center',
    paddingHorizontal: 4, 
    borderWidth: 2, 
    borderColor: COLORS.surface,
    ...SHADOW.sm,
  },
  tabBadgeText: { 
    fontSize: 9, 
    fontWeight: FONT.w9, 
    color: COLORS.textInverse 
  },
  fabWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  fabShadowLayer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'transparent',
    marginTop: -40, 
    ...SHADOW.brand, 
  },
  fabButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: COLORS.brand,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: COLORS.surface,
    borderBottomWidth: 5, 
    borderBottomColor: COLORS.brandDark,
  }
});

const wm = StyleSheet.create({
  overlay: { 
    flex: 1, 
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: SPACE.xxl 
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
    color: COLORS.textSec, 
    lineHeight: 24, 
    textAlign: 'center', 
    marginBottom: SPACE.lg 
  },
  hint: { 
    fontSize: FONT.sm, 
    color: COLORS.textTer, 
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
