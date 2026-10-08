import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, SPACE, RADIUS, SHADOW } from './theme';

export function Card({ children, style, shadow = 'sm', onPress }) {
  const base = [s.card, SHADOW[shadow], style];
  if (onPress) return <TouchableOpacity style={base} onPress={onPress} activeOpacity={0.78}>{children}</TouchableOpacity>;
  return <View style={base}>{children}</View>;
}

export function GlassCard({ children, style, onPress }) {
  const base = [s.glassCard, style];
  if (onPress) return <TouchableOpacity style={base} onPress={onPress} activeOpacity={0.8}>{children}</TouchableOpacity>;
  return <View style={base}>{children}</View>;
}

export function Badge({ label, color = COLORS.brand, bg, style }) {
  return (
    <View style={[s.badge, { backgroundColor: bg || color + '1A' }, style]}>
      <Text style={[s.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

export function Avatar({ name = 'U', size = 44, radius, bg = COLORS.brand, textColor = COLORS.textInverse, style }) {
  const r = radius ?? Math.round(size * 0.32);
  return (
    <View style={[{ width: size, height: size, borderRadius: r, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Text style={{ fontSize: size * 0.38, fontWeight: FONT.w7, color: textColor }}>{(name || 'U')[0].toUpperCase()}</Text>
    </View>
  );
}

export function GradientAvatar({ name = 'U', size = 44, radius, style }) {
  const r = radius ?? Math.round(size * 0.32);
  return (
    <LinearGradient colors={[COLORS.brand, COLORS.brandDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[{ width: size, height: size, borderRadius: r, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Text style={{ fontSize: size * 0.38, fontWeight: FONT.w7, color: COLORS.textInverse }}>{(name || 'U')[0].toUpperCase()}</Text>
    </LinearGradient>
  );
}

export function StatBox({ value, label, light = false, style }) {
  return (
    <View style={[s.statBox, style]}>
      <Text style={[s.statValue, light && { color: COLORS.textInverse }]}>{value}</Text>
      <Text style={[s.statLabel, light && { color: 'rgba(255,255,255,0.55)' }]}>{label}</Text>
    </View>
  );
}

export function SectionHeader({ title, action, onAction, style }) {
  return (
    <View style={[s.sectionHeader, style]}>
      <Text style={s.sectionTitle}>{title}</Text>
      {action && <TouchableOpacity onPress={onAction} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><Text style={s.sectionAction}>{action}</Text></TouchableOpacity>}
    </View>
  );
}

export function Divider({ style }) {
  return <View style={[s.divider, style]} />;
}

export function PrimaryButton({ label, onPress, loading, disabled, style }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled || loading} activeOpacity={0.82} style={[s.primaryBtn, (disabled || loading) && { opacity: 0.7 }, style]}>
      <LinearGradient colors={[COLORS.brand, COLORS.brandDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.primaryBtnInner}>
        {loading ? <ActivityIndicator color={COLORS.textInverse} /> : <Text style={s.primaryBtnText}>{label}</Text>}
      </LinearGradient>
    </TouchableOpacity>
  );
}

export function IconBox({ name, size = 20, color = COLORS.brand, bg, boxSize = 44, radius = RADIUS.md, style }) {
  return (
    <View style={[{ width: boxSize, height: boxSize, borderRadius: radius, backgroundColor: bg || color + '14', alignItems: 'center', justifyContent: 'center' }, style]}>
      <Ionicons name={name} size={size} color={color} />
    </View>
  );
}

export function FadeIn({ children, delay = 0, duration = 380, style }) {
  const o = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(o, { toValue: 1, duration, delay, useNativeDriver: true }).start();
  }, []);
  return <Animated.View style={[{ opacity: o }, style]}>{children}</Animated.View>;
}

export function PulsingDot({ color = COLORS.success, size = 8 }) {
  const sc = useRef(new Animated.Value(1)).current;
  const op = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.parallel([
        Animated.timing(sc, { toValue: 1.8, duration: 800, useNativeDriver: true }),
        Animated.timing(op, { toValue: 0, duration: 800, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(sc, { toValue: 1, duration: 0, useNativeDriver: true }),
        Animated.timing(op, { toValue: 1, duration: 0, useNativeDriver: true }),
      ]),
    ])).start();
  }, []);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity: op, transform: [{ scale: sc }] }} />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: Platform.OS === 'android' ? 1 : 0, borderColor: COLORS.borderLight },
  glassCard: { backgroundColor: COLORS.glass, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.glassBorder },
  badge: { paddingHorizontal: SPACE.sm + 2, paddingVertical: 3, borderRadius: RADIUS.full, alignSelf: 'flex-start' },
  badgeText: { fontSize: FONT.xs, fontWeight: FONT.w7, letterSpacing: 0.5 },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: SPACE.sm + 2 },
  statValue: { fontSize: FONT.lg, fontWeight: FONT.w8, color: COLORS.text },
  statLabel: { fontSize: FONT.xs, fontWeight: FONT.w5, color: COLORS.textTer, marginTop: 2 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACE.md },
  sectionTitle: { fontSize: FONT.md, fontWeight: FONT.w8, color: COLORS.text, letterSpacing: -0.2 },
  sectionAction: { fontSize: FONT.sm, fontWeight: FONT.w6, color: COLORS.brand },
  divider: { height: 1, backgroundColor: COLORS.borderLight },
  primaryBtn: { borderRadius: RADIUS.lg, overflow: 'hidden', ...SHADOW.brand },
  primaryBtnInner: { height: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACE.xl },
  primaryBtnText: { color: COLORS.textInverse, fontSize: FONT.md, fontWeight: FONT.w7, letterSpacing: 0.3 },
});
