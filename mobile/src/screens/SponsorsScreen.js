import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, StyleSheet,
  Platform, StatusBar, RefreshControl, ActivityIndicator, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, SPACE, RADIUS, SHADOW, API_URL, API_HEADERS, TOP, BOTTOM, fixMediaUrl } from '../theme';
import SponsorDetailScreen from './SponsorDetailScreen';

const { width: W } = Dimensions.get('window');
const PAD = SPACE.xl;

const TIER_META = {
  national_funding: { label: 'National Funding Agencies', accent: '#60a5fa', icon: 'business' },
  platinum:         { label: 'Platinum Sponsors',         accent: '#e5e7eb', icon: 'diamond' },
  silver:           { label: 'Silver Sponsors',           accent: '#cbd5e1', icon: 'medal'    },
  bronze:           { label: 'Bronze Sponsors',           accent: '#fbbf24', icon: 'ribbon'   },
};

function LogoTile({ sponsor, onPress, size }) {
  const [ok, setOk] = useState(true);
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[st.tile, { width: size.w, height: size.h }]}
    >
      {sponsor.logo_url && ok ? (
        <Image
          source={{ uri: fixMediaUrl(sponsor.logo_url) }}
          resizeMethod="resize"
          style={{ width: '85%', height: '70%' }}
          resizeMode="contain"
          onError={() => setOk(false)}
        />
      ) : (
        <Text style={st.tileFallback} numberOfLines={2}>{sponsor.name}</Text>
      )}
    </TouchableOpacity>
  );
}

function TierSection({ group, onOpen }) {
  const meta = TIER_META[group.tier] || { label: group.tier_display, accent: '#60a5fa' };
  const items = group.sponsors || [];
  if (items.length === 0) return null;

  // dynamic tile sizing per tier
  let cols = 3;
  if (group.tier === 'platinum') cols = items.length === 1 ? 1 : 2;
  if (group.tier === 'national_funding') cols = items.length === 1 ? 1 : Math.min(items.length, 3);
  if (group.tier === 'silver') cols = Math.min(items.length, 2);
  if (group.tier === 'bronze') cols = 3;

  const gap = SPACE.md;
  const available = W - PAD * 2 - (SPACE.lg * 2);
  const tileW = (available - gap * (cols - 1)) / cols;
  const tileH = group.tier === 'platinum' ? 110 : (group.tier === 'national_funding' ? 100 : 80);

  return (
    <View style={st.sectionCard}>
      <View style={st.sectionHeader}>
        <View style={[st.accentBar, { backgroundColor: meta.accent }]} />
        <Text style={st.sectionTitle}>{meta.label}</Text>
      </View>

      <View style={[st.grid, { gap }]}>
        {items.map(s => (
          <LogoTile
            key={s.id}
            sponsor={s}
            size={{ w: tileW, h: tileH }}
            onPress={() => onOpen(s)}
          />
        ))}
      </View>
    </View>
  );
}

export default function SponsorsScreen({ tokens, onBack }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const fetchSponsors = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/sponsors/`, { headers: API_HEADERS });
      const data = await res.json();
      setGroups(data.groups || []);
    } catch (e) {
      console.log('Sponsors fetch error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchSponsors(); }, [fetchSponsors]);

  const onRefresh = () => { setRefreshing(true); fetchSponsors(); };

  if (selectedId) {
    return (
      <SponsorDetailScreen
        sponsorId={selectedId}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0a1a5e' }}>
      <StatusBar barStyle="light-content" />

      <LinearGradient
        colors={['#0a1a5e', '#0333b6', '#0a1a5e']}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={st.topbar}>
        <TouchableOpacity onPress={onBack} style={st.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={st.topTitle}>Our Sponsors</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#fff" size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: PAD, paddingTop: 8, paddingBottom: 40 + BOTTOM }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
          }
        >
          <Text style={st.heroSub}>ETD 2026 · IIT Delhi</Text>
          <Text style={st.heroTitle}>Powered by our partners</Text>

          {groups.length === 0 && (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Ionicons name="business-outline" size={40} color="rgba(255,255,255,0.4)" />
              <Text style={{ color: 'rgba(255,255,255,0.6)', marginTop: 12 }}>
                No sponsors yet.
              </Text>
            </View>
          )}

          {groups.map(g => (
            <TierSection key={g.tier} group={g} onOpen={(s) => setSelectedId(s.id)} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  topbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: TOP + 8,
    paddingBottom: SPACE.md, paddingHorizontal: PAD,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  topTitle: { fontSize: FONT.lg, fontWeight: FONT.w8, color: '#fff' },

  heroSub: {
    fontSize: 11, fontWeight: FONT.w8,
    color: 'rgba(255,255,255,0.55)', letterSpacing: 1.5,
    marginTop: SPACE.sm,
  },
  heroTitle: {
    fontSize: 28, fontWeight: FONT.w9, color: '#fff',
    letterSpacing: -0.5, marginTop: 4, marginBottom: SPACE.xl,
  },

  sectionCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 24, padding: SPACE.lg,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: SPACE.lg,
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    gap: SPACE.sm, marginBottom: SPACE.md,
  },
  accentBar: { width: 22, height: 3, borderRadius: 2 },
  sectionTitle: { fontSize: FONT.md, fontWeight: FONT.w8, color: '#fff' },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },

  tile: {
    backgroundColor: '#fff', borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    padding: 8, overflow: 'hidden',
  },
  tileFallback: {
    fontSize: FONT.sm, fontWeight: FONT.w7, color: COLORS.brand,
    textAlign: 'center',
  },
});
