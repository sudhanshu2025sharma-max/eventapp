import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Platform, Animated, Easing, ActivityIndicator, RefreshControl, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { COLORS, FONT, SPACE, RADIUS, SHADOW, TOP } from '../theme';
import { apiFetch } from '../api';

const PAD = SPACE.xl;

// ── Countdown ────────────────────────────────────────────────────────────────
function useCountdown(endsAt) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!endsAt) return;
    const calc = () => Math.max(0, Math.round((new Date(endsAt) - Date.now()) / 1000));
    setSecs(calc());
    const id = setInterval(() => setSecs(calc()), 1000);
    return () => clearInterval(id);
  }, [endsAt]);
  if (!endsAt) return null;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ── Vote Success Modal ───────────────────────────────────────────────────────
function VoteSuccessModal({ visible, onClose, points, optionText, isIdeathon }) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0)).current;
  const pointsPop = useRef(new Animated.Value(0)).current;
  const confettiAnims = useRef(
    Array.from({ length: 8 }, () => ({
      y: new Animated.Value(0),
      x: new Animated.Value(0),
      opacity: new Animated.Value(1),
      rotate: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    if (!visible) return;
    scaleAnim.setValue(0);
    checkScale.setValue(0);
    pointsPop.setValue(0);
    confettiAnims.forEach(c => {
      c.y.setValue(0); c.x.setValue(0); c.opacity.setValue(1); c.rotate.setValue(0);
    });

    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
      Animated.spring(checkScale, { toValue: 1, tension: 120, friction: 6, useNativeDriver: true }),
    ]).start();

    // Points bounce
    Animated.sequence([
      Animated.delay(400),
      Animated.spring(pointsPop, { toValue: 1, tension: 150, friction: 5, useNativeDriver: true }),
    ]).start();

    // Confetti burst
    Animated.stagger(50,
      confettiAnims.map((c, i) => {
        const angle = (i / 8) * Math.PI * 2;
        const dist = 60 + Math.random() * 40;
        return Animated.parallel([
          Animated.timing(c.y, {
            toValue: -Math.cos(angle) * dist,
            duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true,
          }),
          Animated.timing(c.x, {
            toValue: Math.sin(angle) * dist,
            duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true,
          }),
          Animated.timing(c.opacity, {
            toValue: 0, duration: 700, delay: 200, useNativeDriver: true,
          }),
          Animated.timing(c.rotate, {
            toValue: 1, duration: 700, useNativeDriver: true,
          }),
        ]);
      })
    ).start();
  }, [visible]);

  const CONFETTI_COLORS = [COLORS.brand, COLORS.accent, COLORS.success, COLORS.purple, COLORS.rose, COLORS.teal, '#fbbf24', '#f472b6'];

  const cardScale = scaleAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  const checkS = checkScale.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const ptsScale = pointsPop.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1.3, 1] });

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={vm.overlay}>
        <Animated.View style={[vm.card, { transform: [{ scale: cardScale }] }]}>
          {/* Confetti */}
          <View style={vm.confettiContainer}>
            {confettiAnims.map((c, i) => {
              const spin = c.rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${360 + Math.random() * 360}deg`] });
              return (
                <Animated.View key={i} style={[
                  vm.confetti,
                  {
                    backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                    width: 8 + Math.random() * 6,
                    height: 8 + Math.random() * 6,
                    borderRadius: Math.random() > 0.5 ? 10 : 2,
                    transform: [
                      { translateY: c.y },
                      { translateX: c.x },
                      { rotate: spin },
                    ],
                    opacity: c.opacity,
                  },
                ]} />
              );
            })}
          </View>

          {/* Check icon */}
          <Animated.View style={[vm.checkCircle, { transform: [{ scale: checkS }] }]}>
            <LinearGradient
              colors={isIdeathon ? [COLORS.accent, COLORS.accentDark] : [COLORS.success, '#059669']}
              style={vm.checkGrad}
            >
              <Ionicons name="checkmark" size={36} color="#fff" />
            </LinearGradient>
          </Animated.View>

          <Text style={vm.title}>
            {isIdeathon ? 'Vote Locked In!' : 'Vote Recorded!'}
          </Text>

          {!!optionText && (
            <View style={vm.choiceRow}>
              <Text style={vm.choiceLabel}>Your choice</Text>
              <Text style={vm.choiceText}>{optionText}</Text>
            </View>
          )}

          {points > 0 && (
            <Animated.View style={[vm.pointsCard, { transform: [{ scale: ptsScale }] }]}>
              <LinearGradient
                colors={[COLORS.brand, COLORS.brandDark]}
                style={vm.pointsGrad}
              >
                <Ionicons name="flash" size={20} color="#fde68a" />
                <Text style={vm.pointsText}>+{points} points</Text>
              </LinearGradient>
            </Animated.View>
          )}

          <Text style={vm.sub}>
            {isIdeathon
              ? 'Your support matters! Results will be revealed live.'
              : 'Thank you for participating.'}
          </Text>

          <TouchableOpacity style={vm.doneBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={vm.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const vm = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  card: {
    backgroundColor: '#fff', borderRadius: 28, padding: 32,
    width: '100%', maxWidth: 340, alignItems: 'center', overflow: 'visible',
  },
  confettiContainer: {
    position: 'absolute', top: 60, left: '50%',
    width: 0, height: 0, alignItems: 'center', justifyContent: 'center',
  },
  confetti: { position: 'absolute' },
  checkCircle: { marginBottom: SPACE.lg },
  checkGrad: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    fontSize: FONT.xl, fontWeight: FONT.w9, color: COLORS.text,
    textAlign: 'center', marginBottom: SPACE.md,
  },
  choiceRow: {
    backgroundColor: COLORS.bg, borderRadius: RADIUS.md,
    padding: SPACE.md, width: '100%', alignItems: 'center',
    marginBottom: SPACE.md,
  },
  choiceLabel: { fontSize: FONT.xs, color: COLORS.textTer, fontWeight: FONT.w6, marginBottom: 4 },
  choiceText: { fontSize: FONT.md, fontWeight: FONT.w8, color: COLORS.brand, textAlign: 'center' },
  pointsCard: { marginBottom: SPACE.md, borderRadius: RADIUS.lg, overflow: 'hidden' },
  pointsGrad: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.sm,
    paddingHorizontal: SPACE.xl, paddingVertical: SPACE.md,
  },
  pointsText: { fontSize: FONT.lg, fontWeight: FONT.w9, color: '#fff' },
  sub: {
    fontSize: FONT.sm, color: COLORS.textSec,
    textAlign: 'center', lineHeight: 20, marginBottom: SPACE.lg,
  },
  doneBtn: {
    backgroundColor: COLORS.bg, borderRadius: RADIUS.lg,
    paddingVertical: SPACE.md, paddingHorizontal: SPACE.xxl * 2,
    width: '100%', alignItems: 'center',
  },
  doneBtnText: { fontSize: FONT.md, fontWeight: FONT.w7, color: COLORS.textSec },
});

// ── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status, hasVoted }) {
  if (hasVoted) {
    return (
      <View style={[st.badge, { backgroundColor: COLORS.successLight }]}>
        <Text style={[st.badgeText, { color: COLORS.success }]}>✓ Voted</Text>
      </View>
    );
  }
  const cfg = {
    live:      { label: '● LIVE',   bg: COLORS.success,    text: '#fff' },
    closed:    { label: 'Closed',   bg: '#e2e8f0',         text: COLORS.textSec },
    scheduled: { label: 'Upcoming', bg: COLORS.accentLight, text: COLORS.accent },
    draft:     { label: 'Draft',    bg: '#f1f5f9',         text: COLORS.textTer },
  }[status] || { label: status, bg: '#f1f5f9', text: COLORS.textTer };
  return (
    <View style={[st.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[st.badgeText, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  );
}

// ── Option Card ──────────────────────────────────────────────────────────────
function OptionCard({ opt, selected, onPress, disabled, showResults, isIdeathon }) {
  const pct = showResults ? (opt.pct || 0) : 0;
  const barAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (showResults) {
      Animated.timing(barAnim, { toValue: pct / 100, duration: 700, useNativeDriver: false }).start();
    }
  }, [pct, showResults]);
  const barWidth = barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <TouchableOpacity
      style={[st.optCard, selected && st.optCardSelected, disabled && !showResults && { opacity: 0.6 }]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.82}
    >
      {showResults && (
        <Animated.View style={[st.resultBar, { width: barWidth,
          backgroundColor: selected ? 'rgba(3,51,182,0.12)' : 'rgba(148,163,184,0.10)' }]} />
      )}
      <View style={st.optInner}>
        <View style={[st.optRadio, selected && st.optRadioSelected]}>
          {selected && <View style={st.optRadioDot} />}
        </View>
        <View style={{ flex: 1 }}>
          {isIdeathon && opt.team_name ? (
            <>
              <Text style={[st.optText, selected && { color: COLORS.brand }]}>{opt.team_name}</Text>
              {!!opt.project_title && <Text style={st.optSub} numberOfLines={2}>{opt.project_title}</Text>}
              {!!opt.team_members && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                  <Ionicons name="people-outline" size={11} color={COLORS.textTer} />
                  <Text style={st.optMeta}>{opt.team_members}</Text>
                </View>
              )}
              {!!opt.project_desc && (
                <Text style={[st.optMeta, { marginTop: 3 }]} numberOfLines={2}>{opt.project_desc}</Text>
              )}
            </>
          ) : (
            <Text style={[st.optText, selected && { color: COLORS.brand }]}>{opt.text}</Text>
          )}
          {showResults && (
            <Text style={[st.optPct, selected && { color: COLORS.brand }]}>
              {pct}% · {opt.votes || 0} vote{(opt.votes || 0) !== 1 ? 's' : ''}
            </Text>
          )}
        </View>
        {selected && (
          <View style={st.checkMark}>
            <Ionicons name="checkmark" size={16} color="#fff" />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── Yes/No buttons ───────────────────────────────────────────────────────────
function YesNoInput({ options, selectedIds, onSelect, disabled, showResults }) {
  const yes = options[0];
  const no = options[1];
  if (!yes || !no) return null;
  return (
    <View style={{ flexDirection: 'row', gap: SPACE.md }}>
      {[yes, no].map((opt, i) => {
        const sel = selectedIds.includes(opt.id);
        const isYes = i === 0;
        return (
          <TouchableOpacity
            key={opt.id}
            style={[st.ynBtn, sel && (isYes ? st.ynBtnYes : st.ynBtnNo)]}
            onPress={() => !disabled && onSelect([opt.id])}
            disabled={disabled}
            activeOpacity={0.8}
          >
            <Ionicons
              name={isYes ? 'thumbs-up' : 'thumbs-down'}
              size={24}
              color={sel ? '#fff' : isYes ? COLORS.success : COLORS.error}
            />
            <Text style={[st.ynLabel, sel && { color: '#fff' }]}>{opt.text}</Text>
            {showResults && (
              <Text style={[st.ynPct, sel && { color: 'rgba(255,255,255,0.8)' }]}>
                {opt.pct || 0}%
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Rating ────────────────────────────────────────────────────────────────────
function RatingInput({ options, selectedIds, onSelect, disabled }) {
  const stars = Math.min(options.length, 5);
  const selectedIdx = options.findIndex(o => selectedIds.includes(o.id));
  return (
    <View style={{ flexDirection: 'row', gap: SPACE.md, justifyContent: 'center', paddingVertical: SPACE.md }}>
      {Array.from({ length: stars }, (_, i) => {
        const opt = options[i];
        const filled = selectedIdx >= i;
        return (
          <TouchableOpacity key={i} onPress={() => !disabled && onSelect([opt.id])} disabled={disabled} activeOpacity={0.7}>
            <Ionicons name={filled ? 'star' : 'star-outline'} size={40} color={COLORS.accent} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Single Poll Card ──────────────────────────────────────────────────────────
function PollCard({ poll, onVoted }) {
  const countdown = useCountdown(poll.status === 'live' ? poll.ends_at : null);
  const [selectedIds, setSelectedIds] = useState(poll.user_option_ids || []);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successData, setSuccessData] = useState({ points: 0, text: '' });
  const submitRef = useRef(false);

  // Sync if poll data updates externally
  useEffect(() => {
    if (poll.user_voted) setSelectedIds(poll.user_option_ids || []);
  }, [poll.user_voted]);

  const hasVoted = poll.user_voted;
  const isOpen = poll.status === 'live' && !hasVoted;
  const showResults = poll.show_results;
  const isIdeathon = poll.is_ideathon;

  const toggleOption = (id) => {
    if (poll.poll_type === 'multiple') {
      setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    } else {
      setSelectedIds([id]);
    }
  };

  const submit = async () => {
    if (submitRef.current || !selectedIds.length) return;
    submitRef.current = true;
    setSubmitting(true);
    try {
      const res = await apiFetch(`/polls/${poll.id}/vote/`, {
        method: 'POST',
        body: JSON.stringify({ option_ids: selectedIds }),
      });
      const data = await res.json();
      if (data.success) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        const votedOpt = poll.options.find(o => o.id === selectedIds[0]);
        setSuccessData({
          points: data.points_awarded || 0,
          text: votedOpt ? (isIdeathon && votedOpt.team_name ? votedOpt.team_name : votedOpt.text) : '',
        });
        setShowSuccess(true);
        if (onVoted) onVoted(data.poll);
      } else {
        // Show inline error
        setSuccessData({ points: 0, text: data.error || 'Vote failed' });
        submitRef.current = false;
      }
    } catch {
      submitRef.current = false;
    }
    setSubmitting(false);
  };

  const typeLabel = {
    single: 'Single Choice', multiple: 'Multiple Choice',
    yesno: 'Yes / No', rating: 'Rating',
  }[poll.poll_type] || poll.poll_type;

  return (
    <View style={[st.pollCard, poll.status === 'live' && !hasVoted && st.pollCardLive]}>
      {/* Success Modal */}
      <VoteSuccessModal
        visible={showSuccess}
        onClose={() => setShowSuccess(false)}
        points={successData.points}
        optionText={successData.text}
        isIdeathon={isIdeathon}
      />

      {/* Header */}
      <View style={st.pollHeader}>
        <View style={{ flex: 1, gap: SPACE.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, flexWrap: 'wrap' }}>
            <StatusBadge status={poll.status} hasVoted={hasVoted} />
            <View style={st.typePill}>
              <Text style={st.typePillText}>{typeLabel}</Text>
            </View>
            {isIdeathon && (
              <View style={[st.typePill, { backgroundColor: COLORS.accentLight }]}>
                <Text style={[st.typePillText, { color: COLORS.accent }]}>🏆 Ideathon</Text>
              </View>
            )}
          </View>
          <Text style={st.pollTitle}>{poll.title}</Text>
        </View>
        {poll.status === 'live' && countdown && (
          <View style={st.timerBox}>
            <Ionicons name="timer-outline" size={14} color={COLORS.error} />
            <Text style={st.timerText}>{countdown}</Text>
          </View>
        )}
      </View>

      {/* Question */}
      <Text style={st.question}>{poll.question}</Text>
      {!!poll.description && <Text style={st.desc}>{poll.description}</Text>}

      {/* Participation */}
      {poll.total_votes > 0 && (
        <View style={st.participationRow}>
          <Ionicons name="people-outline" size={14} color={COLORS.textTer} />
          <Text style={st.participationText}>
            {poll.total_votes} vote{poll.total_votes !== 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {/* Options */}
      <View style={{ gap: SPACE.sm, marginTop: SPACE.md }}>
        {poll.poll_type === 'yesno' ? (
          <YesNoInput
            options={poll.options}
            selectedIds={selectedIds}
            onSelect={setSelectedIds}
            disabled={!isOpen}
            showResults={showResults}
          />
        ) : poll.poll_type === 'rating' ? (
          <RatingInput
            options={poll.options}
            selectedIds={selectedIds}
            onSelect={setSelectedIds}
            disabled={!isOpen}
          />
        ) : (
          poll.options.map(opt => (
            <OptionCard
              key={opt.id}
              opt={opt}
              selected={selectedIds.includes(opt.id)}
              onPress={() => toggleOption(opt.id)}
              disabled={!isOpen}
              showResults={showResults}
              isIdeathon={isIdeathon}
            />
          ))
        )}
      </View>

      {/* Voted confirmation inline */}
      {hasVoted && (
        <View style={st.votedBanner}>
          <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />
          <Text style={st.votedText}>Your vote is recorded</Text>
          {!showResults && (
            <Text style={st.votedSub}> · Results after poll closes</Text>
          )}
        </View>
      )}

      {/* Team leader restriction for ideathon */}
      {isIdeathon && poll.status === 'live' && !hasVoted && poll.is_team_leader === false && (
        <View style={st.closedBanner}>
          <Ionicons name="shield-outline" size={16} color={COLORS.accent} />
          <Text style={[st.closedText, { color: COLORS.accent }]}>
            {poll.my_team_name
              ? 'Only your team leader can cast the vote.'
              : 'Join an Ideathon team to participate in voting.'}
          </Text>
        </View>
      )}

      {/* Cannot vote for own team notice */}
      {isIdeathon && poll.status === 'live' && !hasVoted && poll.is_team_leader === true && (
        <View style={[st.votedBanner, { backgroundColor: COLORS.accentLight }]}>
          <Ionicons name="information-circle" size={16} color={COLORS.accent} />
          <Text style={[st.votedText, { color: COLORS.accent }]}>
            Vote as Team {poll.my_team_name} — you cannot vote for your own team.
          </Text>
        </View>
      )}

      {/* Submit button */}
      {isOpen && (!isIdeathon || poll.is_team_leader) && (
        <TouchableOpacity
          style={[st.submitBtn, (!selectedIds.length || submitting) && { opacity: 0.55 }]}
          onPress={submit}
          disabled={!selectedIds.length || submitting}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={isIdeathon ? [COLORS.accent, COLORS.accentDark] : [COLORS.brand, COLORS.brandDark]}
            style={st.submitGrad}
          >
            {submitting
              ? <ActivityIndicator color="#fff" size="small" />
              : <>
                  <Ionicons name={isIdeathon ? 'trophy' : 'checkmark-circle'} size={18} color="#fff" />
                  <Text style={st.submitText}>
                    {isIdeathon ? 'Cast Your Vote' : 'Submit Vote'}
                  </Text>
                </>
            }
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Closed / upcoming */}
      {poll.status === 'closed' && !hasVoted && (
        <View style={st.closedBanner}>
          <Ionicons name="lock-closed-outline" size={16} color={COLORS.textTer} />
          <Text style={st.closedText}>Voting has ended.</Text>
        </View>
      )}
      {poll.status === 'scheduled' && (
        <View style={st.closedBanner}>
          <Ionicons name="time-outline" size={16} color={COLORS.accent} />
          <Text style={[st.closedText, { color: COLORS.accent }]}>
            Starts {poll.starts_at ? new Date(poll.starts_at).toLocaleTimeString('en-IN', {
              hour: '2-digit', minute: '2-digit', hour12: true,
            }) : 'soon'}
          </Text>
        </View>
      )}
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function PollsScreen({ onBack }) {
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');

  const fetchPolls = useCallback(async () => {
    try {
      const res = await apiFetch('/polls/');
      if (res.ok) {
        const data = await res.json();
        setPolls(data.polls || []);
      }
    } catch { /* silent */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => {
    fetchPolls();
    const id = setInterval(fetchPolls, 30000);
    return () => clearInterval(id);
  }, [fetchPolls]);

  const handleVoted = useCallback((updatedPoll) => {
    setPolls(prev => prev.map(p => p.id === updatedPoll.id ? updatedPoll : p));
  }, []);

  const visible = polls.filter(p => {
    if (filter === 'live') return p.status === 'live';
    if (filter === 'closed') return p.status === 'closed';
    return true;
  });

  const liveCnt = polls.filter(p => p.status === 'live').length;

  return (
    <View style={sc.container}>
      {/* Header */}
      <LinearGradient colors={[COLORS.brandDeep, COLORS.brand]} style={sc.header}>
        <View style={sc.blob} />
        <View style={sc.topbar}>
          <TouchableOpacity style={sc.backBtn} onPress={onBack} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: SPACE.md }}>
            <Text style={sc.headerTitle}>Live Polls</Text>
            <Text style={sc.headerSub}>
              {liveCnt > 0 ? `${liveCnt} poll${liveCnt > 1 ? 's' : ''} active now` : 'Conference engagement'}
            </Text>
          </View>
          {liveCnt > 0 && (
            <View style={sc.livePill}>
              <View style={sc.liveDot} />
              <Text style={sc.livePillText}>LIVE</Text>
            </View>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: PAD, gap: SPACE.sm, paddingBottom: SPACE.md }}>
          {[['all','All'], ['live','Live'], ['closed','Closed']].map(([key, label]) => (
            <TouchableOpacity
              key={key}
              style={[sc.chip, filter === key && sc.chipOn]}
              onPress={() => setFilter(key)}
              activeOpacity={0.8}
            >
              <Text style={[sc.chipText, filter === key && sc.chipTextOn]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </LinearGradient>

      {loading ? (
        <View style={sc.loadWrap}>
          <ActivityIndicator color={COLORS.brand} size="large" />
          <Text style={sc.loadText}>Loading polls…</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: PAD, paddingBottom: 120, gap: SPACE.lg }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchPolls(); }}
              tintColor={COLORS.brand}
            />
          }
        >
          {visible.length === 0 ? (
            <View style={sc.empty}>
              <Ionicons name="stats-chart-outline" size={52} color={COLORS.textTer} />
              <Text style={sc.emptyTitle}>
                {filter === 'live' ? 'No live polls right now' : 'No polls yet'}
              </Text>
              <Text style={sc.emptySub}>
                {filter === 'live'
                  ? 'Check back during sessions — polls will appear live.'
                  : 'Polls will appear here during the conference.'}
              </Text>
            </View>
          ) : (
            visible.map(poll => (
              <PollCard key={poll.id} poll={poll} onVoted={handleVoted} />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const sc = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f9' },
  header: {
    paddingTop: Platform.OS === 'ios' ? 54 : 44,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden',
  },
  blob: {
    position: 'absolute', top: -40, right: -20,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  topbar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: PAD, paddingBottom: SPACE.lg,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: FONT.xl, fontWeight: FONT.w9, color: '#fff', letterSpacing: -0.3 },
  headerSub: { fontSize: FONT.xs, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.xs,
    backgroundColor: COLORS.error, paddingHorizontal: SPACE.md,
    paddingVertical: 6, borderRadius: RADIUS.full,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  livePillText: { fontSize: 10, fontWeight: FONT.w8, color: '#fff', letterSpacing: 1 },
  chip: {
    paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm,
    borderRadius: RADIUS.full, backgroundColor: 'rgba(255,255,255,0.12)',
  },
  chipOn: { backgroundColor: 'rgba(255,255,255,0.25)' },
  chipText: { fontSize: FONT.sm, fontWeight: FONT.w6, color: 'rgba(255,255,255,0.7)' },
  chipTextOn: { color: '#fff', fontWeight: FONT.w8 },
  loadWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACE.md },
  loadText: { fontSize: FONT.sm, color: COLORS.textSec },
  empty: {
    alignItems: 'center', paddingVertical: SPACE.xxl * 2,
    paddingHorizontal: SPACE.xl, gap: SPACE.md,
  },
  emptyTitle: { fontSize: FONT.xl, fontWeight: FONT.w8, color: COLORS.textSec, textAlign: 'center' },
  emptySub: { fontSize: FONT.sm, color: COLORS.textTer, textAlign: 'center', lineHeight: 20 },
});

const st = StyleSheet.create({
  badge: { paddingHorizontal: SPACE.sm, paddingVertical: 4, borderRadius: RADIUS.full },
  badgeText: { fontSize: 10, fontWeight: FONT.w8, letterSpacing: 0.5 },
  typePill: {
    paddingHorizontal: SPACE.sm, paddingVertical: 4,
    borderRadius: RADIUS.full, backgroundColor: COLORS.brandLight,
  },
  typePillText: { fontSize: 10, fontWeight: FONT.w7, color: COLORS.brand },
  pollCard: {
    backgroundColor: '#fff', borderRadius: 24, padding: SPACE.xl,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)',
    ...Platform.select({
      ios: { shadowColor: '#002182', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 16 },
      android: { elevation: 2 },
    }),
  },
  pollCardLive: { borderColor: COLORS.brand, borderWidth: 1.5 },
  pollHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md, marginBottom: SPACE.md },
  pollTitle: { fontSize: FONT.lg, fontWeight: FONT.w9, color: COLORS.text, marginTop: SPACE.xs, letterSpacing: -0.2 },
  timerBox: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.xs,
    backgroundColor: COLORS.errorLight, paddingHorizontal: SPACE.sm,
    paddingVertical: 6, borderRadius: RADIUS.full, flexShrink: 0,
  },
  timerText: { fontSize: FONT.sm, fontWeight: FONT.w8, color: COLORS.error, fontVariant: ['tabular-nums'] },
  question: { fontSize: FONT.md, fontWeight: FONT.w7, color: COLORS.text, lineHeight: 22 },
  desc: { fontSize: FONT.sm, color: COLORS.textSec, marginTop: SPACE.xs, lineHeight: 20 },
  participationRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, marginTop: SPACE.sm },
  participationText: { fontSize: FONT.xs, color: COLORS.textTer, fontWeight: FONT.w6 },
  optCard: {
    borderRadius: RADIUS.lg, borderWidth: 1.5, borderColor: COLORS.border,
    backgroundColor: '#fafbfc', overflow: 'hidden',
  },
  optCardSelected: { borderColor: COLORS.brand, backgroundColor: COLORS.brandLight },
  optInner: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, padding: SPACE.lg },
  resultBar: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: RADIUS.lg },
  optRadio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2,
    borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  optRadioSelected: { borderColor: COLORS.brand },
  optRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.brand },
  optText: { fontSize: FONT.base, fontWeight: FONT.w7, color: COLORS.text },
  optSub: { fontSize: FONT.xs, color: COLORS.textSec, marginTop: 2 },
  optMeta: { fontSize: FONT.xs, color: COLORS.textTer },
  optPct: { fontSize: FONT.xs, fontWeight: FONT.w7, color: COLORS.textSec, marginTop: 4 },
  checkMark: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.brand,
    alignItems: 'center', justifyContent: 'center',
  },
  ynBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACE.sm,
    paddingVertical: SPACE.lg, borderRadius: RADIUS.lg,
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: '#fafbfc',
  },
  ynBtnYes: { backgroundColor: COLORS.success, borderColor: COLORS.success },
  ynBtnNo: { backgroundColor: COLORS.error, borderColor: COLORS.error },
  ynLabel: { fontSize: FONT.md, fontWeight: FONT.w8, color: COLORS.textSec },
  ynPct: { fontSize: FONT.xs, fontWeight: FONT.w7, color: COLORS.textTer, marginTop: 2 },
  votedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.sm,
    marginTop: SPACE.lg, padding: SPACE.md,
    backgroundColor: COLORS.successLight, borderRadius: RADIUS.md,
  },
  votedText: { fontSize: FONT.sm, fontWeight: FONT.w7, color: COLORS.success },
  votedSub: { fontSize: FONT.sm, color: COLORS.textSec },
  closedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.sm,
    marginTop: SPACE.lg, padding: SPACE.md,
    backgroundColor: '#f1f5f9', borderRadius: RADIUS.md,
  },
  closedText: { fontSize: FONT.sm, color: COLORS.textTer },
  submitBtn: { marginTop: SPACE.lg, borderRadius: RADIUS.lg, overflow: 'hidden', ...SHADOW.brand },
  submitGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACE.sm, paddingVertical: SPACE.lg,
  },
  submitText: { fontSize: FONT.md, fontWeight: FONT.w8, color: '#fff' },
});
