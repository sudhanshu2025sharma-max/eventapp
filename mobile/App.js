import React, { useState, useRef, useEffect } from 'react';
import { View, Animated, Text, Platform, ImageBackground, Image, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoginScreen          from './src/screens/LoginScreen';
import ChangePasswordScreen from './src/screens/ChangePasswordScreen';
import MainApp              from './src/MainApp';
import { registerForPushNotifications, setupNotificationListeners } from './src/notifications';
import { API_URL, API_HEADERS, fixMediaUrl } from './src/theme';
import { setTokens as setApiTokens } from './src/api';

// ── Session persistence ──────────────────────────────────────────────────
const Storage = {
  async get(key) {
    if (Platform.OS === 'web') {
      try { return JSON.parse(window.localStorage.getItem(key)); } catch { return null; }
    }
    try {
      const v = await AsyncStorage.getItem(key);
      return v ? JSON.parse(v) : null;
    } catch {
      return null;
    }
  },
  async set(key, value) {
    if (Platform.OS === 'web') {
      try { window.localStorage.setItem(key, JSON.stringify(value)); } catch {}
    } else {
      try {
        await AsyncStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        console.warn('Storage set error:', e);
      }
    }
  },
  async remove(key) {
    if (Platform.OS === 'web') {
      try { window.localStorage.removeItem(key); } catch {}
    } else {
      try {
        await AsyncStorage.removeItem(key);
      } catch (e) {
        console.warn('Storage remove error:', e);
      }
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

// ── Smooth Staggered Character Animation ─────────────────────────────────
function StaggeredText({ text, style, delay = 0, staggerMs = 50 }) {
  const chars = text.split('');
  const anims = useRef(chars.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const animations = anims.map((anim) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      })
    );
    const timer = setTimeout(() => {
      Animated.stagger(staggerMs, animations).start();
    }, delay);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
      {chars.map((char, index) => {
        const translateY = anims[index].interpolate({
          inputRange: [0, 1],
          outputRange: [16, 0],
        });
        const scale = anims[index].interpolate({
          inputRange: [0, 1],
          outputRange: [0.88, 1],
        });
        return (
          <Animated.Text
            key={`${char}-${index}`}
            style={[style, { opacity: anims[index], transform: [{ translateY }, { scale }] }]}
          >
            {char === ' ' ? '\u00A0' : char}
          </Animated.Text>
        );
      })}
    </View>
  );
}

function SplashScreen() {
  const badgeAnim  = useRef(new Animated.Value(0)).current;
  const logoAnim   = useRef(new Animated.Value(0)).current;
  const lineAnim   = useRef(new Animated.Value(0)).current;
  const footerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Badge  → 0.2s
    Animated.timing(badgeAnim,  { toValue: 1, duration: 600, delay: 200,  useNativeDriver: true }).start();
    // Logo   → 0.4s
    Animated.timing(logoAnim,   { toValue: 1, duration: 800, delay: 400,  useNativeDriver: true }).start();
    // Line   → 3.4s
    Animated.timing(lineAnim,   { toValue: 1, duration: 600, delay: 3400, useNativeDriver: true }).start();
    // Footer → 4.0s
    Animated.timing(footerAnim, { toValue: 1, duration: 600, delay: 4000, useNativeDriver: true }).start();
  }, []);

  const logoScale = logoAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1],
  });

  return (
    <ImageBackground
      source={require('./assets/ETD_bgImage.png')}
      style={styles.bg}
      resizeMode="cover"
    >
      <StatusBar style="light" translucent />

      {/* ── ZONE 1: TOP — Symposium badge ── */}
      <View style={styles.topZone}>
        <Animated.View style={{ opacity: badgeAnim }}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>26th International Symposium</Text>
          </View>
        </Animated.View>
      </View>

      {/* ── ZONE 2: MIDDLE — Logo + Title + Subtitle + Line (true vertical center of sky) ── */}
      <View style={styles.midZone}>
        <Animated.View style={{ opacity: logoAnim, transform: [{ scale: logoScale }], marginBottom: 18 }}>
          <Image
            source={require('./assets/etd_Logo-white.png')}
            style={styles.logo}
          />
        </Animated.View>

        <StaggeredText
          text="ETD 2026"
          delay={1200}
          staggerMs={80}
          style={styles.title}
        />

        <View style={{ marginTop: 10 }}>
          <StaggeredText
            text="ETDs in the age of AI"
            delay={2200}
            staggerMs={40}
            style={styles.subtitle}
          />
        </View>

        <Animated.View style={[styles.lineRow, { opacity: lineAnim }]}>
          <View style={styles.lineBar} />
          <View style={styles.lineDot} />
          <View style={styles.lineBar} />
        </Animated.View>
      </View>

      {/* ── ZONE 3: BOTTOM — Organizer footer over the dark skyline ── */}
      <View style={styles.bottomZone}>
        <Animated.View style={{ opacity: footerAnim, width: '100%' }}>
          <View style={styles.footerBox}>
            <Text style={styles.footerText}>Central Library IIT Delhi | NDLTD</Text>
          </View>
        </Animated.View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: '#090A27', // instant sky color — no white flash while PNG loads
    paddingHorizontal: 24,
  },

  // Three equal vertical zones → full-screen utilization
  topZone: {
    flex: 1,
    justifyContent: 'flex-end',   // badge sits just above mid zone
    alignItems: 'center',
    paddingBottom: 8,
    paddingTop: Platform.OS === 'ios' ? 50 : 36,
  },
  midZone: {
    flex: 2.2,                    // largest share — main branding lives in the sky
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomZone: {
    flex: 1,
    justifyContent: 'flex-end',   // footer rests above the skyline hills
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
  },

  badge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  badgeText: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },

  logo: {
    width: 220,
    height: 125,
    resizeMode: 'contain',
  },

  title: {
    fontSize: 48,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 10,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F1F5F9',
    textAlign: 'center',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },

  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
  },
  lineBar: {
    width: 36,
    height: 2,
    backgroundColor: '#F59E0B',
    borderRadius: 2,
  },
  lineDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 8,
  },

  footerBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    width: '100%',
  },
  footerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});

export default function App() {
  const [screen, setScreen] = useState('splash');
  const [user, setUser]     = useState(null);
  const [tokens, setTokens] = useState(null);
  const [notificationRoute, setNotificationRoute] = useState(null);
  const pushToken = useRef(null);

  useEffect(() => {
    if (tokens) setApiTokens(tokens);
  }, [tokens]);

  useEffect(() => {
    const restore = async () => {
      const startTime = Date.now();
      let nextScreen = 'login';

      try {
        const savedUser   = await Storage.get('etd_user');
        const savedTokens = await Storage.get('etd_tokens');

        if (savedUser && savedTokens?.access) {
          let activeTokens = savedTokens;

          try {
            let res = await fetch(API_URL + '/auth/me/', {
              headers: { ...API_HEADERS, Authorization: 'Bearer ' + activeTokens.access },
            });

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
                nextScreen = 'app';

                try {
                  const pt = await registerForPushNotifications(activeTokens.access);
                  pushToken.current = pt;
                } catch (pushErr) {
                  console.warn('Push registration warning:', pushErr);
                }
              }
            }
          } catch (netErr) {
            console.warn('Restore network warning:', netErr);
          }
        }
      } catch (e) {
        console.warn('Restore general error:', e);
      } finally {
        // 7-second cold-start minimum
        const elapsed = Date.now() - startTime;
        const delay = Math.max(0, 7000 - elapsed);
        setTimeout(() => setScreen(nextScreen), delay);
      }
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
          setNotificationRoute({ type: 'chat_room', conversationId: data.conversation_id });
          if (user && tokens) setScreen('app');
        } else if (data.type === 'connection_request') {
          setNotificationRoute({ type: 'connection_requests' });
          if (user && tokens) setScreen('app');
        } else if (data.type === 'session_reminder' && data.session_id) {
          setNotificationRoute({ type: 'schedule', sessionId: data.session_id });
          if (user && tokens) setScreen('app');
        } else if (data.type === 'feed_post') {
          setNotificationRoute({ type: 'feed' });
          if (user && tokens) setScreen('app');
        } else if (data.type === 'checkin_success' || data.type === 'meal_verified' || data.type === 'meal_pass') {
          setNotificationRoute({ type: 'qr' });
          if (user && tokens) setScreen('app');
        } else if (data.type === 'poll') {
          setNotificationRoute({ type: 'poll' });
          if (user && tokens) setScreen('app');
        } else if (data.type === 'ideathon_invite' || data.type === 'ideathon_invite_accepted') {
          setNotificationRoute({ type: 'ideathon' });
          if (user && tokens) setScreen('app');
        } else {
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
    try {
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
        try {
          const pt = await registerForPushNotifications(tokenData.access);
          pushToken.current = pt;
        } catch (pushErr) {
          console.warn('Push registration error:', pushErr);
        }
      }
    } catch (err) {
      console.error('handleLogin error:', err);
      throw err;
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
    try {
      const pt = await registerForPushNotifications(t.access);
      pushToken.current = pt;
    } catch {}
  };

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
    }, 20 * 60 * 1000);
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

  const renderContent = () => {
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
  };

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        {renderContent()}
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
