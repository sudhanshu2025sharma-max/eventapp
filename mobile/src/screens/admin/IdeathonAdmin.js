import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Platform, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONT, SPACE, RADIUS, SHADOW } from '../../theme';
import { apiFetch } from '../../api';

const PAD = SPACE.xl;

const AVATAR_EMOJI = {
  rocket: '🚀', bulb: '💡', fire: '🔥', star: '⭐', brain: '🧠',
  lightning: '⚡', diamond: '💎', trophy: '🏆', compass: '🧭', atom: '⚛️',
};

function TeamCard({ team, onRemove }) {
  return (
    <View style={tc.card}>
      <View style={tc.header}>
        <Text style={{ fontSize: 28 }}>{AVATAR_EMOJI[team.avatar] || '👥'}</Text>
        <View style={{ flex: 1, marginLeft: SPACE.md }}>
          <Text style={tc.name}>{team.name}</Text>
          <Text style={tc.count}>{team.member_count} member{team.member_count !== 1 ? 's' : ''}</Text>
        </View>
      </View>
      {!!team.project_title && <Text style={tc.project}>{team.project_title}</Text>}
      <View style={tc.members}>
        {(team.members || []).map(m => (
          <View key={m.user_id} style={[tc.memberPill, m.is_leader && tc.leaderPill]}>
            {m.is_leader && <Ionicons name="star" size={9} color={COLORS.accent} />}
            <Text style={[tc.memberName, m.is_leader && tc.leaderName]}>{m.name}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const tc = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 18, padding: SPACE.lg, marginBottom: SPACE.md, borderWidth: 1, borderColor: COLORS.border },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACE.sm },
  name: { fontSize: FONT.md, fontWeight: FONT.w8, color: COLORS.text },
  count: { fontSize: FONT.xs, color: COLORS.textTer, marginTop: 2 },
  project: { fontSize: FONT.xs, color: COLORS.textSec, marginBottom: SPACE.sm },
  members: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.xs },
  memberPill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: COLORS.bg, paddingHorizontal: SPACE.sm, paddingVertical: 3, borderRadius: RADIUS.full },
  leaderPill: { backgroundColor: COLORS.accentLight },
  memberName: { fontSize: 10, color: COLORS.textSec, fontWeight: FONT.w6 },
  leaderName: { color: COLORS.accent },
});

export default function IdeathonAdmin({ tokens, onBack }) {
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling]   = useState(false);
  const [creating, setCreating]   = useState(false);

  const fetch_ = useCallback(async () => {
    try {
      const res = await apiFetch('/polls/ideathon/');
      if (res.ok) setData(await res.json());
    } catch { /* silent */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  const toggleRegistration = async () => {
    const isOpen = data?.registration_open;
    Alert.alert(
      isOpen ? 'Close Registration' : 'Open Registration',
      isOpen
        ? 'This will stop participants from forming new teams.'
        : 'This will allow participants to form teams. A push notification will be sent.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isOpen ? 'Close' : 'Open',
          style: isOpen ? 'destructive' : 'default',
          onPress: async () => {
            setToggling(true);
            try {
              const res = await apiFetch('/polls/admin/ideathon/toggle/', { method: 'POST' });
              const d = await res.json();
              if (d.success) {
                Alert.alert('Done', d.message);
                fetch_();
              } else {
                Alert.alert('Error', d.error || 'Failed');
              }
            } catch {
              Alert.alert('Error', 'Network error');
            }
            setToggling(false);
          },
        },
      ]
    );
  };

  const createVotingPoll = async () => {
    const teams = data?.teams || [];
    if (teams.length < 2) {
      Alert.alert('Not Enough Teams', 'You need at least 2 registered teams to create a voting poll.');
      return;
    }
    Alert.alert(
      'Create Audience Choice Poll',
      `This will create a draft voting poll with all ${teams.length} teams as options.\n\nYou can then start it from Live Polls when ready.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create Poll', onPress: async () => {
            setCreating(true);
            try {
              // Build the ideathon voting poll via admin create endpoint
              const optionsList = teams.map(t => ({
                text: t.name,
                team_name: t.name,
                team_members: (t.members || []).map(m => m.name).join(', '),
                project_title: t.project_title || '',
                project_desc: t.project_desc || '',
              }));

              const res = await apiFetch('/polls/admin/create/', {
                method: 'POST',
                body: JSON.stringify({
                  title: '🏆 Ideathon 2026 — Audience Choice',
                  question: 'Which team presented the most impactful solution?',
                  description: 'Vote for the team you think deserves the Audience Choice Award!',
                  poll_type: 'single',
                  is_ideathon: true,
                  award_points: true,
                  options: optionsList,
                  start_now: false,
                }),
              });
              const d = await res.json();
              if (d.success) {
                Alert.alert(
                  'Poll Created! 🎉',
                  `Audience Choice poll created with ${teams.length} teams.\n\nGo to Live Polls to start it when the presentations begin.`
                );
                fetch_();
              } else {
                Alert.alert('Error', d.error || 'Failed');
              }
            } catch {
              Alert.alert('Error', 'Network error');
            }
            setCreating(false);
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.brand} />
      </View>
    );
  }

  const isOpen   = data?.registration_open;
  const teams    = data?.teams || [];
  const minSize  = data?.min_team_size || 2;
  const maxSize  = data?.max_team_size || 5;
  const totalMembers = teams.reduce((a, t) => a + t.member_count, 0);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* Header */}
      <LinearGradient colors={['#667eea', COLORS.brand]} style={s.header}>
        <View style={s.blob} />
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: SPACE.md }}>
          <Text style={s.headerTitle}>💡 Ideathon Admin</Text>
          <Text style={s.headerSub}>Team registration & voting</Text>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ padding: PAD, paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch_(); }} tintColor={COLORS.brand} />}
      >
        {/* Stats */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={s.statVal}>{teams.length}</Text>
            <Text style={s.statKey}>Teams</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statVal}>{totalMembers}</Text>
            <Text style={s.statKey}>Members</Text>
          </View>
          <View style={[s.statCard, { backgroundColor: isOpen ? '#d1fae5' : '#fee2e2' }]}>
            <Text style={[s.statVal, { color: isOpen ? COLORS.success : COLORS.error }]}>
              {isOpen ? 'OPEN' : 'CLOSED'}
            </Text>
            <Text style={s.statKey}>Registration</Text>
          </View>
        </View>

        {/* Registration control */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Registration Window</Text>
          <Text style={s.cardSub}>
            Team size: {minSize}–{maxSize} members.{' '}
            {isOpen ? 'Participants can currently form teams.' : 'Registration is closed.'}
          </Text>
          {data?.reg_ends_at && (
            <Text style={s.cardMeta}>
              Closes: {new Date(data.reg_ends_at).toLocaleString('en-IN', {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
              })}
            </Text>
          )}
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: isOpen ? COLORS.error : COLORS.success }]}
            onPress={toggleRegistration}
            disabled={toggling}
            activeOpacity={0.85}
          >
            {toggling
              ? <ActivityIndicator color="#fff" size="small" />
              : <>
                  <Ionicons name={isOpen ? 'lock-closed' : 'lock-open'} size={18} color="#fff" />
                  <Text style={s.actionBtnText}>
                    {isOpen ? 'Close Registration' : 'Open Registration'}
                  </Text>
                </>
            }
          </TouchableOpacity>
        </View>

        {/* Create voting poll */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Audience Choice Voting</Text>
          <Text style={s.cardSub}>
            Creates a draft poll with all {teams.length} registered team{teams.length !== 1 ? 's' : ''} as options.
            Start it from Live Polls when presentations begin.
          </Text>
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: COLORS.accent }, teams.length < 2 && { opacity: 0.4 }]}
            onPress={createVotingPoll}
            disabled={creating || teams.length < 2}
            activeOpacity={0.85}
          >
            {creating
              ? <ActivityIndicator color="#fff" size="small" />
              : <>
                  <Ionicons name="trophy" size={18} color="#fff" />
                  <Text style={s.actionBtnText}>Create Voting Poll</Text>
                </>
            }
          </TouchableOpacity>
          {teams.length < 2 && (
            <Text style={{ fontSize: FONT.xs, color: COLORS.textTer, marginTop: SPACE.xs }}>
              Need at least 2 teams.
            </Text>
          )}
        </View>

        {/* Workflow guide */}
        <View style={[s.card, { backgroundColor: COLORS.brandLight, borderColor: 'rgba(3,51,182,0.1)' }]}>
          <Text style={[s.cardTitle, { color: COLORS.brand }]}>Workflow</Text>
          {[
            '1. Open registration — participants form teams in the app',
            '2. Close registration when teams are set',
            '3. Reveal problem statement to teams',
            '4. Teams collaborate and build (10:30 AM – 1:00 PM)',
            '5. Teams present their solutions (5:40 PM)',
            '6. Tap "Create Voting Poll" above',
            '7. Go to Live Polls → Start poll during Q&A',
            '8. Audience votes → Close poll → Announce winner',
          ].map((step, i) => (
            <Text key={i} style={[s.cardSub, { color: COLORS.brand, marginBottom: 4 }]}>{step}</Text>
          ))}
        </View>

        {/* Teams list */}
        {teams.length > 0 && (
          <>
            <Text style={s.sectionLabel}>REGISTERED TEAMS ({teams.length})</Text>
            {teams.map(team => (
              <TeamCard key={team.id} team={team} />
            ))}
          </>
        )}

        {teams.length === 0 && (
          <View style={s.empty}>
            <Text style={{ fontSize: 40 }}>🏗️</Text>
            <Text style={s.emptyTitle}>No teams yet</Text>
            <Text style={s.emptySub}>Open registration so participants can form teams.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  header: { paddingTop: Platform.OS === 'ios' ? 54 : 44, paddingBottom: SPACE.xl, paddingHorizontal: PAD, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  blob: { position: 'absolute', top: -40, right: -20, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.07)' },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FONT.xl, fontWeight: FONT.w9, color: '#fff' },
  headerSub: { fontSize: FONT.xs, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: SPACE.sm, marginBottom: SPACE.lg },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: RADIUS.lg, padding: SPACE.md, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  statVal: { fontSize: FONT.xl, fontWeight: FONT.w9, color: COLORS.brand },
  statKey: { fontSize: 9, fontWeight: FONT.w7, color: COLORS.textTer, letterSpacing: 0.5, marginTop: 2 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: SPACE.lg, marginBottom: SPACE.md, borderWidth: 1, borderColor: COLORS.border, gap: SPACE.sm },
  cardTitle: { fontSize: FONT.md, fontWeight: FONT.w8, color: COLORS.text },
  cardSub: { fontSize: FONT.xs, color: COLORS.textSec, lineHeight: 18 },
  cardMeta: { fontSize: FONT.xs, fontWeight: FONT.w6, color: COLORS.brand },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.sm, paddingVertical: SPACE.lg, borderRadius: RADIUS.lg, marginTop: SPACE.xs },
  actionBtnText: { fontSize: FONT.sm, fontWeight: FONT.w7, color: '#fff' },
  sectionLabel: { fontSize: 10, fontWeight: FONT.w8, color: COLORS.textTer, letterSpacing: 1.5, marginBottom: SPACE.sm },
  empty: { alignItems: 'center', paddingVertical: 60, gap: SPACE.md },
  emptyTitle: { fontSize: FONT.xl, fontWeight: FONT.w8, color: COLORS.textSec },
  emptySub: { fontSize: FONT.sm, color: COLORS.textTer, textAlign: 'center' },
});
