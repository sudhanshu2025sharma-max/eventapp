import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Platform, Animated, Modal,
  ActivityIndicator, ScrollView, RefreshControl, TouchableOpacity,
  Dimensions,
} from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS, FONT, SPACE, RADIUS, API_URL, API_HEADERS } from '../theme';
import { GradientAvatar, FadeIn } from '../components';
import qrGenerator from 'qrcode-generator';

const { width: W } = Dimensions.get('window');
const CARD_W = W - SPACE.xl * 2;
const NOTCH = 14;

// ── QR Renderer ────────────────────────────────────────────────────────────
function QRCodeSVG({ value, size = 200, color = '#0a1628' }) {
  const qr = qrGenerator(0, 'M');
  qr.addData(value);
  qr.make();
  const count = qr.getModuleCount();
  const cs    = size / count;
  const cells = [];
  for (let r = 0; r < count; r++)
    for (let c = 0; c < count; c++)
      if (qr.isDark(r, c))
        cells.push(<Rect key={`${r}-${c}`} x={c * cs} y={r * cs} width={cs} height={cs} fill={color} />);
  return <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>{cells}</Svg>;
}

// ── Ticket perforated edge ─────────────────────────────────────────────────
function PerforatedEdge({ side = 'top' }) {
  const dots = Math.floor(CARD_W / 16);
  return (
    <View style={[perf.row, side === 'bottom' && perf.bottom]}>
      {Array.from({ length: dots }, (_, i) => (
        <View key={i} style={perf.dot} />
      ))}
    </View>
  );
}

const perf = StyleSheet.create({
  row:    { flexDirection: 'row', justifyContent: 'space-evenly', width: '100%', position: 'absolute', zIndex: 5 },
  bottom: { bottom: -4 },
  dot:    { width: 8, height: 8, borderRadius: 4, backgroundColor: '#f0f4f9' },
});

// ── Holographic shimmer overlay ────────────────────────────────────────────
function HolographicShimmer() {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 3000, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 3000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const translateX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-CARD_W, CARD_W],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[holo.bar, { transform: [{ translateX }, { rotate: '25deg' }] }]}
    />
  );
}

const holo = StyleSheet.create({
  bar: {
    position: 'absolute', top: -40, width: 60, height: 500,
    backgroundColor: 'rgba(255,255,255,0.12)',
    zIndex: 3,
  },
});

// ── Notch cutout (left/right semicircle) ──────────────────────────────────
function Notch({ side, top }) {
  return (
    <View style={[notch.base, {
      [side]: -NOTCH / 2,
      top,
    }]} />
  );
}

const notch = StyleSheet.create({
  base: {
    position: 'absolute', width: NOTCH, height: NOTCH,
    borderRadius: NOTCH / 2, backgroundColor: '#f0f4f9', zIndex: 5,
  },
});

// ── Dashed tear line ──────────────────────────────────────────────────────
function TearLine({ top }) {
  const dashes = Math.floor((CARD_W - NOTCH * 2) / 12);
  return (
    <View style={[tear.row, { top }]}>
      {Array.from({ length: dashes }, (_, i) => (
        <View key={i} style={tear.dash} />
      ))}
    </View>
  );
}

const tear = StyleSheet.create({
  row:  { position: 'absolute', left: NOTCH, right: NOTCH, flexDirection: 'row', justifyContent: 'space-evenly', zIndex: 4 },
  dash: { width: 6, height: 1.5, backgroundColor: 'rgba(0,0,0,0.12)', borderRadius: 1 },
});

// ── Check-In Popup ────────────────────────────────────────────────────────
let _popupShownThisSession = false;

function CheckInPopup({ visible, onClose, data }) {
  const scale   = useRef(new Animated.Value(0.7)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale,   { toValue: 1, tension: 65, friction: 8, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible || !data) return null;

  return (
    <Modal transparent visible={visible} animationType="none">
      <Animated.View style={[pop.overlay, { opacity }]}>
        <Animated.View style={[pop.popup, { transform: [{ scale }] }]}>
          <View style={pop.iconCircle}>
            <Ionicons name="checkmark-circle" size={56} color={COLORS.success} />
          </View>
          <Text style={pop.popTitle}>Welcome to ETD 2026! 🎉</Text>
          <Text style={pop.popSub}>You have been successfully checked in</Text>
          {data.points_awarded > 0 && (
            <View style={pop.pointsRow}>
              <LinearGradient colors={[COLORS.accent, COLORS.accentDark]} style={pop.pointsPill}>
                <Ionicons name="star" size={16} color="#fff" />
                <Text style={pop.pointsText}>+{data.points_awarded} Points Earned!</Text>
              </LinearGradient>
            </View>
          )}
          <View style={pop.infoCard}>
            <View style={pop.infoRow}>
              <Ionicons name="time-outline" size={16} color={COLORS.textTer} />
              <Text style={pop.infoLabel}>Checked in at</Text>
              <Text style={pop.infoValue}>
                {data.scanned_at
                  ? new Date(data.scanned_at).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })
                  : 'Just now'}
              </Text>
            </View>
            <View style={[pop.infoRow, { borderTopWidth: 1, borderTopColor: COLORS.borderLight }]}>
              <Ionicons name="gift-outline" size={16} color={COLORS.textTer} />
              <Text style={pop.infoLabel}>Conference Kit</Text>
              <Text style={[pop.infoValue, {
                color: data.goodies_status === 'received' ? COLORS.success : COLORS.accent
              }]}>
                {data.goodies_status === 'received' ? '✓ Received'
                  : data.goodies_status === 'skipped' ? 'Not received'
                  : 'Pending'}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={pop.closeBtn} onPress={onClose} activeOpacity={0.8}>
            <LinearGradient colors={[COLORS.brand, COLORS.brandDark]} style={pop.closeBtnInner}>
              <Text style={pop.closeBtnText}>Got it!</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ── Meal Pass Modal ───────────────────────────────────────────────────────
function MealPassModal({ visible, pass, onClose }) {
  const scale   = useRef(new Animated.Value(0.7)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scale.setValue(0.7); opacity.setValue(0);
      Animated.parallel([
        Animated.spring(scale,   { toValue: 1, tension: 65, friction: 8, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible || !pass) return null;

  return (
    <Modal transparent visible={visible} animationType="none">
      <Animated.View style={[pop.overlay, { opacity }]}>
        <Animated.View style={[pop.popup, { transform: [{ scale }] }]}>
          <LinearGradient colors={[COLORS.brand, COLORS.brandDark]} style={ml.modalHeader}>
            <Text style={{ fontSize: 44 }}>🍽️</Text>
            <Text style={ml.modalTitle}>MEAL PASS</Text>
            <Text style={ml.modalDate}>{pass.date}</Text>
          </LinearGradient>
          <View style={ml.modalBody}>
            {pass.used ? (
              <View style={{ alignItems:'center', paddingVertical: SPACE.xl, gap: SPACE.sm }}>
                <Ionicons name="close-circle" size={56} color={COLORS.error} />
                <Text style={{ fontSize: FONT.md, fontWeight:'700', color: COLORS.error }}>Already Used</Text>
              </View>
            ) : (
              <View style={ml.qrWrap}>
                <QRCodeSVG value={pass.qr_data} size={180} />
              </View>
            )}
            {!pass.used && <Text style={ml.hint}>Show this QR to staff at the meal venue</Text>}
          </View>
          <TouchableOpacity style={ml.closeBtn} onPress={onClose}>
            <Text style={{ fontSize: FONT.md, fontWeight:'700', color: COLORS.brand }}>Close</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────
export default function QRScreen({ user, tokens }) {
  const sc = useRef(new Animated.Value(0.88)).current;
  const op = useRef(new Animated.Value(0)).current;

  const [qrData,         setQrData]         = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);
  const [refreshing,     setRefreshing]     = useState(false);
  const [statusData,     setStatusData]     = useState(null);
  const [showPopup,      setShowPopup]      = useState(false);
  const [mealWindow,     setMealWindow]     = useState(null);
  const [generating,     setGenerating]     = useState(false);
  const [activeMealPass, setActiveMealPass] = useState(null);
  const [showMealModal,  setShowMealModal]  = useState(false);

  const checkedInRef = useRef(false);
  const mountedRef   = useRef(true);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(sc, { toValue: 1, tension: 55, friction: 8, useNativeDriver: true }),
      Animated.timing(op, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
    return () => { mountedRef.current = false; };
  }, []);

  const load = async (isRefresh = false) => {
    if (!mountedRef.current) return;
    if (isRefresh) setRefreshing(true); else if (!qrData) setLoading(true);
    setError(null);
    try {
      const headers = { ...API_HEADERS, Authorization: `Bearer ${tokens?.access}` };
      const [qrRes, statusRes, mealRes] = await Promise.all([
        fetch(`${API_URL}/checkins/my-qr/`,      { headers }),
        fetch(`${API_URL}/checkins/status/`,      { headers }),
        fetch(`${API_URL}/checkins/meal/status/`, { headers }).catch(() => null),
      ]);
      if (!mountedRef.current) return;
      if (!qrRes.ok) throw new Error('Failed');

      const qr   = await qrRes.json();
      const st   = await statusRes.json();
      const meal = mealRes ? await mealRes.json() : { windows: [] };

      setQrData(qr);
      setStatusData(st);
      setMealWindow(meal.windows?.[0] || null);

      if (st.checked_in && !_popupShownThisSession) {
        const scannedAt = st.scanned_at ? new Date(st.scanned_at).getTime() : 0;
        if (Date.now() - scannedAt < 60000) setShowPopup(true);
        _popupShownThisSession = true;
      }
      checkedInRef.current = st.checked_in;
    } catch {
      if (mountedRef.current) setError('Could not load QR. Check connection.');
    } finally {
      if (mountedRef.current) { setLoading(false); setRefreshing(false); }
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!checkedInRef.current) load(false);
    }, 300000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    load(true);
  };

  const generateMealPass = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`${API_URL}/checkins/meal/generate/`, {
        method:  'POST',
        headers: { ...API_HEADERS, Authorization: `Bearer ${tokens?.access}` },
        body:    JSON.stringify({ meal_type: 'meal' }),
      });
      const data = await res.json();
      if (data.success) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        setActiveMealPass(data);
        setShowMealModal(true);
        load();
      }
    } catch {}
    finally { setGenerating(false); }
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={COLORS.brand} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={s.center}>
        <Ionicons name="wifi-outline" size={40} color={COLORS.textTer} />
        <Text style={s.errorText}>{error}</Text>
        <TouchableOpacity onPress={() => load()} style={s.retryBtn}>
          <Ionicons name="refresh" size={18} color={COLORS.brand} />
          <Text style={s.retryText}>Tap to retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const checkedIn = statusData?.checked_in;
  const role = (user.role || 'participant').replace(/_/g, ' ').toUpperCase();

  return (
    <>
      <CheckInPopup visible={showPopup} data={statusData} onClose={() => setShowPopup(false)} />
      <MealPassModal visible={showMealModal} pass={activeMealPass} onClose={() => setShowMealModal(false)} />

      <ScrollView
        style={s.bg}
        contentContainerStyle={s.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.brand} />
        }
      >
        <View style={s.header}>
          <Text style={s.title}>My Pass</Text>
          <Text style={s.sub}>Show at entry points and check-in desks</Text>
        </View>

        {/* ── Ticket Card ────────────────────────────────────── */}
        <Animated.View style={{ transform: [{ scale: sc }], opacity: op, width: '100%' }}>
          <View style={s.ticket}>
            <HolographicShimmer />
            <PerforatedEdge side="top" />

            {/* Top strip */}
            <LinearGradient
              colors={checkedIn ? [COLORS.success, '#059669'] : [COLORS.brand, COLORS.brandDark]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.strip}
            >
              <Text style={s.stripLabel}>ETD 2026</Text>
              <View style={s.stripDivider} />
              <Text style={s.stripRight}>IIT DELHI</Text>
            </LinearGradient>

            {/* Status banner */}
            {checkedIn && (
              <View style={s.checkedBanner}>
                <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
                <Text style={s.checkedText}>CHECKED IN</Text>
                {statusData?.goodies_status === 'received' && (
                  <View style={s.kitPill}>
                    <Ionicons name="gift" size={10} color={COLORS.accent} />
                    <Text style={s.kitText}>Kit ✓</Text>
                  </View>
                )}
              </View>
            )}

            {/* Attendee info */}
            <View style={s.attendeeRow}>
              <GradientAvatar name={user.first_name || user.email} size={48} radius={14} />
              <View style={{ flex: 1, marginLeft: SPACE.md }}>
                <Text style={s.attendeeName}>{user.first_name} {user.last_name}</Text>
                <Text style={s.attendeeEmail}>{user.email}</Text>
                <View style={s.rolePill}>
                  <Text style={s.roleText}>{role}</Text>
                </View>
              </View>
            </View>

            {/* Tear line + notches */}
            <Notch side="left" top={210} />
            <Notch side="right" top={210} />
            <TearLine top={216} />

            {/* QR Section */}
            <View style={s.qrSection}>
              {checkedIn && (
                <View style={s.scannedOverlay}>
                  <View style={s.scannedCircle}>
                    <Ionicons name="checkmark-circle" size={44} color={COLORS.success} />
                  </View>
                </View>
              )}
              <View style={{ opacity: checkedIn ? 0.2 : 1, alignItems: 'center' }}>
                <QRCodeSVG value={qrData.qr_data} size={180} />
              </View>
              <Text style={s.regId}>{qrData.registration_id || '—'}</Text>
            </View>

            {/* Footer info row */}
            <View style={s.infoRow}>
              <View style={s.infoItem}>
                <Text style={s.infoLabel}>REG ID</Text>
                <Text style={s.infoValue}>{qrData.registration_id || '—'}</Text>
              </View>
              <View style={s.infoSep} />
              <View style={s.infoItem}>
                <Text style={s.infoLabel}>STATUS</Text>
                <Text style={[s.infoValue, { color: checkedIn ? COLORS.success : COLORS.accent }]}>
                  {checkedIn ? '✓ Verified' : 'Pending'}
                </Text>
              </View>
              <View style={s.infoSep} />
              <View style={s.infoItem}>
                <Text style={s.infoLabel}>VALID</Text>
                <Text style={s.infoValue}>3 Days</Text>
              </View>
            </View>

            {/* Bottom seal */}
            <View style={s.seal}>
              <Ionicons name="shield-checkmark" size={12} color={COLORS.success} />
              <Text style={s.sealText}>Verified Attendee  ·  ETD 2026</Text>
            </View>

            <PerforatedEdge side="bottom" />
          </View>
        </Animated.View>

        {/* ── Refresh Button ────────────────────────────────── */}
        <TouchableOpacity onPress={handleRefresh} activeOpacity={0.8} style={s.refreshBtn}>
          <Ionicons name="refresh" size={18} color={COLORS.brand} />
          <Text style={s.refreshText}>Refresh Status</Text>
        </TouchableOpacity>

        {/* ── Meal Pass ─────────────────────────────────────── */}
        {mealWindow && (
          <FadeIn delay={200}>
            <Text style={s.mealTitle}>Meal Pass</Text>
            <Text style={s.mealSub}>Generate your QR pass for today's meal</Text>
            <View style={s.mealCard}>
              <View style={[s.mealCardLeft, { backgroundColor: COLORS.brandLight }]}>
                <Text style={{ fontSize: 28 }}>🍽️</Text>
              </View>
              <View style={s.mealCardCenter}>
                <Text style={s.mealCardLabel}>Today's Meal</Text>
                <Text style={s.mealCardDate}>{mealWindow.date}</Text>
                {mealWindow.pass_used && (
                  <Text style={{ fontSize: FONT.xs, color: COLORS.success, fontWeight: '600', marginTop: 2 }}>✓ Used</Text>
                )}
              </View>
              {mealWindow.pass_used ? (
                <View style={[s.mealBadge, { backgroundColor: COLORS.successLight }]}>
                  <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                </View>
              ) : (
                <TouchableOpacity
                  style={[s.mealBtn, { backgroundColor: COLORS.brand }]}
                  onPress={generateMealPass}
                  disabled={generating}
                  activeOpacity={0.85}
                >
                  {generating
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={s.mealBtnText}>{mealWindow.pass_exists ? 'Show QR' : 'Generate'}</Text>
                  }
                </TouchableOpacity>
              )}
            </View>
          </FadeIn>
        )}

        <FadeIn delay={300}>
          <Text style={s.hint}>
            {checkedIn ? 'You are all set! Enjoy the conference.' : 'Keep screen brightness high when scanning'}
          </Text>
        </FadeIn>
        <View style={{ height: 120 }} />
      </ScrollView>
    </>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const pop = StyleSheet.create({
  overlay:      { flex:1, backgroundColor:'rgba(0,0,0,0.55)', justifyContent:'center', alignItems:'center', padding:32 },
  popup:        { width:'100%', maxWidth:340, backgroundColor:'#fff', borderRadius:28, padding:28, alignItems:'center',
                  ...Platform.select({ ios:{ shadowColor:'#000', shadowOffset:{ width:0, height:12 }, shadowOpacity:0.25, shadowRadius:32 }, android:{ elevation:8 } }) },
  iconCircle:   { marginBottom: SPACE.lg },
  popTitle:     { fontSize:22, fontWeight:'900', color: COLORS.text, textAlign:'center', letterSpacing:-0.3 },
  popSub:       { fontSize: FONT.sm, color: COLORS.textSec, textAlign:'center', marginTop: SPACE.xs, marginBottom: SPACE.xl },
  pointsRow:    { marginBottom: SPACE.xl },
  pointsPill:   { flexDirection:'row', alignItems:'center', gap: SPACE.sm, paddingHorizontal: SPACE.xl, paddingVertical: SPACE.md, borderRadius: RADIUS.full },
  pointsText:   { fontSize: FONT.sm, fontWeight:'800', color:'#fff', letterSpacing:0.3 },
  infoCard:     { width:'100%', backgroundColor:'#f8fafc', borderRadius:16, overflow:'hidden', marginBottom: SPACE.xl },
  infoRow:      { flexDirection:'row', alignItems:'center', gap: SPACE.sm, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md },
  infoLabel:    { flex:1, fontSize: FONT.xs, color: COLORS.textTer },
  infoValue:    { fontSize: FONT.sm, fontWeight:'700', color: COLORS.text },
  closeBtn:     { width:'100%', borderRadius:16, overflow:'hidden' },
  closeBtnInner:{ height:48, alignItems:'center', justifyContent:'center' },
  closeBtnText: { fontSize: FONT.md, fontWeight:'700', color:'#fff' },
});

const ml = StyleSheet.create({
  modalHeader: { alignItems:'center', paddingVertical: SPACE.xl, paddingHorizontal: SPACE.xxl, borderRadius:28 },
  modalTitle:  { fontSize: FONT.xl, fontWeight:'900', color:'#fff', letterSpacing:1, marginTop: SPACE.sm },
  modalDate:   { fontSize: FONT.xs, color:'rgba(255,255,255,0.75)', marginTop:4 },
  modalBody:   { padding: SPACE.xl, alignItems:'center' },
  qrWrap:      { backgroundColor:'#fff', padding:16, borderRadius:16, borderWidth:1, borderColor: COLORS.borderLight, marginBottom: SPACE.md },
  hint:        { fontSize: FONT.xs, color: COLORS.textTer, textAlign:'center' },
  closeBtn:    { borderTopWidth:1, borderTopColor: COLORS.borderLight, padding: SPACE.lg, alignItems:'center' },
});

const s = StyleSheet.create({
  bg:           { flex: 1, backgroundColor: '#f0f4f9' },
  container:    { paddingHorizontal: SPACE.xl, paddingBottom: 48, alignItems: 'center' },
  center:       { flex: 1, backgroundColor: '#f0f4f9', justifyContent: 'center', alignItems: 'center', gap: SPACE.md },
  header:       { paddingTop: Platform.OS === 'ios' ? 58 : 46, paddingBottom: SPACE.lg, width: '100%' },
  title:        { fontSize: 28, fontWeight: '900', color: COLORS.brand, letterSpacing: -0.5 },
  sub:          { fontSize: FONT.xs, color: COLORS.textTer, marginTop: 3 },

  // Ticket
  ticket: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 22,
    overflow: 'hidden',
    position: 'relative',
    ...Platform.select({
      ios: { shadowColor: '#002182', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.15, shadowRadius: 28 },
      android: { elevation: 6 },
    }),
  },
  strip:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: SPACE.sm },
  stripLabel:   { fontSize: 13, fontWeight: '900', color: '#fff', letterSpacing: 2 },
  stripDivider: { width: 1, height: 14, backgroundColor: 'rgba(255,255,255,0.4)' },
  stripRight:   { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.8)', letterSpacing: 1.5 },

  checkedBanner:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: SPACE.sm, backgroundColor: COLORS.successLight },
  checkedText:  { fontSize: 11, fontWeight: '800', color: COLORS.success, letterSpacing: 1 },
  kitPill:      { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: COLORS.accentLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full, marginLeft: 4 },
  kitText:      { fontSize: 9, fontWeight: '700', color: COLORS.accent },

  attendeeRow:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACE.lg, paddingVertical: SPACE.lg },
  attendeeName: { fontSize: FONT.md, fontWeight: '800', color: COLORS.text },
  attendeeEmail:{ fontSize: FONT.xs, color: COLORS.textTer, marginTop: 2 },
  rolePill:     { alignSelf: 'flex-start', marginTop: 4, backgroundColor: COLORS.brandLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  roleText:     { fontSize: 9, fontWeight: '800', color: COLORS.brand, letterSpacing: 0.5 },

  qrSection:    { alignItems: 'center', paddingVertical: SPACE.xl, position: 'relative' },
  scannedOverlay:{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  scannedCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  regId:        { marginTop: SPACE.md, fontSize: FONT.xs, fontWeight: '800', color: COLORS.textTer, letterSpacing: 3 },

  infoRow:      { flexDirection: 'row', paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, borderTopWidth: 1, borderTopColor: COLORS.borderLight },
  infoItem:     { flex: 1, alignItems: 'center' },
  infoSep:      { width: 1, backgroundColor: COLORS.borderLight, marginVertical: 2 },
  infoLabel:    { fontSize: 9, fontWeight: '700', color: COLORS.textTer, letterSpacing: 1, marginBottom: 4 },
  infoValue:    { fontSize: FONT.sm, fontWeight: '800', color: COLORS.text },

  seal:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: SPACE.md, borderTopWidth: 1, borderTopColor: COLORS.borderLight },
  sealText:     { fontSize: 10, fontWeight: '600', color: COLORS.textTer, letterSpacing: 0.5 },

  // Refresh button
  refreshBtn:   { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginTop: SPACE.lg, paddingVertical: SPACE.md, paddingHorizontal: SPACE.xl, borderRadius: RADIUS.full, backgroundColor: COLORS.brandLight },
  refreshText:  { fontSize: FONT.sm, fontWeight: '700', color: COLORS.brand },

  // Meal
  mealTitle:    { fontSize: 22, fontWeight: '900', color: COLORS.brand, letterSpacing: -0.3, marginTop: SPACE.xxl, marginBottom: SPACE.xxs, width: '100%' },
  mealSub:      { fontSize: FONT.xs, color: COLORS.textTer, marginBottom: SPACE.lg, width: '100%' },
  mealCard: {
    width: '100%', flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', marginBottom: SPACE.md, overflow: 'hidden',
  },
  mealCardLeft:   { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  mealCardCenter: { flex: 1, paddingVertical: SPACE.md, paddingHorizontal: SPACE.sm },
  mealCardLabel:  { fontSize: FONT.md, fontWeight: '700', color: COLORS.text },
  mealCardDate:   { fontSize: FONT.xs, color: COLORS.textTer, marginTop: 2 },
  mealBadge:      { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: SPACE.md },
  mealBtn:        { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm + 2, borderRadius: 12, marginRight: SPACE.md },
  mealBtnText:    { fontSize: FONT.sm, fontWeight: '700', color: '#fff' },

  hint:           { marginTop: SPACE.xl, fontSize: 12, color: COLORS.textTer, textAlign: 'center' },
  errorText:      { fontSize: FONT.sm, color: COLORS.error, textAlign: 'center' },
  retryBtn:       { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginTop: SPACE.md },
  retryText:      { fontSize: FONT.sm, color: COLORS.brand, fontWeight: '600' },
});
