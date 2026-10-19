import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Easing, FlatList, Image, Vibration, Dimensions, PanResponder,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Accelerometer } from 'expo-sensors';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { COLORS, SPACE, TOP, BOTTOM, API_URL, API_HEADERS, fixMediaUrl } from '../theme';
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
        position: 'absolute', top: 0,
        width: size, height: isCircle ? size : size * 2.5,
        borderRadius: isCircle ? size / 2 : 2,
        backgroundColor: color, opacity,
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
    id: i, color: colors[i % colors.length], delay: Math.random() * 400, startX: Math.random() * W,
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map(p => <ConfettiPiece key={p.id} delay={p.delay} color={p.color} startX={p.startX} />)}
    </View>
  );
}

/* ── Ripple Ring ────────────────────────────────────────── */
function RippleRing({ delay = 0, size = 240, color = '#7c3aed' }) {
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
        position: 'absolute', width: size, height: size, borderRadius: size / 2,
        borderWidth: 2, borderColor: color, opacity, transform: [{ scale }],
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
        position: 'absolute', width: size, height: size, borderRadius: size / 2,
        left, top, backgroundColor: 'rgba(124,58,237,0.06)',
        borderWidth: 1, borderColor: 'rgba(167,139,250,0.08)',
        transform: [
          { translateY: y.interpolate({ inputRange: [0, 1], outputRange: [0, -15] }) },
          { translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, 10] }) },
        ],
      }}
    />
  );
}

/* ── Points Burst ───────────────────────────────────────── */
function PointsBurst({ pts = 15 }) {
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
        <Text style={_s.pointsText}>+{pts} pts</Text>
      </LinearGradient>
    </Animated.View>
  );
}

/* ── Swipe to Connect ───────────────────────────────────── */
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

  const textOpacity = pan.interpolate({ inputRange: [0, maxSlide * 0.7], outputRange: [1, 0], extrapolate: 'clamp' });
  const fillOpacity = pan.interpolate({ inputRange: [0, maxSlide], outputRange: [0, 1], extrapolate: 'clamp' });

  return (
    <View style={[_swipe.wrap, { width: trackW }]}>
      <Animated.View style={[_swipe.fill, { opacity: fillOpacity }]}>
        <LinearGradient colors={['#7c3aed', '#4f46e5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, borderRadius: 32 }} />
      </Animated.View>
      <Animated.Text style={[_swipe.label, { opacity: textOpacity }]}>Slide to shake  →</Animated.Text>
      <Animated.View {...responder.panHandlers} style={[_swipe.knob, { width: knobSize, height: knobSize, transform: [{ translateX: pan }] }]}>
        <Ionicons name={done ? 'checkmark' : 'chevron-forward'} size={24} color="#4f46e5" />
      </Animated.View>
    </View>
  );
}

const _swipe = StyleSheet.create({
  wrap: { marginTop: 28, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.28)', padding: 4, justifyContent: 'center', overflow: 'hidden' },
  fill: { position: 'absolute', top: 4, bottom: 4, left: 4, right: 4, borderRadius: 32 },
  label: { position: 'absolute', left: 0, right: 0, textAlign: 'center', color: '#c4b5fd', fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },
  knob: { borderRadius: 999, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 6 },
});

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SCAN-N-CONNECT PANEL
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function ScanConnectPanel({ tokens, onConnected }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanPhase, setScanPhase] = useState('idle'); // idle | scanning | loading | success | error | already
  const [scanned, setScanned] = useState(false);
  const [connected, setConnected] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);
  const successScale = useRef(new Animated.Value(0.8)).current;

  const reset = () => {
    setScanPhase('idle');
    setScanned(false);
    setConnected(null);
    setErrorMsg('');
    setShowConfetti(false);
    successScale.setValue(0.8);
  };

  const handleBarcode = async ({ data }) => {
    if (scanned) return;
    setScanned(true);
    setScanPhase('loading');

    const raw = String(data || '').trim();
    if (!raw) {
      setErrorMsg('Empty QR code. Please scan a valid badge.');
      setScanPhase('error');
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      const r = await fetch(`${API_URL}/chat/scan-connect/`, {
        method: 'POST',
        headers: { ...API_HEADERS, Authorization: `Bearer ${tokens?.access}` },
        body: JSON.stringify({ registration_id: raw, qr_data: raw }),
      });
      let d = {};
      try {
        d = await r.json();
      } catch (e) {
        d = { success: false, error: 'Invalid response from server' };
      }

      if (!r.ok || !d.success) {
        setErrorMsg(d?.error || (r.status === 404 ? 'Endpoint not found. Make sure backend is running.' : 'Could not connect. Please try again.'));
        setScanPhase('error');
        return;
      }

      const person = d.connected_with
        ? { ...d.connected_with, profile_photo_url: fixMediaUrl(d.connected_with.profile_photo_url) }
        : null;

      setConnected({ ...d, connected_with: person });

      if (d.already_connected) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        setScanPhase('already');
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        Vibration.vibrate([0, 70, 50, 90]);
        setShowConfetti(true);
        Animated.spring(successScale, { toValue: 1, tension: 150, friction: 9, useNativeDriver: true }).start();
        setScanPhase('success');
      }
    } catch {
      setErrorMsg('Network error. Please try again.');
      setScanPhase('error');
    }
  };

  // ─ Permission not yet granted ─
  if (!permission) {
    return <View style={_sc.center}><Text style={_sc.msgText}>Checking camera permission…</Text></View>;
  }
  if (!permission.granted) {
    return (
      <View style={_sc.center}>
        <Ionicons name="camera-outline" size={54} color="#c4b5fd" style={{ marginBottom: 16 }} />
        <Text style={_sc.msgTitle}>Camera Access Needed</Text>
        <Text style={_sc.msgText}>Grant camera permission to scan badges and connect with people.</Text>
        <TouchableOpacity onPress={requestPermission} activeOpacity={0.85} style={{ marginTop: 22 }}>
          <LinearGradient colors={['#7c3aed', '#4f46e5']} style={_s.primaryBtn}>
            <Ionicons name="camera" size={18} color="#fff" />
            <Text style={_s.primaryBtnT}>Grant Camera Access</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  // ─ Idle ─
  if (scanPhase === 'idle') {
    return (
      <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: SPACE.xl }}>
        <View style={_sc.howBox}>
          <View style={_sc.stepRow}>
            <View style={_sc.stepNum}><Text style={_sc.stepNumT}>1</Text></View>
            <Text style={_sc.stepText}>Ask the other person to show their ID badge QR code</Text>
          </View>
          <View style={_sc.stepRow}>
            <View style={_sc.stepNum}><Text style={_sc.stepNumT}>2</Text></View>
            <Text style={_sc.stepText}>Tap the button below and point your camera at their QR</Text>
          </View>
          <View style={_sc.stepRow}>
            <View style={_sc.stepNum}><Text style={_sc.stepNumT}>3</Text></View>
            <Text style={_sc.stepText}>Instantly connected — no matching delay needed!</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => setScanPhase('scanning')} activeOpacity={0.85} style={{ marginTop: 28 }}>
          <LinearGradient colors={['#7c3aed', '#4f46e5']} style={_s.primaryBtn}>
            <Ionicons name="qr-code" size={20} color="#fff" />
            <Text style={_s.primaryBtnT}>Scan Their Badge</Text>
          </LinearGradient>
        </TouchableOpacity>
        <Text style={_sc.supportText}>Works with all badge types: ETD-2026-R-xxx, speaker IDs, organiser IDs, invited guest IDs</Text>
      </View>
    );
  }

  // ─ Scanning ─
  if (scanPhase === 'scanning') {
    return (
      <View style={{ flex: 1, width: '100%' }}>
        <View style={_sc.cameraWrap}>
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            onBarcodeScanned={scanned ? undefined : handleBarcode}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          />
          {/* Viewfinder overlay */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <View style={_sc.finder} />
          </View>
          <TouchableOpacity onPress={() => { setScanned(false); setScanPhase('idle'); }} style={_sc.cancelScanBtn}>
            <Ionicons name="close-circle" size={32} color="#fff" />
          </TouchableOpacity>
          <View style={_sc.scanLabel}>
            <Text style={_sc.scanLabelT}>Point camera at their badge QR code</Text>
          </View>
        </View>
      </View>
    );
  }

  // ─ Loading ─
  if (scanPhase === 'loading') {
    return (
      <View style={_sc.center}>
        <Animated.View style={{ marginBottom: 20 }}>
          <Ionicons name="qr-code" size={64} color="#a78bfa" />
        </Animated.View>
        <Text style={_sc.msgTitle}>Connecting…</Text>
        <Text style={_sc.msgText}>Looking up badge and creating connection</Text>
      </View>
    );
  }

  // ─ Success ─
  if (scanPhase === 'success' && connected) {
    return (
      <View style={{ flex: 1, position: 'relative' }}>
        {showConfetti && <ConfettiBlast />}
        <Animated.View style={[_sc.center, { transform: [{ scale: successScale }] }]}>
          <PointsBurst pts={15} />
          <Text style={{ fontSize: 72, marginBottom: 10 }}>🎉</Text>
          <Text style={_s.successTitle}>Connected!</Text>
          {connected.connected_with?.profile_photo_url
            ? <Image source={{ uri: connected.connected_with.profile_photo_url }} style={_sc.successPhoto} />
            : <GradientAvatar name={connected.connected_with?.name || '?'} size={72} radius={22} />}
          <Text style={_s.successName}>{connected.connected_with?.name}</Text>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => onConnected?.(connected.conversation_id)}
            style={{ marginTop: 22 }}
          >
            <LinearGradient colors={['#7c3aed', '#4f46e5']} style={_s.primaryBtn}>
              <Ionicons name="chatbubble" size={18} color="#fff" />
              <Text style={_s.primaryBtnT}>Say Hi!</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={reset} style={{ marginTop: 14 }}>
            <Text style={_s.secondaryBtnT}>Scan another badge</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  }

  // ─ Already Connected ─
  if (scanPhase === 'already' && connected) {
    return (
      <View style={_sc.center}>
        <View style={_s.alreadyBadgeWrap}>
          <Ionicons name="checkmark-circle" size={48} color="#10B981" />
        </View>
        <Text style={_s.successTitle}>Already Connected!</Text>
        <Text style={_s.successName}>{connected.connected_with?.name}</Text>
        <Text style={_s.alreadySub}>You're already connected. Tap below to chat!</Text>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => onConnected?.(connected.conversation_id)}
          style={{ marginTop: 22 }}
        >
          <LinearGradient colors={['#10B981', '#059669']} style={_s.primaryBtn}>
            <Ionicons name="chatbubble-ellipses" size={18} color="#fff" />
            <Text style={_s.primaryBtnT}>Open Conversation</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity onPress={reset} style={{ marginTop: 14 }}>
          <Text style={_s.secondaryBtnT}>Scan another badge</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─ Error ─
  return (
    <View style={_sc.center}>
      <Text style={{ fontSize: 56 }}>😕</Text>
      <Text style={_s.errorTitle}>Scan Failed</Text>
      <Text style={_s.errorSub}>{errorMsg}</Text>
      <View style={{ marginTop: 16, padding: 12, backgroundColor: 'rgba(56,189,248,0.12)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(56,189,248,0.25)', maxWidth: 300 }}>
        <Text style={{ fontSize: 12, fontWeight: '600', color: '#e0f2fe', textAlign: 'center', lineHeight: 18 }}>
          💡 Can't scan? Switch to the 🤝 Shake tab and enable GPS Nearby Filter to find people around you!
        </Text>
      </View>
      <TouchableOpacity activeOpacity={0.9} onPress={reset} style={{ marginTop: 18 }}>
        <LinearGradient colors={['#7c3aed', '#4f46e5']} style={_s.primaryBtn}>
          <Ionicons name="refresh" size={18} color="#fff" />
          <Text style={_s.primaryBtnT}>Try Again</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const _sc = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACE.xl },
  msgTitle: { fontSize: 22, fontWeight: '900', color: '#fff', textAlign: 'center', marginTop: 8 },
  msgText: { fontSize: 14, color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: 8, lineHeight: 22, maxWidth: 300 },
  howBox: { marginTop: 10, gap: 14, width: '100%' },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepNum: { width: 28, height: 28, borderRadius: 10, backgroundColor: 'rgba(124,58,237,0.18)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.22)', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNumT: { fontSize: 13, fontWeight: '900', color: '#c4b5fd' },
  stepText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.65)', flex: 1, lineHeight: 20 },
  supportText: { fontSize: 11, color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginTop: 20, lineHeight: 18, maxWidth: 300 },
  cameraWrap: { flex: 1, overflow: 'hidden', borderRadius: 0 },
  finder: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  cancelScanBtn: { position: 'absolute', top: 20, right: 20, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 999, padding: 4 },
  scanLabel: { position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center' },
  scanLabelT: { fontSize: 14, fontWeight: '700', color: '#fff', backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  successPhoto: { width: 72, height: 72, borderRadius: 22, marginTop: 14, marginBottom: 4 },
});

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   MAIN COMPONENT
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function ShakeConnectScreen({ tokens, user, onConnected, onBack }) {
  const [activeMode, setActiveMode] = useState('shake'); // 'shake' | 'scan'
  const [phase, setPhase] = useState('idle');
  const [shakers, setShakers] = useState([]);
  const [connected, setConnected] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);

  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [coords, setCoords] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const coordsRef = useRef(null);

  const toggleGps = async () => {
    if (gpsEnabled) {
      setGpsEnabled(false);
      setCoords(null);
      coordsRef.current = null;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      return;
    }

    try {
      setGpsLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGpsLoading(false);
        Alert.alert(
          'Location Optional',
          'GPS is completely optional. Turn on location permissions in settings if you want to filter out anyone shaking further than 100 meters away.'
        );
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (loc?.coords) {
        const c = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        setCoords(c);
        coordsRef.current = c;
        setGpsEnabled(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    } catch {
      Alert.alert('GPS Notice', 'Could not obtain current location. You can still shake to connect without GPS or use QR Scan.');
    } finally {
      setGpsLoading(false);
    }
  };

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
    const payload = { action: 'shake' };
    if (coordsRef.current) {
      payload.lat = coordsRef.current.lat;
      payload.lng = coordsRef.current.lng;
    }
    const r = await fetch(`${API_URL}/chat/shake/`, {
      method: 'POST',
      headers: authH(tokens),
      body: JSON.stringify(payload),
    });
    return r.json();
  };

  const postStatus = async () => {
    const payload = { action: 'status' };
    if (coordsRef.current) {
      payload.lat = coordsRef.current.lat;
      payload.lng = coordsRef.current.lng;
    }
    const r = await fetch(`${API_URL}/chat/shake/`, {
      method: 'POST',
      headers: authH(tokens),
      body: JSON.stringify(payload),
    });
    return r.json();
  };

  const connectTo = async (pickIds) => {
    setPhase('waiting');
    try {
      const payload = Array.isArray(pickIds)
        ? { action: 'pick', pick_user_ids: pickIds }
        : { action: 'pick', pick_user_id: pickIds };

      const r = await fetch(`${API_URL}/chat/shake/`, {
        method: 'POST',
        headers: authH(tokens),
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!d.success) {
        setErrorMsg(d.error || 'Could not connect.');
        setPhase('error');
        return;
      }

      setConnected(d);

      if (d.already_connected) {
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } catch (_) {}
        setPhase('already_connected');
      } else {
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (_) {}
        Vibration.vibrate([0, 70, 50, 90]);
        setShowConfetti(true);
        setPhase('success');
        Animated.spring(successScale, { toValue: 1, tension: 150, friction: 9, useNativeDriver: true }).start();
      }
      cleanup();
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
        
        // Partner paired with me!
        if (d.matched && d.connected_with) {
          stopPolling();
          setConnected(d);
          try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (_) {}
          Vibration.vibrate([0, 70, 50, 90]);
          setShowConfetti(true);
          setPhase('success');
          cleanup();
          Animated.spring(successScale, { toValue: 1, tension: 150, friction: 9, useNativeDriver: true }).start();
          return;
        }

        const list = (d.shakers || []).map(s => ({ ...s, profile_photo_url: fixMediaUrl(s.profile_photo_url) }));
        if (list.length === 1) {
          stopPolling();
          await connectTo(list[0].id);
        } else if (list.length > 1) {
          stopPolling();
          try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (_) {}
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
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch (_) {}
    try {
      const d = await postShake();
      const list = (d.shakers || []).map(s => ({ ...s, profile_photo_url: fixMediaUrl(s.profile_photo_url) }));

      if (list.length === 1) {
        await connectTo(list[0].id);
        return;
      }
      if (list.length > 1) {
        try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (_) {}
        setShakers(list);
        setPhase('picking');
        return;
      }

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
    } catch (e) {}
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
        <GlassOrb size={120} left={-30} top={80} delay={0} />
        <GlassOrb size={90} left={W - 60} top={140} delay={500} />
        <GlassOrb size={70} left={40} top={H - 250} delay={300} />
        <GlassOrb size={100} left={W - 90} top={H - 300} delay={800} />

        {showConfetti && <ConfettiBlast />}

        {/* Header */}
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

        {/* ── Mode Tab Switcher ───────────────────────────────── */}
        <View style={_s.modeTabBar}>
          <TouchableOpacity
            style={[_s.modeTab, activeMode === 'shake' && _s.modeTabActive]}
            onPress={() => setActiveMode('shake')}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 14 }}>🤝</Text>
            <Text style={[_s.modeTabT, activeMode === 'shake' && _s.modeTabTActive]}>Shake</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[_s.modeTab, activeMode === 'scan' && _s.modeTabActive]}
            onPress={() => setActiveMode('scan')}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 14 }}>📷</Text>
            <Text style={[_s.modeTabT, activeMode === 'scan' && _s.modeTabTActive]}>Scan QR</Text>
          </TouchableOpacity>
        </View>

        {/* ── Scan-n-Connect Panel ────────────────────────────── */}
        {activeMode === 'scan' && (
          <ScanConnectPanel tokens={tokens} onConnected={onConnected} />
        )}

        {/* ── Shake Connect Content ───────────────────────────── */}
        {activeMode === 'shake' && <>

        {/* ── Idle / Waiting ────────────────────────────────── */}
        {(phase === 'idle' || phase === 'waiting') && (
          <View style={_s.heroWrap}>
            <RippleRing delay={0} size={240} color={phase === 'waiting' ? '#34d399' : '#7c3aed'} />
            <RippleRing delay={500} size={240} color={phase === 'waiting' ? '#34d399' : '#7c3aed'} />
            <RippleRing delay={1000} size={240} color={phase === 'waiting' ? '#34d399' : '#7c3aed'} />

            <View style={_s.coreOuter}>
              <View style={_s.coreGlass}>
                <Animated.View style={{ transform: [{ translateX: iconShift }, { rotate: iconShift.interpolate({ inputRange: [-14, 14], outputRange: ['-8deg', '8deg'] }) }] }}>
                  <Text style={{ fontSize: 68 }}>📱</Text>
                </Animated.View>
              </View>
            </View>

            <Text style={_s.heroTitle}>
              {phase === 'idle' ? 'Shake your phone!' : 'Searching for shakers...'}
            </Text>

            <Text style={_s.heroSub}>
              {phase === 'idle'
                ? 'Shake phones at the same time to connect with people nearby'
                : 'Matching your shake with nearby phones...'}
            </Text>

            {phase === 'idle' && (
              <View style={_s.howItWorks}>
                <View style={_s.stepRow}>
                  <View style={_s.stepNum}><Text style={_s.stepNumT}>1</Text></View>
                  <Text style={_s.stepText}>Open this screen</Text>
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

            {/* GPS Nearby Filter Toggle (Optional) */}
            <TouchableOpacity
              style={[_s.gpsBar, gpsEnabled && _s.gpsBarActive]}
              onPress={toggleGps}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={gpsEnabled ? ['rgba(16,185,129,0.22)', 'rgba(5,150,105,0.18)'] : ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.03)']}
                style={_s.gpsBarGrad}
              >
                <View style={[_s.gpsIconWrap, gpsEnabled && _s.gpsIconWrapActive]}>
                  <Ionicons name={gpsEnabled ? "location" : "location-outline"} size={16} color={gpsEnabled ? "#34d399" : "#c4b5fd"} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[_s.gpsBarT, gpsEnabled && _s.gpsBarTActive]}>
                    {gpsLoading ? 'Acquiring GPS location...' : gpsEnabled ? 'Nearby Filter ON (Within 100m)' : 'Filter Nearby (GPS Optional)'}
                  </Text>
                  <Text style={_s.gpsBarSub}>
                    {gpsEnabled ? 'Matching only phones within 100 meters' : 'Tap to filter out anyone shaking from >100m away'}
                  </Text>
                </View>
                <View style={[_s.gpsSwitch, gpsEnabled && _s.gpsSwitchActive]}>
                  <View style={[_s.gpsSwitchKnob, gpsEnabled && _s.gpsSwitchKnobActive]} />
                </View>
              </LinearGradient>
            </TouchableOpacity>

            {phase === 'waiting' && !gpsEnabled && (
              <TouchableOpacity onPress={toggleGps} style={_s.gpsHintBtn} activeOpacity={0.8}>
                <Ionicons name="location-outline" size={13} color="#a78bfa" />
                <Text style={_s.gpsHintT}>Unable to match? Tap to enable GPS Nearby Filter</Text>
              </TouchableOpacity>
            )}

            <SwipeToConnect onComplete={onShakeDetected} />
          </View>
        )}

        {/* ── Picking (3+ Simultaneous Shakers) ─────────────── */}
        {phase === 'picking' && (
          <View style={_s.panel}>
            <View style={_s.panelGlass}>
              <View style={_s.panelTop}>
                <Text style={{ fontSize: 28 }}>👥</Text>
                <Text style={_s.panelTitle}>{shakers.length} people shook nearby!</Text>
                <Text style={_s.panelSub}>Connect with individuals or all at once</Text>
              </View>

              {!gpsEnabled && (
                <TouchableOpacity onPress={toggleGps} style={_s.pickingGpsPrompt} activeOpacity={0.85}>
                  <Ionicons name="location" size={15} color="#38bdf8" />
                  <Text style={_s.pickingGpsPromptT}>
                    Seeing people from far away? <Text style={{ textDecorationLine: 'underline', fontWeight: '800' }}>Turn on GPS</Text> to filter within 100m.
                  </Text>
                </TouchableOpacity>
              )}

              {/* Connect with All Button */}
              {shakers.length > 1 && (
                <TouchableOpacity
                  activeOpacity={0.88}
                  style={_s.connectAllBtn}
                  onPress={() => connectTo(shakers.map(s => s.id))}
                >
                  <LinearGradient colors={['#7C3AED', '#4F46E5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={_s.connectAllGradient}>
                    <Ionicons name="people" size={18} color="#FFF" />
                    <Text style={_s.connectAllText}>Connect with Everyone ({shakers.length})</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}

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
                        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                          {item.distance_meters != null && (
                            <View style={_s.distChip}>
                              <Ionicons name="navigate" size={10} color="#38bdf8" />
                              <Text style={_s.distChipT}>~{item.distance_meters}m away</Text>
                            </View>
                          )}
                          {item.already_connected && (
                            <View style={_s.connectedChip}>
                              <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                              <Text style={_s.connectedChipText}>Already Connected</Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <LinearGradient colors={['#7c3aed', '#4f46e5']} style={_s.shakerPickBtn}>
                        <Ionicons name="link" size={16} color="#fff" />
                      </LinearGradient>
                    </View>
                  </TouchableOpacity>
                )}
              />

              <TouchableOpacity onPress={reset} style={_s.secondaryBtn}>
                <Text style={_s.secondaryBtnT}>Shake again</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Success (Match Celebration) ──────────────────── */}
        {phase === 'success' && connected && (
          <Animated.View style={[_s.successWrap, { transform: [{ scale: successScale }] }]}>
            <PointsBurst pts={connected.multi ? connected.connections_count * 15 : 15} />

            <Text style={_s.successEmoji}>🎉</Text>
            <Text style={_s.successTitle}>Connected!</Text>
            <Text style={_s.successName}>
              {connected.multi
                ? `${connected.connections_count} People Connected!`
                : connected.connected_with?.name}
            </Text>

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

        {/* ── Already Connected View ───────────────────────── */}
        {phase === 'already_connected' && connected && (
          <View style={_s.successWrap}>
            <View style={_s.alreadyBadgeWrap}>
              <Ionicons name="checkmark-circle" size={48} color="#10B981" />
            </View>

            <Text style={_s.successTitle}>Already Connected!</Text>
            <Text style={_s.successName}>{connected.connected_with?.name}</Text>
            <Text style={_s.alreadySub}>
              You and {connected.connected_with?.name} are already connected. Tap below to chat!
            </Text>

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => onConnected?.(connected.conversation_id)}
              style={{ marginTop: 24 }}
            >
              <LinearGradient colors={['#10B981', '#059669']} style={_s.primaryBtn}>
                <Ionicons name="chatbubble-ellipses" size={18} color="#fff" />
                <Text style={_s.primaryBtnT}>Open Conversation</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={reset} style={{ marginTop: 14 }}>
              <Text style={_s.secondaryBtnT}>Shake with someone else</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Error ────────────────────────────────────────── */}
        {phase === 'error' && (
          <View style={_s.errorWrap}>
            <Text style={{ fontSize: 64 }}>😕</Text>
            <Text style={_s.errorTitle}>Something went wrong</Text>
            <Text style={_s.errorSub}>{errorMsg}</Text>
            {!gpsEnabled && (
              <TouchableOpacity onPress={toggleGps} style={{ marginTop: 14, padding: 12, backgroundColor: 'rgba(52,211,153,0.12)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(52,211,153,0.3)', flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: 300, alignSelf: 'center' }} activeOpacity={0.85}>
                <Ionicons name="location" size={16} color="#34d399" />
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#d1fae5', flex: 1 }}>Enable GPS to find nearby shakers within 100m</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity activeOpacity={0.9} onPress={reset} style={{ marginTop: 16 }}>
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
              <Text style={_s.tipText}>Works within a 3-second window • Zero Bluetooth needed</Text>
            </View>
          </View>
        )}
        </>}
      </LinearGradient>
    </Animated.View>
  );
}

const _s = StyleSheet.create({
  root: { flex: 1 },
  bg: { flex: 1, overflow: 'hidden' },

  header: { paddingTop: TOP + 8, paddingHorizontal: SPACE.xl, paddingBottom: 8 },
  headerGlass: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 18, padding: 8, paddingHorizontal: 12,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 17, fontWeight: '900', color: '#fff', letterSpacing: -0.2 },

  modeTabBar: {
    flexDirection: 'row',
    marginHorizontal: SPACE.xl,
    marginTop: 6,
    marginBottom: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 16,
    padding: 4,
    gap: 4,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  modeTabActive: { backgroundColor: 'rgba(124,58,237,0.30)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.35)' },
  modeTabT: { fontSize: 13, fontWeight: '800', color: 'rgba(255,255,255,0.45)' },
  modeTabTActive: { color: '#c4b5fd' },

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

  connectAllBtn: { marginBottom: 14, borderRadius: 16, overflow: 'hidden' },
  connectAllGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 16 },
  connectAllText: { color: '#FFF', fontSize: 14, fontWeight: '800' },

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

  connectedChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.12)', paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 10, alignSelf: 'flex-start',
  },
  connectedChipText: { fontSize: 10, fontWeight: '700', color: '#10B981' },

  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACE.xl },
  successEmoji: { fontSize: 80, marginBottom: 12 },
  successTitle: { fontSize: 32, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  successName: { fontSize: 22, fontWeight: '800', color: '#c4b5fd', marginTop: 6, textAlign: 'center' },

  alreadyBadgeWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(16, 185, 129, 0.12)', justifyContent: 'center', alignItems: 'center',
    marginBottom: 16, borderWidth: 2, borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  alreadySub: {
    fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.6)',
    textAlign: 'center', marginTop: 10, maxWidth: 280, lineHeight: 20,
  },

  pointsBurst: { position: 'absolute', top: -50, zIndex: 10 },
  pointsPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999 },
  pointsText: { fontSize: 15, fontWeight: '900', color: '#fff' },

  primaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 30, paddingVertical: 16, borderRadius: 16 },
  primaryBtnT: { fontSize: 16, fontWeight: '900', color: '#fff' },
  secondaryBtn: { alignSelf: 'center', marginTop: 10, paddingVertical: 10 },
  secondaryBtnT: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.45)' },

  errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACE.xl },
  errorTitle: { fontSize: 26, fontWeight: '900', color: '#fff', marginTop: 12 },
  errorSub: { fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 8, lineHeight: 22 },

  tipRow: { paddingHorizontal: SPACE.xl, paddingBottom: BOTTOM + 12 },
  tipGlass: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14, padding: 12, justifyContent: 'center',
  },
  tipText: { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.4)' },

  // GPS Nearby Filter Styles
  gpsBar: {
    width: '100%',
    maxWidth: 320,
    marginTop: 20,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  gpsBarActive: {
    borderColor: 'rgba(52,211,153,0.45)',
  },
  gpsBarGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  gpsIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: 'rgba(124,58,237,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gpsIconWrapActive: {
    backgroundColor: 'rgba(16,185,129,0.25)',
  },
  gpsBarT: {
    fontSize: 13,
    fontWeight: '800',
    color: '#e2e8f0',
  },
  gpsBarTActive: {
    color: '#34d399',
  },
  gpsBarSub: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  gpsSwitch: {
    width: 40,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.15)',
    padding: 2,
    justifyContent: 'center',
  },
  gpsSwitchActive: {
    backgroundColor: '#10b981',
  },
  gpsSwitchKnob: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#fff',
  },
  gpsSwitchKnobActive: {
    alignSelf: 'flex-end',
  },

  gpsHintBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(124,58,237,0.15)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.25)',
  },
  gpsHintT: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#c4b5fd',
  },

  distChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56,189,248,0.14)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.25)',
  },
  distChipT: {
    fontSize: 10,
    fontWeight: '800',
    color: '#38bdf8',
  },

  pickingGpsPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(56,189,248,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.25)',
    borderRadius: 14,
    padding: 10,
    marginBottom: 12,
  },
  pickingGpsPromptT: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#e0f2fe',
    lineHeight: 16,
  },
});

