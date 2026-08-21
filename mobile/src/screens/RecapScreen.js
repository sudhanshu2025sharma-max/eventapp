import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Animated, Share, ActivityIndicator, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONT, SPACE, RADIUS, SHADOW, TOP } from '../theme';
import { apiFetch } from '../api';

// ── Animated number counter ───────────────────────────────────────────────────
function Counter({ value, style, duration = 1200 }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    Animated.timing(anim, { toValue: value, duration, useNativeDriver: false }).start();
    const id = anim.addListener(({ value: v }) => setDisplay(Math.round(v)));
    return () => anim.removeListener(id);
  }, [value]);

  return <Text style={style}>{display}</Text>;
}

// ── Single achievement card ───────────────────────────────────────────────────
function Card({ delay = 0, colors, icon, label, value, sub, children }) {
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(24)).current;

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
            <Counter value={value} style={card.value} duration={1000} />
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
  iconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  label:    { fontSize: FONT.md, fontWeight: FONT.w7, color: '#fff' },
  sub:      { fontSize: FONT.xs, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  value:    { fontSize: 32, fontWeight: FONT.w9, color: '#fff', minWidth: 48, textAlign: 'right' },
});

// ── Bookmarked sessions list ──────────────────────────────────────────────────
function SessionList({ sessions }) {
  if (!sessions?.length) return null;
  return (
    <View style={{ marginTop: SPACE.sm }}>
      {sessions.map((s, i) => (
        <View key={i} style={sl.row}>
          <View style={sl.dot} />
          <Text style={sl.time}>{s.time}</Text>
          <Text style={sl.title} numberOfLines={1}>{s.title}</Text>
        </View>
      ))}
    </View>
  );
}

const sl = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginTop: SPACE.sm },
  dot:   { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.6)' },
  time:  { fontSize: FONT.xs, color: 'rgba(255,255,255,0.7)', width: 36 },
  title: { flex: 1, fontSize: FONT.sm, color: '#fff', fontWeight: FONT.w5 },
});

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function RecapScreen({ onBack }) {
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

  useEffect(() => { load(day); }, [day]);

  const share = async () => {
    if (!recap) return;
    const lines = [
      `🎓 My ETD 2026 — Day ${recap.day} Recap`,
      ``,
      `⚡ ${recap.points_earned_today} points earned today`,
      `🏆 Overall rank: #${recap.rank || '—'}`,
      `📅 ${recap.sessions_bookmarked_count} sessions bookmarked`,
      `📸 ${recap.photos_uploaded} photos shared`,
      `📊 ${recap.polls_voted} polls voted`,
      `🤝 ${recap.connections_made} connections made`,
      recap.team ? `💡 Ideathon team: ${recap.team}` : null,
      ``,
      recap.highlight,
      ``,
      `#ETD2026 #IITDelhi`,
    ].filter(Boolean).join('\n');

    Share.share({ message: lines });
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* Header */}
      <LinearGradient colors={[COLORS.brandDeep, COLORS.brand]} style={s.header}>
        <View style={s.headerRow}>
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Conference Memory</Text>
            <Text style={s.headerSub}>ETD 2026 — Your Day</Text>
          </View>
          <TouchableOpacity onPress={share} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="share-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Day picker */}
        <View style={s.dayRow}>
          {[1, 2, 3].map(d => (
            <TouchableOpacity
              key={d}
              style={[s.dayBtn, day === d && s.dayBtnOn]}
              onPress={() => setDay(d)}
              activeOpacity={0.8}
            >
              <Text style={[s.dayBtnT, day === d && s.dayBtnTOn]}>Day {d}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.brand} />
        </View>
      ) : !recap ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACE.xxl }}>
          <Ionicons name="wifi-outline" size={48} color={COLORS.textTer} />
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
              <Text style={s.highlightText}>{recap.highlight}</Text>
            </View>
          )}

          {/* Rank */}
          <Card
            delay={0}
            colors={['#f59e0b', '#d97706']}
            icon="trophy"
            label="Overall Rank"
            sub={`${recap.total_points} total points`}
            value={recap.rank || 0}
          />

          {/* Points today */}
          <Card
            delay={80}
            colors={[COLORS.brand, COLORS.brandDark]}
            icon="flash"
            label="Points Today"
            sub="Earned on this day"
            value={recap.points_earned_today}
          />

          {/* Sessions */}
          <Card
            delay={160}
            colors={['#7c3aed', '#4f46e5']}
            icon="calendar"
            label="Sessions Bookmarked"
            sub={recap.sessions_bookmarked_count === 0 ? 'Tap ♡ on sessions to save them' : 'Your saved sessions'}
            value={recap.sessions_bookmarked_count}
          >
            <SessionList sessions={recap.sessions_bookmarked} />
          </Card>

          {/* Photos */}
          <Card
            delay={240}
            colors={['#ec4899', '#db2777']}
            icon="camera"
            label="Photos Shared"
            sub="Contributed to the gallery"
            value={recap.photos_uploaded}
          />

          {/* Polls */}
          <Card
            delay={320}
            colors={['#06b6d4', '#0891b2']}
            icon="bar-chart"
            label="Polls Voted"
            sub="Your voice counted"
            value={recap.polls_voted}
          />

          {/* Connections */}
          <Card
            delay={400}
            colors={['#10b981', '#059669']}
            icon="people"
            label="Connections Made"
            sub="New people met today"
            value={recap.connections_made}
          />

          {/* Ideathon team */}
          {!!recap.team && (
            <Card
              delay={480}
              colors={['#f97316', '#ea580c']}
              icon="bulb"
              label="Ideathon Team"
              sub={recap.team}
            />
          )}

          {/* Share CTA */}
          <TouchableOpacity onPress={share} activeOpacity={0.85} style={{ marginTop: SPACE.md }}>
            <LinearGradient colors={[COLORS.brand, COLORS.brandDark]} style={s.shareBtn}>
              <Ionicons name="share-social" size={20} color="#fff" />
              <Text style={s.shareBtnT}>Share My Day {recap.day} Recap</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  header:      { paddingTop: TOP, paddingBottom: SPACE.lg, paddingHorizontal: SPACE.xl },
  headerRow:   { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginBottom: SPACE.lg },
  headerTitle: { fontSize: 20, fontWeight: FONT.w9, color: '#fff' },
  headerSub:   { fontSize: FONT.xs, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  dayRow:      { flexDirection: 'row', gap: SPACE.sm },
  dayBtn:      { flex: 1, paddingVertical: SPACE.sm, borderRadius: RADIUS.md, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center' },
  dayBtnOn:    { backgroundColor: '#fff' },
  dayBtnT:     { fontSize: FONT.sm, fontWeight: FONT.w7, color: 'rgba(255,255,255,0.8)' },
  dayBtnTOn:   { color: COLORS.brand },
  highlight:   { backgroundColor: COLORS.brandLight, borderRadius: RADIUS.lg, padding: SPACE.lg, marginBottom: SPACE.lg },
  highlightText: { fontSize: FONT.md, fontWeight: FONT.w7, color: COLORS.brand, textAlign: 'center' },
  shareBtn:    { borderRadius: RADIUS.lg, padding: SPACE.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.sm },
  shareBtnT:   { fontSize: FONT.md, fontWeight: FONT.w7, color: '#fff' },
});
