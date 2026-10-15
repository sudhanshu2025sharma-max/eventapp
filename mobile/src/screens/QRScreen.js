import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Platform, Animated, Modal, Image,
  ActivityIndicator, ScrollView, RefreshControl, TouchableOpacity,
  Dimensions,
} from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS, FONT, SPACE, RADIUS, TOP, BOTTOM, API_URL, API_HEADERS, fixMediaUrl } from '../theme';
import { GradientAvatar, FadeIn, PulsingDot } from '../components';
import qrGenerator from 'qrcode-generator';

const { width: W } = Dimensions.get('window');
const CARD_W = W - SPACE.xl * 2;
const NOTCH = 14;

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
  row: { flexDirection: 'row', justifyContent: 'space-evenly', width: '100%', position: 'absolute', zIndex: 5 },
  bottom: { bottom: -4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#f0f4f9' },
});

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
  const translateX = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-CARD_W, CARD_W] });
  return <Animated.View pointerEvents="none" style={[holo.bar, { transform: [{ translateX}, { rotate: '25deg' }] }]} />;
}
const holo = StyleSheet.create({
  bar: { position: 'absolute', top: -40, width: 60, height: 500, backgroundColor: 'rgba(255,255,255,0.12)', zIndex: 3 },
});

function Notch({ side, top }) {
  return <View style={[notch.base, { [side]: -NOTCH / 2, top }]} />;
}
const notch = StyleSheet.create({
  base: { position: 'absolute', width: NOTCH, height: NOTCH, borderRadius: NOTCH / 2, backgroundColor: '#f0f4f9', zIndex: 5 },
});

function TearLine({ top }) {
  const dashes = Math.floor((CARD_W - NOTCH * 2) / 12);
  return (
    <View style={[tear.row, { top }]}>
      {Array.from({ length: dashes }, (_, i) => <View key={i} style={tear.dash} />)}
    </View>
  );
}
const tear = StyleSheet.create({
  row: { position: 'absolute', left: NOTCH, right: NOTCH, flexDirection: 'row', justifyContent: 'space-evenly', zIndex: 4 },
  dash: { width: 6, height: 1.5, backgroundColor: 'rgba(0,0,0,0.12)', borderRadius: 1 },
});

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

  const kitReceived = data.goodies_status === 'received' || data.goodies_status === true;

  return (
    <Modal transparent visible={visible} animationType="none" presentationStyle="overFullScreen">
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
              <Text style={pop.infoLabel}>Conference Kit</Text>
              <Text style={[pop.infoValue, { color: kitReceived ? COLORS.success : COLORS.accent }]}>
                {kitReceived ? '✓ Received' : 'Pending'}
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

let _popupShownThisSession = false;

export default function QRScreen({ user, tokens }) {
  const sc = useRef(new Animated.Value(0.88)).current;
  const op = useRef(new Animated.Value(0)).current;

  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [statusData, setStatusData] = useState(null);
  const [showPopup, setShowPopup] = useState(false);
  const [myMeals, setMyMeals] = useState([]);
  const [activeMealName, setActiveMealName] = useState(null);

  const mountedRef = useRef(true);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(sc, { toValue: 1, tension: 55, friction: 8, useNativeDriver: true }),
      Animated.timing(op, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
    return () => { mountedRef.current = false; };
  }, []);

  const load = async (isRefresh = false, isSilent = false) => {
    if (!mountedRef.current) return;
    if (isRefresh) setRefreshing(true); 
    else if (!qrData && !isSilent) setLoading(true);
    
    setError(null);
    try {
      const headers = { ...API_HEADERS, Authorization: `Bearer ${tokens?.access}` };
      const [qrRes, statusRes, mealsRes, mealStatusRes] = await Promise.all([
        fetch(`${API_URL}/checkins/my-qr/`, { headers }),
        fetch(`${API_URL}/checkins/status/`, { headers }),
        fetch(`${API_URL}/checkins/meal-pass/mine/`, { headers }).catch(() => null),
        fetch(`${API_URL}/checkins/meal/status/`, { headers }).catch(() => null),
      ]);
      if (!mountedRef.current) return;
      if (!qrRes.ok) throw new Error('Failed');

      const qr = await qrRes.json();
      const st = await statusRes.json();
      const mealsData = mealsRes ? await mealsRes.json() : { passes: [] };
      const mealStatus = mealStatusRes ? await mealStatusRes.json() : null;

      setQrData(qr);
      setStatusData(st);
      setMyMeals((mealsData.passes || []).filter(p => p.used));

      if (mealStatus?.is_open) {
        setActiveMealName(mealStatus.meal_type);
      } else {
        setActiveMealName(null);
      }

      if (st.checked_in && !_popupShownThisSession) {
        const scannedAt = st.scanned_at ? new Date(st.scanned_at).getTime() : 0;
        if (Date.now() - scannedAt < 60000) setShowPopup(true);
        _popupShownThisSession = true;
      }
    } catch {
      if (mountedRef.current && !isSilent) setError('Could not load QR. Check connection.');
    } finally {
      if (mountedRef.current) { setLoading(false); setRefreshing(false); }
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    // 10s Background polling (silent refresh)
    const interval = setInterval(() => load(false, true), 10000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    load(true);
  };

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={COLORS.brand} /></View>;
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
  const kitReceived = statusData?.goodies_status === 'received' || statusData?.goodies_status === true;
  const role = (user.role || 'participant').replace(/_/g, ' ').toUpperCase();
  const photoUrl = user.profile_photo_url ? fixMediaUrl(user.profile_photo_url) : null;
  const isMealOpen = !!activeMealName;
  
  // Logic: QR is active if they haven't checked in YET, OR if a meal window is currently active.
  const isQrActive = !checkedIn || isMealOpen;

  return (
    <>
      <CheckInPopup visible={showPopup} data={statusData} onClose={() => setShowPopup(false)} />

      <ScrollView
        style={s.bg}
        contentContainerStyle={s.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.brand} />}
      >
        <View style={s.header}>
          <Text style={s.title}>Universal Pass</Text>
          <Text style={s.sub}>One QR for entry, meals, and conference kits</Text>
        </View>

        {/* ── Ticket Card ── */}
        <Animated.View style={{ transform: [{ scale: sc }], opacity: op, width: '100%' }}>
          <View style={s.ticket}>
            <HolographicShimmer />
            <PerforatedEdge side="top" />

            <LinearGradient
              colors={checkedIn ? [COLORS.success, '#059669'] : [COLORS.brand, COLORS.brandDark]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.strip}
            >
              <Text style={s.stripLabel}>ETD 2026</Text>
              <View style={s.stripDivider} />
              <Text style={s.stripRight}>IIT DELHI</Text>
            </LinearGradient>

            {checkedIn && (
              <View style={s.checkedBanner}>
                <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
                <Text style={s.checkedText}>CHECKED IN</Text>
              </View>
            )}

            <View style={s.attendeeRow}>
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={s.attendeePhoto} />
              ) : (
                <GradientAvatar name={user.first_name || user.email} size={56} radius={16} />
              )}
              <View style={{ flex: 1, marginLeft: SPACE.md }}>
                <Text style={s.attendeeName}>{user.first_name} {user.last_name}</Text>
                <Text style={s.attendeeEmail}>{user.email}</Text>
                <View style={s.rolePill}><Text style={s.roleText}>{role}</Text></View>
              </View>
            </View>

            {/* Conference Kit Status Card */}
            <View style={[s.kitCard, kitReceived ? s.kitCardReceived : s.kitCardPending]}>
              <View style={[s.kitIconBox, { backgroundColor: kitReceived ? COLORS.success: COLORS.accent }]}>
                <Ionicons name={kitReceived ? 'gift' : 'gift-outline'} size={20} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.kitLabel}>Conference Kit</Text>
                <Text style={[s.kitStatus, { color: kitReceived ? COLORS.success : COLORS.accent }]}>
                  {kitReceived ? '✓ Received' : 'Not yet collected'}
                </Text>
              </View>
              {kitReceived && <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />}
            </View>

            <Notch side="left" top={276} />
            <Notch side="right" top={276} />
            <TearLine top={282} />

            <View style={s.qrSection}>
              {!isQrActive && (
                <View style={s.scannedOverlay}>
                  <View style={s.lockCircle}>
                    <Ionicons name="lock-closed" size={28} color={COLORS.textTer} />
                  </View>
                </View>
              )}
              <View style={{ opacity: isQrActive ? 1 : 0.15, alignItems: 'center' }}>
                <QRCodeSVG value={qrData?.qr_data || qrData?.registration_id || user?.registration_id || 'ETD-2026'} size={180} />
              </View>
              <Text style={s.regId}>{qrData?.registration_id || '—'}</Text>
              {!isQrActive && (
                <Text style={{ fontSize: 10, color: COLORS.textTer, marginTop: 4 }}>
                  QR unlocks automatically during meal service
                </Text>
              )}
            </View>

            <View style={s.infoRow}>
              <View style={s.infoItem}><Text style={s.infoLabel}>REG ID</Text><Text style={s.infoValue}>{qrData?.registration_id || '—'}</Text></View>
              <View style={s.infoSep} />
              <View style={s.infoItem}><Text style={s.infoLabel}>STATUS</Text><Text style={[s.infoValue, { color: checkedIn ? COLORS.success : COLORS.accent }]}>{checkedIn ? '✓ Verified' : 'Pending'}</Text></View>
              <View style={s.infoSep} />
              <View style={s.infoItem}><Text style={s.infoLabel}>VALID</Text><Text style={s.infoValue}>3 Days</Text></View>
            </View>

            <View style={s.seal}>
              <Ionicons name="shield-checkmark" size={12} color={COLORS.success} />
              <Text style={s.sealText}>Verified Universal Pass  ·  ETD 2026</Text>
            </View>

            <PerforatedEdge side="bottom" />
          </View>
        </Animated.View>

        <TouchableOpacity onPress={handleRefresh} activeOpacity={0.8} style={s.refreshBtn}>
          <Ionicons name="refresh" size={18} color={COLORS.brand} />
          <Text style={s.refreshText}>Refresh Status</Text>
        </TouchableOpacity>

        {/* ── Today's Activity Log ── */}
        <Animated.View style={{ opacity: op, width: '100%' }}>
          <View style={s.actHeader}>
            <Text style={s.actTitle}>Today's Activity</Text>
            {activeMealName && (
              <View style={s.servingBadge}>
                <PulsingDot color="#fff" size={5} />
                <Text style={s.servingText}>{activeMealName} is serving now</Text>
              </View>
            )}
          </View>

          <View style={s.actCard}>
            
            {/* Conference Check-In Entry */}
            <View style={s.actRow}>
              <View style={[s.actIconBox, { backgroundColor: checkedIn ? COLORS.successLight : COLORS.borderLight }]}>
                <Ionicons name={checkedIn ? "checkmark-outline" : "time-outline"} size={18} color={checkedIn ? COLORS.success : COLORS.textTer} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.actName}>Conference Check-In</Text>
                <Text style={[s.actTime, checkedIn && { color: COLORS.success, fontWeight: '700' }]}>
                  {checkedIn ? 'Verified' : 'Pending Verification'}
                </Text>
              </View>
            </View>

            {/* Redeemed Meals */}
            {myMeals.map((meal) => (
              <View style={[s.actRow, { borderTopWidth: 1, borderTopColor: COLORS.borderLight }]} key={meal.id}>
                <View style={[s.actIconBox, { backgroundColor: COLORS.brandLight }]}>
                  <Ionicons name="restaurant-outline" size={18} color={COLORS.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.actName}>{meal.meal_type} Redeemed</Text>
                  <Text style={s.actTime}>Scanned successfully</Text>
                </View>
                <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
              </View>
            ))}

            {myMeals.length === 0 && (
              <View style={[s.actRow, { borderTopWidth: 1, borderTopColor: COLORS.borderLight }]}>
                <Text style={s.actEmpty}>No dining services redeemed yet today.</Text>
              </View>
            )}

          </View>
        </Animated.View>

        <Animated.View style={{ opacity: op, width: '100%' }}>
          <Text style={s.hint}>
            If an admin scans your pass by mistake, they can reset it for you from their device. Keep screen brightness high when scanning.
          </Text>
        </Animated.View>
        <View style={{ height: 120 }} />
      </ScrollView>
    </>
  );
}

const pop = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  popup: { width: '100%', maxWidth: 340, backgroundColor: '#fff', borderRadius: 28, padding: 28, alignItems: 'center' },
  iconCircle: { marginBottom: SPACE.lg },
  popTitle: { fontSize: 22, fontWeight: '900', color: COLORS.text, textAlign: 'center' },
  popSub: { fontSize: FONT.sm, color: COLORS.textSec, textAlign: 'center', marginTop: SPACE.xs, marginBottom: SPACE.xl },
  pointsRow: { marginBottom: SPACE.xl },
  pointsPill: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, paddingHorizontal: SPACE.xl, paddingVertical: SPACE.md, borderRadius: RADIUS.full },
  pointsText: { fontSize: FONT.sm, fontWeight: '800', color: '#fff' },
  infoCard: { width: '100%', backgroundColor: '#f8fafc', borderRadius: 16, overflow: 'hidden', marginBottom: SPACE.xl },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md },
  infoLabel: { flex: 1, fontSize: FONT.xs, color: COLORS.textTer },
  infoValue: { fontSize: FONT.sm, fontWeight: '700', color: COLORS.text },
  closeBtn: { width: '100%', borderRadius: 16, overflow: 'hidden' },
  closeBtnInner: { height: 48, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: FONT.md, fontWeight: '700', color: '#fff' },
});

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#f0f4f9' },
  container: { paddingHorizontal: SPACE.xl, paddingBottom: 130 + BOTTOM, alignItems: 'center' },
  center: { flex: 1, backgroundColor: '#f0f4f9', justifyContent: 'center', alignItems: 'center', gap: SPACE.md },
  header: { paddingTop: TOP + 8, paddingBottom: SPACE.lg, width: '100%' },
  title: { fontSize: 28, fontWeight: '900', color: COLORS.brand, letterSpacing: -0.5 },
  sub: { fontSize: FONT.xs, color: COLORS.textblack, marginTop: 3 },
  ticket: { width: '100%', backgroundColor: '#fff', borderRadius: 22, overflow: 'hidden',position: 'relative' },
  strip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: SPACE.sm },
  stripLabel: { fontSize: 13, fontWeight: '900', color: '#fff', letterSpacing: 2 },
  stripDivider: { width: 1, height: 14, backgroundColor: 'rgba(255,255,255,0.4)' },
  stripRight: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.8)', letterSpacing: 1.5 },
  checkedBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: SPACE.sm, backgroundColor: COLORS.successLight },
  checkedText: { fontSize: 11, fontWeight: '800', color: COLORS.success, letterSpacing: 1},
  attendeeRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACE.lg,paddingVertical: SPACE.lg },
  attendeePhoto: { width: 56, height: 56, borderRadius: 16, borderWidth: 2, borderColor: COLORS.brandLight, backgroundColor: '#e2e8f0' },
  attendeeName: { fontSize: FONT.md, fontWeight: '800', color: COLORS.text },
  attendeeEmail: { fontSize: FONT.xs, color: COLORS.text, marginTop: 2, fontWeight: '600'},
  rolePill: { alignSelf: 'flex-start', marginTop: 4, backgroundColor: COLORS.brandLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  roleText: { fontSize: 9, fontWeight: '800', color: COLORS.brand, letterSpacing: 0.5 },
  kitCard: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginHorizontal:SPACE.lg, marginBottom: SPACE.md, paddingVertical: SPACE.md, paddingHorizontal: SPACE.md,borderRadius: 14, borderWidth: 1.5 },
  kitCardReceived: { backgroundColor: COLORS.successLight, borderColor: 'rgba(34,197,94,0.35)' },
  kitCardPending: { backgroundColor: COLORS.accentLight, borderColor: 'rgba(245,158,11,0.35)' },
  kitIconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  kitLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textSec, letterSpacing: 0.5 },
  kitStatus: { fontSize: FONT.sm, fontWeight: '900', marginTop: 2, letterSpacing: 0.2 },
  qrSection: { alignItems: 'center', paddingVertical: SPACE.xl, position: 'relative' },
  scannedOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  lockCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(241, 245, 249, 0.95)', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5 },
  regId: { marginTop: SPACE.md, fontSize: FONT.xs, fontWeight: '800', color: COLORS.textTer, letterSpacing: 3 },
  infoRow: { flexDirection: 'row', paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, borderTopWidth: 1, borderTopColor: COLORS.borderLight },
  infoItem: { flex: 1, alignItems: 'center' },
  infoSep: { width: 1, backgroundColor: COLORS.borderLight, marginVertical: 2 },
  infoLabel: { fontSize: 9, fontWeight: '700', color: COLORS.textTer, letterSpacing: 1, marginBottom: 4 },
  infoValue: { fontSize: FONT.sm, fontWeight: '800', color: COLORS.text },
  seal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: SPACE.md, borderTopWidth: 1, borderTopColor: COLORS.borderLight },
  sealText: { fontSize: 10, fontWeight: '600', color: COLORS.textTer, letterSpacing: 0.5 },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginTop: SPACE.lg, paddingVertical: SPACE.md, paddingHorizontal: SPACE.xl, borderRadius: RADIUS.full, backgroundColor: COLORS.brandLight },
  refreshText: { fontSize: FONT.sm, fontWeight: '700', color: COLORS.brand },
  
  actHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', width: '100%', marginTop: SPACE.xxl, marginBottom: SPACE.sm },
  actTitle: { fontSize: 20, fontWeight: '900', color: COLORS.brand, letterSpacing: -0.3 },
  servingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.error, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  servingText: { color: '#fff', fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  actCard: { width: '100%', backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: COLORS.borderLight, overflow: 'hidden' },
  actRow: { flexDirection: 'row', alignItems: 'center', padding: SPACE.lg },
  actIconBox: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: SPACE.md },
  actName: { fontSize: FONT.sm, fontWeight: '800', color: COLORS.text },
  actTime: { fontSize: FONT.xs, color: COLORS.textTer, marginTop: 2 },
  actEmpty: { fontSize: FONT.xs, color: COLORS.textTer, textAlign: 'center', paddingVertical: SPACE.md },
  
  hint: { marginTop: SPACE.xl, fontSize: 12, color: COLORS.textTer, textAlign: 'center', lineHeight: 18 },
  errorText: { fontSize: FONT.sm, color: COLORS.error, textAlign: 'center' },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginTop: SPACE.md },
  retryText: { fontSize: FONT.sm, color: COLORS.brand, fontWeight: '600' },
});
