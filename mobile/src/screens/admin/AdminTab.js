import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Platform, Alert, Dimensions, StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONT, SPACE, RADIUS } from '../../theme';
import { FadeIn } from '../../components';

import CheckInScreen from './CheckInScreen';
import NotificationsAdmin from './NotificationsAdmin';
import UsersAdmin from './UsersAdmin';
import AddParticipantScreen from './AddParticipantScreen';
import ScheduleAdmin from './ScheduleAdmin';
import PhotosAdmin from './PhotosAdmin';
import PollsAdmin from './PollsAdmin';
import IdeathonAdmin from './IdeathonAdmin';
import PapersAdminScreen from './PapersAdminScreen';
import StaffAdminScreen from './StaffAdminScreen';
import FeedAdmin from './FeedAdmin';

const CARD_SIZE = (Dimensions.get('window').width - SPACE.xl * 2 - SPACE.md) / 2;

const ALL_FEATURES = [
  {
    key:  'checkin',
    icon: 'qr-code',
    label:'Scan',
    sub:  'Check-in & Meal Passes',
    grad: ['#059669', '#047857'],
    perm: 'checkin_scanner',
  },
  {
    key:  'notifications',
    icon: 'megaphone',
    label:'Notifications',
    sub:  'Send push messages',
    grad: [COLORS.brand, COLORS.brandDark],
    perm: 'notifications',
  },
  {
    key:  'feed_admin',
    icon: 'newspaper',
    label:'Feed Posts',
    sub:  'Create & manage posts',
    grad: [COLORS.purple, '#6d28d9'],
    perm: 'feed',
  },
  {
    key:  'add_participant',
    icon: 'person-add',
    label:'Add Member',
    sub:  'Create participant account',
    grad: ['#0d9488', '#0f766e'],
    perm: 'users_manage',
  },
  {
    key:  'users',
    icon: 'shield',
    label:'User Mgmt',
    sub:  'Warn or suspend accounts',
    grad: [COLORS.purple, '#7c3aed'],
    perm: 'users_manage',
  },
  {
    key:  'staff_admin',
    icon: 'people-circle',
    label:'Manage Staff',
    sub:  'CRUD Staff Profiles',
    grad: ['#7c3aed', '#5b21b6'],
    perm: 'users_manage',
  },
  {
    key:  'schedule',
    icon: 'calendar',
    label:'Sessions',
    sub:  'Manage schedule & feedback',
    grad: ['#0284c7', '#0369a1'],
    perm: 'schedule',
  },
  {
    key:  'photos',
    icon: 'camera',
    label:'Photos',
    sub:  'Moderate uploads & wall',
    grad: ['#059669', '#047857'],
    perm: 'photos',
  },
  {
    key:  'polls_admin',
    icon: 'stats-chart',
    label:'Live Polls',
    sub:  'Create, start & monitor',
    grad: [COLORS.accent, '#b45309'],
    perm: 'polls',
  },
  {
    key:  'papers',
    icon: 'document-text',
    label:'Papers/Posters',
    sub:  'Manage accepted items',
    grad: ['#0d9488', '#0f766e'],
    perm: 'papers',
  },
  {
    key:  'ideathon_admin',
    icon: 'bulb',
    label:'Ideathon',
    sub:  'Teams & audience voting',
    grad: ['#667eea', '#764ba2'],
    perm: 'ideathon',
  },
];

function FeatureCube({ feat, onPress }) {
  return (
    <TouchableOpacity
      style={[g.cube, { width: CARD_SIZE, height: CARD_SIZE }]}
      onPress={onPress}
      activeOpacity={0.82}
    >
      <LinearGradient colors={feat.grad} style={g.grad}>
        <View style={g.iconWrap}>
          <Ionicons name={feat.icon} size={28} color="#fff" />
        </View>
        <View>
          <Text style={g.label} numberOfLines={1}>{feat.label}</Text>
          <Text style={g.sub}   numberOfLines={2}>{feat.sub}</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

export default function AdminTab({ user, tokens, onLogout }) {
  const [screen, setScreen] = useState(null);

  const isSuperAdmin = user?.role === 'super_admin' || user?.role === 'mgmt_admin';
  const userPerms = Array.isArray(user?.permissions) ? user.permissions : [];

  const visibleFeatures = (ALL_FEATURES || []).filter(
    (f) => isSuperAdmin || userPerms.includes(f.perm)
  );

  const handleLogout = () =>
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: onLogout },
    ]);

  if (screen === 'checkin')         return <CheckInScreen        tokens={tokens} onBack={() => setScreen(null)} />;
  if (screen === 'notifications')   return <NotificationsAdmin   tokens={tokens} onBack={() => setScreen(null)} />;
  if (screen === 'feed_admin')      return <FeedAdmin            tokens={tokens} onBack={() => setScreen(null)} />;
  if (screen === 'add_participant') return <AddParticipantScreen tokens={tokens} onBack={() => setScreen(null)} onCreated={() => setScreen(null)} />;
  if (screen === 'users')           return <UsersAdmin           tokens={tokens} onBack={() => setScreen(null)} />;
  if (screen === 'staff_admin')     return <StaffAdminScreen     onBack={() => setScreen(null)} />;
  if (screen === 'papers')          return <PapersAdminScreen    onBack={() => setScreen(null)} />;
  if (screen === 'schedule')        return <ScheduleAdmin        tokens={tokens} onBack={() => setScreen(null)} />;
  if (screen === 'polls_admin')     return <PollsAdmin           tokens={tokens} onBack={() => setScreen(null)} />;
  if (screen === 'ideathon_admin')  return <IdeathonAdmin        tokens={tokens} onBack={() => setScreen(null)} />;
  if (screen === 'photos')          return <PhotosAdmin          onBack={() => setScreen(null)} />;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.brandDeep} />
      <LinearGradient colors={[COLORS.brandDeep, COLORS.brand]} style={a.hero}>
        <View style={a.blob} />
        <View style={a.iconWrap}>
          <Ionicons name="shield-checkmark" size={36} color="#fff" />
        </View>
        <Text style={a.heroTitle}>Admin Panel</Text>
        <Text style={a.heroSub}>{user?.first_name} {user?.last_name}</Text>
        <View style={a.rolePill}>
          <Text style={a.roleTxt}>{(user?.role || '').replace('_', ' ').toUpperCase()}</Text>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: SPACE.xl, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {visibleFeatures.length === 0 ? (
          <View style={a.emptyContainer}>
            <Ionicons name="shield-outline" size={48} color={COLORS.textTer} />
            <Text style={a.emptyTitle}>No Tasks Assigned</Text>
            <Text style={a.emptySub}>Please contact your Organising Chair.</Text>
          </View>
        ) : (
          <FadeIn delay={60}>
            <Text style={a.secLabel}>TOOLS</Text>
            <View style={g.grid}>
              {visibleFeatures.map(f => (
                <FeatureCube key={f.key} feat={f} onPress={() => setScreen(f.key)} />
              ))}
            </View>
          </FadeIn>
        )}
        <FadeIn delay={140}>
          <Text style={a.secLabel}>SYSTEM</Text>
          <View style={a.infoCard}>
            <Ionicons name="globe-outline" size={15} color={COLORS.textTer} />
            <Text style={a.infoTxt}>Full web dashboard at your server's /panel/ URL</Text>
          </View>
        </FadeIn>
        <FadeIn delay={200}>
          <TouchableOpacity style={a.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={18} color={COLORS.error} />
            <Text style={a.logoutTxt}>Sign Out</Text>
          </TouchableOpacity>
        </FadeIn>
      </ScrollView>
    </View>
  );
}

const g = StyleSheet.create({
  grid:    { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.md, marginBottom: SPACE.xl },
  cube:    { borderRadius: RADIUS.xl, overflow: 'hidden' },
  grad:    { flex: 1, padding: SPACE.lg, justifyContent: 'space-between' },
  iconWrap:{ width: 50, height: 50, borderRadius: RADIUS.md, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: SPACE.sm },
  label:   { fontSize: FONT.md, fontWeight: FONT.w8, color: '#fff' },
  sub:     { fontSize: FONT.xs, color: 'rgba(255,255,255,0.72)', marginTop: 3, lineHeight: 16 },
});

const a = StyleSheet.create({
  hero:     { paddingTop: Platform.OS === 'ios' ? 58 : 46, paddingBottom: SPACE.xxl, paddingHorizontal: SPACE.xl, alignItems: 'center', overflow: 'hidden' },
  blob:     { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.05)', top: -80, right: -60 },
  iconWrap: { width: 72, height: 72, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: SPACE.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  heroTitle:{ fontSize: FONT.xl, fontWeight: FONT.w9, color: '#fff', letterSpacing: -0.3 },
  heroSub:  { fontSize: FONT.sm, color: 'rgba(255,255,255,0.65)', marginTop: 4 },
  rolePill: { marginTop: SPACE.md, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', paddingHorizontal: SPACE.md, paddingVertical: 5, borderRadius: RADIUS.full },
  roleTxt:  { fontSize: 10, fontWeight: FONT.w8, color: '#fff', letterSpacing: 0.8 },
  secLabel: { fontSize: 10, fontWeight: FONT.w8, color: COLORS.textTer, letterSpacing: 1.5, marginBottom: SPACE.sm, marginLeft: 4 },
  infoCard: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACE.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACE.xl },
  infoTxt:  { flex: 1, fontSize: FONT.xs, color: COLORS.textTer, lineHeight: 18 },
  logoutBtn:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.sm, paddingVertical: SPACE.md, borderRadius: RADIUS.lg, borderWidth: 1.5, borderColor: COLORS.error, backgroundColor:COLORS.errorLight },
  logoutTxt:{ fontSize: FONT.sm, fontWeight: FONT.w7, color: COLORS.error },
  emptyContainer: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textSec, marginTop: 12 },
  emptySub: { fontSize: 13, color: COLORS.textTer, marginTop: 4, textAlign: 'center' },
});
