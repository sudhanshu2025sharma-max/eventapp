import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Platform, Animated, Modal,
  ActivityIndicator, ScrollView, RefreshControl, TouchableOpacity,
} from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, SPACE, RADIUS, API_URL, API_HEADERS } from '../theme';
import { GradientAvatar, FadeIn } from '../components';
import qrGenerator from 'qrcode-generator';

// ── QR Renderer ────────────────────────────────────────────────────────────
function QRCodeSVG({ value, size = 200, color = '#0a1628' }) {
  const text = String(value || 'ETD-2026');
  const qr = qrGenerator(0, 'M');
  qr.addData(text);
  qr.make();
  const count = qr.getModuleCount();
  const cs = size / count;
  const cells = [];
  for (let r = 0; r < count; r++)
    for (let c = 0; c < count; c++)
      if (qr.isDark(r, c))
        cells.push(<Rect key={`${r}-${c}`} x={c * cs} y={r * cs} width={cs} height={cs} fill={color} />);
  return <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>{cells}</Svg>;
}

// ── Module-level flag: popup shown once per app session ────────────────────
let _popupShownThisSession = false;

function CheckInPopup({ visible, onClose, data }) {
  const scale = useRef(new Animated.Value(0.7)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, tension: 65, friction: 8, useNativeDriver: true }),
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
                {data.scanned_at ? new Date(data.scanned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
              </Text>
            </View>
            <View style={[pop.infoRow, { borderTopWidth: 1, borderTopColor: COLORS.borderLight }]}>
              <Ionicons name="gift-outline" size={16} color={COLORS.textTer} />
              <Text style={pop.infoLabel}>Goodies bag</Text>
              <Text style={[pop.infoValue, { color: data.goodies_status === 'received' ? COLORS.success : COLORS.accent }]}>
                {data.goodies_status === 'received' ? '✓ Received' : data.goodies_status === 'skipped' ? 'Not received' : 'Pending'}
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

// ── Meal Pass QR Modal ────────────────────────────────────────────────────
function MealPassModal({ visible, pass, onClose }) {
  const scale = useRef(new Animated.Value(0.7)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scale.setValue(0.7);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, tension: 65, friction: 8, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible || !pass) return null;
  const icon = pass.meal_type === 'lunch' ? '🍽️' : '🍷';

  return (
    <Modal transparent visible={visible} animationType="none">
      <Animated.View style={[pop.overlay, { opacity }]}>
        <Animated.View style={[pop.popup, { transform: [{ scale }] }]}>
          <LinearGradient
            colors={pass.meal_type === 'lunch' ? [COLORS.accent, COLORS.accentDark] : [COLORS.purple, '#6d28d9']}
            style={ml.modalHeader}
          >
            <Text style={{ fontSize: 44 }}>{icon}</Text>
            <Text style={ml.modalTitle}>{pass.meal_type.toUpperCase()} PASS</Text>
            <Text style={ml.modalDate}>{pass.date}</Text>
          </LinearGradient>
          <View style={ml.modalBody}>
            {pass.used ? (
              <View style={{ alignItems: 'center', paddingVertical: SPACE.xl, gap: SPACE.sm }}>
                <Ionicons name="close-circle" size={56} color={COLORS.error} />
                <Text style={{ fontSize: FONT.md, fontWeight: '700', color: COLORS.error }}>Already Used</Text>
              </View>
            ) : (
              <View style={ml.qrWrap}>
                <QRCodeSVG value={pass.qr_data} size={180} />
              </View>
            )}
            {!pass.used && (
              <Text style={ml.hint}>Show this QR to staff at the {pass.meal_type} venue</Text>
            )}
          </View>
          <TouchableOpacity style={ml.closeBtn} onPress={onClose}>
            <Text style={{ fontSize: FONT.md, fontWeight: '700', color: COLORS.brand }}>Close</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ── Main QR Screen ────────────────────────────────────────────────────────
export default function QRScreen({ user, tokens }) {
  const sc = useRef(new Animated.Value(0.88)).current;
  const op = useRef(new Animated.Value(0)).current;
  const [qrData,     setQrData]     = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [statusData, setStatusData] = useState(null);
  const [showPopup,  setShowPopup]  = useState(false);

  // Meal pass state
  const [mealWindows,    setMealWindows]    = useState([]);
  const [generating,     setGenerating]     = useState('');
  const [activeMealPass, setActiveMealPass] = useState(null);
  const [showMealModal,  setShowMealModal]  = useState(false);

  // Refs for polling control
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
        fetch(`${API_URL}/checkins/my-qr/`, { headers }),
        fetch(`${API_URL}/checkins/status/`, { headers }),
        fetch(`${API_URL}/checkins/meal/status/`, { headers }).catch(() => null),
      ]);
      if (!mountedRef.current) return;
      if (!qrRes.ok) throw new Error('Failed');

      const qr   = await qrRes.json();
      const st   = await statusRes.json();
      const meal = mealRes ? await mealRes.json() : { windows: [] };

      setQrData(qr);
      setStatusData(st);
      setMealWindows(meal.windows || []);

      // Show popup ONCE — only if checked in within last 60s
      if (st.checked_in && !_popupShownThisSession) {
        const scannedAt = st.scanned_at ? new Date(st.scanned_at).getTime() : 0;
        if (Date.now() - scannedAt < 60000) {
          setShowPopup(true);
        }
        _popupShownThisSession = true;
      }

      checkedInRef.current = st.checked_in;
    } catch (e) {
      if (mountedRef.current) setError('Could not load QR. Check connection.');
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  // Initial load — once
  useEffect(() => { load(); }, []);

  // Poll every 10s ONLY if not checked in yet — stops after check-in
  useEffect(() => {
    const interval = setInterval(() => {
      if (!checkedInRef.current) load(false);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Meal pass generation
  const generateMealPass = async (mealType) => {
    setGenerating(mealType);
    try {
      const res = await fetch(`${API_URL}/checkins/meal/generate/`, {
        method:  'POST',
        headers: { ...API_HEADERS, Authorization: `Bearer ${tokens?.access}` },
        body:    JSON.stringify({ meal_type: mealType }),
      });
      const data = await res.json();
      if (data.success) {
        setActiveMealPass(data);
        setShowMealModal(true);
        load();
      }
    } catch (_) {}
    finally { setGenerating(''); }
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
        <Text style={s.retry} onPress={() => load()}>Tap to retry</Text>
      </View>
    );
  }

  const checkedIn = statusData?.checked_in;

  const MEAL_CONFIG = {
    lunch:  { icon: '🍽️', label: 'Lunch',  color: COLORS.accent, bg: COLORS.accentLight },
    dinner: { icon: '🍷', label: 'Dinner', color: COLORS.purple, bg: COLORS.purpleLight },
  };

  return (
    <>
      <CheckInPopup
        visible={showPopup}
        data={statusData}
        onClose={() => setShowPopup(false)}
      />
      <MealPassModal
        visible={showMealModal}
        pass={activeMealPass}
        onClose={() => setShowMealModal(false)}
      />

      <ScrollView
        style={s.bg}
        contentContainerStyle={s.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.brand} />}
      >
        <View style={s.header}>
          <Text style={s.title}>My QR Code</Text>
          <Text style={s.sub}>Show at entry points and check-in desks</Text>
        </View>

        {/* Conference QR Card */}
        <Animated.View style={{ transform: [{ scale: sc }], opacity: op, width: '100%' }}>
          <View style={s.card}>
            <LinearGradient
              colors={checkedIn ? [COLORS.success, '#059669'] : [COLORS.brand, COLORS.brandDark]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.strip}
            >
              <Text style={s.stripText}>
                {checkedIn ? '✓  CHECKED IN  ·  ETD 2026' : 'ETD 2026  ·  IIT Delhi'}
              </Text>
            </LinearGradient>

            {checkedIn && (
              <View style={s.checkedBanner}>
                <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                <Text style={s.checkedText}>Welcome to ETD 2026!</Text>
                {statusData?.goodies_status === 'received' && (
                  <View style={s.goodiesPill}>
                    <Ionicons name="gift" size={11} color={COLORS.accent} />
                    <Text style={s.goodiesText}>Goodies ✓</Text>
                  </View>
                )}
              </View>
            )}

            <View style={s.qrWrap}>
              {checkedIn && (
                <View style={s.scannedOverlay}>
                  <View style={s.scannedCircle}>
                    <Ionicons name="checkmark-circle" size={48} color={COLORS.success} />
                  </View>
                </View>
              )}
              <View style={{ opacity: checkedIn ? 0.25 : 1 }}>
                <QRCodeSVG value={qrData.qr_data} size={200} />
              </View>
            </View>

            <Text style={s.regIdText}>{qrData.registration_id || '—'}</Text>

            <View style={s.userRow}>
              <GradientAvatar name={user.first_name || user.email} size={52} radius={16} />
              <View style={{ marginLeft: SPACE.md, flex: 1 }}>
                <Text style={s.uName}>{user.first_name} {user.last_name}</Text>
                <Text style={s.uEmail}>{user.email}</Text>
                <View style={s.rolePill}>
                  <Text style={s.rolePillText}>
                    {(user.role || 'participant').replace(/_/g, ' ').toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>

            <View style={s.divider} />

            <View style={s.regRow}>
              <View style={s.regItem}>
                <Text style={s.regL}>Registration ID</Text>
                <Text style={s.regV}>{qrData.registration_id || '—'}</Text>
              </View>
              <View style={s.regSep} />
              <View style={s.regItem}>
                <Text style={s.regL}>Status</Text>
                <Text style={[s.regV, { color: checkedIn ? COLORS.success : COLORS.accent }]}>
                  {checkedIn ? '✓ Checked In' : 'Pending'}
                </Text>
              </View>
            </View>

            <View style={s.divider} />
            <View style={s.footer}>
              <Ionicons name="shield-checkmark-outline" size={13} color={COLORS.success} />
              <Text style={s.footerText}>Verified attendee  ·  Valid for all 3 days</Text>
            </View>
          </View>
        </Animated.View>

        {/* Meal Passes Section */}
        {mealWindows.length > 0 && (
          <FadeIn delay={200}>
            <Text style={s.mealTitle}>Meal Passes</Text>
            <Text style={s.mealSub}>Generate QR for lunch & dinner entry</Text>

            {mealWindows.map((w) => {
              const cfg = MEAL_CONFIG[w.meal_type] || MEAL_CONFIG.lunch;
              return (
                <View key={w.meal_type} style={s.mealCard}>
                  <View style={[s.mealCardLeft, { backgroundColor: cfg.bg }]}>
                    <Text style={{ fontSize: 28 }}>{cfg.icon}</Text>
                  </View>
                  <View style={s.mealCardCenter}>
                    <Text style={s.mealCardLabel}>{cfg.label}</Text>
                    <Text style={s.mealCardDate}>{w.date}</Text>
                    {w.pass_used && (
                      <Text style={{ fontSize: FONT.xs, color: COLORS.success, fontWeight: '600', marginTop: 2 }}>✓ Used</Text>
                    )}
                  </View>
                  {w.pass_used ? (
                    <View style={[s.mealBadge, { backgroundColor: COLORS.successLight }]}>
                      <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[s.mealBtn, { backgroundColor: cfg.color }]}
                      onPress={() => generateMealPass(w.meal_type)}
                      disabled={!!generating}
                      activeOpacity={0.85}
                    >
                      {generating === w.meal_type ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={s.mealBtnText}>
                          {w.pass_exists ? 'Show QR' : 'Generate'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
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

// ── Popup Styles ──────────────────────────────────────────────────────────
const pop = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  popup:        { width: '100%', maxWidth: 340, backgroundColor: '#fff', borderRadius: 28, padding: 28, alignItems: 'center',
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.25, shadowRadius: 32 }, android: { elevation: 8 } }) },
  iconCircle:   { marginBottom: SPACE.lg },
  popTitle:     { fontSize: 22, fontWeight: '900', color: COLORS.text, textAlign: 'center', letterSpacing: -0.3 },
  popSub:       { fontSize: FONT.sm, color: COLORS.textSec, textAlign: 'center', marginTop: SPACE.xs, marginBottom: SPACE.xl },
  pointsRow:    { marginBottom: SPACE.xl },
  pointsPill:   { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, paddingHorizontal: SPACE.xl, paddingVertical: SPACE.md, borderRadius: RADIUS.full },
  pointsText:   { fontSize: FONT.sm, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
  infoCard:     { width: '100%', backgroundColor: '#f8fafc', borderRadius: 16, overflow: 'hidden', marginBottom: SPACE.xl },
  infoRow:      { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md },
  infoLabel:    { flex: 1, fontSize: FONT.xs, color: COLORS.textTer },
  infoValue:    { fontSize: FONT.sm, fontWeight: '700', color: COLORS.text },
  closeBtn:     { width: '100%', borderRadius: 16, overflow: 'hidden' },
  closeBtnInner:{ height: 48, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: FONT.md, fontWeight: '700', color: '#fff' },
});

// ── Meal Modal Styles ─────────────────────────────────────────────────────
const ml = StyleSheet.create({
  modalHeader: { alignItems: 'center', paddingVertical: SPACE.xl, paddingHorizontal: SPACE.xxl },
  modalTitle:  { fontSize: FONT.xl, fontWeight: '900', color: '#fff', letterSpacing: 1, marginTop: SPACE.sm },
  modalDate:   { fontSize: FONT.xs, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  modalBody:   { padding: SPACE.xl, alignItems: 'center' },
  qrWrap:      { backgroundColor: '#fff', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.borderLight, marginBottom: SPACE.md },
  hint:        { fontSize: FONT.xs, color: COLORS.textTer, textAlign: 'center' },
  closeBtn:    { borderTopWidth: 1, borderTopColor: COLORS.borderLight, padding: SPACE.lg, alignItems: 'center' },
});

// ── Main Styles ───────────────────────────────────────────────────────────
const s = StyleSheet.create({
  bg:        { flex: 1, backgroundColor: '#f0f4f9' },
  container: { paddingHorizontal: SPACE.xl, paddingBottom: 48, alignItems: 'center' },
  center:    { flex: 1, backgroundColor: '#f0f4f9', justifyContent: 'center', alignItems: 'center', gap: SPACE.md },

  header:    { paddingTop: Platform.OS === 'ios' ? 58 : 46, paddingBottom: SPACE.lg, width: '100%' },
  title:     { fontSize: 28, fontWeight: '900', color: COLORS.brand, letterSpacing: -0.5 },
  sub:       { fontSize: FONT.xs, color: COLORS.textTer, marginTop: 3 },

  card: {
    width: '100%', borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.85)',
    overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)',
    ...Platform.select({ ios: { shadowColor: '#002182', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 24 }, android: { elevation: 0 } }),
  },
  strip:     { paddingVertical: 12, alignItems: 'center' },
  stripText: { fontSize: FONT.xs, fontWeight: FONT.w7, color: 'rgba(255,255,255,0.85)', letterSpacing: 1.5 },

  checkedBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.xs, paddingVertical: SPACE.sm, backgroundColor: COLORS.successLight, flexWrap: 'wrap' },
  checkedText:   { fontSize: FONT.xs, fontWeight: FONT.w6, color: COLORS.success },
  goodiesPill:   { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: COLORS.accentLight, paddingHorizontal: SPACE.sm, paddingVertical: 2, borderRadius: RADIUS.full, marginLeft: SPACE.xs },
  goodiesText:   { fontSize: 10, fontWeight: '700', color: COLORS.accent },

  qrWrap:         { alignItems: 'center', paddingVertical: SPACE.xxl, paddingHorizontal: SPACE.xxl, position: 'relative' },
  scannedOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  scannedCircle:  { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },

  regIdText: { textAlign: 'center', fontSize: FONT.xs, fontWeight: FONT.w7, color: COLORS.textTer, letterSpacing: 2, marginTop: -SPACE.lg, marginBottom: SPACE.lg },

  userRow:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACE.xl, paddingBottom: SPACE.lg },
  uName:        { fontSize: FONT.md, fontWeight: FONT.w7, color: COLORS.text },
  uEmail:       { fontSize: FONT.xs, color: COLORS.textTer, marginTop: 2 },
  rolePill:     { alignSelf: 'flex-start', marginTop: SPACE.xs, backgroundColor: COLORS.brandLight, paddingHorizontal: SPACE.sm, paddingVertical: 3, borderRadius: RADIUS.full },
  rolePillText: { fontSize: 9, fontWeight: FONT.w8, color: COLORS.brand, letterSpacing: 0.5 },

  divider: { height: 1, backgroundColor: COLORS.borderLight, marginHorizontal: SPACE.xl },

  regRow:  { flexDirection: 'row', paddingHorizontal: SPACE.xl, paddingVertical: SPACE.lg },
  regItem: { flex: 1, alignItems: 'center' },
  regSep:  { width: 1, backgroundColor: COLORS.borderLight, marginVertical: SPACE.xs },
  regL:    { fontSize: FONT.xs, color: COLORS.textTer, marginBottom: 4 },
  regV:    { fontSize: FONT.sm, fontWeight: FONT.w7, color: COLORS.text, textAlign: 'center' },

  footer:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.xs, paddingHorizontal: SPACE.xl, paddingVertical: SPACE.md },
  footerText: { fontSize: FONT.xs, color: COLORS.textTer },

  // Meal section
  mealTitle: { fontSize: 22, fontWeight: '900', color: COLORS.brand, letterSpacing: -0.3, marginTop: SPACE.xxl, marginBottom: SPACE.xxs, width: '100%' },
  mealSub:   { fontSize: FONT.xs, color: COLORS.textTer, marginBottom: SPACE.lg, width: '100%' },

  mealCard: {
    width: '100%', flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)',
    marginBottom: SPACE.md, overflow: 'hidden',
    ...Platform.select({ ios: { shadowColor: '#002182', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 }, android: { elevation: 0 } }),
  },
  mealCardLeft:   { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  mealCardCenter: { flex: 1, paddingVertical: SPACE.md, paddingHorizontal: SPACE.sm },
  mealCardLabel:  { fontSize: FONT.md, fontWeight: '700', color: COLORS.text },
  mealCardDate:   { fontSize: FONT.xs, color: COLORS.textTer, marginTop: 2 },
  mealBadge:      { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: SPACE.md },
  mealBtn:        { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm + 2, borderRadius: 12, marginRight: SPACE.md },
  mealBtnText:    { fontSize: FONT.sm, fontWeight: '700', color: '#fff' },

  hint:      { marginTop: SPACE.xl, fontSize: 12, color: COLORS.textTer, textAlign: 'center' },
  errorText: { fontSize: FONT.sm, color: COLORS.error, textAlign: 'center' },
  retry:     { fontSize: FONT.sm, color: COLORS.brand, fontWeight: FONT.w6 },
});
