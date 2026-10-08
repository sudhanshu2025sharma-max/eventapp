import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Platform, TouchableOpacity,
  ActivityIndicator, ScrollView, Modal, Animated,
} from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONT, SPACE, RADIUS, API_URL, API_HEADERS, TOP, BOTTOM } from '../theme';
import { FadeIn } from '../components';
import qrGenerator from 'qrcode-generator';

function QRCodeSVG({ value, size = 180, color = '#0a1628' }) {
  const safeVal = String(value || 'ETD-2026');
  const qr = qrGenerator(0, 'M');
  qr.addData(safeVal);
  qr.make();
  const count    = qr.getModuleCount();
  const cellSize = size / count;
  const cells    = [];
  for (let r = 0; r < count; r++)
    for (let c = 0; c < count; c++)
      if (qr.isDark(r, c))
        cells.push(<Rect key={`${r}-${c}`} x={c * cellSize} y={r * cellSize} width={cellSize} height={cellSize} fill={color} />);
  return <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>{cells}</Svg>;
}

function PassModal({ visible, pass, onClose }) {
  const scale   = React.useRef(new Animated.Value(0.7)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale,   { toValue: 1, tension: 65, friction: 8, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      scale.setValue(0.7);
      opacity.setValue(0);
    }
  }, [visible]);

  if (!visible || !pass) return null;

  const icon = pass.meal_type === 'lunch' ? '🍽️' : '🍷';

  return (
    <Modal transparent visible={visible} animationType="none" presentationStyle="overFullScreen">
      <Animated.View style={[m.overlay, { opacity }]}>
        <Animated.View style={[m.modal, { transform: [{ scale }] }]}>
          <LinearGradient
            colors={pass.meal_type === 'lunch' ? [COLORS.accent, COLORS.accentDark] : [COLORS.purple, '#6d28d9']}
            style={m.modalHeader}
          >
            <Text style={m.modalIcon}>{icon}</Text>
            <Text style={m.modalTitle}>{pass.meal_type.toUpperCase()} PASS</Text>
            <Text style={m.modalDate}>{pass.date}</Text>
          </LinearGradient>

          <View style={m.modalBody}>
            {pass.used ? (
              <View style={m.usedWrap}>
                <Ionicons name="close-circle" size={56} color={COLORS.error} />
                <Text style={m.usedText}>Already Used</Text>
              </View>
            ) : (
              <View style={m.qrWrap}>
                <QRCodeSVG value={pass.qr_data} size={180} />
              </View>
            )}

            <Text style={m.passId} numberOfLines={1}>Pass ID: {pass.pass_id?.slice(0, 8)}...</Text>

            {!pass.used && (
              <Text style={m.hint}>Show this QR to staff at the {pass.meal_type} venue</Text>
            )}
          </View>

          <TouchableOpacity style={m.closeBtn} onPress={onClose}>
            <Text style={m.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

export default function MealPassScreen({ tokens, onBack }) {
  const [windows,   setWindows]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [generating, setGenerating] = useState('');
  const [activePass, setActivePass] = useState(null);
  const [showModal, setShowModal]  = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/checkins/meal/status/`, {
        headers: { ...API_HEADERS, Authorization: `Bearer ${tokens?.access}` },
      });
      const data = await res.json();
      setWindows(data.windows || []);
    } catch (_) {}
    finally { setLoading(false); }
  }, [tokens]);

  useEffect(() => { load(); }, [load]);

  const generatePass = async (mealType) => {
    setGenerating(mealType);
    try {
      const res  = await fetch(`${API_URL}/checkins/meal/generate/`, {
        method:  'POST',
        headers: { ...API_HEADERS, Authorization: `Bearer ${tokens?.access}` },
        body:    JSON.stringify({ meal_type: mealType }),
      });
      const data = await res.json();
      if (data.success) {
        setActivePass(data);
        setShowModal(true);
        load();
      } else {
        // Show error inline
        setActivePass({ error: data.message, meal_type: mealType });
        setShowModal(false);
      }
    } catch (_) {}
    finally { setGenerating(''); }
  };

  const viewPass = (window) => {
    if (window.pass_id) {
      generatePass(window.meal_type);
    }
  };

  const MEAL_CONFIG = {
    lunch:  { icon: '🍽️', color: COLORS.accent,  bg: COLORS.accentLight,  label: 'Lunch Pass' },
    dinner: { icon: '🍷', color: COLORS.purple,  bg: COLORS.purpleLight,  label: 'Dinner Pass' },
  };

  return (
    <>
      <PassModal
        visible={showModal}
        pass={activePass}
        onClose={() => setShowModal(false)}
      />

      <View style={s.bg}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={onBack} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={COLORS.brand} />
          </TouchableOpacity>
          <View>
            <Text style={s.title}>Meal Passes</Text>
            <Text style={s.sub}>Generate your QR for meals</Text>
          </View>
        </View>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color={COLORS.brand} />
          </View>
        ) : windows.length === 0 ? (
          <View style={s.center}>
            <Text style={{ fontSize: 48 }}>🍴</Text>
            <Text style={s.emptyTitle}>No Meal Windows Open</Text>
            <Text style={s.emptySub}>Admin will open meal windows before lunch/dinner time</Text>
            <TouchableOpacity style={s.refreshBtn} onPress={load}>
              <Ionicons name="refresh" size={18} color={COLORS.brand} />
              <Text style={s.refreshText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
            {windows.map((w, i) => {
              const cfg = MEAL_CONFIG[w.meal_type] || MEAL_CONFIG.lunch;
              return (
                <FadeIn key={w.meal_type} delay={i * 80}>
                  <View style={s.card}>
                    {/* Card header */}
                    <View style={[s.cardTop, { backgroundColor: cfg.bg }]}>
                      <Text style={{ fontSize: 36 }}>{cfg.icon}</Text>
                      <View style={{ flex: 1, marginLeft: SPACE.md }}>
                        <Text style={[s.cardTitle, { color: cfg.color }]}>{cfg.label}</Text>
                        <Text style={s.cardDate}>{w.date}</Text>
                      </View>
                      {w.pass_used ? (
                        <View style={[s.statusBadge, { backgroundColor: COLORS.errorLight }]}>
                          <Text style={[s.statusText, { color: COLORS.error }]}>Used</Text>
                        </View>
                      ) : w.pass_exists ? (
                        <View style={[s.statusBadge, { backgroundColor: COLORS.successLight }]}>
                          <Text style={[s.statusText, { color: COLORS.success }]}>Ready</Text>
                        </View>
                      ) : (
                        <View style={[s.statusBadge, { backgroundColor: cfg.bg }]}>
                          <Text style={[s.statusText, { color: cfg.color }]}>New</Text>
                        </View>
                      )}
                    </View>

                    {/* Card body */}
                    <View style={s.cardBody}>
                      {w.pass_used ? (
                        <View style={s.usedInfo}>
                          <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                          <Text style={s.usedInfoText}>Pass used — enjoy your {w.meal_type}!</Text>
                        </View>
                      ) : w.pass_exists ? (
                        <TouchableOpacity
                          style={[s.actionBtn, { backgroundColor: cfg.color }]}
                          onPress={() => viewPass(w)}
                          activeOpacity={0.85}
                        >
                          {generating === w.meal_type ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <>
                              <Ionicons name="qr-code" size={20} color="#fff" />
                              <Text style={s.actionBtnText}>Show My Pass</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={[s.actionBtn, { backgroundColor: cfg.color }]}
                          onPress={() => generatePass(w.meal_type)}
                          activeOpacity={0.85}
                          disabled={!!generating}
                        >
                          {generating === w.meal_type ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <>
                              <Ionicons name="add-circle" size={20} color="#fff" />
                              <Text style={s.actionBtnText}>Generate Pass</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </FadeIn>
              );
            })}

            <FadeIn delay={200}>
              <View style={s.infoCard}>
                <Ionicons name="information-circle-outline" size={18} color={COLORS.brand} />
                <Text style={s.infoText}>
                  Passes are valid only for today. Each pass can only be scanned once.
                  Conference check-in required.
                </Text>
              </View>
            </FadeIn>

            <View style={{ height: 120 + BOTTOM }} />
          </ScrollView>
        )}
      </View>
    </>
  );
}

const m = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  modal:       { width: '100%', maxWidth: 340, backgroundColor: '#fff', borderRadius: 28, overflow: 'hidden',
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.25, shadowRadius: 32 }, android: { elevation: 8 } }) },
  modalHeader: { alignItems: 'center', paddingVertical: SPACE.xl, paddingHorizontal: SPACE.xxl },
  modalIcon:   { fontSize: 44, marginBottom: SPACE.sm },
  modalTitle:  { fontSize: FONT.xl, fontWeight: '900', color: '#fff', letterSpacing: 1 },
  modalDate:   { fontSize: FONT.xs, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  modalBody:   { padding: SPACE.xl, alignItems: 'center' },
  qrWrap:      { backgroundColor: '#fff', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.borderLight, marginBottom: SPACE.md },
  passId:      { fontSize: FONT.xs, color: COLORS.textTer, letterSpacing: 1, marginBottom: SPACE.xs },
  hint:        { fontSize: FONT.xs, color: COLORS.textTer, textAlign: 'center' },
  usedWrap:    { alignItems: 'center', paddingVertical: SPACE.xl, gap: SPACE.sm },
  usedText:    { fontSize: FONT.md, fontWeight: '700', color: COLORS.error },
  closeBtn:    { borderTopWidth: 1, borderTopColor: COLORS.borderLight, padding: SPACE.lg, alignItems: 'center' },
  closeBtnText:{ fontSize: FONT.md, fontWeight: '700', color: COLORS.brand },
});

const s = StyleSheet.create({
  bg:       { flex: 1, backgroundColor: '#f0f4f9' },
  header:   { flexDirection: 'row', alignItems: 'center', gap: SPACE.md,
    paddingTop: TOP + 8, paddingBottom: SPACE.lg, paddingHorizontal: SPACE.xl },
  backBtn:  { width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.brandLight, alignItems: 'center', justifyContent: 'center' },
  title:    { fontSize: 22, fontWeight: '900', color: COLORS.brand, letterSpacing: -0.3 },
  sub:      { fontSize: FONT.xs, color: COLORS.textTer, marginTop: 2 },
  container:{ paddingHorizontal: SPACE.xl },
  center:   { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SPACE.md, padding: 32 },
  emptyTitle: { fontSize: FONT.lg, fontWeight: '800', color: COLORS.text },
  emptySub:   { fontSize: FONT.sm, color: COLORS.textTer, textAlign: 'center' },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginTop: SPACE.md,
    paddingHorizontal: SPACE.xl, paddingVertical: SPACE.md, backgroundColor: COLORS.brandLight, borderRadius: RADIUS.full },
  refreshText:{ fontSize: FONT.sm, fontWeight: '700', color: COLORS.brand },

  card:     { backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 24, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', marginBottom: SPACE.lg,
    ...Platform.select({ ios: { shadowColor: '#002182', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 12 }, android: { elevation: 0 } }) },
  cardTop:  { flexDirection: 'row', alignItems: 'center', padding: SPACE.lg },
  cardTitle:{ fontSize: FONT.lg, fontWeight: '800' },
  cardDate: { fontSize: FONT.xs, color: COLORS.textTer, marginTop: 2 },
  cardBody: { padding: SPACE.lg },
  statusBadge: { paddingHorizontal: SPACE.md, paddingVertical: 4, borderRadius: RADIUS.full },
  statusText:  { fontSize: FONT.xs, fontWeight: '800' },

  actionBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.sm,
    height: 48, borderRadius: 14 },
  actionBtnText: { fontSize: FONT.md, fontWeight: '700', color: '#fff' },

  usedInfo:     { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, justifyContent: 'center', paddingVertical: SPACE.sm },
  usedInfoText: { fontSize: FONT.sm, color: COLORS.success, fontWeight: '600' },

  infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm,
    backgroundColor: COLORS.brandLight, borderRadius: 16, padding: SPACE.lg },
  infoText: { fontSize: FONT.xs, color: COLORS.brand, flex: 1, lineHeight: 18 },
});
