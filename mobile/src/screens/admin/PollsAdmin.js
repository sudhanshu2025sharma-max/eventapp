import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Platform, Alert, ActivityIndicator, TextInput, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONT, SPACE, RADIUS, SHADOW } from '../../theme';
import { apiFetch } from '../../api';

const PAD = SPACE.xl;

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    live:      { label: '● LIVE',     bg: COLORS.success,    color: '#fff' },
    draft:     { label: 'Draft',      bg: '#e2e8f0',         color: COLORS.textSec },
    closed:    { label: 'Closed',     bg: '#f1f5f9',         color: COLORS.textTer },
    scheduled: { label: 'Scheduled',  bg: COLORS.accentLight, color: COLORS.accent },
  };
  const s = map[status] || map.draft;
  return (
    <View style={[sb.pill, { backgroundColor: s.bg }]}>
      <Text style={[sb.text, { color: s.color }]}>{s.label}</Text>
    </View>
  );
}
const sb = StyleSheet.create({
  pill: { paddingHorizontal: SPACE.sm, paddingVertical: 3, borderRadius: RADIUS.full },
  text: { fontSize: 10, fontWeight: FONT.w8, letterSpacing: 0.4 },
});

// ── Result bar ────────────────────────────────────────────────────────────────
function ResultBar({ text, votes, pct, isTop }) {
  return (
    <View style={{ marginBottom: SPACE.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 }}>
          {isTop && <Text style={{ fontSize: 14 }}>🏆</Text>}
          <Text style={rb.label} numberOfLines={1}>{text}</Text>
        </View>
        <Text style={rb.pct}>{pct}% <Text style={rb.votes}>({votes})</Text></Text>
      </View>
      <View style={rb.track}>
        <View style={[rb.fill, { width: `${pct}%`, backgroundColor: isTop ? COLORS.accent : COLORS.brand }]} />
      </View>
    </View>
  );
}
const rb = StyleSheet.create({
  label: { fontSize: FONT.sm, fontWeight: FONT.w7, color: COLORS.text, flex: 1 },
  pct:   { fontSize: FONT.sm, fontWeight: FONT.w8, color: COLORS.brand },
  votes: { fontSize: FONT.xs, color: COLORS.textTer, fontWeight: FONT.w5 },
  track: { height: 10, backgroundColor: COLORS.bg, borderRadius: 5, overflow: 'hidden' },
  fill:  { height: '100%', borderRadius: 5 },
});

// ── Poll Card ─────────────────────────────────────────────────────────────────
function PollCard({ poll, onAction, onViewResults }) {
  const [loading, setLoading] = useState(null); // 'start'|'close'|'reopen'

  const doAction = async (action) => {
    setLoading(action);
    try {
      const res = await apiFetch(`/polls/admin/${poll.id}/action/`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      const d = await res.json();
      if (d.success) onAction();
      else Alert.alert('Error', d.error || 'Action failed');
    } catch {
      Alert.alert('Error', 'Network error');
    }
    setLoading(null);
  };

  const confirm = (action, msg) =>
    Alert.alert('Confirm', msg, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes', onPress: () => doAction(action) },
    ]);

  return (
    <View style={pc.card}>
      <View style={pc.header}>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, flexWrap: 'wrap' }}>
            <StatusBadge status={poll.status} />
            <Text style={pc.type}>{poll.poll_type}</Text>
            {poll.is_ideathon && <Text style={pc.ideathonTag}>🏆 Ideathon</Text>}
          </View>
          <Text style={pc.title}>{poll.title}</Text>
          <Text style={pc.question} numberOfLines={2}>{poll.question}</Text>
        </View>
      </View>

      {/* Vote count */}
      <View style={pc.statsRow}>
        <View style={pc.stat}>
          <Text style={pc.statVal}>{poll.total_votes}</Text>
          <Text style={pc.statKey}>Votes</Text>
        </View>
        <View style={pc.stat}>
          <Text style={pc.statVal}>{poll.options?.length || 0}</Text>
          <Text style={pc.statKey}>Options</Text>
        </View>
        {poll.ends_at && (
          <View style={pc.stat}>
            <Text style={pc.statVal} numberOfLines={1}>
              {new Date(poll.ends_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
            </Text>
            <Text style={pc.statKey}>Ends</Text>
          </View>
        )}
      </View>

      {/* Action buttons */}
      <View style={pc.actions}>
        {poll.status === 'draft' || poll.status === 'scheduled' ? (
          <TouchableOpacity
            style={pc.btnStart}
            onPress={() => confirm('start', `Start "${poll.title}" now? A push notification will be sent to all participants.`)}
            disabled={!!loading}
            activeOpacity={0.8}
          >
            {loading === 'start'
              ? <ActivityIndicator size="small" color="#fff" />
              : <><Ionicons name="play" size={14} color="#fff" /><Text style={pc.btnStartText}>Start Poll</Text></>
            }
          </TouchableOpacity>
        ) : poll.status === 'live' ? (
          <TouchableOpacity
            style={pc.btnClose}
            onPress={() => confirm('close', `Close "${poll.title}"?`)}
            disabled={!!loading}
            activeOpacity={0.8}
          >
            {loading === 'close'
              ? <ActivityIndicator size="small" color="#fff" />
              : <><Ionicons name="stop" size={14} color="#fff" /><Text style={pc.btnCloseText}>Close Poll</Text></>
            }
          </TouchableOpacity>
        ) : poll.status === 'closed' ? (
          <TouchableOpacity
            style={pc.btnReopen}
            onPress={() => confirm('reopen', `Reopen "${poll.title}"?`)}
            disabled={!!loading}
            activeOpacity={0.8}
          >
            {loading === 'reopen'
              ? <ActivityIndicator size="small" color={COLORS.brand} />
              : <><Ionicons name="refresh" size={14} color={COLORS.brand} /><Text style={pc.btnReopenText}>Reopen</Text></>
            }
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity style={pc.btnResults} onPress={() => onViewResults(poll)} activeOpacity={0.8}>
          <Ionicons name="bar-chart-outline" size={14} color={COLORS.brand} />
          <Text style={pc.btnResultsText}>Results</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const pc = StyleSheet.create({
  card: {
    backgroundColor: '#fff', borderRadius: 20, padding: SPACE.lg,
    marginBottom: SPACE.md, borderWidth: 1, borderColor: COLORS.border,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 }, android: { elevation: 2 } }),
  },
  header: { flexDirection: 'row', gap: SPACE.md, marginBottom: SPACE.md },
  type: { fontSize: 10, fontWeight: FONT.w7, color: COLORS.textTer, backgroundColor: COLORS.bg, paddingHorizontal: SPACE.sm, paddingVertical: 2, borderRadius: RADIUS.full },
  ideathonTag: { fontSize: 10, fontWeight: FONT.w7, color: COLORS.accent, backgroundColor: COLORS.accentLight, paddingHorizontal: SPACE.sm, paddingVertical: 2, borderRadius: RADIUS.full },
  title: { fontSize: FONT.md, fontWeight: FONT.w8, color: COLORS.text },
  question: { fontSize: FONT.xs, color: COLORS.textSec, lineHeight: 16 },
  statsRow: { flexDirection: 'row', gap: SPACE.xl, marginBottom: SPACE.md, paddingTop: SPACE.md, borderTopWidth: 1, borderTopColor: COLORS.borderLight },
  stat: { alignItems: 'center' },
  statVal: { fontSize: FONT.lg, fontWeight: FONT.w9, color: COLORS.brand },
  statKey: { fontSize: 9, fontWeight: FONT.w7, color: COLORS.textTer, letterSpacing: 0.5 },
  actions: { flexDirection: 'row', gap: SPACE.sm },
  btnStart:   { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.xs, backgroundColor: COLORS.success, paddingVertical: SPACE.md, borderRadius: RADIUS.lg },
  btnStartText: { fontSize: FONT.sm, fontWeight: FONT.w7, color: '#fff' },
  btnClose:   { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.xs, backgroundColor: COLORS.error, paddingVertical: SPACE.md, borderRadius: RADIUS.lg },
  btnCloseText: { fontSize: FONT.sm, fontWeight: FONT.w7, color: '#fff' },
  btnReopen:  { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.xs, backgroundColor: COLORS.brandLight, paddingVertical: SPACE.md, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.brand },
  btnReopenText: { fontSize: FONT.sm, fontWeight: FONT.w7, color: COLORS.brand },
  btnResults: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.xs, backgroundColor: COLORS.bg, paddingVertical: SPACE.md, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border },
  btnResultsText: { fontSize: FONT.sm, fontWeight: FONT.w6, color: COLORS.brand },
});

// ── Results View ──────────────────────────────────────────────────────────────
function PollResults({ poll, onBack }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState('results'); // results | voters
  const timerRef              = useRef(null);

  const fetch_ = useCallback(async () => {
    try {
      const res = await apiFetch(`/polls/admin/${poll.id}/results/`);
      if (res.ok) setData(await res.json());
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [poll.id]);

  useEffect(() => {
    fetch_();
    if (poll.status === 'live') {
      timerRef.current = setInterval(fetch_, 10000);
    }
    return () => clearInterval(timerRef.current);
  }, [fetch_, poll.status]);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <LinearGradient colors={[COLORS.brandDeep, COLORS.brand]} style={rv.header}>
        <TouchableOpacity onPress={onBack} style={rv.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: SPACE.md }}>
          <Text style={rv.title} numberOfLines={1}>{poll.title}</Text>
          <StatusBadge status={poll.status} />
        </View>
        {poll.status === 'live' && (
          <View style={rv.liveDot}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} /></View>
        )}
      </LinearGradient>

      {/* Tab bar */}
      <View style={rv.tabs}>
        {[['results','Results'],['voters','Voted'],['missing','Not Voted']].map(([key, label]) => (
          <TouchableOpacity key={key} style={[rv.tab, tab === key && rv.tabOn]} onPress={() => setTab(key)}>
            <Text style={[rv.tabText, tab === key && rv.tabTextOn]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={COLORS.brand} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: PAD, paddingBottom: 80 }}>

          {tab === 'results' && (
            <View>
              {/* Summary */}
              <View style={rv.summaryRow}>
                <View style={rv.summaryItem}>
                  <Text style={rv.summaryVal}>{data?.total_votes || 0}</Text>
                  <Text style={rv.summaryKey}>Total Votes</Text>
                </View>
                <View style={rv.summaryItem}>
                  <Text style={rv.summaryVal}>{data?.participation_pct || 0}%</Text>
                  <Text style={rv.summaryKey}>Participation</Text>
                </View>
                <View style={rv.summaryItem}>
                  <Text style={rv.summaryVal}>{data?.eligible_count || 0}</Text>
                  <Text style={rv.summaryKey}>Eligible</Text>
                </View>
              </View>

              {/* Result bars */}
              <View style={rv.card}>
                {(data?.results || []).map((r, i) => (
                  <ResultBar key={r.id} text={r.text} votes={r.votes} pct={r.pct} isTop={i === 0 && r.votes > 0} />
                ))}
                {(!data?.results || data.results.length === 0) && (
                  <Text style={{ color: COLORS.textTer, textAlign: 'center', padding: SPACE.xl }}>No votes yet</Text>
                )}
              </View>

              {poll.status === 'live' && (
                <Text style={rv.refreshHint}>● Auto-refreshing every 10s</Text>
              )}
            </View>
          )}

          {tab === 'voters' && (
            <View style={rv.card}>
              {(data?.voters || []).length === 0 ? (
                <Text style={{ color: COLORS.textTer, textAlign: 'center', padding: SPACE.xl }}>No votes yet</Text>
              ) : (
                (data.voters || []).map((v, i) => (
                  <View key={i} style={rv.voterRow}>
                    <View style={rv.voterAvatar}>
                      <Text style={rv.voterAvatarText}>{(v.name[0] || '?').toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={rv.voterName}>{v.name}</Text>
                      <Text style={rv.voterEmail}>{v.email}</Text>
                    </View>
                    <View style={rv.voterChoice}>
                      <Text style={rv.voterChoiceText} numberOfLines={1}>{v.option}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          {tab === 'missing' && (
            <View style={rv.card}>
              {(data?.non_voters || []).length === 0 ? (
                <Text style={{ color: COLORS.textTer, textAlign: 'center', padding: SPACE.xl }}>
                  Everyone has voted! 🎉
                </Text>
              ) : (
                <>
                  <Text style={{ fontSize: FONT.xs, color: COLORS.textSec, marginBottom: SPACE.md }}>
                    {data.non_voter_count} participant{data.non_voter_count !== 1 ? 's' : ''} haven't voted yet
                  </Text>
                  {(data.non_voters || []).map((u, i) => (
                    <View key={i} style={rv.voterRow}>
                      <View style={[rv.voterAvatar, { backgroundColor: COLORS.errorLight }]}>
                        <Text style={[rv.voterAvatarText, { color: COLORS.error }]}>{(u.name[0] || '?').toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={rv.voterName}>{u.name}</Text>
                        <Text style={rv.voterEmail}>{u.email}</Text>
                      </View>
                    </View>
                  ))}
                </>
              )}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const rv = StyleSheet.create({
  header: { paddingTop: Platform.OS === 'ios' ? 54 : 44, paddingBottom: SPACE.xl, paddingHorizontal: PAD, flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: FONT.md, fontWeight: FONT.w8, color: '#fff' },
  liveDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.error, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  tab: { flex: 1, alignItems: 'center', paddingVertical: SPACE.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabOn: { borderBottomColor: COLORS.brand },
  tabText: { fontSize: FONT.sm, fontWeight: FONT.w6, color: COLORS.textTer },
  tabTextOn: { color: COLORS.brand, fontWeight: FONT.w8 },
  summaryRow: { flexDirection: 'row', gap: SPACE.sm, marginBottom: SPACE.md },
  summaryItem: { flex: 1, backgroundColor: '#fff', borderRadius: RADIUS.lg, padding: SPACE.md, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  summaryVal: { fontSize: FONT.xl, fontWeight: FONT.w9, color: COLORS.brand },
  summaryKey: { fontSize: 9, fontWeight: FONT.w7, color: COLORS.textTer, letterSpacing: 0.5, marginTop: 2 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: SPACE.lg, borderWidth: 1, borderColor: COLORS.border },
  refreshHint: { textAlign: 'center', fontSize: FONT.xs, color: COLORS.success, fontWeight: FONT.w6, marginTop: SPACE.md },
  voterRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingVertical: SPACE.sm, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  voterAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.brandLight, alignItems: 'center', justifyContent: 'center' },
  voterAvatarText: { fontSize: FONT.sm, fontWeight: FONT.w8, color: COLORS.brand },
  voterName: { fontSize: FONT.sm, fontWeight: FONT.w7, color: COLORS.text },
  voterEmail: { fontSize: FONT.xs, color: COLORS.textTer, marginTop: 1 },
  voterChoice: { backgroundColor: COLORS.brandLight, paddingHorizontal: SPACE.sm, paddingVertical: 3, borderRadius: RADIUS.full, maxWidth: 100 },
  voterChoiceText: { fontSize: 10, fontWeight: FONT.w7, color: COLORS.brand },
});

// ── Create Poll Form ──────────────────────────────────────────────────────────
function CreatePollForm({ onCreated, onCancel }) {
  const [title, setTitle]     = useState('');
  const [question, setQuestion] = useState('');
  const [type, setType]       = useState('single');
  const [options, setOptions] = useState(['', '']);
  const [startNow, setStartNow] = useState(false);
  const [isIdeathon, setIsIdeathon] = useState(false);
  const [loading, setLoading] = useState(false);
  const submitRef = useRef(false);

  const addOption = () => {
    if (options.length < 6) setOptions(prev => [...prev, '']);
  };

  const updateOption = (i, val) => {
    setOptions(prev => prev.map((o, idx) => idx === i ? val : o));
  };

  const removeOption = (i) => {
    if (options.length <= 2) return;
    setOptions(prev => prev.filter((_, idx) => idx !== i));
  };

  const submit = async () => {
    if (submitRef.current) return;
    if (!title.trim() || !question.trim()) {
      Alert.alert('Required', 'Title and question are required.');
      return;
    }
    const validOpts = options.map(o => ({ text: o.trim() })).filter(o => o.text);
    if (validOpts.length < 2) {
      Alert.alert('Required', 'Add at least 2 options.');
      return;
    }
    submitRef.current = true;
    setLoading(true);
    try {
      const res = await apiFetch('/polls/admin/create/', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          question: question.trim(),
          poll_type: type,
          options: validOpts,
          start_now: startNow,
          award_points: true,
        }),
      });
      const d = await res.json();
      if (d.success) {
        Alert.alert(startNow ? '✅ Poll Started!' : '✅ Poll Created',
          startNow ? 'Poll is now live. Participants have been notified.' : 'Poll saved as draft. Start it from the poll list.');
        onCreated();
      } else {
        Alert.alert('Error', d.error || 'Failed to create poll');
      }
    } catch {
      Alert.alert('Error', 'Network error');
    }
    setLoading(false);
    submitRef.current = false;
  };

  const TYPE_OPTIONS = [
    { key: 'single',   label: 'Single Choice' },
    { key: 'multiple', label: 'Multiple Choice' },
    { key: 'yesno',    label: 'Yes / No' },
    { key: 'rating',   label: 'Rating (1-5)' },
  ];

  const hideOptions = type === 'yesno' || type === 'rating';

  return (
    <ScrollView contentContainerStyle={{ padding: PAD, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
      <Text style={cf.sectionLabel}>POLL DETAILS</Text>

      <View style={cf.card}>
        <Text style={cf.label}>Title *</Text>
        <TextInput style={cf.input} placeholder="e.g. Session Engagement" value={title} onChangeText={setTitle} maxLength={200} placeholderTextColor={COLORS.textTer} />

        <Text style={[cf.label, { marginTop: SPACE.md }]}>Question *</Text>
        <TextInput style={[cf.input, { minHeight: 60 }]} placeholder="What do you want to ask?" value={question} onChangeText={setQuestion} multiline placeholderTextColor={COLORS.textTer} textAlignVertical="top" />

        <Text style={[cf.label, { marginTop: SPACE.md }]}>Poll Type</Text>
        <View style={cf.typeRow}>
          {TYPE_OPTIONS.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[cf.typeBtn, type === t.key && cf.typeBtnOn]}
              onPress={() => setType(t.key)}
              activeOpacity={0.8}
            >
              <Text style={[cf.typeBtnText, type === t.key && cf.typeBtnTextOn]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Ideathon toggle */}
      <View style={cf.card}>
        <TouchableOpacity style={cf.toggleRow} onPress={() => setIsIdeathon(!isIdeathon)} activeOpacity={0.8}>
          <View style={[cf.toggle, isIdeathon && cf.toggleOn]}>
            <View style={[cf.toggleThumb, isIdeathon && cf.toggleThumbOn]} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={cf.toggleLabel}>🏆 Ideathon Voting Poll</Text>
            <Text style={cf.toggleSub}>
              {isIdeathon
                ? 'Only team leaders can vote. Teams cannot vote for themselves.'
                : 'Mark this as an Ideathon audience choice poll'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {!hideOptions && (
        <>
          <Text style={cf.sectionLabel}>OPTIONS</Text>
          <View style={cf.card}>
            {options.map((opt, i) => (
              <View key={i} style={cf.optRow}>
                <TextInput
                  style={[cf.input, { flex: 1 }]}
                  placeholder={`Option ${i + 1}`}
                  value={opt}
                  onChangeText={v => updateOption(i, v)}
                  maxLength={200}
                  placeholderTextColor={COLORS.textTer}
                />
                {options.length > 2 && (
                  <TouchableOpacity onPress={() => removeOption(i)} style={cf.removeBtn}>
                    <Ionicons name="close-circle" size={22} color={COLORS.error} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            {options.length < 6 && (
              <TouchableOpacity style={cf.addOptBtn} onPress={addOption}>
                <Ionicons name="add-circle-outline" size={18} color={COLORS.brand} />
                <Text style={cf.addOptText}>Add Option</Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      )}

      {type === 'yesno' && (
        <View style={[cf.card, { marginTop: 0 }]}>
          <Text style={{ fontSize: FONT.xs, color: COLORS.textSec }}>
            Yes/No polls automatically use "Yes" and "No" as options.
          </Text>
        </View>
      )}

      <Text style={cf.sectionLabel}>LAUNCH</Text>
      <View style={cf.card}>
        <TouchableOpacity style={cf.toggleRow} onPress={() => setStartNow(!startNow)} activeOpacity={0.8}>
          <View style={[cf.toggle, startNow && cf.toggleOn]}>
            <View style={[cf.toggleThumb, startNow && cf.toggleThumbOn]} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={cf.toggleLabel}>Start immediately</Text>
            <Text style={cf.toggleSub}>
              {startNow
                ? 'Poll goes live now — all participants get a push notification'
                : 'Poll saved as draft — start it manually from the list'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', gap: SPACE.sm, marginTop: SPACE.lg }}>
        <TouchableOpacity style={cf.cancelBtn} onPress={onCancel}>
          <Text style={cf.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[cf.submitBtn, (!title.trim() || !question.trim() || loading) && { opacity: 0.5 }]}
          onPress={submit}
          disabled={loading || !title.trim() || !question.trim()}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={cf.submitText}>{startNow ? '🚀 Create & Start' : '💾 Save as Draft'}</Text>
          }
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const cf = StyleSheet.create({
  sectionLabel: { fontSize: 10, fontWeight: FONT.w8, color: COLORS.textTer, letterSpacing: 1.5, marginBottom: SPACE.sm, marginTop: SPACE.lg },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: SPACE.lg, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACE.sm },
  label: { fontSize: FONT.xs, fontWeight: FONT.w7, color: COLORS.textSec, marginBottom: SPACE.xs },
  input: { backgroundColor: COLORS.bg, borderRadius: RADIUS.md, padding: SPACE.md, fontSize: FONT.sm, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, marginTop: SPACE.xs },
  typeBtn: { paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, borderRadius: RADIUS.full, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
  typeBtnOn: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  typeBtnText: { fontSize: FONT.xs, fontWeight: FONT.w6, color: COLORS.textSec },
  typeBtnTextOn: { color: '#fff', fontWeight: FONT.w7 },
  optRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.sm },
  removeBtn: { padding: SPACE.xs },
  addOptBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, marginTop: SPACE.xs },
  addOptText: { fontSize: FONT.sm, fontWeight: FONT.w6, color: COLORS.brand },
  toggleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md },
  toggle: { width: 44, height: 24, borderRadius: 12, backgroundColor: COLORS.border, padding: 2, justifyContent: 'center' },
  toggleOn: { backgroundColor: COLORS.success },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', alignSelf: 'flex-start' },
  toggleThumbOn: { alignSelf: 'flex-end' },
  toggleLabel: { fontSize: FONT.sm, fontWeight: FONT.w7, color: COLORS.text },
  toggleSub: { fontSize: FONT.xs, color: COLORS.textTer, marginTop: 2, lineHeight: 16 },
  cancelBtn: { flex: 1, alignItems: 'center', paddingVertical: SPACE.lg, borderRadius: RADIUS.lg, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
  cancelText: { fontSize: FONT.sm, fontWeight: FONT.w6, color: COLORS.textSec },
  submitBtn: { flex: 2, alignItems: 'center', paddingVertical: SPACE.lg, borderRadius: RADIUS.lg, backgroundColor: COLORS.brand },
  submitText: { fontSize: FONT.sm, fontWeight: FONT.w7, color: '#fff' },
});

// ── Main PollsAdmin Screen ────────────────────────────────────────────────────
export default function PollsAdmin({ tokens, onBack }) {
  const [view, setView]       = useState('list'); // list | create | results
  const [polls, setPolls]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPoll, setSelectedPoll] = useState(null);
  const [filter, setFilter]   = useState('all'); // all | live | draft | closed

  const fetchPolls = useCallback(async () => {
    try {
      const res = await apiFetch('/polls/admin/list/');
      if (res.ok) {
        const d = await res.json();
        setPolls(d.polls || []);
      }
    } catch { /* silent */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => {
    fetchPolls();
    const id = setInterval(fetchPolls, 15000);
    return () => clearInterval(id);
  }, [fetchPolls]);

  if (view === 'create') {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
        <LinearGradient colors={[COLORS.brandDeep, COLORS.brand]} style={s.header}>
          <TouchableOpacity onPress={() => setView('list')} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Create Poll</Text>
        </LinearGradient>
        <CreatePollForm
          onCreated={() => { setView('list'); fetchPolls(); }}
          onCancel={() => setView('list')}
        />
      </View>
    );
  }

  if (view === 'results' && selectedPoll) {
    return (
      <PollResults
        poll={selectedPoll}
        onBack={() => { setView('list'); setSelectedPoll(null); fetchPolls(); }}
      />
    );
  }

  // Poll list
  const liveCount   = polls.filter(p => p.status === 'live').length;
  const draftCount  = polls.filter(p => p.status === 'draft').length;
  const closedCount = polls.filter(p => p.status === 'closed').length;

  const visible = polls.filter(p => {
    if (filter === 'live')   return p.status === 'live';
    if (filter === 'draft')  return p.status === 'draft' || p.status === 'scheduled';
    if (filter === 'closed') return p.status === 'closed';
    return true;
  });

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* Header */}
      <LinearGradient colors={[COLORS.brandDeep, COLORS.brand]} style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: SPACE.md }}>
          <Text style={s.headerTitle}>Live Polls</Text>
          <Text style={s.headerSub}>
            {liveCount > 0 ? `${liveCount} poll${liveCount > 1 ? 's' : ''} live now` : 'Manage conference polls'}
          </Text>
        </View>
        <TouchableOpacity style={s.createBtn} onPress={() => setView('create')}>
          <Ionicons name="add" size={20} color={COLORS.brand} />
        </TouchableOpacity>
      </LinearGradient>

      {/* Stats strip */}
      <View style={s.statsStrip}>
        {[
          { label: 'Live',   val: liveCount,   color: COLORS.success, filter: 'live' },
          { label: 'Draft',  val: draftCount,  color: COLORS.textTer, filter: 'draft' },
          { label: 'Closed', val: closedCount, color: COLORS.accent,  filter: 'closed' },
          { label: 'All',    val: polls.length, color: COLORS.brand,  filter: 'all' },
        ].map(st => (
          <TouchableOpacity key={st.filter} style={[s.statItem, filter === st.filter && s.statItemOn]} onPress={() => setFilter(st.filter)}>
            <Text style={[s.statVal, { color: filter === st.filter ? COLORS.brand : st.color }]}>{st.val}</Text>
            <Text style={s.statKey}>{st.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.brand} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: PAD, paddingBottom: 80 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPolls(); }} tintColor={COLORS.brand} />}
        >
          {visible.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="stats-chart-outline" size={48} color={COLORS.textTer} />
              <Text style={s.emptyTitle}>No polls yet</Text>
              <Text style={s.emptySub}>Tap + to create your first poll</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={() => setView('create')}>
                <Text style={s.emptyBtnText}>Create Poll</Text>
              </TouchableOpacity>
            </View>
          ) : (
            visible.map(poll => (
              <PollCard
                key={poll.id}
                poll={poll}
                onAction={fetchPolls}
                onViewResults={(p) => { setSelectedPoll(p); setView('results'); }}
              />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  header: { paddingTop: Platform.OS === 'ios' ? 54 : 44, paddingBottom: SPACE.xl, paddingHorizontal: PAD, flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FONT.xl, fontWeight: FONT.w9, color: '#fff', letterSpacing: -0.3 },
  headerSub: { fontSize: FONT.xs, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  createBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  statsStrip: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  statItem: { flex: 1, alignItems: 'center', paddingVertical: SPACE.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  statItemOn: { borderBottomColor: COLORS.brand },
  statVal: { fontSize: FONT.lg, fontWeight: FONT.w9 },
  statKey: { fontSize: 9, fontWeight: FONT.w7, color: COLORS.textTer, letterSpacing: 0.5 },
  empty: { alignItems: 'center', paddingVertical: 80, gap: SPACE.md },
  emptyTitle: { fontSize: FONT.xl, fontWeight: FONT.w8, color: COLORS.textSec },
  emptySub: { fontSize: FONT.sm, color: COLORS.textTer },
  emptyBtn: { backgroundColor: COLORS.brand, paddingHorizontal: SPACE.xl, paddingVertical: SPACE.md, borderRadius: RADIUS.lg, marginTop: SPACE.sm },
  emptyBtnText: { fontSize: FONT.sm, fontWeight: FONT.w7, color: '#fff' },
});
