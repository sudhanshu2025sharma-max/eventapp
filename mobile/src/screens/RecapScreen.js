import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Animated, Share, ActivityIndicator, Platform, StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONT, SPACE, RADIUS, SHADOW, TOP } from '../theme';
import { apiFetch } from '../api';

// ── Animated number counter ───────────────────────────────────────────────────
function Counter({ value, style, duration = 1000 }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    Animated.timing(anim, { toValue: value || 0, duration, useNativeDriver: false }).start();
    const id = anim.addListener(({ value: v }) => setDisplay(Math.round(v)));
    return () => anim.removeListener(id);
  }, [value]);

  return <Text style={style}>{display}</Text>;
}

// ── Single achievement card ───────────────────────────────────────────────────
function Card({ delay = 0, colors, icon, label, value, sub, children }) {
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,  { toValue: 1, duration: 400, delay, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 400, delay, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }], marginBottom: SPACE.md }}>
      <LinearGradient colors={colors} style={card.wrap}>
        <View style={card.row}>
          <View style={card.iconWrap}>
            <Ionicons name={icon} size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={card.label}>{label}</Text>
            {sub ? <Text style={card.sub}>{sub}</Text> : null}
          </View>
          {value !== undefined && (
            <Counter value={value} style={card.value} duration={900} />
          )}
        </View>
        {children}
      </LinearGradient>
    </Animated.View>
  );
}

const card = StyleSheet.create({
  wrap:     { borderRadius: RADIUS.xl, padding: SPACE.lg, ...SHADOW.md },
  row:      { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  iconWrap: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  label:    { fontSize: FONT.base, fontWeight: FONT.w8, color: '#fff' },
  sub:      { fontSize: FONT.xs, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  value:    { fontSize: 28, fontWeight: FONT.w9, color: '#fff', minWidth: 44, textAlign: 'right' },
});

// ── Bookmarked sessions list ──────────────────────────────────────────────────
function SessionList({ sessions }) {
  if (!sessions?.length) return null;
  return (
    <View style={{ marginTop: SPACE.sm, paddingTop: SPACE.xs, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)' }}>
      {sessions.map((s, i) => (
        <View key={i} style={sl.row}>
          <View style={sl.dot} />
          <Text style={sl.time}>{s.time || '—'}</Text>
          <Text style={sl.title} numberOfLines={1}>{s.title}</Text>
        </View>
      ))}
    </View>
  );
}

const sl = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginTop: 6 },
  dot:   { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.7)' },
  time:  { fontSize: FONT.xs, color: 'rgba(255,255,255,0.75)', width: 42, fontWeight: FONT.w6 },
  title: { flex: 1, fontSize: FONT.xs, color: '#fff', fontWeight: FONT.w6 },
});

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function RecapScreen({ tokens, onBack }) {
  const [recap, setRecap]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [day, setDay]       = useState(1);

  const load = useCallback(async (d) => {
    setLoading(true);
    try {
      const res  = await apiFetch(`/auth/my-recap/?day=${d}`);
      const data = await res.json();
      setRecap(data);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(day); }, [day, load]);

  const share = async () => {
    if (!recap) return;
    const lines = [
      `ETD 2026 — Day ${recap.day} Symposium Memory`,
      ``,
      `Activity points earned: ${recap.points_earned_today} (${recap.total_points} overall)`,
      `Leaderboard standing: #${recap.rank || '—'}`,
      `Sessions bookmarked: ${recap.sessions_bookmarked_count}`,
      `Gallery photos shared: ${recap.photos_uploaded}`,
      `Symposium polls answered: ${recap.polls_voted}`,
      `Networking channels: ${recap.connections_made}`,
      recap.team ? `Ideathon team: ${recap.team}` : null,
      ``,
      `Central Library, IIT Delhi`,
      `https://etd2026.iitd.ac.in`,
    ].filter(Boolean).join('\n');

    Share.share({ message: lines });
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <LinearGradient colors={[COLORS.brandDeep, COLORS.brand]} style={s.header}>
        <View style={s.headerRow}>
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Symposium Memory</Text>
            <Text style={s.headerSub}>ETD 2026 — Daily Highlights</Text>
          </View>
          <TouchableOpacity onPress={share} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={s.shareIconBtn}>
            <Ionicons name="share-social-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Day picker */}
        <View style={s.dayRow}>
          {[
            { num: 1, label: 'Day 1 (Oct 23)' },
            { num: 2, label: 'Day 2 (Oct 24)' },
            { num: 3, label: 'Day 3 (Oct 25)' },
          ].map(d => (
            <TouchableOpacity
              key={d.num}
              style={[s.dayBtn, day === d.num && s.dayBtnOn]}
              onPress={() => setDay(d.num)}
              activeOpacity={0.8}
            >
              <Text style={[s.dayBtnT, day === d.num && s.dayBtnTOn]}>Day {d.num}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="small" color={COLORS.brand} />
          <Text style={{ marginTop: SPACE.md, fontSize: FONT.sm, color: COLORS.textSec }}>Loading highlights…</Text>
        </View>
      ) : !recap ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACE.xxl }}>
          <Ionicons name="cloud-offline-outline" size={48} color={COLORS.textTer} />
          <Text style={{ marginTop: SPACE.md, color: COLORS.textSec, textAlign: 'center' }}>
            Could not load recap. Check your connection.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: SPACE.xl, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Highlight banner */}
          {!!recap.highlight && (
            <View style={s.highlight}>
              <Ionicons name="sparkles-outline" size={15} color={COLORS.brand} style={{ marginRight: 6 }} />
              <Text style={s.highlightText}>{recap.highlight}</Text>
            </View>
          )}

          {/* Rank */}
          <Card
            delay={0}
            colors={['#f59e0b', '#d97706']}
            icon="trophy-outline"
            label="Leaderboard Standing"
            sub={`${recap.total_points} total points`}
            value={recap.rank || 0}
          />

          {/* Points today */}
          <Card
            delay={80}
            colors={[COLORS.brand, COLORS.brandDark]}
            icon="flash-outline"
            label="Daily Activity"
            sub="Points verified on this day"
            value={recap.points_earned_today}
          />

          {/* Sessions */}
          <Card
            delay={160}
            colors={['#7c3aed', '#4f46e5']}
            icon="calendar-outline"
            label="Bookmarked Talks"
            sub={recap.sessions_bookmarked_count === 0 ? 'No bookmarks saved yet' : `${recap.sessions_bookmarked_count} talks saved`}
            value={recap.sessions_bookmarked_count}
          >
            <SessionList sessions={recap.sessions_bookmarked} />
          </Card>

          {/* Connections */}
          <Card
            delay={240}
            colors={['#10b981', '#059669']}
            icon="people-outline"
            label="Connections"
            sub="Scholars & peers connected"
            value={recap.connections_made}
          />

          {/* Photos */}
          <Card
            delay={320}
            colors={['#ec4899', '#db2777']}
            icon="camera-outline"
            label="Gallery Photos"
            sub="Moments uploaded"
            value={recap.photos_uploaded}
          />

          {/* Polls */}
          <Card
            delay={400}
            colors={['#06b6d4', '#0891b2']}
            icon="stats-chart-outline"
            label="Live Polls"
            sub="Opinions shared"
            value={recap.polls_voted}
          />

          {/* Ideathon team */}
          {!!recap.team && (
            <Card
              delay={480}
              colors={['#f97316', '#ea580c']}
              icon="bulb-outline"
              label="Ideathon Team"
              sub={`Registered under team ${recap.team}`}
            />
          )}

          {/* Share CTA */}
          <TouchableOpacity onPress={share} activeOpacity={0.85} style={{ marginTop: SPACE.md }}>
            <LinearGradient colors={[COLORS.brand, COLORS.brandDark]} style={s.shareBtn}>
              <Ionicons name="share-social-outline" size={16} color="#fff" />
              <Text style={s.shareBtnT}>Share Day {recap.day} Highlights</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  header:      { paddingTop: TOP + 8, paddingBottom: SPACE.lg, paddingHorizontal: SPACE.xl },
  headerRow:   { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginBottom: SPACE.lg },
  backBtn:     { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  shareIconBtn:{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: FONT.w9, color: '#fff' },
  headerSub:   { fontSize: FONT.xs, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  dayRow:      { flexDirection: 'row', gap: SPACE.sm },
  dayBtn:      { flex: 1, paddingVertical: 10, borderRadius: RADIUS.md, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center' },
  dayBtnOn:    { backgroundColor: '#fff' },
  dayBtnT:     { fontSize: FONT.sm, fontWeight: FONT.w7, color: 'rgba(255,255,255,0.85)' },
  dayBtnTOn:   { color: COLORS.brand, fontWeight: FONT.w9 },
  highlight:   { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.brandLight, borderRadius: RADIUS.lg, padding: SPACE.md, marginBottom: SPACE.lg, borderWidth: 1, borderColor: 'rgba(3,51,182,0.12)' },
  highlightText: { flex: 1, fontSize: FONT.sm, fontWeight: FONT.w7, color: COLORS.brand },
  shareBtn:    { borderRadius: RADIUS.lg, padding: SPACE.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.sm, ...SHADOW.brand },
  shareBtnT:   { fontSize: FONT.md, fontWeight: FONT.w7, color: '#fff' },
});
