import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, RefreshControl,
  StyleSheet, Platform, StatusBar, Animated, Easing, Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, SPACE, RADIUS, SHADOW, fixMediaUrl, TOP, BOTTOM } from '../theme';
import { apiFetch } from '../api';
import { GradientAvatar, PulsingDot } from '../components';

const PAD = SPACE.xl;

const ACTION_ICONS = {
  signup: 'person-add',
  checkin: 'qr-code',
  meal: 'restaurant',
  poll_vote: 'stats-chart',
  photo_upload: 'camera',
  profile_completion: 'checkmark-circle',
  feedback: 'chatbox-ellipses',
  networking: 'people',
  daily_login: 'sunny',
};

const ACTION_COLORS = {
  signup: COLORS.brand,
  checkin: COLORS.success,
  meal: COLORS.accent,
  poll_vote: COLORS.purple,
  photo_upload: COLORS.teal,
  profile_completion: COLORS.success,
  feedback: COLORS.brand,
  networking: COLORS.rose,
  daily_login: COLORS.accent,
};

const ACTION_BG = {
  signup: COLORS.brandLight,
  checkin: COLORS.successLight,
  meal: COLORS.accentLight,
  poll_vote: COLORS.purpleLight,
  photo_upload: COLORS.tealLight,
  profile_completion: COLORS.successLight,
  feedback: COLORS.brandLight,
  networking: COLORS.roseLight,
  daily_login: COLORS.accentLight,
};

const WAYS_TO_SCORE = [
  {
    action: 'checkin',
    title: 'Conference Check-in',
    desc: 'Scan your registration QR at the main venue desk to unlock rankings.',
    pts: '+50',
    freq: 'Event entry',
    icon: ACTION_ICONS.checkin,
    color: ACTION_COLORS.checkin,
    bg: ACTION_BG.checkin,
  },
  {
    action: 'profile_completion',
    title: 'Complete Your Profile',
    desc: 'Add your photo, bio, and affiliation so fellow attendees can find you.',
    pts: '+50',
    freq: 'One-time',
    icon: ACTION_ICONS.profile_completion,
    color: ACTION_COLORS.profile_completion,
    bg: ACTION_BG.profile_completion,
  },
  {
    action: 'networking',
    title: 'Attendee Networking',
    desc: 'Connect and exchange badges with other participants at the venue.',
    pts: '+30',
    freq: 'Per connection',
    icon: ACTION_ICONS.networking,
    color: ACTION_COLORS.networking,
    bg: ACTION_BG.networking,
  },
  {
    action: 'feedback',
    title: 'Session Feedback',
    desc: 'Rate talks and share thoughts after attending keynotes or panels.',
    pts: '+25',
    freq: 'Per session',
    icon: ACTION_ICONS.feedback,
    color: ACTION_COLORS.feedback,
    bg: ACTION_BG.feedback,
  },
  {
    action: 'photo_upload',
    title: 'Photo Wall Upload',
    desc: 'Share conference moments and highlights to the community gallery.',
    pts: '+20',
    freq: 'Per photo',
    icon: ACTION_ICONS.photo_upload,
    color: ACTION_COLORS.photo_upload,
    bg: ACTION_BG.photo_upload,
  },
  {
    action: 'poll_vote',
    title: 'Live Poll Voting',
    desc: 'Participate in real-time interactive audience polls during sessions.',
    pts: '+15',
    freq: 'Per poll',
    icon: ACTION_ICONS.poll_vote,
    color: ACTION_COLORS.poll_vote,
    bg: ACTION_BG.poll_vote,
  },
  {
    action: 'meal',
    title: 'Meal Check-in',
    desc: 'Scan your QR code at breakfast, lunch, or networking dinner counters.',
    pts: '+10',
    freq: 'Per meal',
    icon: ACTION_ICONS.meal,
    color: ACTION_COLORS.meal,
    bg: ACTION_BG.meal,
  },
  {
    action: 'daily_login',
    title: 'Daily App Check-in',
    desc: 'Open the app each conference day to claim your daily streak bonus.',
    pts: '+10',
    freq: 'Daily',
    icon: ACTION_ICONS.daily_login,
    color: ACTION_COLORS.daily_login,
    bg: ACTION_BG.daily_login,
  },
  {
    action: 'signup',
    title: 'Account Registration',
    desc: 'Welcome bonus awarded automatically when you join the conference app.',
    pts: '+25',
    freq: 'Welcome bonus',
    icon: ACTION_ICONS.signup,
    color: ACTION_COLORS.signup,
    bg: ACTION_BG.signup,
  },
];

const MEDAL = {
  1: { colors: [COLORS.accent, COLORS.accentDark], ring: COLORS.accentLight, icon: 'trophy', label: '1ST' },
  2: { colors: ['#64748b', '#475569'], ring: COLORS.border, icon: 'medal', label: '2ND' },
  3: { colors: ['#d97706', '#92400e'], ring: COLORS.warningLight, icon: 'ribbon', label: '3RD' },
};

function AnimatedNumber({ value, style, suffix = '' }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setDisplay(Math.round(v)));
    Animated.timing(anim, {
      toValue: value || 0,
      duration: 850,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => anim.removeListener(id);
  }, [value, anim]);

  return <Text style={style}>{display.toLocaleString()}{suffix}</Text>;
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function ScalePressable({ children, style, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 28,
      bounciness: 6,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 24,
      bounciness: 8,
    }).start();
  };

  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

function CompactRankHeader({ rank, points, gap, nextName, eligible, onOpenWays }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const prog = useRef(new Animated.Value(0)).current;

  const targetProgress = useMemo(() => {
    if (!eligible) return 0.15;
    if (rank === 1) return 1;
    if (gap <= 0) return 0.85;
    const total = points + gap;
    if (total <= 0) return 0.2;
    return Math.max(0.14, Math.min(0.94, points / total));
  }, [eligible, rank, points, gap]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);

  useEffect(() => {
    Animated.timing(prog, {
      toValue: targetProgress,
      duration: 950,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [targetProgress, prog]);

  const badgeScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const widthPct = prog.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={hero.card}>
      <View style={hero.topRow}>
        <View style={hero.leftGroup}>
          <Animated.View style={[hero.rankBadgeWrap, { transform: [{ scale: badgeScale }] }]}>
            <LinearGradient
              colors={rank === 1 ? [COLORS.accent, COLORS.accentDark] : [COLORS.brand, COLORS.brandDark]}
              style={hero.rankBadge}
            >
              <Text style={hero.rankLabel}>RANK</Text>
              <Text style={hero.rankValue}>{rankLabel || (eligible && rank ? `#${rank}` : '—')}</Text>
            </LinearGradient>
          </Animated.View>

          <View style={hero.statsCol}>
            <Text style={hero.kicker}>YOUR TOTAL SCORE</Text>
            <View style={hero.pointsRow}>
              <AnimatedNumber value={points || 0} style={hero.points} />
              <Text style={hero.ptsUnit}>PTS</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity activeOpacity={0.85} onPress={onOpenWays} style={hero.boostPill}>
          <Ionicons name="sparkles" size={13} color={COLORS.accent} />
          <Text style={hero.boostText}>Score +</Text>
          <Ionicons name="chevron-forward" size={12} color={COLORS.textInverse} />
        </TouchableOpacity>
      </View>

      <View style={hero.progressWrap}>
        <View style={hero.progressTrack}>
          <Animated.View style={[hero.progressFill, { width: widthPct }]}>
            <LinearGradient
              colors={[COLORS.accent, '#fbbf24']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFillObject}
            />
          </Animated.View>
        </View>

        <View style={hero.chaseRow}>
          {!eligible ? (
            <View style={hero.chaseInline}>
              <Ionicons name="lock-closed-outline" size={12} color={COLORS.accentLight} />
              <Text style={hero.chaseText}>Check in at the venue to unlock your live rank</Text>
            </View>
          ) : rank === 1 ? (
            <View style={hero.chaseInline}>
              <Ionicons name="trophy" size={12} color={COLORS.accent} />
              <Text style={hero.chaseText}>You are #1 on the leaderboard! Keep defending your lead.</Text>
            </View>
          ) : gap > 0 && !!nextName ? (
            <View style={hero.chaseInline}>
              <Ionicons name="flash" size={12} color={COLORS.accent} />
              <Text style={hero.chaseText} numberOfLines={1}>
                <Text style={hero.chaseHighlight}>{gap} pts</Text> behind {nextName}
              </Text>
            </View>
          ) : (
            <View style={hero.chaseInline}>
              <Ionicons name="trending-up" size={12} color={COLORS.accent} />
              <Text style={hero.chaseText}>Complete conference activities to climb higher</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

function SpotlightCard({ entry, slot, index }) {
  const medal = MEDAL[entry.rank] || {
    colors: [COLORS.brand, COLORS.brandDark],
    ring: COLORS.brandLight,
    icon: 'sparkles',
    label: `#${entry.rank}`,
  };

  const enterAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const haloAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(enterAnim, {
      toValue: 1,
      delay: index * 110,
      speed: 12,
      bounciness: 7,
      useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 2000 + index * 350,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2000 + index * 350,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    if (slot === 'center') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(haloAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
          Animated.timing(haloAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [enterAnim, floatAnim, haloAnim, index, slot]);

  const configs = {
    left:   { width: '30%', top: 22, rotate: '-3deg', scale: 0.95 },
    center: { width: '36%', top: 0,  rotate: '0deg',  scale: 1 },
    right:  { width: '30%', top: 22, rotate: '3deg',  scale: 0.95 },
  };
  const cfg = configs[slot];

  const translateY = Animated.add(
    enterAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }),
    floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -6] })
  );

  const scale = enterAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, cfg.scale] });
  const haloScale = haloAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const haloOpacity = haloAnim.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.55] });

  return (
    <Animated.View
      style={[
        pod.cardWrap,
        {
          width: cfg.width,
          marginTop: cfg.top,
          opacity: enterAnim,
          transform: [{ translateY }, { rotate: cfg.rotate }, { scale }],
        },
      ]}
    >
      <LinearGradient colors={medal.colors} style={[pod.card, slot === 'center' && pod.cardCenter]}>
        <View style={pod.topRow}>
          <View style={pod.rankChip}>
            <Ionicons name={medal.icon} size={10} color={COLORS.textInverse} />
            <Text style={pod.rankChipText}>#{entry.rank}</Text>
          </View>
          {entry.is_me && (
            <View style={pod.youChip}>
              <Text style={pod.youChipText}>YOU</Text>
            </View>
          )}
        </View>

        <View style={pod.avatarContainer}>
          {slot === 'center' && (
            <Animated.View
              style={[
                pod.crownHalo,
                { transform: [{ scale: haloScale }], opacity: haloOpacity },
              ]}
            />
          )}
          <View style={[pod.avatarRing, { borderColor: medal.ring }]}>
            {entry.profile_photo_url ? (
              <Image
                source={{ uri: fixMediaUrl(entry.profile_photo_url) }}
                style={slot === 'center' ? pod.avatarCenter : pod.avatar}
              />
            ) : (
              <GradientAvatar
                name={entry.name}
                size={slot === 'center' ? 62 : 50}
                radius={slot === 'center' ? 31 : 25}
              />
            )}
          </View>
        </View>

        {entry.is_tied && (
          <View style={pod.tiePill}>
            <Ionicons name="time-outline" size={9} color={COLORS.textInverse} />
            <Text style={pod.tieText}>Tie-break</Text>
          </View>
        )}

        <Text style={pod.name} numberOfLines={1}>{entry.name}</Text>
        {!!entry.affiliation && <Text style={pod.aff} numberOfLines={1}>{entry.affiliation}</Text>}

        <View style={pod.bottomRow}>
          <Text style={pod.points}>{entry.points.toLocaleString()}</Text>
          <Text style={pod.pointsUnit}>pts</Text>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

function StandingCard({ entry }) {
  if (!entry) return null;
  return (
    <View style={stand.card}>
      <LinearGradient colors={[COLORS.brandMid, COLORS.accentMid]} style={stand.bg} />
      <View style={stand.left}>
        <View style={stand.rankBubble}>
          <Text style={stand.rankText}>#{entry.rank}</Text>
        </View>
        {entry.profile_photo_url ? (
          <Image source={{ uri: fixMediaUrl(entry.profile_photo_url) }} style={stand.avatar} />
        ) : (
          <GradientAvatar name={entry.name} size={44} radius={22} />
        )}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, flexWrap: 'wrap' }}>
            <Text style={stand.title}>YOUR STANDING</Text>
            {entry.is_tied && (
              <View style={stand.tiePill}>
                <Ionicons name="time-outline" size={9} color={COLORS.accentDark} />
                <Text style={stand.tiePillText}>Time tie-break</Text>
              </View>
            )}
          </View>
          <Text style={stand.name} numberOfLines={1}>{entry.name}</Text>
          <Text style={stand.aff} numberOfLines={1}>{entry.affiliation || 'Checked-in participant'}</Text>
        </View>
      </View>
      <View style={stand.right}>
        <Text style={stand.points}>{entry.points.toLocaleString()}</Text>
        <Text style={stand.pointsLabel}>points</Text>
      </View>
    </View>
  );
}

function LeaderboardRow({ entry, index }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 340,
      delay: Math.min(index * 45, 450),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim, index]);

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
      }}
    >
      <ScalePressable style={[row.card, entry.is_me && row.cardMe]}>
        <View style={[row.rankPill, entry.is_me && row.rankPillMe]}>
          <Text style={[row.rankText, entry.is_me && row.rankTextMe]}>#{entry.rank}</Text>
        </View>

        {entry.profile_photo_url ? (
          <Image source={{ uri: fixMediaUrl(entry.profile_photo_url) }} style={row.avatar} />
        ) : (
          <GradientAvatar name={entry.name} size={44} radius={22} />
        )}

        <View style={row.info}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, flexWrap: 'wrap' }}>
            <Text style={[row.name, entry.is_me && row.nameMe]} numberOfLines={1}>{entry.name}</Text>
            {entry.is_me && <View style={row.youChip}><Text style={row.youChipText}>YOU</Text></View>}
            {entry.is_tied && (
              <View style={row.tiePill}>
                <Ionicons name="time-outline" size={9} color={COLORS.accentDark} />
                <Text style={row.tiePillText}>Tie-break</Text>
              </View>
            )}
          </View>
          <Text style={row.aff} numberOfLines={1}>{entry.affiliation || 'Participant'}</Text>
        </View>

        <View style={row.pointsWrap}>
          <Text style={[row.points, entry.is_me && row.pointsMe]}>{entry.points.toLocaleString()}</Text>
          <Text style={row.pointsLabel}>pts</Text>
        </View>
      </ScalePressable>
    </Animated.View>
  );
}

function ActivityItem({ item, index, isLast }) {
  const icon = ACTION_ICONS[item.action] || 'sparkles';
  const color = ACTION_COLORS[item.action] || COLORS.brand;
  const bg = ACTION_BG[item.action] || COLORS.brandLight;
  const timeAgo = formatTimeAgo(item.date);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 320,
      delay: Math.min(index * 50, 500),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim, index]);

  return (
    <Animated.View
      style={[
        activity.item,
        {
          opacity: anim,
          transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
        },
      ]}
    >
      <View style={activity.rail}>
        <View style={[activity.dot, { backgroundColor: color }]} />
        {!isLast && <View style={activity.line} />}
      </View>

      <View style={activity.card}>
        <View style={[activity.iconWrap, { backgroundColor: bg }]}>
          <Ionicons name={icon} size={18} color={color} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={activity.action}>{item.action_display}</Text>
          {!!item.note && <Text style={activity.note} numberOfLines={1}>{item.note}</Text>}
        </View>

        <View style={{ alignItems: 'flex-end' }}>
          <View style={activity.ptsBadge}>
            <Text style={activity.points}>+{item.points}</Text>
          </View>
          <Text style={activity.time}>{timeAgo}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

function WayToScoreCard({ item, index, count, earnedPoints }) {
  const anim = useRef(new Animated.Value(0)).current;
  const completed = count > 0;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      delay: index * 45,
      speed: 14,
      bounciness: 6,
      useNativeDriver: true,
    }).start();
  }, [anim, index]);

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
      }}
    >
      <ScalePressable style={[ways.card, completed && ways.cardCompleted]}>
        <View style={[ways.iconBox, { backgroundColor: item.bg }]}>
          <Ionicons name={item.icon} size={22} color={item.color} />
          {completed && (
            <View style={ways.checkDot}>
              <Ionicons name="checkmark" size={10} color={COLORS.textInverse} />
            </View>
          )}
        </View>

        <View style={ways.body}>
          <View style={ways.titleRow}>
            <Text style={ways.title} numberOfLines={1}>{item.title}</Text>
            <View style={[ways.freqPill, { backgroundColor: item.bg }]}>
              <Text style={[ways.freqText, { color: item.color }]}>{item.freq}</Text>
            </View>
          </View>
          <Text style={ways.desc} numberOfLines={2}>{item.desc}</Text>

          {completed && (
            <View style={ways.earnedRow}>
              <Ionicons name="checkmark-circle" size={13} color={COLORS.success} />
              <Text style={ways.earnedText}>
                Completed {count > 1 ? `${count}x` : 'once'} • +{earnedPoints} pts earned
              </Text>
            </View>
          )}
        </View>

        <View style={[ways.ptsPill, { backgroundColor: item.bg, borderColor: item.color }]}>
          <Text style={[ways.ptsValue, { color: item.color }]}>{item.pts}</Text>
          <Text style={[ways.ptsLabel, { color: item.color }]}>PTS</Text>
        </View>
      </ScalePressable>
    </Animated.View>
  );
}

function WaysToScoreSection({ history = [] }) {
  const actionStats = useMemo(() => {
    const map = {};
    (history || []).forEach((h) => {
      if (!h?.action) return;
      if (!map[h.action]) map[h.action] = { count: 0, pts: 0 };
      map[h.action].count += 1;
      map[h.action].pts += Number(h.points || 0);
    });
    return map;
  }, [history]);

  const completedTypes = Object.keys(actionStats).length;

  return (
    <View style={s.sectionWrap}>
      <View style={s.sectionHead}>
        <View>
          <Text style={s.sectionTitle}>All Ways to Score Points</Text>
          <Text style={s.sectionSub}>
            Complete activities across the conference to climb the live rankings
          </Text>
        </View>
        <View style={s.metaPill}>
          <Ionicons name="sparkles" size={12} color={COLORS.brand} />
          <Text style={s.metaPillText}>{completedTypes}/{WAYS_TO_SCORE.length} unlocked</Text>
        </View>
      </View>

      {WAYS_TO_SCORE.map((item, idx) => {
        const stat = actionStats[item.action] || { count: 0, pts: 0 };
        return (
          <WayToScoreCard
            key={item.action}
            item={item}
            index={idx}
            count={stat.count}
            earnedPoints={stat.pts}
          />
        );
      })}
    </View>
  );
}

export default function LeaderboardScreen({ onBack }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myData, setMyData] = useState(null);
  const [topData, setTopData] = useState(null);
  const [tab, setTab] = useState('rankings');

  const orbFloat = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(orbFloat, { toValue: 1, duration: 3600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(orbFloat, { toValue: 0, duration: 3600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, [orbFloat]);

  const fetchData = useCallback(async () => {
    try {
      const [myRes, topRes] = await Promise.all([
        apiFetch('/leaderboard/my/'),
        apiFetch('/leaderboard/top/'),
      ]);
      const myJson = myRes.ok ? await myRes.json() : null;
      const topJson = topRes.ok ? await topRes.json() : null;
      setMyData(myJson);
      setTopData(topJson);
    } catch (e) {
      console.log('leaderboard fetch error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const intervalId = setInterval(() => {
      fetchData();
    }, 5 * 60 * 1000);
    return () => clearInterval(intervalId);
  }, [fetchData]);

  const leaderboard = useMemo(
    () => (Array.isArray(topData?.leaderboard) ? topData.leaderboard : []),
    [topData]
  );

  const eligible = myData ? !!myData.eligible : true;
  const top3 = leaderboard.slice(0, 3);
  const top3Ids = new Set(top3.map((x) => x.user_id));
  const rest = leaderboard.filter((x) => !top3Ids.has(x.user_id));
  const myEntry = topData?.my_entry || leaderboard.find((x) => x.is_me) || null;

  const myRank = topData?.my_rank || myData?.rank || 0;
  const myPoints = topData?.my_points ?? myData?.total_points ?? 0;
  const nextGap = myData?.next_gap || 0;
  const nextName = myData?.next_rank_name || '';
  const totalParticipants = topData?.total_participants || 0;
  const history = myData?.history || [];

  const blob1TranslateY = orbFloat.interpolate({ inputRange: [0, 1], outputRange: [0, 14] });
  const blob2TranslateX = orbFloat.interpolate({ inputRange: [0, 1], outputRange: [0, -16] });

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />

      <LinearGradient
        colors={[COLORS.brandDeeper, COLORS.brandDeep, COLORS.brand]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.header}
      >
        <Animated.View style={[s.blob1, { transform: [{ translateY: blob1TranslateY }] }]} />
        <Animated.View style={[s.blob2, { transform: [{ translateX: blob2TranslateX }] }]} />

        <View style={s.topbar}>
          <TouchableOpacity onPress={onBack} style={s.backBtn} activeOpacity={0.8} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={20} color={COLORS.textInverse} />
          </TouchableOpacity>

          <View style={s.titleGroup}>
            <Text style={s.headerTitle}>Leaderboard</Text>
            <View style={s.livePill}>
              <PulsingDot color={COLORS.success} size={6} />
              <Text style={s.liveText}>LIVE</Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => {
              setRefreshing(true);
              fetchData();
            }}
            style={s.backBtn}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="refresh" size={18} color={COLORS.textInverse} />
          </TouchableOpacity>
        </View>

        <CompactRankHeader
          rank={eligible ? myRank : 0}
          points={myPoints}
          gap={eligible ? nextGap : 0}
          nextName={eligible ? nextName : ''}
          eligible={eligible}
          onOpenWays={() => setTab('earn')}
        />

        <View style={s.tabRow}>
          {[
            { key: 'rankings', label: 'Rankings', icon: 'trophy-outline' },
            { key: 'earn', label: 'Earn Pts', icon: 'sparkles-outline' },
            { key: 'activity', label: 'Activity', icon: 'pulse-outline' },
          ].map((t) => {
            const active = tab === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                activeOpacity={0.85}
                style={[s.tabBtn, active && s.tabBtnOn]}
                onPress={() => setTab(t.key)}
              >
                <Ionicons
                  name={t.icon}
                  size={15}
                  color={active ? COLORS.brand : 'rgba(255,255,255,0.72)'}
                />
                <Text style={[s.tabText, active && s.tabTextOn]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </LinearGradient>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: SPACE.huge + BOTTOM }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchData();
            }}
            tintColor={COLORS.brand}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={s.loadingWrap}>
            <PulsingDot color={COLORS.brand} size={11} />
            <Text style={s.loadingText}>Syncing live rankings…</Text>
          </View>
        ) : tab === 'earn' ? (
          <WaysToScoreSection history={history} />
        ) : !eligible && tab === 'rankings' ? (
          <>
            <View style={s.lockWrap}>
              <LinearGradient colors={[COLORS.surface, COLORS.brandLight]} style={s.lockCard}>
                <View style={s.lockIcon}>
                  <Ionicons name="shield-checkmark-outline" size={32} color={COLORS.brand} />
                </View>
                <Text style={s.lockTitle}>Check in to join the leaderboard</Text>
                <Text style={s.lockText}>
                  Only conference checked-in participants are ranked. Your points are safe — scan your QR at the registration desk to appear on the board!
                </Text>
                <View style={s.lockStatRow}>
                  <View style={s.lockStat}>
                    <Text style={s.lockStatValue}>{myPoints}</Text>
                    <Text style={s.lockStatLabel}>Your Points</Text>
                  </View>
                  <View style={s.lockDivider} />
                  <View style={s.lockStat}>
                    <Text style={s.lockStatValue}>{totalParticipants}</Text>
                    <Text style={s.lockStatLabel}>Checked-in</Text>
                  </View>
                </View>
              </LinearGradient>
            </View>
            <WaysToScoreSection history={history} />
          </>
        ) : tab === 'rankings' ? (
          <>
            {top3.length > 0 && (
              <View style={s.sectionWrap}>
                <View style={s.sectionHead}>
                  <View>
                    <Text style={s.sectionTitle}>Top Champions</Text>
                    <Text style={s.sectionSub}>Leading participants right now</Text>
                  </View>
                  <View style={s.metaPill}>
                    <Ionicons name="people-outline" size={12} color={COLORS.brand} />
                    <Text style={s.metaPillText}>{totalParticipants} ranked</Text>
                  </View>
                </View>

                <View style={s.spotlight}>
                  {!!top3[1] && <SpotlightCard entry={top3[1]} slot="left" index={1} />}
                  {!!top3[0] && <SpotlightCard entry={top3[0]} slot="center" index={0} />}
                  {!!top3[2] && <SpotlightCard entry={top3[2]} slot="right" index={2} />}
                </View>
              </View>
            )}

            {!!myEntry && !top3Ids.has(myEntry.user_id) && (
              <View style={s.sectionWrap}>
                <StandingCard entry={myEntry} />
              </View>
            )}

            <View style={s.sectionWrap}>
              <View style={s.sectionHead}>
                <Text style={s.sectionTitle}>All Checked-in Rankings</Text>
                <TouchableOpacity onPress={() => setTab('earn')} style={s.linkPill}>
                  <Ionicons name="flash" size={12} color={COLORS.brand} />
                  <Text style={s.linkPillText}>How to climb</Text>
                </TouchableOpacity>
              </View>

              {rest.length ? (
                rest.map((entry, idx) => (
                  <LeaderboardRow key={entry.user_id} entry={entry} index={idx} />
                ))
              ) : (
                <View style={s.emptyCard}>
                  <Ionicons name="trophy-outline" size={28} color={COLORS.textMuted} />
                  <Text style={s.emptyText}>
                    More participants will appear here as they check in and score points.
                  </Text>
                </View>
              )}
            </View>

            <WaysToScoreSection history={history} />
          </>
        ) : (
          <>
            <View style={s.sectionWrap}>
              <View style={s.sectionHead}>
                <View>
                  <Text style={s.sectionTitle}>Your Point History</Text>
                  <Text style={s.sectionSub}>Every action that boosted your score</Text>
                </View>
                <View style={s.metaPill}>
                  <Ionicons name="layers-outline" size={12} color={COLORS.brand} />
                  <Text style={s.metaPillText}>{history.length} events</Text>
                </View>
              </View>

              {history.length ? (
                history.map((item, i) => (
                  <ActivityItem
                    key={`${item.action}-${item.date}-${i}`}
                    item={item}
                    index={i}
                    isLast={i === history.length - 1}
                  />
                ))
              ) : (
                <View style={s.emptyCard}>
                  <Ionicons name="sparkles-outline" size={28} color={COLORS.textMuted} />
                  <Text style={s.emptyText}>No point activity yet. Try the actions below!</Text>
                </View>
              )}
            </View>

            <WaysToScoreSection history={history} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const hero = StyleSheet.create({
  card: {
    marginHorizontal: PAD,
    marginTop: SPACE.md,
    padding: SPACE.md,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.glass,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    flex: 1,
  },
  rankBadgeWrap: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  rankBadge: {
    minWidth: 58,
    height: 54,
    paddingHorizontal: SPACE.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankLabel: {
    fontSize: FONT.micro,
    fontWeight: FONT.w8,
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 1,
  },
  rankValue: {
    fontSize: FONT.xl,
    fontWeight: FONT.w9,
    color: COLORS.textInverse,
    marginTop: 1,
  },
  statsCol: {
    flex: 1,
  },
  kicker: {
    fontSize: FONT.micro,
    fontWeight: FONT.w8,
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 1.1,
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: SPACE.xs,
    marginTop: 2,
  },
  points: {
    fontSize: FONT.xxl,
    fontWeight: FONT.w9,
    color: COLORS.textInverse,
    letterSpacing: -0.5,
  },
  ptsUnit: {
    fontSize: FONT.xs,
    fontWeight: FONT.w8,
    color: COLORS.accentLight,
  },
  boostPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15,23,42,0.42)',
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
    borderRadius: RADIUS.full,
  },
  boostText: {
    fontSize: FONT.xs,
    fontWeight: FONT.w8,
    color: COLORS.textInverse,
  },
  progressWrap: {
    marginTop: SPACE.md,
  },
  progressTrack: {
    height: 6,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(15,23,42,0.38)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: RADIUS.full,
  },
  chaseRow: {
    marginTop: SPACE.xs + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chaseInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  chaseText: {
    fontSize: FONT.xs,
    fontWeight: FONT.w6,
    color: 'rgba(255,255,255,0.86)',
  },
  chaseHighlight: {
    fontWeight: FONT.w9,
    color: COLORS.accentLight,
  },
});

const pod = StyleSheet.create({
  cardWrap: { alignSelf: 'flex-start' },
  card: {
    borderRadius: RADIUS.xl,
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.sm,
    minHeight: 210,
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
    ...SHADOW.lg,
  },
  cardCenter: {
    minHeight: 228,
    borderWidth: 1.5,
    borderColor: COLORS.accentLight,
  },
  topRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rankChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: SPACE.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(15,23,42,0.26)',
  },
  rankChipText: { fontSize: FONT.xs, fontWeight: FONT.w8, color: COLORS.textInverse },
  youChip: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.brandDeep,
  },
  youChipText: { fontSize: FONT.micro, fontWeight: FONT.w9, color: COLORS.textInverse },
  avatarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: SPACE.xs,
  },
  crownHalo: {
    position: 'absolute',
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: COLORS.accentLight,
  },
  avatarRing: {
    borderWidth: 2.5,
    borderRadius: RADIUS.full,
    padding: 2,
  },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  avatarCenter: { width: 62, height: 62, borderRadius: 31 },
  tiePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(15,23,42,0.24)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.xs,
  },
  tieText: { fontSize: FONT.micro, fontWeight: FONT.w7, color: COLORS.textInverse },
  name: {
    fontSize: FONT.sm,
    fontWeight: FONT.w8,
    color: COLORS.textInverse,
    textAlign: 'center',
    marginTop: 2,
    width: '100%',
  },
  aff: {
    fontSize: FONT.micro,
    color: 'rgba(255,255,255,0.80)',
    textAlign: 'center',
    width: '100%',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
    marginTop: SPACE.xs,
    backgroundColor: 'rgba(15,23,42,0.20)',
    paddingHorizontal: SPACE.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  points: { fontSize: FONT.sm, fontWeight: FONT.w9, color: COLORS.textInverse },
  pointsUnit: { fontSize: FONT.micro, fontWeight: FONT.w7, color: 'rgba(255,255,255,0.85)' },
});

const stand = StyleSheet.create({
  card: {
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACE.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...SHADOW.md,
  },
  bg: { ...StyleSheet.absoluteFillObject },
  left: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, flex: 1, paddingRight: SPACE.md },
  rankBubble: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: { fontSize: FONT.base, fontWeight: FONT.w9, color: COLORS.textInverse },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  title: { fontSize: FONT.micro, fontWeight: FONT.w8, color: COLORS.brand, letterSpacing: 1 },
  tiePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.accentLight,
    borderWidth: 0.5,
    borderColor: COLORS.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  tiePillText: { fontSize: FONT.micro, fontWeight: FONT.w7, color: COLORS.accentDark },
  name: { fontSize: FONT.md, fontWeight: FONT.w8, color: COLORS.text, marginTop: 2 },
  aff: { fontSize: FONT.xs, color: COLORS.textSec, marginTop: 1 },
  right: { alignItems: 'flex-end' },
  points: { fontSize: FONT.xl, fontWeight: FONT.w9, color: COLORS.brand },
  pointsLabel: { fontSize: FONT.micro, fontWeight: FONT.w6, color: COLORS.textTer },
});

const row = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACE.md,
    marginBottom: SPACE.sm,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    ...SHADOW.sm,
  },
  cardMe: {
    borderWidth: 1.5,
    borderColor: COLORS.brand,
    backgroundColor: COLORS.brandLight,
  },
  rankPill: {
    minWidth: 42,
    height: 32,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bgAlt,
  },
  rankPillMe: { backgroundColor: COLORS.brand },
  rankText: { fontSize: FONT.xs, fontWeight: FONT.w8, color: COLORS.textSec },
  rankTextMe: { color: COLORS.textInverse },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  info: { flex: 1 },
  name: { fontSize: FONT.base, fontWeight: FONT.w8, color: COLORS.text },
  nameMe: { color: COLORS.brand },
  aff: { fontSize: FONT.xs, color: COLORS.textTer, marginTop: 2 },
  youChip: {
    backgroundColor: COLORS.brand,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  youChipText: { fontSize: FONT.micro, fontWeight: FONT.w8, color: COLORS.textInverse },
  tiePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.accentLight,
    borderWidth: 0.5,
    borderColor: COLORS.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  tiePillText: { fontSize: FONT.micro, fontWeight: FONT.w7, color: COLORS.accentDark },
  pointsWrap: { alignItems: 'flex-end' },
  points: { fontSize: FONT.md, fontWeight: FONT.w9, color: COLORS.text },
  pointsMe: { color: COLORS.brand },
  pointsLabel: { fontSize: FONT.micro, color: COLORS.textTer },
});

const activity = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: SPACE.sm,
    marginBottom: SPACE.sm,
  },
  rail: { width: 16, alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 18 },
  line: { width: 2, flex: 1, backgroundColor: COLORS.border, marginTop: 4 },
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACE.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    ...SHADOW.sm,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  action: { fontSize: FONT.sm, fontWeight: FONT.w8, color: COLORS.text },
  note: { fontSize: FONT.xs, color: COLORS.textSec, marginTop: 2 },
  ptsBadge: {
    backgroundColor: COLORS.successLight,
    paddingHorizontal: SPACE.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  points: { fontSize: FONT.xs, fontWeight: FONT.w9, color: COLORS.success },
  time: { fontSize: FONT.micro, color: COLORS.textTer, marginTop: 4 },
});

const ways = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACE.md,
    marginBottom: SPACE.sm,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    ...SHADOW.sm,
  },
  cardCompleted: {
    borderColor: COLORS.success,
    backgroundColor: COLORS.surface,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDot: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.surface,
  },
  body: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xs,
    flexWrap: 'wrap',
  },
  title: {
    fontSize: FONT.sm,
    fontWeight: FONT.w8,
    color: COLORS.text,
  },
  freqPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.xs,
  },
  freqText: {
    fontSize: FONT.micro,
    fontWeight: FONT.w8,
  },
  desc: {
    fontSize: FONT.xs,
    color: COLORS.textSec,
    marginTop: 3,
    lineHeight: 16,
  },
  earnedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 5,
  },
  earnedText: {
    fontSize: FONT.micro,
    fontWeight: FONT.w7,
    color: COLORS.success,
  },
  ptsPill: {
    minWidth: 54,
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ptsValue: {
    fontSize: FONT.base,
    fontWeight: FONT.w9,
  },
  ptsLabel: {
    fontSize: FONT.micro,
    fontWeight: FONT.w8,
    marginTop: 1,
  },
});

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    paddingTop: TOP + 8,
    paddingBottom: SPACE.lg,
    borderBottomLeftRadius: RADIUS.xxl,
    borderBottomRightRadius: RADIUS.xxl,
    overflow: 'hidden',
    ...SHADOW.lg,
  },
  blob1: {
    position: 'absolute',
    top: -40,
    right: -30,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  blob2: {
    position: 'absolute',
    bottom: -30,
    left: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.accentMid,
  },
  topbar: {
    paddingHorizontal: PAD,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.glass,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
  },
  headerTitle: {
    fontSize: FONT.lg,
    fontWeight: FONT.w9,
    color: COLORS.textInverse,
    letterSpacing: -0.3,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16,185,129,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.4)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  liveText: {
    fontSize: FONT.micro,
    fontWeight: FONT.w9,
    color: COLORS.successLight,
    letterSpacing: 0.6,
  },

  tabRow: {
    marginHorizontal: PAD,
    marginTop: SPACE.md,
    padding: 4,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(15,23,42,0.32)',
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    flexDirection: 'row',
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: SPACE.sm + 1,
    borderRadius: RADIUS.full,
  },
  tabBtnOn: {
    backgroundColor: COLORS.surface,
    ...SHADOW.sm,
  },
  tabText: {
    fontSize: FONT.xs,
    fontWeight: FONT.w7,
    color: 'rgba(255,255,255,0.75)',
  },
  tabTextOn: {
    color: COLORS.brand,
    fontWeight: FONT.w8,
  },

  loadingWrap: { alignItems: 'center', paddingVertical: SPACE.huge },
  loadingText: { fontSize: FONT.sm, color: COLORS.textSec, marginTop: SPACE.md },

  sectionWrap: { paddingHorizontal: PAD, marginTop: SPACE.xl },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACE.md,
  },
  sectionTitle: {
    fontSize: FONT.lg,
    fontWeight: FONT.w9,
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  sectionSub: {
    fontSize: FONT.xs,
    color: COLORS.textSec,
    marginTop: 2,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.brandLight,
    paddingHorizontal: SPACE.sm + 2,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  metaPillText: { fontSize: FONT.xs, fontWeight: FONT.w8, color: COLORS.brand },
  linkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.brandLight,
    paddingHorizontal: SPACE.sm + 2,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  linkPillText: { fontSize: FONT.xs, fontWeight: FONT.w8, color: COLORS.brand },

  spotlight: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    minHeight: 242,
  },

  emptyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACE.xl,
    alignItems: 'center',
    gap: SPACE.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyText: {
    fontSize: FONT.sm,
    color: COLORS.textTer,
    textAlign: 'center',
    lineHeight: 20,
  },

  lockWrap: { paddingHorizontal: PAD, marginTop: SPACE.xl },
  lockCard: {
    borderRadius: RADIUS.xxl,
    padding: SPACE.xxl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.lg,
  },
  lockIcon: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: COLORS.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACE.md,
  },
  lockTitle: {
    fontSize: FONT.lg,
    fontWeight: FONT.w9,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACE.xs,
  },
  lockText: {
    fontSize: FONT.sm,
    color: COLORS.textSec,
    textAlign: 'center',
    lineHeight: 20,
  },
  lockStatRow: {
    marginTop: SPACE.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xl,
  },
  lockDivider: {
    width: 1,
    height: 32,
    backgroundColor: COLORS.border,
  },
  lockStat: { alignItems: 'center' },
  lockStatValue: { fontSize: FONT.xxl, fontWeight: FONT.w9, color: COLORS.brand },
  lockStatLabel: { fontSize: FONT.xs, color: COLORS.textTer, marginTop: 2 },
});
