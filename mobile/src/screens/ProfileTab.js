import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, SPACE, RADIUS, SHADOW, API_URL, API_HEADERS, fixMediaUrl } from '../theme';
import { GradientAvatar, FadeIn, IconBox, Divider } from '../components';

export default function ProfileTab({ user, tokens, onLogout, onEditProfile, onChangePassword, onOpenNotifications, onOpenChats, onOpenRecap }) {
  const [stats,       setStats]       = useState({ points: 0, rank: 0 });
  const [connections, setConnections] = useState(0);

  const fetchStats = useCallback(async () => {
    if (!tokens?.access) return;
    const auth = { ...API_HEADERS, Authorization: `Bearer ${tokens.access}` };
    try {
      const [lb, conn] = await Promise.all([
        fetch(`${API_URL}/leaderboard/my/`, { headers: auth }),
        fetch(`${API_URL}/chat/connections/count/`, { headers: auth }),
      ]);
      const lbData   = await lb.json();
      const connData = await conn.json();
      setStats({ points: lbData.total_points || 0, rank: lbData.rank || 0 });
      setConnections(connData.count || 0);
    } catch { /* silent */ }
  }, [tokens]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const MENU = [
    { section: 'Account', items: [
      { icon: 'person-outline',        label: 'Edit Profile',     sub: 'Update your information', onPress: onEditProfile },
      { icon: 'notifications-outline', label: 'Notifications',    sub: 'View notifications',      onPress: onOpenNotifications },
      { icon: 'lock-closed-outline',   label: 'Change Password',  sub: 'Update your password',    onPress: onChangePassword },
    ]},
    { section: 'Conference', items: [
      { icon: 'sparkles-outline',      label: 'My Recap',      sub: 'Your conference memory',   onPress: onOpenRecap },
      { icon: 'bar-chart-outline',     label: 'My Activity',   sub: `${stats.points} points earned` },
      { icon: 'chatbubbles-outline',   label: 'My Connections', sub: 'Chats & requests',        onPress: onOpenChats },
      { icon: 'calendar-outline',      label: 'My Sessions',   sub: 'Bookmarked talks' },
      { icon: 'document-text-outline', label: 'Certificates',  sub: 'Download certificate' },
    ]},
    { section: 'Support', items: [
      { icon: 'help-circle-outline',   label: 'Help & Support',    sub: 'Contact organizers' },
      { icon: 'globe-outline',         label: 'Conference Site',   sub: 'etd2026.iitd.ac.in' },
    ]},
  ];

  const interests = (user.research_interests || '').split(',').map(t => t.trim()).filter(Boolean);

  return (
    <View style={{ flex: 1, backgroundColor: '#f0f4f9' }}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* hero */}
        <View style={p.hero}>
          <View style={p.blob} />
          <FadeIn>
            {user.profile_photo_url
              ? <Image source={{ uri: fixMediaUrl(user.profile_photo_url) }} style={p.photo} />
              : <GradientAvatar name={user.first_name || user.email} size={88} radius={28}
                  style={{ borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)', alignSelf: 'center', marginBottom: SPACE.md }} />}
            <Text style={p.name}>{user.first_name} {user.last_name}</Text>
            {user.designation ? <Text style={p.designation}>{user.designation}</Text> : null}
            <Text style={p.email}>{user.email}</Text>
            <View style={p.rolePill}>
              <Text style={p.rolePillText}>{(user.role || 'participant').replace('_', ' ').toUpperCase()}</Text>
              {user.affiliation ? <><View style={p.pillSep} /><Text style={p.pillAff} numberOfLines={1}>{user.affiliation}</Text></> : null}
            </View>
          </FadeIn>
        </View>

        <View style={p.body}>
          {/* stats pills */}
          <FadeIn delay={80}>
            <View style={p.statsRow}>
              {[
                { label: 'POINTS',  value: String(stats.points) },
                { label: 'RANK',    value: stats.rank > 0 ? `#${stats.rank}` : '—' },
                { label: 'CONNECTS',value: String(connections) },
                { label: 'PROFILE', value: user.profile_complete ? '✓' : '○' },
              ].map(st => (
                <View key={st.label} style={p.statPill}>
                  <Text style={p.statPillValue}>{st.value}</Text>
                  <Text style={p.statPillLabel}>{st.label}</Text>
                </View>
              ))}
            </View>
          </FadeIn>

          {/* research interests */}
          {interests.length > 0 && (
            <FadeIn delay={120}>
              <View style={p.card}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.md }}>
                  <Ionicons name="flask-outline" size={15} color={COLORS.brand} />
                  <Text style={p.cardTitle}>Research Interests</Text>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm }}>
                  {interests.map(tag => (
                    <View key={tag} style={p.tag}>
                      <Text style={p.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </FadeIn>
          )}

          {/* menu sections */}
          {MENU.map((sec, si) => (
            <FadeIn key={sec.section} delay={150 + si * 60}>
              <Text style={p.secLabel}>{sec.section.toUpperCase()}</Text>
              <View style={p.card}>
                {sec.items.map((item, ii) => (
                  <React.Fragment key={item.label}>
                    <TouchableOpacity style={p.menuRow} activeOpacity={0.7} onPress={item.onPress}>
                      <IconBox name={item.icon} size={17} color={COLORS.brand} bg={COLORS.brandLight} boxSize={38} radius={RADIUS.md} style={{ marginRight: SPACE.md }} />
                      <View style={{ flex: 1 }}>
                        <Text style={p.menuLabel}>{item.label}</Text>
                        <Text style={p.menuSub}>{item.sub}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={15} color={COLORS.border} />
                    </TouchableOpacity>
                    {ii < sec.items.length - 1 && <Divider style={{ marginLeft: SPACE.md + 38 + SPACE.md }} />}
                  </React.Fragment>
                ))}
              </View>
            </FadeIn>
          ))}

          <FadeIn delay={400}>
            <TouchableOpacity style={p.logout} onPress={onLogout} activeOpacity={0.75}>
              <Ionicons name="log-out-outline" size={18} color={COLORS.error} />
              <Text style={p.logoutText}>Sign Out</Text>
            </TouchableOpacity>
            <Text style={p.ver}>ETD 2026  ·  v1.0  ·  IIT Delhi</Text>
          </FadeIn>
          <View style={{ height: 110 }} />
        </View>
      </ScrollView>
    </View>
  );
}

const p = StyleSheet.create({
  hero: {
    paddingTop: Platform.OS === 'ios' ? 58 : 46,
    paddingBottom: SPACE.xxl, paddingHorizontal: SPACE.xl,
    backgroundColor: COLORS.brand, alignItems: 'center', overflow: 'hidden',
  },
  blob: {
    position: 'absolute', width: 220, height: 220, borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.06)', top: -80, right: -60,
  },
  photo: { width: 88, height: 88, borderRadius: 28, borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)', alignSelf: 'center', marginBottom: SPACE.md },
  name: { fontSize: FONT.xl, fontWeight: FONT.w9, color: '#fff', textAlign: 'center', letterSpacing: -0.3 },
  designation: { fontSize: FONT.sm, color: 'rgba(255,255,255,0.7)', marginTop: 2, textAlign: 'center' },
  email: { fontSize: FONT.xs, color: 'rgba(255,255,255,0.5)', marginTop: 4, textAlign: 'center' },
  rolePill: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: SPACE.md, backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: SPACE.md, paddingVertical: 6, borderRadius: RADIUS.full,
  },
  rolePillText: { fontSize: 10, fontWeight: FONT.w8, color: '#fff', letterSpacing: 0.5 },
  pillSep: { width: 1, height: 12, backgroundColor: 'rgba(255,255,255,0.25)', marginHorizontal: SPACE.sm },
  pillAff: { fontSize: FONT.xs, color: 'rgba(255,255,255,0.65)', maxWidth: 160 },

  body: { paddingHorizontal: SPACE.xl, paddingTop: SPACE.xl },

  statsRow: { flexDirection: 'row', gap: SPACE.sm, marginBottom: SPACE.xl, justifyContent: 'center' },
  statPill: {
    flex: 1, alignItems: 'center', paddingVertical: SPACE.lg,
    backgroundColor: 'rgba(255,255,255,0.72)', borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)',
  },
  statPillValue: { fontSize: FONT.xl, fontWeight: FONT.w9, color: COLORS.text },
  statPillLabel: { fontSize: 9, fontWeight: FONT.w8, color: COLORS.textTer, letterSpacing: 1, marginTop: 3 },

  card: {
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 24, overflow: 'hidden',
    marginBottom: SPACE.xl, padding: SPACE.lg,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)',
    ...Platform.select({
      ios: { shadowColor: '#002182', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
      android: { elevation: 0 },
    }),
  },
  cardTitle: { fontSize: FONT.sm, fontWeight: FONT.w7, color: COLORS.text },
  tag: { backgroundColor: COLORS.brandLight, paddingHorizontal: SPACE.md, paddingVertical: SPACE.xs, borderRadius: RADIUS.full },
  tagText: { fontSize: FONT.xs, fontWeight: FONT.w6, color: COLORS.brand },

  secLabel: { fontSize: 10, fontWeight: FONT.w8, color: COLORS.textTer, letterSpacing: 1.5, marginBottom: SPACE.sm, marginLeft: 4 },
  menuRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACE.md },
  menuLabel: { fontSize: FONT.sm, fontWeight: FONT.w6, color: COLORS.text },
  menuSub: { fontSize: FONT.xs, color: COLORS.textTer, marginTop: 2 },

  logout: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACE.sm, height: 52, borderRadius: 20,
    borderWidth: 1.5, borderColor: COLORS.error,
    backgroundColor: 'rgba(255,255,255,0.72)', marginBottom: SPACE.xl,
  },
  logoutText: { fontSize: FONT.md, fontWeight: FONT.w6, color: COLORS.error },
  ver: { textAlign: 'center', fontSize: FONT.xs, color: COLORS.textTer, opacity: 0.5 },
});
