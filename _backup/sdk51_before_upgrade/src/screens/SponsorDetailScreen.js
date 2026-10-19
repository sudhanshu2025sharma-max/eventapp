import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, StyleSheet,
  Platform, StatusBar, ActivityIndicator, Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, SPACE, RADIUS, SHADOW, API_URL, API_HEADERS } from '../theme';

const PAD = SPACE.xl;

const TIER_LABEL = {
  national_funding: 'NATIONAL FUNDING AGENCY',
  platinum: 'PLATINUM SPONSOR',
  silver:   'SILVER SPONSOR',
  bronze:   'BRONZE SPONSOR',
};

function InfoRow({ icon, label, value, onPress }) {
  if (!value) return null;
  const Row = onPress ? TouchableOpacity : View;
  return (
    <Row style={st.infoRow} onPress={onPress} activeOpacity={0.7}>
      <View style={st.infoIcon}>
        <Ionicons name={icon} size={18} color={COLORS.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={st.infoLabel}>{label}</Text>
        <Text style={st.infoValue} numberOfLines={2}>{value}</Text>
      </View>
      {onPress && <Ionicons name="open-outline" size={18} color={COLORS.textTer} />}
    </Row>
  );
}

function SocialBtn({ icon, url, color }) {
  if (!url) return null;
  return (
    <TouchableOpacity
      style={[st.socialBtn, { backgroundColor: color }]}
      onPress={() => Linking.openURL(url).catch(() => {})}
      activeOpacity={0.8}
    >
      <Ionicons name={icon} size={20} color="#fff" />
    </TouchableOpacity>
  );
}

export default function SponsorDetailScreen({ sponsorId, onBack }) {
  const [sponsor, setSponsor] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/sponsors/${sponsorId}/`, { headers: API_HEADERS });
        const data = await res.json();
        setSponsor(data);
      } catch (e) { console.log('Detail fetch error', e); }
      finally { setLoading(false); }
    })();
  }, [sponsorId]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a1a5e', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  if (!sponsor) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a1a5e', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#fff' }}>Sponsor not found.</Text>
        <TouchableOpacity onPress={onBack} style={{ marginTop: 16 }}>
          <Text style={{ color: COLORS.accent, fontWeight: '700' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const tierLabel = TIER_LABEL[sponsor.tier] || sponsor.tier_display;

  return (
    <View style={{ flex: 1, backgroundColor: '#f0f4f9' }}>
      <StatusBar barStyle="light-content" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Hero */}
        <LinearGradient colors={['#0a1a5e', '#0333b6']} style={st.hero}>
          <View style={st.heroTopBar}>
            <TouchableOpacity onPress={onBack} style={st.backBtn}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={st.tierBadge}>{tierLabel}</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={st.logoBox}>
            {sponsor.logo_url ? (
              <Image source={{ uri: sponsor.logo_url }} style={st.logo} resizeMode="contain" />
            ) : (
              <Text style={st.logoFallback}>{sponsor.name}</Text>
            )}
          </View>

          <Text style={st.name}>{sponsor.name}</Text>
        </LinearGradient>

        {/* Content */}
        <View style={{ padding: PAD, marginTop: -20 }}>

          {!!sponsor.description && (
            <View style={st.card}>
              <Text style={st.sectionTitle}>About</Text>
              <Text style={st.body}>{sponsor.description}</Text>
            </View>
          )}

          {!!sponsor.partnership_details && (
            <View style={st.card}>
              <Text style={st.sectionTitle}>Partnership</Text>
              <Text style={st.body}>{sponsor.partnership_details}</Text>
            </View>
          )}

          {(sponsor.website_url || sponsor.contact_email || sponsor.contact_phone || sponsor.address) && (
            <View style={st.card}>
              <Text style={st.sectionTitle}>Contact</Text>
              <InfoRow
                icon="globe-outline"
                label="Website"
                value={sponsor.website_url}
                onPress={sponsor.website_url ? () => Linking.openURL(sponsor.website_url).catch(() => {}) : null}
              />
              <InfoRow
                icon="mail-outline"
                label="Email"
                value={sponsor.contact_email}
                onPress={sponsor.contact_email ? () => Linking.openURL(`mailto:${sponsor.contact_email}`).catch(() => {}) : null}
              />
              <InfoRow
                icon="call-outline"
                label="Phone"
                value={sponsor.contact_phone}
                onPress={sponsor.contact_phone ? () => Linking.openURL(`tel:${sponsor.contact_phone}`).catch(() => {}) : null}
              />
              <InfoRow
                icon="location-outline"
                label="Address"
                value={sponsor.address}
              />
            </View>
          )}

          {(sponsor.linkedin_url || sponsor.twitter_url || sponsor.facebook_url || sponsor.instagram_url || sponsor.youtube_url) && (
            <View style={st.card}>
              <Text style={st.sectionTitle}>Connect with Spnonsor</Text>
              <View style={{ flexDirection: 'row', gap: SPACE.md, flexWrap: 'wrap' }}>
                <SocialBtn icon="logo-linkedin"  url={sponsor.linkedin_url}  color="#0a66c2" />
                <SocialBtn icon="logo-twitter"   url={sponsor.twitter_url}   color="#1DA1F2" />
                <SocialBtn icon="logo-facebook"  url={sponsor.facebook_url}  color="#1877f2" />
                <SocialBtn icon="logo-instagram" url={sponsor.instagram_url} color="#e4405f" />
                <SocialBtn icon="logo-youtube"   url={sponsor.youtube_url}   color="#ff0000" />
              </View>
            </View>
          )}

        </View>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  hero: {
    paddingTop: Platform.OS === 'ios' ? 54 : 44,
    paddingBottom: SPACE.xxl + SPACE.lg,
    paddingHorizontal: PAD,
    borderBottomLeftRadius: 32, borderBottomRightRadius: 32,
  },
  heroTopBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACE.xl },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  tierBadge: {
    fontSize: 10, fontWeight: FONT.w8, color: '#fde68a',
    letterSpacing: 1.5,
  },
  logoBox: {
    backgroundColor: '#fff', borderRadius: 20, padding: 20,
    alignItems: 'center', justifyContent: 'center',
    height: 140, marginBottom: SPACE.lg,
    ...SHADOW.lg,
  },
  logo: { width: '100%', height: '100%' },
  logoFallback: { fontSize: FONT.xl, fontWeight: FONT.w9, color: COLORS.brand, textAlign: 'center' },

  name: {
    fontSize: 26, fontWeight: FONT.w9, color: '#fff',
    letterSpacing: -0.3, textAlign: 'center',
  },

  card: {
    backgroundColor: '#fff', borderRadius: 20,
    padding: SPACE.xl, marginBottom: SPACE.md,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
      android: { elevation: 0, borderWidth: 1, borderColor: COLORS.borderLight },
    }),
  },
  sectionTitle: {
    fontSize: FONT.md, fontWeight: FONT.w8, color: COLORS.text,
    marginBottom: SPACE.md,
  },
  body: { fontSize: FONT.sm, color: COLORS.textSec, lineHeight: 22 },

  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.md,
    paddingVertical: SPACE.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  infoIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: COLORS.brandLight,
    alignItems: 'center', justifyContent: 'center',
  },
  infoLabel: { fontSize: 11, fontWeight: FONT.w7, color: COLORS.textTer, letterSpacing: 0.5, textTransform: 'uppercase' },
  infoValue: { fontSize: FONT.sm, color: COLORS.text, marginTop: 2, fontWeight: FONT.w6 },

  socialBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
});
