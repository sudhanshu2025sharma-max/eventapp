import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Platform, TextInput, Alert, ActivityIndicator, RefreshControl, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { COLORS, FONT, SPACE, RADIUS, SHADOW, fixMediaUrl } from '../theme';
import { apiFetch } from '../api';
import { GradientAvatar } from '../components';

const PAD = SPACE.xl;

// ── Avatar config ─────────────────────────────────────────────────────────────
const AVATARS = [
  { value: 'rocket',    emoji: '🚀', label: 'Rocket' },
  { value: 'bulb',      emoji: '💡', label: 'Bulb' },
  { value: 'fire',      emoji: '🔥', label: 'Fire' },
  { value: 'star',      emoji: '⭐', label: 'Star' },
  { value: 'brain',     emoji: '🧠', label: 'Brain' },
  { value: 'lightning', emoji: '⚡', label: 'Lightning' },
  { value: 'diamond',   emoji: '💎', label: 'Diamond' },
  { value: 'trophy',    emoji: '🏆', label: 'Trophy' },
  { value: 'compass',   emoji: '🧭', label: 'Compass' },
  { value: 'atom',      emoji: '⚛️', label: 'Atom' },
];

function avatarEmoji(value) {
  return (AVATARS.find(a => a.value === value) || AVATARS[0]).emoji;
}

// ── Inline participant search (Filtered to interested participants) ───────────
function InlineSearch({ query, setQuery, results, loading, onSelect, excludeIds }) {
  const filtered = results.filter(u => !excludeIds.includes(u.id));
  if (!query.trim()) return null;

  return (
    <View style={ins.container}>
      {loading ? (
        <View style={ins.loadRow}>
          <ActivityIndicator size="small" color={COLORS.brand} />
          <Text style={ins.loadText}>Searching interested participants...</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={ins.emptyRow}>
          <Ionicons name="person-outline" size={16} color={COLORS.textTer} />
          <Text style={ins.emptyText}>No matching interested participants found</Text>
        </View>
      ) : (
        filtered.map(u => (
          <TouchableOpacity
            key={u.id}
            style={ins.row}
            onPress={() => { onSelect(u); setQuery(''); }}
            activeOpacity={0.7}
          >
            {u.profile_photo_url ? (
              <Image source={{ uri: fixMediaUrl(u.profile_photo_url) }} style={ins.avatarImg} />
            ) : (
              <View style={ins.avatar}>
                <Text style={ins.avatarText}>{(u.name[0] || '?').toUpperCase()}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={ins.name}>{u.name}</Text>
              {!!u.affiliation && <Text style={ins.sub} numberOfLines={1}>{u.affiliation}</Text>}
            </View>
            <View style={ins.addBtn}>
              <Ionicons name="add" size={16} color="#fff" />
            </View>
          </TouchableOpacity>
        ))
      )}
    </View>
  );
}

const ins = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    marginTop: SPACE.xs,
    ...SHADOW.sm,
  },
  loadRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, padding: SPACE.md },
  loadText: { fontSize: FONT.sm, color: COLORS.textTer },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, padding: SPACE.md },
  emptyText: { fontSize: FONT.sm, color: COLORS.textTer },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.md,
    padding: SPACE.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.brandLight,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarImg: { width: 36, height: 36, borderRadius: 18 },
  avatarText: { fontSize: FONT.md, fontWeight: FONT.w8, color: COLORS.brand },
  name: { fontSize: FONT.sm, fontWeight: FONT.w7, color: COLORS.text },
  sub: { fontSize: FONT.xs, color: COLORS.textTer, marginTop: 1 },
  addBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.brand,
    alignItems: 'center', justifyContent: 'center',
  },
});

// ── Invite card ───────────────────────────────────────────────────────────────
function InviteCard({ invite, onRespond }) {
  const [loading, setLoading] = useState(false);
  const handle = async (action) => {
    setLoading(true);
    try {
      const res = await apiFetch(`/polls/ideathon/invites/${invite.invite_id}/respond/`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      const d = await res.json();
      if (d.success) {
        if (action === 'accept') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
        onRespond(action, invite.invite_id, d.team);
      } else Alert.alert('Error', d.error || 'Failed');
    } catch { Alert.alert('Error', 'Network error'); }
    finally { setLoading(false); }
  };

  return (
    <View style={ic.card}>
      <View style={ic.header}>
        <Text style={ic.avatar}>{avatarEmoji(invite.team_avatar)}</Text>
        <View style={{ flex: 1 }}>
          <Text style={ic.title}>Team invite</Text>
          <Text style={ic.teamName}>{invite.team_name}</Text>
          <Text style={ic.from}>from {invite.invited_by}</Text>
        </View>
      </View>
      <View style={ic.btns}>
        <TouchableOpacity style={ic.decline} onPress={() => handle('decline')} disabled={loading} activeOpacity={0.8}>
          <Text style={ic.declineText}>Decline</Text>
        </TouchableOpacity>
        <TouchableOpacity style={ic.accept} onPress={() => handle('accept')} disabled={loading} activeOpacity={0.8}>
          {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={ic.acceptText}>Accept ✓</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const ic = StyleSheet.create({
  card: {
    backgroundColor: COLORS.brandLight, borderRadius: RADIUS.lg,
    padding: SPACE.lg, borderWidth: 1.5, borderColor: COLORS.brand,
    gap: SPACE.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  avatar: { fontSize: 32 },
  title: { fontSize: FONT.xs, fontWeight: FONT.w8, color: COLORS.brand, letterSpacing: 0.5 },
  teamName: { fontSize: FONT.lg, fontWeight: FONT.w9, color: COLORS.text },
  from: { fontSize: FONT.xs, color: COLORS.textSec },
  btns: { flexDirection: 'row', gap: SPACE.sm },
  decline: { flex: 1, alignItems: 'center', paddingVertical: SPACE.sm, borderRadius: RADIUS.md, backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border },
  declineText: { fontSize: FONT.sm, fontWeight: FONT.w6, color: COLORS.textSec },
  accept: { flex: 2, alignItems: 'center', paddingVertical: SPACE.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.brand },
  acceptText: { fontSize: FONT.sm, fontWeight: FONT.w7, color: '#fff' },
});

// ── Join Request Card (Leaders respond to participants) ───────────────────
function JoinRequestCard({ req, onRespond }) {
  const [loading, setLoading] = useState(false);
  const handle = async (action) => {
    setLoading(true);
    try {
      const res = await apiFetch(`/polls/ideathon/join-requests/${req.request_id}/respond/`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      const d = await res.json();
      if (d.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        onRespond(action, req.request_id, d.team);
      } else Alert.alert('Error', d.error || 'Failed');
    } catch { Alert.alert('Error', 'Network error'); }
    finally { setLoading(false); }
  };

  return (
    <View style={jrc.card}>
      <View style={jrc.header}>
        <View style={jrc.avatarBox}>
          <GradientAvatar name={req.user_name} size={36} radius={18} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={jrc.title}>Join Request</Text>
          <Text style={jrc.name}>{req.user_name}</Text>
          {!!req.affiliation && <Text style={jrc.sub}>{req.affiliation}</Text>}
        </View>
      </View>
      <View style={jrc.btns}>
        <TouchableOpacity style={jrc.decline} onPress={() => handle('decline')} disabled={loading} activeOpacity={0.8}>
          <Text style={jrc.declineText}>Decline</Text>
        </TouchableOpacity>
        <TouchableOpacity style={jrc.accept} onPress={() => handle('accept')} disabled={loading} activeOpacity={0.8}>
          {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={jrc.acceptText}>Approve ✓</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const jrc = StyleSheet.create({
  card: {
    backgroundColor: '#fff', borderRadius: RADIUS.lg,
    padding: SPACE.lg, borderWidth: 1.5, borderColor: COLORS.accent,
    gap: SPACE.md, ...SHADOW.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  avatarBox: { width: 36, height: 36 },
  title: { fontSize: FONT.xs, fontWeight: FONT.w8, color: COLORS.accent, letterSpacing: 0.5 },
  name: { fontSize: FONT.md, fontWeight: FONT.w8, color: COLORS.text },
  sub: { fontSize: FONT.xs, color: COLORS.textTer, marginTop: 1 },
  btns: { flexDirection: 'row', gap: SPACE.sm },
  decline: { flex: 1, alignItems: 'center', paddingVertical: SPACE.sm, borderRadius: RADIUS.md, backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border },
  declineText: { fontSize: FONT.sm, fontWeight: FONT.w6, color: COLORS.textSec },
  accept: { flex: 2, alignItems: 'center', paddingVertical: SPACE.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.accent },
  acceptText: { fontSize: FONT.sm, fontWeight: FONT.w7, color: '#fff' },
});

// ── Team card ─────────────────────────────────────────────────────────────────
function TeamCard({ team, isMyTeam, canJoin, requested, onJoin, joining, maxSize, minSize }) {
  const full = team.member_count >= maxSize;
  return (
    <View style={[tc.card, isMyTeam && tc.cardMine]}>
      <View style={tc.header}>
        <Text style={tc.avatar}>{avatarEmoji(team.avatar)}</Text>
        <View style={{ flex: 1 }}>
          <Text style={tc.name}>{team.name}</Text>
          <Text style={tc.count}>{team.member_count}/{maxSize} members (min {minSize})</Text>
        </View>

        {/* Dynamic button state based on team relation */}
        {canJoin && !full && !isMyTeam && (
          requested ? (
            <View style={tc.requestedBadge}>
              <Ionicons name="time-outline" size={12} color={COLORS.warning} />
              <Text style={tc.requestedText}>Pending</Text>
            </View>
          ) : (
            <TouchableOpacity style={tc.joinBtn} onPress={() => onJoin(team.id)} disabled={joining} activeOpacity={0.8}>
              {joining ? <ActivityIndicator size="small" color="#fff" /> : <Text style={tc.joinBtnText}>Ask to Join</Text>}
            </TouchableOpacity>
          )
        )}
        {full && !isMyTeam && (
          <View style={tc.fullBadge}><Text style={tc.fullText}>Full</Text></View>
        )}
      </View>
      {!!team.project_title && <Text style={tc.project}>{team.project_title}</Text>}
      <View style={tc.members}>
        {team.members.map(m => (
          <View key={m.user_id} style={tc.memberPill}>
            {m.is_leader && <Ionicons name="star" size={10} color={COLORS.accent} />}
            <Text style={tc.memberName}>{m.name}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const tc = StyleSheet.create({
  card: {
    backgroundColor: '#fff', borderRadius: 18, padding: SPACE.lg,
    borderWidth: 1, borderColor: COLORS.border, gap: SPACE.sm,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 }, android: { elevation: 1 } }),
  },
  cardMine: { borderColor: COLORS.brand, borderWidth: 2 },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  avatar: { fontSize: 28 },
  name: { fontSize: FONT.md, fontWeight: FONT.w8, color: COLORS.text },
  count: { fontSize: FONT.xs, color: COLORS.textTer, marginTop: 2 },
  joinBtn: { backgroundColor: COLORS.brand, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm, borderRadius: RADIUS.full },
  joinBtnText: { fontSize: FONT.xs, fontWeight: FONT.w8, color: '#fff' },
  requestedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(245,158,11,0.08)', paddingHorizontal: SPACE.md, paddingVertical: SPACE.xs, borderRadius: RADIUS.full, borderStyle: 'solid', borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)' },
  requestedText: { fontSize: FONT.xs, fontWeight: FONT.w7, color: COLORS.warning },
  fullBadge: { backgroundColor: COLORS.bg, paddingHorizontal: SPACE.md, paddingVertical: SPACE.xs, borderRadius: RADIUS.full },
  fullText: { fontSize: FONT.xs, fontWeight: FONT.w6, color: COLORS.textTer },
  project: { fontSize: FONT.sm, color: COLORS.textSec },
  members: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.xs },
  memberPill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: COLORS.bg, paddingHorizontal: SPACE.sm, paddingVertical: 4, borderRadius: RADIUS.full },
  memberName: { fontSize: FONT.xs, color: COLORS.textSec, fontWeight: FONT.w6 },
});

// ── Interested Participant Grid Card ──────────────────────────────────────────
function ParticipantCard({ user, onInvite, isInviting, myTeam, amLeader, isMyTeamFull }) {
  const hasTeam = user.has_team;
  const canInvite = amLeader && !hasTeam && !isMyTeamFull;

  return (
    <View style={pc.card}>
      <View style={pc.topRow}>
        {user.profile_photo_url ? (
          <Image source={{ uri: fixMediaUrl(user.profile_photo_url) }} style={pc.photo} />
        ) : (
          <GradientAvatar name={user.name} size={44} radius={22} />
        )}
        <View style={{ flex: 1, marginLeft: SPACE.sm }}>
          <Text style={pc.name} numberOfLines={1}>{user.name}</Text>
          <Text style={pc.sub} numberOfLines={1}>{user.affiliation || 'Attendee'}</Text>
        </View>
      </View>

      <View style={pc.badgeRow}>
        {hasTeam ? (
          <View style={pc.teamPill}>
            <Text style={pc.teamEmoji}>{avatarEmoji(user.team?.avatar)}</Text>
            <Text style={pc.teamText} numberOfLines={1}>{user.team?.team_name}</Text>
          </View>
        ) : (
          <View style={pc.lookingPill}>
            <View style={pc.lookingDot} />
            <Text style={pc.lookingText}>Looking for team</Text>
          </View>
        )}
      </View>

      {canInvite && (
        <TouchableOpacity
          style={pc.inviteBtn}
          onPress={() => onInvite(user.id)}
          disabled={isInviting}
          activeOpacity={0.8}
        >
          {isInviting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="paper-plane-outline" size={13} color="#fff" />
              <Text style={pc.inviteBtnText}>Invite</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const pc = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: SPACE.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'space-between',
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 }, android: { elevation: 1 } }),
  },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  photo: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.bg },
  name: { fontSize: FONT.sm, fontWeight: FONT.w8, color: COLORS.text },
  sub: { fontSize: 11, color: COLORS.textTer, marginTop: 1 },
  badgeRow: { marginTop: SPACE.sm, marginBottom: SPACE.xs },
  lookingPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(16,185,129,0.12)', paddingHorizontal: SPACE.sm, paddingVertical: 3, borderRadius: RADIUS.full, alignSelf: 'flex-start' },
  lookingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.success },
  lookingText: { fontSize: 10, fontWeight: FONT.w7, color: COLORS.success },
  teamPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.bg, paddingHorizontal: SPACE.sm, paddingVertical: 3, borderRadius: RADIUS.full, alignSelf: 'flex-start', maxWidth: '100%' },
  teamEmoji: { fontSize: 11 },
  teamText: { fontSize: 10, fontWeight: FONT.w6, color: COLORS.textSec, flexShrink: 1 },
  inviteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: COLORS.brand, borderRadius: RADIUS.md, paddingVertical: 6, marginTop: SPACE.xs },
  inviteBtnText: { fontSize: 11, fontWeight: FONT.w7, color: '#fff' },
});

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function IdeathonScreen({ onBack, onOpenPolls }) {
  const [activeTab, setActiveTab] = useState('teams');
  const [data, setData]           = useState(null);
  const [interestedList, setInterestedList] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [togglingInterest, setTogglingInterest] = useState(false);

  // Participant Grid Filter Search
  const [partSearch, setPartSearch] = useState('');

  // Create form state
  const [showCreate, setShowCreate]   = useState(false);
  const [teamName, setTeamName]       = useState('');
  const [nameStatus, setNameStatus]   = useState(null);
  const [avatar, setAvatar]           = useState('rocket');
  const [projTitle, setProjTitle]     = useState('');
  const [projDesc, setProjDesc]       = useState('');
  const [pendingMembers, setPendingMembers] = useState([]);
  const [leaderUserId, setLeaderUserId]    = useState(null);
  const [creating, setCreating]       = useState(false);

  // Search state for create form (filtered to interested participants)
  const [searchQuery, setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching]       = useState(false);

  // Edit form
  const [showEdit, setShowEdit]   = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc]   = useState('');

  // Invite UI
  const [inviteQuery, setInviteQuery]     = useState('');
  const [inviteResults, setInviteResults] = useState([]);
  const [inviteSearching, setInviteSearching] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(null);

  const [joining, setJoining]   = useState(null);
  const [leaving, setLeaving]   = useState(false);
  const submitRef = useRef(false);
  const nameCheckRef = useRef(null);

  const fetch_ = useCallback(async () => {
    try {
      const [infoRes, partRes] = await Promise.all([
        apiFetch('/polls/ideathon/'),
        apiFetch('/polls/ideathon/interested/'),
      ]);
      if (infoRes.ok) setData(await infoRes.json());
      if (partRes.ok) {
        const pd = await partRes.json();
        setInterestedList(pd.participants || []);
      }
    } catch { /* silent */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  // Toggle Interest Handler
  const handleToggleInterest = async () => {
    setTogglingInterest(true);
    try {
      const res = await apiFetch('/polls/ideathon/interest/', { method: 'POST' });
      const d = await res.json();
      if (d.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setData(prev => ({ ...prev, is_interested: d.is_interested, interested_count: d.interested_count }));
        fetch_();
      } else {
        Alert.alert('Notice', d.error || 'Failed');
      }
    } catch {
      Alert.alert('Error', 'Network error');
    } finally {
      setTogglingInterest(false);
    }
  };

  // Debounced name uniqueness check
  useEffect(() => {
    if (!teamName.trim()) { setNameStatus(null); return; }
    setNameStatus('checking');
    if (nameCheckRef.current) clearTimeout(nameCheckRef.current);
    nameCheckRef.current = setTimeout(async () => {
      try {
        const res = await apiFetch(`/polls/ideathon/check-name/?name=${encodeURIComponent(teamName.trim())}`);
        if (res.ok) {
          const d = await res.json();
          setNameStatus(d.available ? 'ok' : 'taken');
        }
      } catch { setNameStatus(null); }
    }, 500);
    return () => clearTimeout(nameCheckRef.current);
  }, [teamName]);

  // Debounced member search on interested users (for create form)
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await apiFetch(`/polls/ideathon/interested/?search=${encodeURIComponent(searchQuery)}`);
        if (res.ok) { const d = await res.json(); setSearchResults(d.users || []); }
      } catch { /* silent */ }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Debounced invite search on interested users (for existing team)
  useEffect(() => {
    if (!inviteQuery.trim()) { setInviteResults([]); return; }
    setInviteSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await apiFetch(`/polls/ideathon/interested/?search=${encodeURIComponent(inviteQuery)}`);
        if (res.ok) { const d = await res.json(); setInviteResults(d.users || []); }
      } catch { /* silent */ }
      finally { setInviteSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [inviteQuery]);

  const handleCreate = async () => {
    if (submitRef.current) return;
    if (!teamName.trim()) { Alert.alert('Required', 'Enter a team name.'); return; }
    if (nameStatus === 'taken') { Alert.alert('Name Taken', 'Choose a different team name.'); return; }
    if (nameStatus === 'checking') { Alert.alert('Please wait', 'Checking name availability...'); return; }

    submitRef.current = true;
    setCreating(true);
    try {
      const res = await apiFetch('/polls/ideathon/create-team/', {
        method: 'POST',
        body: JSON.stringify({
          name: teamName.trim(),
          avatar,
          project_title: projTitle.trim(),
          project_desc: projDesc.trim(),
        }),
      });
      const d = await res.json();
      if (d.success) {
        const teamId = d.team.id;
        for (const m of pendingMembers) {
          try {
            await apiFetch(`/polls/ideathon/teams/${teamId}/invite/`, {
              method: 'POST',
              body: JSON.stringify({ user_id: m.id }),
            });
          } catch { /* non-critical */ }
        }
        if (leaderUserId) {
          try {
            await apiFetch(`/polls/ideathon/teams/${teamId}/change-leader/`, {
              method: 'POST',
              body: JSON.stringify({ user_id: leaderUserId }),
            });
          } catch { /* non-critical */ }
        }
        Alert.alert('Team Created! 🎉', d.message + (pendingMembers.length ? `\nInvites sent to ${pendingMembers.length} member(s).` : ''));
        setShowCreate(false);
        setTeamName(''); setProjTitle(''); setProjDesc('');
        setAvatar('rocket'); setPendingMembers([]); setLeaderUserId(null);
        fetch_();
      } else {
        Alert.alert('Error', d.error || 'Failed');
      }
    } catch { Alert.alert('Error', 'Network error'); }
    finally { setCreating(false); submitRef.current = false; }
  };

  const handleSendInvite = async (userId) => {
    if (!data?.my_team) return;
    setSendingInvite(userId);
    try {
      const res = await apiFetch(`/polls/ideathon/teams/${data.my_team.id}/invite/`, {
        method: 'POST',
        body: JSON.stringify({ user_id: userId }),
      });
      const d = await res.json();
      if (d.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        Alert.alert('Invite Sent', d.message);
        setInviteQuery('');
        setInviteResults([]);
        fetch_();
      } else Alert.alert('Error', d.error || 'Failed');
    } catch { Alert.alert('Error', 'Network error'); }
    finally { setSendingInvite(null); }
  };

  // Submit join request to a team
  const handleRequestToJoin = async (teamId) => {
    setJoining(teamId);
    try {
      const res = await apiFetch(`/polls/ideathon/teams/${teamId}/request-join/`, { method: 'POST' });
      const d = await res.json();
      if (d.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        Alert.alert('Requested!', d.message);
        fetch_();
      } else Alert.alert('Error', d.error || 'Request failed');
    } catch { Alert.alert('Error', 'Network error'); }
    finally { setJoining(null); }
  };

  const handleLeave = () => {
    Alert.alert('Leave Team', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave', style: 'destructive', onPress: async () => {
          setLeaving(true);
          try {
            const res = await apiFetch('/polls/ideathon/leave-team/', { method: 'POST' });
            const d = await res.json();
            if (d.success) { Alert.alert('Done', d.message); fetch_(); }
            else Alert.alert('Error', d.error);
          } catch { Alert.alert('Error', 'Network error'); }
          finally { setLeaving(false); }
        },
      },
    ]);
  };

  const handleUpdate = async () => {
    if (!data?.my_team) return;
    try {
      const res = await apiFetch(`/polls/ideathon/teams/${data.my_team.id}/update/`, {
        method: 'PATCH',
        body: JSON.stringify({ project_title: editTitle.trim(), project_desc: editDesc.trim() }),
      });
      const d = await res.json();
      if (d.success) { setShowEdit(false); fetch_(); }
      else Alert.alert('Error', d.error);
    } catch { Alert.alert('Error', 'Network error'); }
  };

  const handleInviteRespond = (action, inviteId, team) => {
    setData(prev => {
      if (!prev) return prev;
      const invites = prev.pending_invites.filter(i => i.invite_id !== inviteId);
      return { ...prev, pending_invites: invites, my_team: action === 'accept' ? team : prev.my_team };
    });
    fetch_();
  };

  // Respond to request of someone trying to join my team
  const handleJoinRequestRespond = (action, requestId, updatedTeam) => {
    setData(prev => {
      if (!prev) return prev;
      const requests = prev.pending_join_requests.filter(r => r.request_id !== requestId);
      return { ...prev, pending_join_requests: requests, my_team: action === 'accept' ? updatedTeam : prev.my_team };
    });
    fetch_();
  };

  const handleChangeLeader = (memberId) => {
    if (!data?.my_team) return;
    Alert.alert('Transfer Leadership', 'Make this person the team leader?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Transfer', onPress: async () => {
          try {
            const res = await apiFetch(`/polls/ideathon/teams/${data.my_team.id}/change-leader/`, {
              method: 'POST',
              body: JSON.stringify({ user_id: memberId }),
            });
            const d = await res.json();
            if (d.success) { Alert.alert('Done', d.message); fetch_(); }
            else Alert.alert('Error', d.error);
          } catch { Alert.alert('Error', 'Network error'); }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg }}>
        <ActivityIndicator size="large" color={COLORS.brand} />
      </View>
    );
  }

  const isOpen          = data?.registration_open;
  const isInterested    = !!data?.is_interested;
  const myTeam          = data?.my_team;
  const teams           = data?.teams || [];
  const minSize         = 3;
  const maxSize         = 5;
  const pendingInvites  = data?.pending_invites || [];
  const pendingJoinRequests = data?.pending_join_requests || [];
  const mySentJoinRequests  = data?.my_sent_join_requests || [];
  const otherTeams      = myTeam ? teams.filter(t => t.id !== myTeam.id) : teams;

  const amLeader        = myTeam && String(myTeam.leader_id) === String(myTeam.members.find(m => m.is_leader)?.user_id);
  const myTeamFull      = myTeam && myTeam.member_count >= maxSize;

  const createExclude   = pendingMembers.map(m => m.id);
  const inviteExclude   = (myTeam?.members || []).map(m => m.user_id);

  const filteredParticipants = interestedList.filter(u => {
    if (!partSearch.trim()) return true;
    const q = partSearch.toLowerCase();
    return (
      (u.name || '').toLowerCase().includes(q) ||
      (u.affiliation || '').toLowerCase().includes(q) ||
      (u.team?.team_name || '').toLowerCase().includes(q)
    );
  });

  return (
    <View style={sc.container}>
      {/* Header */}
      <LinearGradient colors={[COLORS.brandDeep, COLORS.brand]} style={sc.header}>
        <View style={sc.blob1} />
        <View style={sc.blob2} />
        <View style={sc.topbar}>
          <TouchableOpacity style={sc.backBtn} onPress={onBack} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: SPACE.md }}>
            <Text style={sc.headerTitle}>💡 Ideathon 2026</Text>
            <Text style={sc.headerSub}>Teams: 3–5 Members · Audience Choice Voting</Text>
          </View>
          {isOpen && (
            <View style={sc.openPill}>
              <View style={sc.openDot} />
              <Text style={sc.openText}>OPEN</Text>
            </View>
          )}
        </View>

        <View style={sc.statsRow}>
          <View style={sc.statPill}>
            <Ionicons name="sparkles-outline" size={13} color="rgba(255,255,255,0.7)" />
            <Text style={sc.statText}>{interestedList.length} Interested</Text>
          </View>
          <View style={sc.statPill}>
            <Ionicons name="people-outline" size={13} color="rgba(255,255,255,0.7)" />
            <Text style={sc.statText}>{data?.total_teams || 0} teams formed</Text>
          </View>
        </View>

        {/* Tab Switcher */}
        <View style={sc.tabBar}>
          <TouchableOpacity
            style={[sc.tabItem, activeTab === 'teams' && sc.tabItemActive]}
            onPress={() => setActiveTab('teams')}
            activeOpacity={0.8}
          >
            <Ionicons name="cube-outline" size={15} color={activeTab === 'teams' ? COLORS.brand : 'rgba(255,255,255,0.8)'} />
            <Text style={[sc.tabItemText, activeTab === 'teams' && sc.tabItemTextActive]}>Teams ({teams.length})</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[sc.tabItem, activeTab === 'participants' && sc.tabItemActive]}
            onPress={() => setActiveTab('participants')}
            activeOpacity={0.8}
          >
            <Ionicons name="people-outline" size={15} color={activeTab === 'participants' ? COLORS.brand : 'rgba(255,255,255,0.8)'} />
            <Text style={[sc.tabItemText, activeTab === 'participants' && sc.tabItemTextActive]}>Interested ({interestedList.length})</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ padding: PAD, paddingBottom: 140, gap: SPACE.lg }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch_(); }} tintColor={COLORS.brand} />}
      >
        {/* Interest Acknowledgment Card */}
        <View style={[sc.interestCard, isInterested ? sc.interestCardActive : sc.interestCardInactive]}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, marginBottom: 2 }}>
              <Text style={sc.interestTitle}>
                {isInterested ? '⭐ Registered as Interested' : '💡 Are you interested in Ideathon?'}
              </Text>
            </View>
            <Text style={sc.interestSub}>
              {isInterested
                ? 'Other participants can discover and request/invite you to their teams.'
                : 'Mark yourself interested to be discovered by teammates and start forming teams.'}
            </Text>
          </View>
          <TouchableOpacity
            style={[sc.interestBtn, isInterested ? sc.interestBtnWithdraw : sc.interestBtnJoin]}
            onPress={handleToggleInterest}
            disabled={togglingInterest}
            activeOpacity={0.85}
          >
            {togglingInterest ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={sc.interestBtnText}>{isInterested ? 'Withdraw' : 'Count Me In 🚀'}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ── TAB 1: TEAMS ────────────────────────────────────────── */}
        {activeTab === 'teams' && (
          <>
            {/* Pending invites to current user */}
            {pendingInvites.length > 0 && (
              <View style={{ gap: SPACE.sm }}>
                <Text style={sc.sectionLabel}>PENDING TEAM INVITES</Text>
                {pendingInvites.map(inv => (
                  <InviteCard key={inv.invite_id} invite={inv} onRespond={handleInviteRespond} />
                ))}
              </View>
            )}

            {/* Pending join requests to MY team (if I am leader) */}
            {amLeader && pendingJoinRequests.length > 0 && (
              <View style={{ gap: SPACE.sm }}>
                <Text style={[sc.sectionLabel, { color: COLORS.accent }]}>PENDING JOIN REQUESTS (ACTION NEEDED)</Text>
                {pendingJoinRequests.map(req => (
                  <JoinRequestCard key={req.request_id} req={req} onRespond={handleJoinRequestRespond} />
                ))}
              </View>
            )}

            {/* Voting banner */}
            {!isOpen && onOpenPolls && (
              <TouchableOpacity style={sc.voteBanner} onPress={onOpenPolls} activeOpacity={0.85}>
                <LinearGradient colors={[COLORS.accent, COLORS.accentDark]} style={sc.voteGrad}>
                  <View style={sc.voteIconBox}><Ionicons name="trophy" size={22} color={COLORS.textInverse} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={sc.voteTitle}>🏆 Audience Choice Voting</Text>
                    <Text style={sc.voteSub}>Team leaders — go to Polls to cast your vote</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
                </LinearGradient>
              </TouchableOpacity>
            )}

            {/* Info on team limits */}
            {isOpen && !myTeam && (
              <View style={sc.infoCard}>
                <Ionicons name="information-circle-outline" size={18} color={COLORS.brand} />
                <Text style={sc.infoText}>
                  Form a team of <Text style={{ fontWeight: FONT.w8 }}>3 to 5 members</Text>.
                  You can click "Ask to Join" on any team, which must be approved by their leader.
                </Text>
              </View>
            )}

            {/* My team card */}
            {myTeam && (
              <View style={sc.myTeamCard}>
                <LinearGradient colors={[COLORS.brand, COLORS.brandDark]} style={sc.myTeamGrad}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginBottom: SPACE.md }}>
                    <Text style={{ fontSize: 36 }}>{avatarEmoji(myTeam.avatar)}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={sc.myTeamLabel}>YOUR TEAM</Text>
                      <Text style={sc.myTeamName}>{myTeam.name}</Text>
                      <Text style={sc.myTeamSizeNotice}>
                        {myTeam.member_count < 3 ? `⚠️ Need at least 3 members (currently ${myTeam.member_count}/5)` : `${myTeam.member_count}/5 members (Valid)`}
                      </Text>
                    </View>
                  </View>
                  {!!myTeam.project_title && <Text style={sc.myTeamProject}>{myTeam.project_title}</Text>}

                  {/* Members */}
                  <Text style={[sc.myTeamLabel, { marginTop: SPACE.md, marginBottom: SPACE.xs }]}>MEMBERS ({myTeam.member_count}/5)</Text>
                  {myTeam.members.map(m => (
                    <View key={m.user_id} style={sc.memberRow}>
                      <Ionicons
                        name={m.is_leader ? 'star' : 'person-outline'}
                        size={14}
                        color={m.is_leader ? '#fde68a' : 'rgba(255,255,255,0.5)'}
                      />
                      <Text style={sc.memberRowName}>{m.name}</Text>
                      {m.is_leader && <Text style={sc.leaderTag}>Leader</Text>}
                      {amLeader && !m.is_leader && (
                        <TouchableOpacity onPress={() => handleChangeLeader(m.user_id)} style={sc.makeLeaderBtn}>
                          <Text style={sc.makeLeaderText}>Transfer Leadership</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}

                  {/* Invite section */}
                  {isOpen && amLeader && !myTeamFull && (
                    <View style={{ marginTop: SPACE.lg }}>
                      <Text style={[sc.myTeamLabel, { marginBottom: SPACE.sm }]}>INVITE INTERESTED MEMBER</Text>
                      <View style={sc.inviteSearchBox}>
                        <Ionicons name="search-outline" size={16} color="rgba(255,255,255,0.5)" />
                        <TextInput
                          style={sc.inviteSearchInput}
                          placeholder="Search interested participants..."
                          placeholderTextColor="rgba(255,255,255,0.4)"
                          value={inviteQuery}
                          onChangeText={setInviteQuery}
                        />
                        {inviteQuery.length > 0 && (
                          <TouchableOpacity onPress={() => { setInviteQuery(''); setInviteResults([]); }}>
                            <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.5)" />
                          </TouchableOpacity>
                        )}
                      </View>
                      {inviteQuery.trim().length > 0 && (
                        <View style={sc.inviteResults}>
                          {inviteSearching && (
                            <View style={sc.inviteResultRow}>
                              <ActivityIndicator size="small" color={COLORS.brand} />
                              <Text style={sc.inviteResultText}>Searching...</Text>
                            </View>
                          )}
                          {!inviteSearching && inviteResults.filter(u => !inviteExclude.includes(u.id)).length === 0 && (
                            <View style={sc.inviteResultRow}>
                              <Ionicons name="person-outline" size={14} color={COLORS.textTer} />
                              <Text style={sc.inviteResultText}>No matching interested participants</Text>
                            </View>
                          )}
                          {!inviteSearching && inviteResults
                            .filter(u => !inviteExclude.includes(u.id))
                            .map(u => (
                              <View key={u.id} style={[sc.inviteResultRow, { justifyContent: 'space-between' }]}>
                                <View style={{ flex: 1 }}>
                                  <Text style={sc.inviteResultName}>{u.name}</Text>
                                  {!!u.affiliation && <Text style={sc.inviteResultSub}>{u.affiliation}</Text>}
                                </View>
                                <TouchableOpacity
                                  style={sc.sendInviteBtn}
                                  onPress={() => handleSendInvite(u.id)}
                                  disabled={sendingInvite === u.id}
                                  activeOpacity={0.8}
                                >
                                  {sendingInvite === u.id
                                    ? <ActivityIndicator size="small" color={COLORS.brand} />
                                    : <Text style={sc.sendInviteText}>Invite</Text>
                                  }
                                </TouchableOpacity>
                              </View>
                            ))
                          }
                        </View>
                      )}
                    </View>
                  )}

                  {/* Actions */}
                  <View style={{ flexDirection: 'row', gap: SPACE.sm, marginTop: SPACE.lg }}>
                    {amLeader && (
                      <TouchableOpacity style={sc.myTeamBtn} onPress={() => { setEditTitle(myTeam.project_title || ''); setEditDesc(myTeam.project_desc || ''); setShowEdit(!showEdit); }} activeOpacity={0.8}>
                        <Ionicons name="create-outline" size={14} color="#fff" />
                        <Text style={sc.myTeamBtnText}>{showEdit ? 'Cancel' : 'Edit'}</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={[sc.myTeamBtn, { backgroundColor: 'rgba(239,68,68,0.3)' }]} onPress={handleLeave} disabled={leaving} activeOpacity={0.8}>
                      {leaving ? <ActivityIndicator size="small" color="#fff" /> : <>
                        <Ionicons name="exit-outline" size={14} color="#fff" />
                        <Text style={sc.myTeamBtnText}>Leave</Text>
                      </>}
                    </TouchableOpacity>
                  </View>
                </LinearGradient>
              </View>
            )}

            {/* Edit project modal/inline */}
            {showEdit && (
              <View style={sc.formCard}>
                <Text style={sc.formTitle}>Update Project</Text>
                <TextInput style={sc.input} placeholder="Project title" value={editTitle} onChangeText={setEditTitle} maxLength={300} placeholderTextColor={COLORS.textTer} />
                <TextInput style={[sc.input, { minHeight: 60 }]} placeholder="Project description" value={editDesc} onChangeText={setEditDesc} multiline placeholderTextColor={COLORS.textTer} textAlignVertical="top" />
                <View style={{ flexDirection: 'row', gap: SPACE.sm }}>
                  <TouchableOpacity style={sc.formCancel} onPress={() => setShowEdit(false)}><Text style={sc.formCancelText}>Cancel</Text></TouchableOpacity>
                  <TouchableOpacity style={sc.formSubmit} onPress={handleUpdate}><Text style={sc.formSubmitText}>Save</Text></TouchableOpacity>
                </View>
              </View>
            )}

            {/* Create team button */}
            {isOpen && !myTeam && (
              <TouchableOpacity style={sc.createBtn} onPress={() => setShowCreate(!showCreate)} activeOpacity={0.85}>
                <LinearGradient colors={[COLORS.brand, COLORS.brandDark]} style={sc.createGrad}>
                  <Ionicons name={showCreate ? 'chevron-up' : 'add-circle'} size={20} color="#fff" />
                  <Text style={sc.createText}>{showCreate ? 'Cancel Creation' : 'Create a Team (Min 3 Members)'}</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {/* Create form */}
            {showCreate && !myTeam && (
              <View style={sc.formCard}>
                <Text style={sc.formTitle}>New Team Formation</Text>

                <View>
                  <Text style={sc.inputLabel}>Team Avatar</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: SPACE.sm, paddingVertical: SPACE.xs }}
                  >
                    {AVATARS.map(a => (
                      <TouchableOpacity
                        key={a.value}
                        style={[sc.avatarOption, avatar === a.value && sc.avatarOptionSelected]}
                        onPress={() => setAvatar(a.value)}
                        activeOpacity={0.8}
                      >
                        <Text style={{ fontSize: 24 }}>{a.emoji}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <View>
                  <Text style={sc.inputLabel}>Team Name *</Text>
                  <View style={{ position: 'relative' }}>
                    <TextInput
                      style={[sc.input, nameStatus === 'taken' && { borderColor: COLORS.error }, nameStatus === 'ok' && { borderColor: COLORS.success }]}
                      placeholder="e.g. AI Pioneers"
                      value={teamName}
                      onChangeText={setTeamName}
                      maxLength={200}
                      placeholderTextColor={COLORS.textTer}
                    />
                    <View style={{ position: 'absolute', right: SPACE.md, top: 0, bottom: 0, justifyContent: 'center' }}>
                      {nameStatus === 'checking' && <ActivityIndicator size="small" color={COLORS.brand} />}
                      {nameStatus === 'ok'       && <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />}
                      {nameStatus === 'taken'    && <Ionicons name="close-circle" size={18} color={COLORS.error} />}
                    </View>
                  </View>
                  {nameStatus === 'taken' && <Text style={{ fontSize: FONT.xs, color: COLORS.error, marginTop: 3 }}>This name is taken. Choose another.</Text>}
                  {nameStatus === 'ok'    && <Text style={{ fontSize: FONT.xs, color: COLORS.success, marginTop: 3 }}>Name is available ✓</Text>}
                </View>

                <View>
                  <Text style={sc.inputLabel}>Project Title</Text>
                  <TextInput style={sc.input} placeholder="What will your team build?" value={projTitle} onChangeText={setProjTitle} maxLength={300} placeholderTextColor={COLORS.textTer} />
                </View>
                <View>
                  <Text style={sc.inputLabel}>Project Description</Text>
                  <TextInput style={[sc.input, { minHeight: 60 }]} placeholder="Brief idea description..." value={projDesc} onChangeText={setProjDesc} multiline placeholderTextColor={COLORS.textTer} textAlignVertical="top" />
                </View>

                {/* Add members via inline search (Interested users only) */}
                <View>
                  <Text style={sc.inputLabel}>
                    Invite Interested Teammates ({pendingMembers.length + 1}/5) — [Min 3 Required]
                  </Text>
                  {pendingMembers.length + 1 < maxSize && (
                    <View>
                      <View style={sc.searchBox}>
                        <Ionicons name="search-outline" size={16} color={COLORS.textTer} />
                        <TextInput
                          style={sc.searchInput}
                          placeholder="Search interested attendees..."
                          value={searchQuery}
                          onChangeText={setSearchQuery}
                          placeholderTextColor={COLORS.textTer}
                        />
                        {searchQuery.length > 0 && (
                          <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
                            <Ionicons name="close-circle" size={16} color={COLORS.textTer} />
                          </TouchableOpacity>
                        )}
                      </View>
                      <InlineSearch
                        query={searchQuery}
                        setQuery={setSearchQuery}
                        results={searchResults}
                        loading={searching}
                        onSelect={(u) => setPendingMembers(prev => [...prev, u])}
                        excludeIds={createExclude}
                      />
                    </View>
                  )}

                  {/* Selected members preview */}
                  {pendingMembers.length > 0 && (
                    <View style={sc.memberPreview}>
                      <View style={sc.memberPreviewPill}>
                        <Ionicons name="star" size={10} color={COLORS.accent} />
                        <Text style={sc.memberPreviewText}>You (Creator)</Text>
                      </View>
                      {pendingMembers.map(m => (
                        <View key={m.id} style={sc.memberPreviewPill}>
                          <Text style={sc.memberPreviewText}>{m.name.split(' ')[0]}</Text>
                          <TouchableOpacity onPress={() => {
                            setPendingMembers(prev => prev.filter(x => x.id !== m.id));
                            if (leaderUserId === m.id) setLeaderUserId(null);
                          }}>
                            <Ionicons name="close-circle" size={13} color={COLORS.error} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {/* Leader selector */}
                {pendingMembers.length > 0 && (
                  <View>
                    <Text style={sc.inputLabel}>Who is the Team Leader?</Text>
                    <View style={{ gap: SPACE.xs }}>
                      <TouchableOpacity
                        style={[sc.leaderOption, !leaderUserId && sc.leaderOptionSelected]}
                        onPress={() => setLeaderUserId(null)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name={!leaderUserId ? 'radio-button-on' : 'radio-button-off'} size={18} color={!leaderUserId ? COLORS.brand : COLORS.textTer} />
                        <Text style={[sc.leaderOptionText, !leaderUserId && { color: COLORS.brand, fontWeight: FONT.w7 }]}>You (creator)</Text>
                        <View style={sc.defaultBadge}><Text style={sc.defaultBadgeText}>default</Text></View>
                      </TouchableOpacity>
                      {pendingMembers.map(m => (
                        <TouchableOpacity
                          key={m.id}
                          style={[sc.leaderOption, leaderUserId === m.id && sc.leaderOptionSelected]}
                          onPress={() => setLeaderUserId(m.id)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name={leaderUserId === m.id ? 'radio-button-on' : 'radio-button-off'} size={18} color={leaderUserId === m.id ? COLORS.brand : COLORS.textTer} />
                          <Text style={[sc.leaderOptionText, leaderUserId === m.id && { color: COLORS.brand, fontWeight: FONT.w7 }]}>{m.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                <View style={{ flexDirection: 'row', gap: SPACE.sm }}>
                  <TouchableOpacity style={sc.formCancel} onPress={() => { setShowCreate(false); setPendingMembers([]); setTeamName(''); setProjTitle(''); setProjDesc(''); setLeaderUserId(null); }}>
                    <Text style={sc.formCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[sc.formSubmit, (!teamName.trim() || creating || nameStatus === 'taken' || nameStatus === 'checking') && { opacity: 0.5 }]}
                    onPress={handleCreate}
                    disabled={creating || !teamName.trim() || nameStatus === 'taken' || nameStatus === 'checking'}
                    activeOpacity={0.85}
                  >
                    {creating ? <ActivityIndicator color="#fff" size="small" /> : <Text style={sc.formSubmitText}>Create & Send Invites</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* All other teams */}
            <Text style={sc.sectionTitle}>
              {myTeam ? 'Other Teams' : 'All Teams'} ({otherTeams.length})
            </Text>
            {otherTeams.length === 0 ? (
              <View style={sc.emptyCard}>
                <Text style={{ fontSize: 40 }}>🏗️</Text>
                <Text style={sc.emptyText}>{myTeam ? 'No other teams yet.' : 'No teams formed yet. Be the first!'}</Text>
              </View>
            ) : (
              otherTeams.map(team => (
                <TeamCard
                  key={team.id}
                  team={team}
                  isMyTeam={false}
                  canJoin={!!(isOpen && !myTeam)}
                  requested={mySentJoinRequests.includes(String(team.id))}
                  onJoin={handleRequestToJoin}
                  joining={joining === team.id}
                  maxSize={maxSize}
                  minSize={minSize}
                />
              ))
            )}
          </>
        )}

        {/* ── TAB 2: INTERESTED PARTICIPANTS GRID ─────────────────── */}
        {activeTab === 'participants' && (
          <View style={{ gap: SPACE.md }}>
            <View style={sc.filterBox}>
              <Ionicons name="search-outline" size={18} color={COLORS.textTer} />
              <TextInput
                style={sc.filterInput}
                placeholder="Search interested attendees or teams..."
                placeholderTextColor={COLORS.textTer}
                value={partSearch}
                onChangeText={setPartSearch}
              />
              {partSearch.length > 0 && (
                <TouchableOpacity onPress={() => setPartSearch('')}>
                  <Ionicons name="close-circle" size={18} color={COLORS.textTer} />
                </TouchableOpacity>
              )}
            </View>

            <Text style={sc.sectionTitle}>
              Interested Attendees ({filteredParticipants.length})
            </Text>

            {filteredParticipants.length === 0 ? (
              <View style={sc.emptyCard}>
                <Ionicons name="people-outline" size={44} color={COLORS.textTer} />
                <Text style={sc.emptyText}>
                  {partSearch ? 'No attendees match your search.' : 'No attendees marked as interested yet. Tap "Count Me In" above!'}
                </Text>
              </View>
            ) : (
              <View style={sc.partGrid}>
                {filteredParticipants.map(u => (
                  <ParticipantCard
                    key={u.id}
                    user={u}
                    onInvite={handleSendInvite}
                    isInviting={sendingInvite === u.id}
                    myTeam={myTeam}
                    amLeader={amLeader}
                    isMyTeamFull={myTeamFull}
                  />
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const sc = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingTop: Platform.OS === 'ios' ? 54 : 44, paddingBottom: SPACE.md, overflow: 'hidden' },
  blob1: { position: 'absolute', top: -50, right: -20, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.06)' },
  blob2: { position: 'absolute', bottom: -30, left: -30, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(245,158,11,0.08)' },
  topbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: PAD, marginBottom: SPACE.sm },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FONT.xl, fontWeight: FONT.w9, color: '#fff', letterSpacing: -0.3 },
  headerSub: { fontSize: FONT.xs, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  openPill: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, backgroundColor: COLORS.success, paddingHorizontal: SPACE.md, paddingVertical: 6, borderRadius: RADIUS.full },
  openDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  openText: { fontSize: 10, fontWeight: FONT.w8, color: '#fff', letterSpacing: 1 },
  statsRow: { flexDirection: 'row', gap: SPACE.sm, paddingHorizontal: PAD, marginBottom: SPACE.md },
  statPill: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: SPACE.md, paddingVertical: 5, borderRadius: RADIUS.full },
  statText: { fontSize: FONT.xs, fontWeight: FONT.w6, color: 'rgba(255,255,255,0.85)' },
  tabBar: { flexDirection: 'row', gap: SPACE.sm, paddingHorizontal: PAD, marginTop: SPACE.xs },
  tabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: RADIUS.full, backgroundColor: 'rgba(255,255,255,0.15)' },
  tabItemActive: { backgroundColor: '#fff' },
  tabItemText: { fontSize: FONT.xs, fontWeight: FONT.w7, color: 'rgba(255,255,255,0.9)' },
  tabItemTextActive: { color: COLORS.brand, fontWeight: FONT.w8 },
  sectionLabel: { fontSize: 10, fontWeight: FONT.w8, color: COLORS.textTer, letterSpacing: 1.5 },
  interestCard: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, padding: SPACE.lg, borderRadius: RADIUS.xl, borderWidth: 1.5, ...SHADOW.sm },
  interestCardActive: { backgroundColor: 'rgba(16,185,129,0.06)', borderColor: COLORS.success },
  interestCardInactive: { backgroundColor: '#fff', borderColor: COLORS.brandLight },
  interestTitle: { fontSize: FONT.sm, fontWeight: FONT.w8, color: COLORS.text },
  interestSub: { fontSize: FONT.xs, color: COLORS.textTer, marginTop: 2, lineHeight: 16 },
  interestBtn: { paddingHorizontal: SPACE.md, paddingVertical: 8, borderRadius: RADIUS.full, minWidth: 90, alignItems: 'center' },
  interestBtnJoin: { backgroundColor: COLORS.brand },
  interestBtnWithdraw: { backgroundColor: COLORS.textTer },
  interestBtnText: { fontSize: FONT.xs, fontWeight: FONT.w8, color: '#fff' },
  voteBanner: { borderRadius: RADIUS.xl, overflow: 'hidden', ...SHADOW.md },
  voteGrad: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, padding: SPACE.lg },
  voteIconBox: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  voteTitle: { fontSize: FONT.md, fontWeight: FONT.w8, color: '#fff' },
  voteSub: { fontSize: FONT.xs, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm, backgroundColor: COLORS.brandLight, borderRadius: RADIUS.lg, padding: SPACE.md, borderWidth: 1, borderColor: 'rgba(3,51,182,0.1)' },
  infoText: { flex: 1, fontSize: FONT.xs, color: COLORS.brand, lineHeight: 18 },
  myTeamCard: { borderRadius: 20, overflow: 'hidden', ...SHADOW.brand },
  myTeamGrad: { padding: SPACE.xl },
  myTeamLabel: { fontSize: 9, fontWeight: FONT.w8, color: 'rgba(255,255,255,0.55)', letterSpacing: 1.5 },
  myTeamName: { fontSize: FONT.xxl, fontWeight: FONT.w9, color: '#fff' },
  myTeamSizeNotice: { fontSize: 11, fontWeight: FONT.w7, color: '#fde68a', marginTop: 2 },
  myTeamProject: { fontSize: FONT.sm, color: 'rgba(255,255,255,0.8)', marginTop: SPACE.xs },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, paddingVertical: SPACE.xs },
  memberRowName: { flex: 1, fontSize: FONT.sm, color: '#fff', fontWeight: FONT.w6 },
  leaderTag: { fontSize: 10, fontWeight: FONT.w8, color: '#fde68a', backgroundColor: 'rgba(253,230,138,0.15)', paddingHorizontal: SPACE.sm, paddingVertical: 2, borderRadius: RADIUS.full },
  makeLeaderBtn: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: SPACE.sm, paddingVertical: 3, borderRadius: RADIUS.full },
  makeLeaderText: { fontSize: 10, fontWeight: FONT.w7, color: '#fff' },
  inviteSearchBox: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: RADIUS.md, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  inviteSearchInput: { flex: 1, fontSize: FONT.sm, color: '#fff' },
  inviteResults: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: RADIUS.md, marginTop: SPACE.xs, overflow: 'hidden' },
  inviteResultRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, padding: SPACE.md, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  inviteResultText: { fontSize: FONT.xs, color: 'rgba(255,255,255,0.5)' },
  inviteResultName: { fontSize: FONT.sm, fontWeight: FONT.w6, color: '#fff' },
  inviteResultSub: { fontSize: FONT.xs, color: 'rgba(255,255,255,0.5)', marginTop: 1 },
  sendInviteBtn: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: SPACE.md, paddingVertical: 4, borderRadius: RADIUS.full },
  sendInviteText: { fontSize: FONT.xs, fontWeight: FONT.w7, color: '#fff' },
  myTeamBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, borderRadius: RADIUS.full },
  myTeamBtnText: { fontSize: FONT.xs, fontWeight: FONT.w7, color: '#fff' },
  createBtn: { borderRadius: RADIUS.lg, overflow: 'hidden', ...SHADOW.md },
  createGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.sm, paddingVertical: SPACE.lg },
  createText: { fontSize: FONT.md, fontWeight: FONT.w8, color: '#fff' },
  formCard: { backgroundColor: '#fff', borderRadius: RADIUS.lg, padding: SPACE.xl, gap: SPACE.lg, borderWidth: 1, borderColor: COLORS.border, ...SHADOW.sm },
  formTitle: { fontSize: FONT.lg, fontWeight: FONT.w8, color: COLORS.text },
  inputLabel: { fontSize: FONT.xs, fontWeight: FONT.w7, color: COLORS.textSec, marginBottom: SPACE.xs },
  input: { backgroundColor: COLORS.bg, borderRadius: RADIUS.md, padding: SPACE.md, fontSize: FONT.sm, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border },
  avatarOption: { width: 52, height: 52, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg, borderWidth: 2, borderColor: 'transparent' },
  avatarOptionSelected: { borderColor: COLORS.brand, backgroundColor: COLORS.brandLight },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, backgroundColor: COLORS.bg, borderRadius: RADIUS.md, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, borderWidth: 1, borderColor: COLORS.border },
  searchInput: { flex: 1, fontSize: FONT.sm, color: COLORS.text },
  memberPreview: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.xs, marginTop: SPACE.sm },
  memberPreviewPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.brandLight, paddingHorizontal: SPACE.sm, paddingVertical: 5, borderRadius: RADIUS.full },
  memberPreviewText: { fontSize: FONT.xs, fontWeight: FONT.w6, color: COLORS.brand },
  leaderOption: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, padding: SPACE.md, borderRadius: RADIUS.md, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: 'transparent' },
  leaderOptionSelected: { borderColor: COLORS.brand, backgroundColor: COLORS.brandLight },
  leaderOptionText: { flex: 1, fontSize: FONT.sm, color: COLORS.textSec },
  defaultBadge: { backgroundColor: COLORS.border, paddingHorizontal: SPACE.xs, paddingVertical: 2, borderRadius: RADIUS.full },
  defaultBadgeText: { fontSize: 9, color: COLORS.textTer, fontWeight: FONT.w6 },
  formCancel: { flex: 1, alignItems: 'center', paddingVertical: SPACE.md, borderRadius: RADIUS.md, backgroundColor: COLORS.bg },
  formCancelText: { fontSize: FONT.sm, fontWeight: FONT.w6, color: COLORS.textSec },
  formSubmit: { flex: 2, alignItems: 'center', paddingVertical: SPACE.md, borderRadius: RADIUS.md, backgroundColor: COLORS.brand },
  formSubmitText: { fontSize: FONT.sm, fontWeight: FONT.w7, color: '#fff' },
  sectionTitle: { fontSize: FONT.lg, fontWeight: FONT.w9, color: COLORS.text, letterSpacing: -0.2 },
  emptyCard: { alignItems: 'center', paddingVertical: SPACE.xxl, gap: SPACE.md },
  emptyText: { fontSize: FONT.sm, color: COLORS.textTer, textAlign: 'center' },
  filterBox: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, backgroundColor: '#fff', paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border },
  filterInput: { flex: 1, fontSize: FONT.sm, color: COLORS.text },
  partGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
});
