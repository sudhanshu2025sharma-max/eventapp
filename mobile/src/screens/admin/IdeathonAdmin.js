import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal,
  ActivityIndicator, RefreshControl, TextInput, Alert, Image, Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONT, SPACE, RADIUS, SHADOW, fixMediaUrl } from '../../theme';
import { apiFetch } from '../../api';
import { PulsingDot, GradientAvatar } from '../../components';

const PAD = SPACE.xl;
const AVATAR_OPTIONS = [
  { value: 'rocket', emoji: '🚀' }, { value: 'brain', emoji: '🧠' },
  { value: 'lightbulb', emoji: '💡' }, { value: 'laptop', emoji: '💻' },
  { value: 'globe', emoji: '🌐' }, { value: 'fire', emoji: '🔥' },
  { value: 'star', emoji: '⭐' }, { value: 'crown', emoji: '👑' },
  { value: 'shield', emoji: '🛡️' },
];
const getEmoji = (a) => (AVATAR_OPTIONS.find(o => o.value === a) || AVATAR_OPTIONS[0]).emoji;

export default function IdeathonAdmin({ onBack }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [activeTab, setActiveTab] = useState('teams');
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [expandedMenu, setExpandedMenu] = useState(null);

  // Modal state
  const [modalMode, setModalMode] = useState(null); // 'create'|'edit'|'members'
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Create form
  const [createForm, setCreateForm] = useState({ name: '', avatar: 'rocket', project_title: '', project_desc: '', leader_id: '' });
  // Edit form
  const [editForm, setEditForm] = useState({ name: '', project_title: '', project_desc: '' });
  // Member search
  const [memberSearch, setMemberSearch] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [infoRes, partRes] = await Promise.all([
        apiFetch('/polls/ideathon/'),
        apiFetch('/polls/ideathon/interested/'),
      ]);
      if (infoRes.ok) setStats(await infoRes.json());
      if (partRes.ok) { const pd = await partRes.json(); setParticipants(pd.participants || []); }
    } catch { Alert.alert('Error', 'Failed to sync Ideathon stats'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleToggleReg = async () => {
    setToggling(true);
    try {
      const res = await apiFetch('/polls/admin/ideathon/toggle/', { method: 'POST' });
      const d = await res.json();
      if (d.success) { Alert.alert('Success', d.message); loadData(); }
      else Alert.alert('Error', d.error || 'Toggle failed');
    } catch { Alert.alert('Error', 'Connection timed out'); }
    finally { setToggling(false); }
  };

  // ── Admin CRUD Actions ──
  const openCreate = () => {
    setCreateForm({ name: '', avatar: 'rocket', project_title: '', project_desc: '', leader_id: '' });
    setModalMode('create');
  };

  const openEdit = (team) => {
    setEditForm({ name: team.name, project_title: team.project_title || '', project_desc: team.project_desc || '' });
    setSelectedTeam(team);
    setExpandedMenu(null);
    setModalMode('edit');
  };

  const openMembers = (team) => {
    setSelectedTeam(team);
    setMemberSearch('');
    setExpandedMenu(null);
    setModalMode('members');
  };

  const closeModal = () => { setModalMode(null); setSelectedTeam(null); };

  const doCreateTeam = async () => {
    if (!createForm.name.trim()) return Alert.alert('Error', 'Team name is required.');
    if (!createForm.leader_id) return Alert.alert('Error', 'Select a team leader.');
    setActionLoading(true);
    try {
      const res = await apiFetch('/polls/admin/ideathon/teams/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      const d = await res.json();
      if (d.success) { Alert.alert('Created', d.message); closeModal(); loadData(); }
      else Alert.alert('Error', d.error);
    } catch { Alert.alert('Error', 'Network error'); }
    finally { setActionLoading(false); }
  };

  const doEditTeam = async () => {
    if (!editForm.name.trim()) return Alert.alert('Error', 'Team name is required.');
    setActionLoading(true);
    try {
      const res = await apiFetch(`/polls/admin/ideathon/teams/${selectedTeam.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const d = await res.json();
      if (d.success) { Alert.alert('Updated', d.message); closeModal(); loadData(); }
      else Alert.alert('Error', d.error);
    } catch { Alert.alert('Error', 'Network error'); }
    finally { setActionLoading(false); }
  };

  const doDisband = (team) => {
    setExpandedMenu(null);
    Alert.alert('Disband Team', `Delete "${team.name}" and remove all members?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Disband', style: 'destructive', onPress: async () => {
        setActionLoading(true);
        try {
          const res = await apiFetch(`/polls/admin/ideathon/teams/${team.id}/`, { method: 'DELETE' });
          const d = await res.json();
          if (d.success) { Alert.alert('Done', d.message); loadData(); }
          else Alert.alert('Error', d.error);
        } catch { Alert.alert('Error', 'Network error'); }
        finally { setActionLoading(false); }
      }},
    ]);
  };

  const doAddMember = async (userId) => {
    setActionLoading(true);
    try {
      const res = await apiFetch(`/polls/admin/ideathon/teams/${selectedTeam.id}/add-member/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      const d = await res.json();
      if (d.success) { loadData(); setSelectedTeam(d.team); }
      else Alert.alert('Error', d.error);
    } catch { Alert.alert('Error', 'Network error'); }
    finally { setActionLoading(false); }
  };

  const doRemoveMember = async (userId, userName) => {
    Alert.alert('Remove Member', `Remove ${userName}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        setActionLoading(true);
        try {
          const res = await apiFetch(`/polls/admin/ideathon/teams/${selectedTeam.id}/remove-member/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId }),
          });
          const d = await res.json();
          if (d.success) {
            loadData();
            if (d.team) setSelectedTeam(d.team);
            else closeModal(); // team was disbanded
          }
          else Alert.alert('Error', d.error);
        } catch { Alert.alert('Error', 'Network error'); }
        finally { setActionLoading(false); }
      }},
    ]);
  };

  const doChangeLeader = async (userId, userName) => {
    Alert.alert('Change Leader', `Make ${userName} the team leader?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: async () => {
        setActionLoading(true);
        try {
          const res = await apiFetch(`/polls/admin/ideathon/teams/${selectedTeam.id}/change-leader/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId }),
          });
          const d = await res.json();
          if (d.success) { Alert.alert('Done', d.message); loadData(); setSelectedTeam(d.team); }
          else Alert.alert('Error', d.error);
        } catch { Alert.alert('Error', 'Network error'); }
        finally { setActionLoading(false); }
      }},
    ]);
  };

  if (loading) {
    return <View style={[s.container, s.centered]}><ActivityIndicator size="large" color={COLORS.brand} /></View>;
  }

  const isRegOpen = !!stats?.registration_open;
  const rawTeams = stats?.teams || [];

  const filteredTeams = rawTeams.filter(t => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (t.name || '').toLowerCase().includes(q) ||
      (t.project_title || '').toLowerCase().includes(q) ||
      t.members.some(m => (m.name || '').toLowerCase().includes(q));
  });

  const filteredPool = participants.filter(p => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (p.name || '').toLowerCase().includes(q) || (p.affiliation || '').toLowerCase().includes(q);
  });

  const teamedCount = participants.filter(p => p.has_team).length;
  const lookingCount = participants.filter(p => !p.has_team).length;

  // Users available to add (interested, not in any team)
  const availableUsers = participants.filter(p => {
    if (p.has_team) return false;
    if (!memberSearch.trim()) return true;
    const q = memberSearch.toLowerCase();
    return (p.name || '').toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q);
  });

  return (
    <View style={s.container}>
      {/* Header */}
      <LinearGradient colors={[COLORS.brandDeep, COLORS.brand]} style={s.header}>
        <View style={s.topRow}>
          <TouchableOpacity style={s.backBtn} onPress={onBack}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: SPACE.md }}>
            <Text style={s.headerTitle}>Ideathon Control</Text>
            <Text style={s.headerSub}>Admin Live Dashboard</Text>
          </View>
          <View style={[s.statusBadge, { backgroundColor: isRegOpen ? COLORS.success : COLORS.error }]}>
            <Text style={s.statusText}>{isRegOpen ? 'REG OPEN' : 'CLOSED'}</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={COLORS.brand} />}
      >
        {/* Toggle */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Ionicons name="settings-outline" size={18} color={COLORS.brand} />
            <Text style={s.cardTitle}>Registration Window</Text>
          </View>
          <Text style={s.cardDesc}>
            Allow attendees to form {stats?.min_team_size || 3}–{stats?.max_team_size || 5} member teams.
          </Text>
          <TouchableOpacity
            style={[s.toggleBtn, { backgroundColor: isRegOpen ? COLORS.error : COLORS.brand }]}
            onPress={handleToggleReg} disabled={toggling}
          >
            {toggling ? <ActivityIndicator size="small" color="#fff" /> : (
              <>
                <Ionicons name={isRegOpen ? 'lock-closed-outline' : 'lock-open-outline'} size={16} color="#fff" />
                <Text style={s.toggleBtnText}>{isRegOpen ? 'Close Registration' : 'Open Registration'}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={s.statsGrid}>
          <View style={[s.statCard, { borderLeftColor: COLORS.brand }]}>
            <Text style={s.statValue}>{participants.length}</Text>
            <Text style={s.statLabel}>Interested Pool</Text>
          </View>
          <View style={[s.statCard, { borderLeftColor: COLORS.success }]}>
            <Text style={s.statValue}>{lookingCount}</Text>
            <Text style={s.statLabel}>Looking for Team</Text>
          </View>
          <View style={[s.statCard, { borderLeftColor: COLORS.accent }]}>
            <Text style={s.statValue}>{stats?.total_teams || 0}</Text>
            <Text style={s.statLabel}>Teams Formed</Text>
          </View>
          <View style={[s.statCard, { borderLeftColor: COLORS.text }]}>
            <Text style={s.statValue}>{teamedCount}</Text>
            <Text style={s.statLabel}>Teamed Up</Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={s.tabBar}>
          <TouchableOpacity style={[s.tabBtn, activeTab === 'teams' && s.tabActive]} onPress={() => { setActiveTab('teams'); setSearch(''); }}>
            <Ionicons name="people" size={16} color={activeTab === 'teams' ? COLORS.brand : COLORS.textTer} />
            <Text style={[s.tabText, activeTab === 'teams' && s.tabTextActive]}>Teams ({rawTeams.length})</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.tabBtn, activeTab === 'pool' && s.tabActive]} onPress={() => { setActiveTab('pool'); setSearch(''); }}>
            <Ionicons name="list" size={16} color={activeTab === 'pool' ? COLORS.brand : COLORS.textTer} />
            <Text style={[s.tabText, activeTab === 'pool' && s.tabTextActive]}>Pool ({participants.length})</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={s.searchWrap}>
          <Ionicons name="search-outline" size={18} color={COLORS.textTer} />
          <TextInput style={s.searchInput} placeholder={activeTab === 'teams' ? 'Search teams, projects, members...' : 'Search pool...'} value={search} onChangeText={setSearch} placeholderTextColor={COLORS.textTer} />
          {search.length > 0 && <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={18} color={COLORS.textTer} /></TouchableOpacity>}
        </View>

        {/* Content */}
        {activeTab === 'teams' ? (
          <View style={{ gap: SPACE.md }}>
            <Text style={s.sectionTitle}>Formed Teams ({filteredTeams.length})</Text>
            {filteredTeams.length === 0 ? (
              <View style={s.emptyState}><Ionicons name="gift-outline" size={36} color={COLORS.textTer} /><Text style={s.emptyText}>No teams yet</Text></View>
            ) : filteredTeams.map(t => {
              const valid = t.member_count >= (stats?.min_team_size || 3) && t.member_count <= (stats?.max_team_size || 5);
              const menuOpen = expandedMenu === t.id;
              return (
                <View key={t.id} style={s.teamCard}>
                  <View style={s.teamHeader}>
                    <View style={s.avatarBox}><Text style={s.emojiText}>{getEmoji(t.avatar)}</Text></View>
                    <View style={{ flex: 1, marginLeft: SPACE.md }}>
                      <Text style={s.teamName}>{t.name}</Text>
                      <Text style={s.memberLabel}>{t.member_count}/{stats?.max_team_size || 5} members</Text>
                    </View>
                    <View style={[s.badge, { backgroundColor: valid ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)' }]}>
                      <Text style={[s.badgeText, { color: valid ? COLORS.success : COLORS.warning }]}>{valid ? 'VALID' : 'INCOMPLETE'}</Text>
                    </View>
                    <TouchableOpacity style={s.menuBtn} onPress={() => setExpandedMenu(menuOpen ? null : t.id)}>
                      <Ionicons name="ellipsis-vertical" size={20} color={COLORS.textTer} />
                    </TouchableOpacity>
                  </View>

                  {/* Action Menu */}
                  {menuOpen && (
                    <View style={s.actionMenu}>
                      <TouchableOpacity style={s.actionItem} onPress={() => openEdit(t)}>
                        <Ionicons name="create-outline" size={16} color={COLORS.brand} />
                        <Text style={s.actionText}>Edit Details</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.actionItem} onPress={() => openMembers(t)}>
                        <Ionicons name="people-outline" size={16} color={COLORS.accent} />
                        <Text style={s.actionText}>Manage Members</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.actionItem} onPress={() => doDisband(t)}>
                        <Ionicons name="trash-outline" size={16} color={COLORS.error} />
                        <Text style={[s.actionText, { color: COLORS.error }]}>Disband Team</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {(t.project_title || t.project_desc) ? (
                    <View style={s.projBox}>
                      {t.project_title ? <Text style={s.projTitle} numberOfLines={1}>🎯 {t.project_title}</Text> : null}
                      {t.project_desc ? <Text style={s.projDesc} numberOfLines={2}>{t.project_desc}</Text> : null}
                    </View>
                  ) : (
                    <View style={[s.projBox, { borderStyle: 'dashed' }]}><Text style={s.noProj}>💡 No project info yet</Text></View>
                  )}

                  <Text style={s.membersLabel}>MEMBERS</Text>
                  <View style={s.chipsRow}>
                    {t.members.map(m => (
                      <View key={m.user_id} style={[s.chip, m.is_leader && s.chipLeader]}>
                        {m.is_leader && <Ionicons name="ribbon" size={11} color={COLORS.warning} />}
                        <Text style={[s.chipText, m.is_leader && s.chipTextLeader]} numberOfLines={1}>{m.name}{m.is_leader ? ' ★' : ''}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={{ gap: SPACE.xs }}>
            <Text style={s.sectionTitle}>Participants Pool ({filteredPool.length})</Text>
            {filteredPool.length === 0 ? (
              <View style={s.emptyState}><Ionicons name="people-outline" size={36} color={COLORS.textTer} /><Text style={s.emptyText}>No matches</Text></View>
            ) : filteredPool.map(p => (
              <View key={p.id} style={s.poolItem}>
                {p.profile_photo_url ? <Image source={{ uri: fixMediaUrl(p.profile_photo_url) }} style={s.avatar} /> : <GradientAvatar name={p.name} size={40} radius={20} />}
                <View style={{ flex: 1, marginLeft: SPACE.md }}>
                  <Text style={s.pName}>{p.name}</Text>
                  <Text style={s.pAff} numberOfLines={1}>{p.affiliation || 'Attendee'}</Text>
                  {p.has_team ? (
                    <View style={s.teamBadge}><Ionicons name="checkmark-circle" size={12} color={COLORS.success} /><Text style={s.teamBadgeText} numberOfLines={1}>In: {p.team?.team_name}</Text></View>
                  ) : (
                    <View style={s.lookingBadge}><PulsingDot color={COLORS.warning} size={6} /><Text style={s.lookingText}>Looking for team</Text></View>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Dynamic spacer so scroll content always clears the absolute FAB */}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* FAB — Create Team (Z-Indexed above lists) */}
      {/* <TouchableOpacity style={s.fab} onPress={openCreate} activeOpacity={0.8}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity> */}

      {/* ═══════ CREATE TEAM MODAL ═══════ */}
      <Modal visible={modalMode === 'create'} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Create Team</Text>
              <TouchableOpacity onPress={closeModal}><Ionicons name="close" size={24} color={COLORS.textTer} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: SPACE.md }}>
              <Text style={s.fieldLabel}>Team Name *</Text>
              <TextInput style={s.input} value={createForm.name} onChangeText={v => setCreateForm(f => ({ ...f, name: v }))} placeholder="e.g. Code Ninjas" />

              <Text style={s.fieldLabel}>Avatar</Text>
              <View style={s.avatarGrid}>
                {AVATAR_OPTIONS.map(a => (
                  <TouchableOpacity key={a.value} style={[s.avatarOption, createForm.avatar === a.value && s.avatarOptionActive]} onPress={() => setCreateForm(f => ({ ...f, avatar: a.value }))}>
                    <Text style={s.avatarEmoji}>{a.emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.fieldLabel}>Project Title</Text>
              <TextInput style={s.input} value={createForm.project_title} onChangeText={v => setCreateForm(f => ({ ...f, project_title: v }))} placeholder="Optional" />

              <Text style={s.fieldLabel}>Project Description</Text>
              <TextInput style={[s.input, { height: 70 }]} value={createForm.project_desc} onChangeText={v => setCreateForm(f => ({ ...f, project_desc: v }))} placeholder="Optional" multiline />

              <Text style={s.fieldLabel}>Team Leader * (from interested pool)</Text>
              <View style={{ gap: 6, maxHeight: 160 }}>
                {participants.filter(p => !p.has_team).slice(0, 20).map(p => (
                  <TouchableOpacity key={p.id} style={[s.userRow, createForm.leader_id === p.id && s.userRowActive]} onPress={() => setCreateForm(f => ({ ...f, leader_id: p.id }))}>
                    <GradientAvatar name={p.name} size={28} radius={14} />
                    <Text style={[s.userRowName, createForm.leader_id === p.id && { color: COLORS.brand }]}>{p.name}</Text>
                    {createForm.leader_id === p.id && <Ionicons name="checkmark-circle" size={18} color={COLORS.brand} />}
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <TouchableOpacity style={[s.primaryBtn, actionLoading && { opacity: 0.6 }]} onPress={doCreateTeam} disabled={actionLoading}>
              {actionLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Create Team</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ═══════ EDIT TEAM MODAL ═══════ */}
      <Modal visible={modalMode === 'edit'} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Edit Team</Text>
              <TouchableOpacity onPress={closeModal}><Ionicons name="close" size={24} color={COLORS.textTer} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: SPACE.md }}>
              <Text style={s.fieldLabel}>Team Name</Text>
              <TextInput style={s.input} value={editForm.name} onChangeText={v => setEditForm(f => ({ ...f, name: v }))} />
              <Text style={s.fieldLabel}>Project Title</Text>
              <TextInput style={s.input} value={editForm.project_title} onChangeText={v => setEditForm(f => ({ ...f, project_title: v }))} />
              <Text style={s.fieldLabel}>Project Description</Text>
              <TextInput style={[s.input, { height: 70 }]} value={editForm.project_desc} onChangeText={v => setEditForm(f => ({ ...f, project_desc: v }))} multiline />
            </ScrollView>
            <TouchableOpacity style={[s.primaryBtn, { marginTop: SPACE.lg }, actionLoading && { opacity: 0.6 }]} onPress={doEditTeam} disabled={actionLoading}>
              {actionLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Save Changes</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ═══════ MANAGE MEMBERS MODAL ═══════ */}
      <Modal visible={modalMode === 'members'} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.modalOverlay}>
          <View style={[s.modalCard, { maxHeight: '90%' }]}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{selectedTeam?.name} — Members</Text>
              <TouchableOpacity onPress={closeModal}><Ionicons name="close" size={24} color={COLORS.textTer} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: SPACE.md }}>
              {/* Current Members */}
              <Text style={s.fieldLabel}>Current Members ({selectedTeam?.members?.length || 0})</Text>
              {(selectedTeam?.members || []).map(m => (
                <View key={m.user_id} style={s.memberRow}>
                  <GradientAvatar name={m.name} size={32} radius={16} />
                  <View style={{ flex: 1, marginLeft: SPACE.sm }}>
                    <Text style={s.memberName}>{m.name} {m.is_leader && '👑'}</Text>
                  </View>
                  {!m.is_leader && (
                    <TouchableOpacity style={s.memberActionBtn} onPress={() => doChangeLeader(m.user_id, m.name)}>
                      <Ionicons name="ribbon-outline" size={16} color={COLORS.warning} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={s.memberActionBtn} onPress={() => doRemoveMember(m.user_id, m.name)}>
                    <Ionicons name="remove-circle-outline" size={18} color={COLORS.error} />
                  </TouchableOpacity>
                </View>
              ))}

              {/* Add Member */}
              <View style={s.divider} />
              <Text style={s.fieldLabel}>Add Member</Text>
              <TextInput style={s.input} placeholder="Search available users..." value={memberSearch} onChangeText={setMemberSearch} placeholderTextColor={COLORS.textTer} />
              {actionLoading && <ActivityIndicator size="small" color={COLORS.brand} />}
              <View style={{ gap: 4, maxHeight: 200 }}>
                {availableUsers.slice(0, 15).map(p => (
                  <TouchableOpacity key={p.id} style={s.userRow} onPress={() => doAddMember(p.id)} disabled={actionLoading}>
                    <GradientAvatar name={p.name} size={28} radius={14} />
                    <Text style={s.userRowName}>{p.name}</Text>
                    <Ionicons name="add-circle-outline" size={18} color={COLORS.success} />
                  </TouchableOpacity>
                ))}
                {availableUsers.length === 0 && <Text style={s.emptyText}>No available users</Text>}
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  centered: { justifyContent: 'center', alignItems: 'center' },
  header: { paddingTop: Platform.OS === 'ios' ? 54 : 44, paddingBottom: SPACE.lg },
  topRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: PAD },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FONT.lg, fontWeight: FONT.w9, color: '#fff' },
  headerSub: { fontSize: FONT.xs, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  statusBadge: { paddingHorizontal: SPACE.md, paddingVertical: 6, borderRadius: RADIUS.full },
  statusText: { fontSize: 10, fontWeight: FONT.w8, color: '#fff', letterSpacing: 0.5 },
  scrollContent: { padding: PAD, paddingBottom: 180, gap: SPACE.lg }, // Raised bottom padding to completely bypass FAB area
  card: { backgroundColor: '#fff', borderRadius: 16, padding: SPACE.xl, borderWidth: 1, borderColor: COLORS.border, ...SHADOW.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.sm },
  cardTitle: { fontSize: FONT.md, fontWeight: FONT.w8, color: COLORS.text },
  cardDesc: { fontSize: FONT.xs, color: COLORS.textSec, lineHeight: 18, marginBottom: SPACE.lg },
  toggleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.sm, paddingVertical: 12, borderRadius: RADIUS.md },
  toggleBtnText: { fontSize: FONT.sm, fontWeight: FONT.w7, color: '#fff' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  statCard: { flex: 1, minWidth: '46%', backgroundColor: '#fff', padding: SPACE.md, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, borderLeftWidth: 4, gap: 4, ...SHADOW.sm },
  statValue: { fontSize: 20, fontWeight: FONT.w9, color: COLORS.text },
  statLabel: { fontSize: 10, fontWeight: FONT.w7, color: COLORS.textTer },
  tabBar: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.03)', padding: 4, borderRadius: 12, gap: 4 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 8 },
  tabActive: { backgroundColor: '#fff', ...SHADOW.sm },
  tabText: { fontSize: FONT.xs, fontWeight: FONT.w7, color: COLORS.textTer },
  tabTextActive: { color: COLORS.brand },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, backgroundColor: '#fff', paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, ...SHADOW.sm },
  searchInput: { flex: 1, fontSize: FONT.sm, color: COLORS.text },
  sectionTitle: { fontSize: FONT.md, fontWeight: FONT.w9, color: COLORS.text, marginTop: SPACE.xs },
  emptyState: { alignItems: 'center', paddingVertical: SPACE.xxl, gap: SPACE.md },
  emptyText: { fontSize: FONT.sm, color: COLORS.textTer },
  // Team cards
  teamCard: { backgroundColor: '#fff', borderRadius: 16, padding: SPACE.md, borderWidth: 1, borderColor: COLORS.border, ...SHADOW.sm },
  teamHeader: { flexDirection: 'row', alignItems: 'center' },
  avatarBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.04)', alignItems: 'center', justifyContent: 'center' },
  emojiText: { fontSize: 22 },
  teamName: { fontSize: FONT.sm, fontWeight: FONT.w9, color: COLORS.text },
  memberLabel: { fontSize: 11, color: COLORS.textTer, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginRight: SPACE.xs },
  badgeText: { fontSize: 9, fontWeight: FONT.w8 },
  menuBtn: { padding: 6, marginRight: -4 },
  actionMenu: { marginTop: SPACE.sm, backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: 10, padding: SPACE.xs, gap: 2 },
  actionItem: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, paddingVertical: 10, paddingHorizontal: SPACE.sm, borderRadius: 8 },
  actionText: { fontSize: FONT.sm, fontWeight: FONT.w7, color: COLORS.text },
  projBox: { marginTop: SPACE.sm, backgroundColor: 'rgba(0,0,0,0.02)', padding: SPACE.md, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border },
  projTitle: { fontSize: FONT.xs, fontWeight: FONT.w8, color: COLORS.text },
  projDesc: { fontSize: 11, color: COLORS.textSec, marginTop: 4, lineHeight: 16 },
  noProj: { fontSize: 11, color: COLORS.textTer, fontStyle: 'italic', textAlign: 'center' },
  membersLabel: { fontSize: 9.5, fontWeight: FONT.w8, color: COLORS.textTer, letterSpacing: 0.5, marginTop: SPACE.md, marginBottom: SPACE.xs },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.04)', paddingHorizontal: SPACE.sm, paddingVertical: 5, borderRadius: 8 },
  chipLeader: { backgroundColor: 'rgba(245,158,11,0.08)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)' },
  chipText: { fontSize: 10.5, fontWeight: FONT.w7, color: COLORS.textSec },
  chipTextLeader: { color: COLORS.warning },
  // Pool
  poolItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: SPACE.md, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACE.xs },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.bg },
  pName: { fontSize: FONT.sm, fontWeight: FONT.w8, color: COLORS.text },
  pAff: { fontSize: 11, color: COLORS.textTer, marginTop: 1 },
  teamBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(16,185,129,0.1)', paddingHorizontal: SPACE.sm, paddingVertical: 3, borderRadius: RADIUS.full, alignSelf: 'flex-start', marginTop: 4, maxWidth: '90%' },
  teamBadgeText: { fontSize: 9.5, fontWeight: FONT.w7, color: COLORS.success, flexShrink: 1 },
  lookingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(245,158,11,0.1)', paddingHorizontal: SPACE.sm, paddingVertical: 3, borderRadius: RADIUS.full, alignSelf: 'flex-start', marginTop: 4 },
  lookingText: { fontSize: 9.5, fontWeight: FONT.w7, color: COLORS.warning },
  // FAB (Styled with higher z-index to stay clean)
  fab: { position: 'absolute', right: PAD, bottom: 30, width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.brand, alignItems: 'center', justifyContent: 'center', ...SHADOW.sm, elevation: 8, zIndex: 99 },
  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: PAD, paddingBottom: 40, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACE.lg },
  modalTitle: { fontSize: FONT.lg, fontWeight: FONT.w9, color: COLORS.text },
  fieldLabel: { fontSize: FONT.xs, fontWeight: FONT.w8, color: COLORS.textSec, marginTop: SPACE.xs },
  input: { backgroundColor: 'rgba(0,0,0,0.04)', borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: SPACE.md, paddingVertical: 10, fontSize: FONT.sm, color: COLORS.text },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  avatarOption: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.04)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  avatarOptionActive: { borderColor: COLORS.brand, backgroundColor: 'rgba(59,130,246,0.08)' },
  avatarEmoji: { fontSize: 20 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, paddingVertical: 8, paddingHorizontal: SPACE.sm, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.02)' },
  userRowActive: { backgroundColor: 'rgba(59,130,246,0.08)', borderWidth: 1, borderColor: COLORS.brand },
  userRowName: { flex: 1, fontSize: FONT.sm, fontWeight: FONT.w7, color: COLORS.text },
  primaryBtn: { backgroundColor: COLORS.brand, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: SPACE.md },
  primaryBtnText: { color: '#fff', fontSize: FONT.sm, fontWeight: FONT.w8 },
  // Member management
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: SPACE.sm, backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: 10 },
  memberName: { fontSize: FONT.sm, fontWeight: FONT.w7, color: COLORS.text },
  memberActionBtn: { padding: 6 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: SPACE.sm },
});
