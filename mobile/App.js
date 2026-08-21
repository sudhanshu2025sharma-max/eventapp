import React, { useState, useRef, useEffect } from 'react';
import { View, StatusBar, Animated, Text, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import LoginScreen          from './src/screens/LoginScreen';
import ChangePasswordScreen from './src/screens/ChangePasswordScreen';
import MainApp              from './src/MainApp';
import { registerForPushNotifications, setupNotificationListeners } from './src/notifications';
import { API_URL, API_HEADERS, fixMediaUrl } from './src/theme';
import { setTokens as setApiTokens } from './src/api';

// ── Session persistence (web only) ──────────────────────────────────────
let AsyncStorage;
try { AsyncStorage = require('@react-native-async-storage/async-storage').default; } catch {}

const Storage = {
  async get(key) {
    if (Platform.OS === 'web') {
      try { return JSON.parse(window.localStorage.getItem(key)); } catch { return null; }
    }
    if (AsyncStorage) {
      try { const v = await AsyncStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; }
    }
    return null;
  },
  async set(key, value) {
    if (Platform.OS === 'web') {
      try { window.localStorage.setItem(key, JSON.stringify(value)); } catch {}
    } else if (AsyncStorage) {
      try { await AsyncStorage.setItem(key, JSON.stringify(value)); } catch {}
    }
  },
  async remove(key) {
    if (Platform.OS === 'web') {
      try { window.localStorage.removeItem(key); } catch {}
    } else if (AsyncStorage) {
      try { await AsyncStorage.removeItem(key); } catch {}
    }
  },
};

// ── Token refresh helper ─────────────────────────────────────────────────
async function refreshAccessToken(tokens) {
  try {
    const res = await fetch(API_URL + '/auth/token/refresh/', {
      method: 'POST',
      headers: API_HEADERS,
      body: JSON.stringify({ refresh: tokens.refresh }),
    });
    const data = await res.json();
    if (data.access) {
      return { ...tokens, access: data.access, ...(data.refresh ? { refresh: data.refresh } : {}) };
    }
  } catch {}
  return null;
}

function SplashScreen() {
  const sc = useRef(new Animated.Value(0.75)).current;
  const op = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(sc, { toValue: 1, tension: 55, friction: 8, useNativeDriver: true }),
      Animated.timing(op, { toValue: 1, duration: 700, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <LinearGradient
      colors={['#070614', '#0F172A', '#0333b6']}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
    >
      <StatusBar barStyle="light-content" />
      <View style={{
        position: 'absolute', width: 300, height: 300, borderRadius: 150,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)', top: -80, right: -80,
      }} />
      <Animated.View style={{ alignItems: 'center', transform: [{ scale: sc }], opacity: op }}>
        <View style={{
          width: 90, height: 90, borderRadius: 26,
          backgroundColor: 'rgba(255,255,255,0.10)',
          borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.18)',
          alignItems: 'center', justifyContent: 'center', marginBottom: 20,
        }}>
          <Text style={{ fontSize: 26, fontWeight: '900', color: '#FFFFFF', letterSpacing: 2 }}>ETD</Text>
        </View>
        <Text style={{ fontSize: 38, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.5 }}>ETD 2026</Text>
        <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.50)', marginTop: 6, letterSpacing: 0.3 }}>
          ETDs in the age of AI
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 24 }}>
          <View style={{ width: 32, height: 2, backgroundColor: '#f59e0b', borderRadius: 2 }} />
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#f59e0b', marginHorizontal: 6 }} />
          <View style={{ width: 32, height: 2, backgroundColor: '#f59e0b', borderRadius: 2 }} />
        </View>
        <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.30)', marginTop: 16 }}>IIT Delhi</Text>
      </Animated.View>
    </LinearGradient>
  );
}

export default function App() {
  const [screen, setScreen] = useState('splash');
  const [user, setUser]     = useState(null);
  const [tokens, setTokens] = useState(null);
  const [notificationRoute, setNotificationRoute] = useState(null);
  const pushToken = useRef(null);

  // Keep api.js module token in sync with React state — fires before children render
  useEffect(() => {
    if (tokens) setApiTokens(tokens);
  }, [tokens]);

  useEffect(() => {
    const restore = async () => {
      // Works for both web and native now
      const savedUser   = await Storage.get('etd_user');
      const savedTokens = await Storage.get('etd_tokens');

      if (savedUser && savedTokens?.access) {
        let activeTokens = savedTokens;

        // Try to verify session
        try {
          let res = await fetch(API_URL + '/auth/me/', {
            headers: { ...API_HEADERS, Authorization: 'Bearer ' + activeTokens.access },
          });

          // If 401, try refreshing the token
          if (res.status === 401 && savedTokens.refresh) {
            const refreshed = await refreshAccessToken(savedTokens);
            if (refreshed) {
              activeTokens = refreshed;
              res = await fetch(API_URL + '/auth/me/', {
                headers: { ...API_HEADERS, Authorization: 'Bearer ' + activeTokens.access },
              });
            }
          }

          if (res.ok) {
            const data = await res.json();
            if (data.success && data.user) {
              if (data.user.profile_photo_url) {
                data.user.profile_photo_url = fixMediaUrl(data.user.profile_photo_url);
              }
              setUser(data.user);
              setTokens(activeTokens);
              setApiTokens(activeTokens, async (nextTokens) => {
                setTokens(nextTokens);
                await Storage.set('etd_tokens', nextTokens);
              });
              await Storage.set('etd_tokens', activeTokens);
              setScreen('app');
              // Register push with valid token
              const pt = await registerForPushNotifications(activeTokens.access);
              pushToken.current = pt;
              return;
            }
          }
        } catch (e) {
          console.log('Restore error:', e.message);
        }
      }
      setTimeout(() => setScreen('login'), 2200);
    };
    restore();
  }, []);

  useEffect(() => {
    const cleanup = setupNotificationListeners(
      (notification) => {
        console.log('Notification:', notification.request.content.title);
      },
      (response) => {
        const data = response?.notification?.request?.content?.data || {};
        console.log('Tapped notification data:', data);

        if (data.type === 'new_message' && data.conversation_id) {
          setNotificationRoute({
            type: 'chat_room',
            conversationId: data.conversation_id,
          });
          if (user && tokens) setScreen('app');
        } else if (data.type === 'connection_request') {
          setNotificationRoute({ type: 'connection_requests' });
          if (user && tokens) setScreen('app');
        } else if (data.type === 'session_reminder' && data.session_id) {
          setNotificationRoute({
            type: 'schedule',
            sessionId: data.session_id,
          });
          if (user && tokens) setScreen('app');
        } else if (data.type === 'feed_post') {
          setNotificationRoute({ type: 'feed' });
          if (user && tokens) setScreen('app');
        } else if (data.type === 'checkin_success' || data.type === 'meal_verified') {
          setNotificationRoute({ type: 'qr' });
          if (user && tokens) setScreen('app');
        } else if (data.type === 'poll') {
          setNotificationRoute({ type: 'poll' });
          if (user && tokens) setScreen('app');
        } else if (data.type === 'ideathon_invite' || data.type === 'ideathon_invite_accepted') {
          setNotificationRoute({ type: 'ideathon' });
          if (user && tokens) setScreen('app');
        } else {
          // Generic — open notifications list
          if (user && tokens) {
            setNotificationRoute({ type: 'notifications' });
            setScreen('app');
          }
        }
      }
    );
    return cleanup;
  }, [user, tokens]);

  const handleLogin = async (userData, tokenData) => {
    // Fix media URLs
    if (userData.profile_photo_url) {
      userData.profile_photo_url = fixMediaUrl(userData.profile_photo_url);
    }
    setUser(userData);
    setTokens(tokenData);
    setApiTokens(tokenData, async (nextTokens) => {
      setTokens(nextTokens);
      await Storage.set('etd_tokens', nextTokens);
    });
    await Storage.set('etd_user', userData);
    await Storage.set('etd_tokens', tokenData);
    if (userData.must_change_password) {
      setScreen('change_password');
    } else {
      setScreen('app');
      const pt = await registerForPushNotifications(tokenData.access);
      pushToken.current = pt;
    }
  };

  const refreshUser = async (t) => {
    try {
      const res = await fetch(API_URL + '/auth/me/', {
        headers: { ...API_HEADERS, Authorization: 'Bearer ' + (t || tokens).access },
      });
      const data = await res.json();
      if (data.success && data.user) {
        if (data.user.profile_photo_url) {
          data.user.profile_photo_url = fixMediaUrl(data.user.profile_photo_url);
        }
        setUser(data.user);
      }
    } catch { /* silent */ }
  };

  const handlePasswordChanged = async (updatedUser, newTokens) => {
    const u = updatedUser || user;
    const t = newTokens   || tokens;
    setUser({ ...u, must_change_password: false });
    setTokens(t);
    setApiTokens(t, async (nextTokens) => {
      setTokens(nextTokens);
      await Storage.set('etd_tokens', nextTokens);
    });
    await Storage.set('etd_user', { ...u, must_change_password: false });
    await Storage.set('etd_tokens', t);
    setScreen('app');
    const pt = await registerForPushNotifications(t.access);
    pushToken.current = pt;
  };

  // Auto-refresh access token every 20 minutes
  useEffect(() => {
    const interval = setInterval(async () => {
      const refreshed = await refreshAccessToken(tokens);
      if (refreshed) {
        setTokens(refreshed);
        setApiTokens(refreshed, async (nextTokens) => {
          setTokens(nextTokens);
          await Storage.set('etd_tokens', nextTokens);
        });
        await Storage.set('etd_tokens', refreshed);
      }
    }, 20 * 60 * 1000); // 20 minutes
    return () => clearInterval(interval);
  }, [tokens?.refresh]);

  const handleLogout = async () => {
    setUser(null);
    setTokens(null);
    pushToken.current = null;
    setApiTokens(null);
    setNotificationRoute(null);
    await Storage.remove('etd_user');
    await Storage.remove('etd_tokens');
    setScreen('login');
  };

  if (screen === 'splash') return <SplashScreen />;
  if (screen === 'login') return <LoginScreen onLogin={handleLogin} />;
  if (screen === 'change_password') {
    return (
      <ChangePasswordScreen
        user={user} tokens={tokens}
        onDone={handlePasswordChanged}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <MainApp
      user={user}
      tokens={tokens}
      onLogout={handleLogout}
      setUser={setUser}
      refreshUser={refreshUser}
      notificationRoute={notificationRoute}
      clearNotificationRoute={() => setNotificationRoute(null)}
    />
  );
}
