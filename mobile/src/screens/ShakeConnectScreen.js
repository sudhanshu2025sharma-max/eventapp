import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Easing, FlatList, Image, Vibration, Dimensions, PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Accelerometer } from 'expo-sensors';
import * as Haptics from 'expo-haptics';
import { COLORS, SPACE, API_URL, API_HEADERS, fixMediaUrl } from '../theme';
import { GradientAvatar } from '../components';

const { width: W, height: H } = Dimensions.get('window');
const SHAKE_THRESHOLD = 1.8;
const SHAKE_COOLDOWN = 900;
const POLL_INTERVAL = 1800;
const MATCH_WINDOW = 6500;

const authH = t => ({ ...API_HEADERS, Authorization: `Bearer ${t?.access}` });

/* ── Confetti Particle ─────────────────────────────────── */
function ConfettiPiece({ delay, color, startX }) {
  const y = useRef(new Animated.Value(-20)).current;
  const x = useRef(new Animated.Value(startX)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const dur = 2200 + Math.random() * 800;
    Animated.parallel([
      Animated.timing(y, { toValue: H * 0.7, duration: dur, delay, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(x, { toValue: startX + (Math.random() - 0.5) * 120, duration: dur * 0.6, delay, useNativeDriver: true }),
        Animated.timing(x, { toValue: startX + (Math.random() - 0.5) * 80, duration: dur * 0.4, useNativeDriver: true }),
      ]),
      Animated.timing(spin, { toValue: 4 + Math.random() * 4, duration: dur, delay, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: dur, delay, useNativeDriver: true }),
    ]).start();
  }, []);

  const size = 6 + Math.random() * 6;
  const isCircle = Math.random() > 0.5;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 0,
        width: size,
        height: isCircle ? size : size * 2.5,
        borderRadius: isCircle ? size / 2 : 2,
        backgroundColor: color,
        opacity,
        transform: [
          { translateX: x },
          { translateY: y },
          { rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
        ],
      }}
    />
  );
}

function ConfettiBlast() {
  const colors = ['#7c3aed', '#a78bfa', '#34d399', '#fbbf24', '#f472b6', '#60a5fa', '#f87171', '#c084fc'];
  const pieces = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    color: colors[i % colors.length],
    delay: Math.random() * 400,
    startX: Math.random() * W,
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map(p => (
        <ConfettiPiece key={p.id} delay={p.delay} color={p.color} startX={p.startX} />
      ))}
    </View>
  );
}

/* ── Ripple Ring ────────────────────────────────────────── */
function RippleRing({ delay = 0, size = 200, color = '#7c3aed' }) {
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.6, duration: 2000, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 2000, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 0.6, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.45, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2,
        borderColor: color,
        opacity,
        transform: [{ scale }],
      }}
    />
  );
}

/* ── Floating Glass Orb ─────────────────────────────────── */
function GlassOrb({ size, left, top, delay = 0 }) {
  const y = useRef(new Animated.Value(0)).current;
  const x = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const dur = 3000 + Math.random() * 1500;
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(y, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(x, { toValue: 1, duration: dur * 1.1, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(y, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(x, { toValue: 0, duration: dur * 1.1, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        left,
        top,
        backgroundColor: 'rgba(124,58,237,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(167,139,250,0.08)',
        transform: [
          { translateY: y.interpolate({ inputRange: [0, 1], outputRange: [0, -15] }) },
          { translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, 10] }) },
        ],
      }}
    />
  );
}

/* ── Wait Dot ───────────────────────────────────────────── */
function WaitDot({ delay = 0 }) {
  const a = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(a, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(a, { toValue: 0.2, duration: 350, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View
      style={{
        width: 8, height: 8, borderRadius: 4, marginHorizontal: 4,
        backgroundColor: '#c4b5fd', opacity: a,
        transform: [{ scale: a.interpolate({ inputRange: [0.2, 1], outputRange: [0.7, 1.2] }) }],
      }}
    />
  );
}

/* ── Dual Phone Animation ───────────────────────────────── */
function DualPhoneAnim({ active }) {
  const leftX = useRef(new Animated.Value(0)).current;
  const rightX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(leftX, { toValue: 8, duration: 200, useNativeDriver: true }),
          Animated.timing(rightX, { toValue: -8, duration: 200, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(leftX, { toValue: -6, duration: 200, useNativeDriver: true }),
          Animated.timing(rightX, { toValue: 6, duration: 200, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(leftX, { toValue: 4, duration: 150, useNativeDriver: true }),
          Animated.timing(rightX, { toValue: -4, duration: 150, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(leftX, { toValue: 0, duration: 150, useNativeDriver: true }),
          Animated.timing(rightX, { toValue: 0, duration: 150, useNativeDriver: true }),
        ]),
        Animated.delay(600),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [active]);

  return (
    <View style={_s.dualWrap}>
      <Animated.View style={[_s.dualPhone, { transform: [{ translateX: leftX }, { rotate: '-8deg' }] }]}>
        <Text style={{ fontSize: 42 }}>📱</Text>
      </Animated.View>
      <View style={_s.dualBolt}>
        <Ionicons name="flash" size={22} color="#fbbf24" />
      </View>
      <Animated.View style={[_s.dualPhone, { transform: [{ translateX: rightX }, { rotate: '8deg' }] }]}>
        <Text style={{ fontSize: 42 }}>📱</Text>
      </Animated.View>
    </View>
  );
}

/* ── Points Burst ───────────────────────────────────────── */
function PointsBurst() {
  const scale = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(400),
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, tension: 200, friction: 8, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]),
      Animated.delay(1200),
      Animated.parallel([
        Animated.timing(y, { toValue: -30, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  return (
    <Animated.View style={[_s.pointsBurst, { opacity, transform: [{ scale }, { translateY: y }] }]}>
      <LinearGradient colors={['#fbbf24', '#f59e0b']} style={_s.pointsPill}>
        <Ionicons name="star" size={14} color="#fff" />
        <Text style={_s.pointsText}>+15 pts</Text>
      </LinearGradient>
    </Animated.View>
  );
}

/* ── Met In Person Badge ────────────────────────────────── */
function MetBadge({ name }) {
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(700),
      Animated.spring(scale, { toValue: 1, tension: 180, friction: 9, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[_s.metBadge, { transform: [{ scale }] }]}>
      <LinearGradient colors={['rgba(124,58,237,0.15)', 'rgba(99,102,241,0.10)']} style={_s.metBadgeInner}>
        <Text style={{ fontSize: 20 }}>🤝</Text>
        <View style={{ flex: 1 }}>
          <Text style={_s.metBadgeTitle}>Met in person</Text>
          <Text style={_s.metBadgeSub}>You & {name} connected at ETD 2026</Text>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}


/* ── Swipe to Connect (iPhone unlock style) ─────────────── */
function SwipeToConnect({ onComplete }) {
  const trackW = Math.min(320, W - 60);
  const knobSize = 56;
  const maxSlide = trackW - knobSize - 8;
  const pan = useRef(new Animated.Value(0)).current;
  const [done, setDone] = useState(false);
  const doneRef = useRef(false);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !doneRef.current,
      onMoveShouldSetPanResponder: () => !doneRef.current,
      onPanResponderMove: (_, g) => {
        if (doneRef.current) return;
        const x = Math.max(0, Math.min(maxSlide, g.dx));
        pan.setValue(x);
      },
      onPanResponderRelease: (_, g) => {
        if (doneRef.current) return;
        if (g.dx >= maxSlide - 20) {
          doneRef.current = true;
          setDone(true);
          Animated.spring(pan, { toValue: maxSlide, tension: 200, friction: 15, useNativeDriver: false }).start();
          onComplete?.();
          setTimeout(() => {
            doneRef.current = false;
            setDone(false);
            Animated.spring(pan, { toValue: 0, tension: 100, friction: 12, useNativeDriver: false }).start();
          }, 800);
        } else {
          Animated.spring(pan, { toValue: 0, tension: 100, friction: 12, useNativeDriver: false }).start();
        }
      },
    })
  ).current;

  const textOpacity = pan.interpolate({
    inputRange: [0, maxSlide * 0.7],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const fillOpacity = pan.interpolate({
    inputRange: [0, maxSlide],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={[_swipe.wrap, { width: trackW }]}>
      <Animated.View style={[_swipe.fill, { opacity: fillOpacity }]}>
        <LinearGradient
          colors={['#7c3aed', '#4f46e5']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1, borderRadius: 32 }}
        />
      </Animated.View>

      <Animated.Text style={[_swipe.label, { opacity: textOpacity }]}>
        Slide to shake  →
      </Animated.Text>

      <Animated.View
        {...responder.panHandlers}
        style={[
          _swipe.knob,
          { width: knobSize, height: knobSize, transform: [{ translateX: pan }] },
        ]}
      >
        <Ionicons name={done ? 'checkmark' : 'chevron-forward'} size={24} color="#4f46e5" />
      </Animated.View>
    </View>
  );
}

const _swipe = StyleSheet.create({
  wrap: {
    marginTop: 28,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.28)',
    padding: 4,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    top: 4, bottom: 4, left: 4, right: 4,
    borderRadius: 32,
  },
  label: {
    position: 'absolute',
    left: 0, right: 0,
    textAlign: 'center',
    color: '#c4b5fd',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.5,
  },
  knob: {
    borderRadius: 999,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
});

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   MAIN SCREEN
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function ShakeConnectScreen({ tokens, user, onConnected, onBack }) {
  const [phase, setPhase] = useState('idle');
  const [shakers, setShakers] = useState([]);
  const [connected, setConnected] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);

  const iconShift = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0.8)).current;
  const glassY = useRef(new Animated.Value(30)).current;

  const accelSub = useRef(null);
  const lastShakeAt = useRef(0);
  const pollTimer = useRef(null);
  const deadline = useRef(0);

  const stopPolling = () => { if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; } };
  const stopListening = () => { if (accelSub.current) { accelSub.current.remove(); accelSub.current = null; } };
  const cleanup = () => { stopPolling(); stopListening(); };

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(glassY, { toValue: 0, duration: 700, easing: Easing.out(Easing.exp), useNativeDriver: true }),
    ]).start();
    return cleanup;
  }, []);

  const wiggle = () => {
    Animated.sequence([
      Animated.timing(iconShift, { toValue: 14, duration: 55, useNativeDriver: true }),
      Animated.timing(iconShift, { toValue: -14, duration: 55, useNativeDriver: true }),
      Animated.timing(iconShift, { toValue: 10, duration: 55, useNativeDriver: true }),
      Animated.timing(iconShift, { toValue: -10, duration: 55, useNativeDriver: true }),
      Animated.timing(iconShift, { toValue: 0, duration: 55, useNativeDriver: true }),
    ]).start();
  };

  const postShake = async () => {
    const r = await fetch(`${API_URL}/chat/shake/`, {
      method: 'POST',
      headers: authH(tokens),
      body: JSON.stringify({ action: 'shake' }),
    });
    return r.json();
  };

  const postStatus = async () => {
    const r = await fetch(`${API_URL}/chat/shake/`, {
      method: 'POST',
      headers: authH(tokens),
      body: JSON.stringify({ action: 'status' }),
    });
    return r.json();
  };

  const connectTo = async (pickId) => {
    setPhase('waiting');
    try {
      const r = await fetch(`${API_URL}/chat/shake/`, {
        method: 'POST',
        headers: authH(tokens),
        body: JSON.stringify({ action: 'pick', pick_user_id: pickId }),
      });
      const d = await r.json();
      if (!d.success) {
        setErrorMsg(d.error || 'Could not connect.');
        setPhase('error');
        return;
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Vibration.vibrate([0, 70, 50, 90]);
      setConnected(d);
      setShowConfetti(true);
      setPhase('success');
      cleanup();
      Animated.spring(successScale, { toValue: 1, tension: 150, friction: 9, useNativeDriver: true }).start();
    } catch {
      setErrorMsg('Network error.');
      setPhase('error');
    }
  };

  const startPolling = () => {
    stopPolling();
    pollTimer.current = setInterval(async () => {
      if (Date.now() > deadline.current) {
        stopPolling();
        setPhase('idle');
        return;
      }
      try {
        const d = await postStatus();
        const list = (d.shakers || []).map(s => ({ ...s, profile_photo_url: fixMediaUrl(s.profile_photo_url) }));
        if (list.length === 1) {
          stopPolling();
          await connectTo(list[0].id);
        } else if (list.length > 1) {
          stopPolling();
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setShakers(list);
          setPhase('picking');
        }
      } catch {}
    }, POLL_INTERVAL);
  };

  const onShakeDetected = useCallback(async () => {
    const now = Date.now();
    if (now - lastShakeAt.current < SHAKE_COOLDOWN) return;
    lastShakeAt.current = now;
    wiggle();
    setPhase('waiting');
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const d = await postShake();
      const list = (d.shakers || []).map(s => ({ ...s, profile_photo_url: fixMediaUrl(s.profile_photo_url) }));

      // Immediate match from initial shake response
      if (list.length === 1) {
        await connectTo(list[0].id);
        return;
      }
      if (list.length > 1) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setShakers(list);
        setPhase('picking');
        return;
      }

      // No match yet — start polling for the other person to shake
      deadline.current = Date.now() + MATCH_WINDOW;
      startPolling();
    } catch {
      setErrorMsg('Could not reach server.');
      setPhase('error');
    }
  }, [tokens]);

  const beginListening = useCallback(() => {
    stopListening();
    try {
      Accelerometer.setUpdateInterval(120);
      accelSub.current = Accelerometer.addListener(({ x, y, z }) => {
        if (Math.sqrt(x * x + y * y + z * z) >= SHAKE_THRESHOLD) onShakeDetected();
      });
    } catch (e) {
      // Accelerometer not available (web) — manual button only
    }
  }, [onShakeDetected]);

  useEffect(() => { beginListening(); return stopListening; }, [beginListening]);

  const reset = () => {
    cleanup();
    setPhase('idle');
    setShakers([]);
    setConnected(null);
    setErrorMsg('');
    setShowConfetti(false);
    successScale.setValue(0.8);
    beginListening();
  };

  return (
    <Animated.View style={[_s.root, { opacity: fade }]}>
      <LinearGradient colors={['#0a0a1a', '#12102e', '#0d1b3e']} style={_s.bg}>
        {/* Glass orbs */}
        <GlassOrb size={120} left={-30} top={80} delay={0} />
        <GlassOrb size={90} left={W - 60} top={140} delay={500} />
        <GlassOrb size={70} left={40} top={H - 250} delay={300} />
        <GlassOrb size={100} left={W - 90} top={H - 300} delay={800} />

        {showConfetti && <ConfettiBlast />}

        {/* Glassmorphism header */}
        <Animated.View style={[_s.header, { transform: [{ translateY: glassY }] }]}>
          <View style={_s.headerGlass}>
            <TouchableOpacity onPress={() => { cleanup(); onBack?.(); }} style={_s.backBtn}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={_s.headerCenter}>
              <Text style={{ fontSize: 18 }}>🤝</Text>
              <Text style={_s.headerTitle}>Shake Connect</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>
        </Animated.View>

        {/* ── Idle / Waiting ────────────────────────────────── */}
        {(phase === 'idle' || phase === 'waiting') && (
          <View style={_s.heroWrap}>
            {/* Ripple rings */}
            <RippleRing delay={0} size={240} color={phase === 'waiting' ? '#34d399' : '#7c3aed'} />
            <RippleRing delay={500} size={240} color={phase === 'waiting' ? '#34d399' : '#7c3aed'} />
            <RippleRing delay={1000} size={240} color={phase === 'waiting' ? '#34d399' : '#7c3aed'} />

            {/* Core circle — glassmorphism */}
            <View style={_s.coreOuter}>
              <View style={_s.coreGlass}>
                {phase === 'waiting' ? (
                  <DualPhoneAnim active={true} />
                ) : (
                  <Animated.View style={{ transform: [{ translateX: iconShift }, { rotate: iconShift.interpolate({ inputRange: [-14, 14], outputRange: ['-8deg', '8deg'] }) }] }}>
                    <Text style={{ fontSize: 68 }}>📱</Text>
                  </Animated.View>
                )}
              </View>
            </View>

            <Text style={_s.heroTitle}>
              {phase === 'idle' ? 'Shake your phone!' : 'Searching for shakers...'}
            </Text>

            <Text style={_s.heroSub}>
              {phase === 'idle'
                ? 'Both people shake at the same time to connect instantly'
                : 'Hold on — matching your shake with nearby phones'}
            </Text>

            {phase === 'waiting' && (
              <View style={_s.waitRow}>
                <WaitDot delay={0} />
                <WaitDot delay={150} />
                <WaitDot delay={300} />
              </View>
            )}

            {phase === 'idle' && (
              <View style={_s.howItWorks}>
                <View style={_s.stepRow}>
                  <View style={_s.stepNum}><Text style={_s.stepNumT}>1</Text></View>
                  <Text style={_s.stepText}>Both open this screen</Text>
                </View>
                <View style={_s.stepRow}>
                  <View style={_s.stepNum}><Text style={_s.stepNumT}>2</Text></View>
                  <Text style={_s.stepText}>Shake phones together</Text>
                </View>
                <View style={_s.stepRow}>
                  <View style={_s.stepNum}><Text style={_s.stepNumT}>3</Text></View>
                  <Text style={_s.stepText}>Instantly connected!</Text>
                </View>
              </View>
            )}

            <SwipeToConnect onComplete={onShakeDetected} />
          </View>
        )}

        {/* ── Picking ──────────────────────────────────────── */}
        {phase === 'picking' && (
          <View style={_s.panel}>
            <View style={_s.panelGlass}>
              <View style={_s.panelTop}>
                <Text style={{ fontSize: 28 }}>👥</Text>
                <Text style={_s.panelTitle}>{shakers.length} people shook nearby</Text>
                <Text style={_s.panelSub}>Tap the person you're standing with</Text>
              </View>

              <FlatList
                data={shakers}
                keyExtractor={item => item.id}
                contentContainerStyle={{ gap: 10, paddingBottom: 10 }}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <TouchableOpacity activeOpacity={0.85} onPress={() => connectTo(item.id)}>
                    <View style={_s.shakerCard}>
                      {item.profile_photo_url
                        ? <Image source={{ uri: item.profile_photo_url }} style={_s.shakerPhoto} />
                        : <GradientAvatar name={item.name} size={50} radius={16} />}
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={_s.shakerName} numberOfLines={1}>{item.name}</Text>
                        {!!item.affiliation && <Text style={_s.shakerAff} numberOfLines={1}>{item.affiliation}</Text>}
                      </View>
                      <LinearGradient colors={['#7c3aed', '#4f46e5']} style={_s.shakerPickBtn}>
                        <Ionicons name="hand-left" size={16} color="#fff" />
                      </LinearGradient>
                    </View>
                  </TouchableOpacity>
                )}
              />

              <TouchableOpacity onPress={reset} style={_s.secondaryBtn}>
                <Text style={_s.secondaryBtnT}>Not them? Shake again</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Success ──────────────────────────────────────── */}
        {phase === 'success' && connected && (
          <Animated.View style={[_s.successWrap, { transform: [{ scale: successScale }] }]}>
            <PointsBurst />

            <Text style={_s.successEmoji}>🎉</Text>
            <Text style={_s.successTitle}>Connected!</Text>
            <Text style={_s.successName}>{connected.connected_with?.name}</Text>

            <MetBadge name={connected.connected_with?.name || 'them'} />

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => onConnected?.(connected.conversation_id)}
              style={{ marginTop: 24 }}
            >
              <LinearGradient colors={['#7c3aed', '#4f46e5']} style={_s.primaryBtn}>
                <Ionicons name="chatbubble" size={18} color="#fff" />
                <Text style={_s.primaryBtnT}>Say Hi!</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={reset} style={{ marginTop: 14 }}>
              <Text style={_s.secondaryBtnT}>Connect with someone else</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── Error ────────────────────────────────────────── */}
        {phase === 'error' && (
          <View style={_s.errorWrap}>
            <Text style={{ fontSize: 64 }}>😕</Text>
            <Text style={_s.errorTitle}>Something went wrong</Text>
            <Text style={_s.errorSub}>{errorMsg}</Text>
            <TouchableOpacity activeOpacity={0.9} onPress={reset} style={{ marginTop: 22 }}>
              <LinearGradient colors={['#7c3aed', '#4f46e5']} style={_s.primaryBtn}>
                <Ionicons name="refresh" size={18} color="#fff" />
                <Text style={_s.primaryBtnT}>Try Again</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Bottom Tip ───────────────────────────────────── */}
        {(phase === 'idle' || phase === 'waiting') && (
          <View style={_s.tipRow}>
            <View style={_s.tipGlass}>
              <Ionicons name="sparkles" size={14} color="#c4b5fd" />
              <Text style={_s.tipText}>Works within a 4-second window • No Bluetooth needed</Text>
            </View>
          </View>
        )}
      </LinearGradient>
    </Animated.View>
  );
}

const _s = StyleSheet.create({
  root: { flex: 1 },
  bg: { flex: 1, overflow: 'hidden' },

  header: { paddingTop: 50, paddingHorizontal: SPACE.xl, paddingBottom: 8 },
  headerGlass: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 18, padding: 8, paddingHorizontal: 12,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 17, fontWeight: '900', color: '#fff', letterSpacing: -0.2 },

  heroWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACE.xl },
  coreOuter: { marginBottom: 28 },
  coreGlass: {
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(124,58,237,0.12)',
    borderWidth: 1.5, borderColor: 'rgba(167,139,250,0.22)',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  heroTitle: { fontSize: 26, fontWeight: '900', color: '#fff', textAlign: 'center', letterSpacing: -0.4 },
  heroSub: { fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 22, marginTop: 10, maxWidth: 300 },
  waitRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18 },

  howItWorks: { marginTop: 30, gap: 12, width: '100%', maxWidth: 260 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepNum: {
    width: 28, height: 28, borderRadius: 10,
    backgroundColor: 'rgba(124,58,237,0.18)',
    borderWidth: 1, borderColor: 'rgba(167,139,250,0.22)',
    alignItems: 'center', justifyContent: 'center',
  },
  stepNumT: { fontSize: 13, fontWeight: '900', color: '#c4b5fd' },
  stepText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.65)' },

  dualWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dualPhone: {},
  dualBolt: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(251,191,36,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },

  panel: { flex: 1, paddingHorizontal: SPACE.xl, paddingTop: 12 },
  panelGlass: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 24, padding: 18,
  },
  panelTop: { alignItems: 'center', marginBottom: 16, gap: 6 },
  panelTitle: { fontSize: 22, fontWeight: '900', color: '#fff', textAlign: 'center' },
  panelSub: { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.5)', textAlign: 'center' },

  shakerCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(167,139,250,0.18)',
    borderRadius: 16, padding: 12,
  },
  shakerPhoto: { width: 50, height: 50, borderRadius: 16, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)' },
  shakerName: { fontSize: 15, fontWeight: '900', color: '#fff' },
  shakerAff: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  shakerPickBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACE.xl },
  successEmoji: { fontSize: 80, marginBottom: 12 },
  successTitle: { fontSize: 32, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  successName: { fontSize: 22, fontWeight: '800', color: '#c4b5fd', marginTop: 6, textAlign: 'center' },

  pointsBurst: { position: 'absolute', top: -50, zIndex: 10 },
  pointsPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999,
  },
  pointsText: { fontSize: 15, fontWeight: '900', color: '#fff' },

  metBadge: { marginTop: 20, width: '100%' },
  metBadgeInner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(167,139,250,0.2)',
  },
  metBadgeTitle: { fontSize: 14, fontWeight: '900', color: '#c4b5fd' },
  metBadgeSub: { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.5)', marginTop: 2 },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 30, paddingVertical: 16, borderRadius: 16,
  },
  primaryBtnT: { fontSize: 16, fontWeight: '900', color: '#fff' },
  secondaryBtn: { alignSelf: 'center', marginTop: 10, paddingVertical: 10 },
  secondaryBtnT: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.45)' },

  errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACE.xl },
  errorTitle: { fontSize: 26, fontWeight: '900', color: '#fff', marginTop: 12 },
  errorSub: { fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 8, lineHeight: 22 },

  tipRow: { paddingHorizontal: SPACE.xl, paddingBottom: 32 },
  tipGlass: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14, padding: 12, justifyContent: 'center',
  },
  tipText: { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.4)' },

  manualBtn: {
    width: '100%',
    maxWidth: 320,
    marginTop: 28,
  },
  manualBtnBox: {
    minHeight: 64,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 8,
  },
  manualBtnIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(79,70,229,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualBtnT: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111827',
    letterSpacing: -0.2,
  },
  manualBtnSub: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 3,
    lineHeight: 16,
  },
});
