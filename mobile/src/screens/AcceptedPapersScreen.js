import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Linking,
  StyleSheet, Platform, StatusBar, ActivityIndicator,
  Dimensions, LayoutAnimation, UIManager, Animated, Easing,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONT, RADIUS, SHADOW, fixMediaUrl } from '../theme';
import { apiFetch } from '../api';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  if (!global.nativeFabricUIManager) UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: W } = Dimensions.get('window');
const TOP_INSET = Platform.OS === 'ios' ? 54 : 44;

/* ─────────────────────────────────────────────────────────────
   Animated Card Component (staggered entrance + expand animation)
   ───────────────────────────────────────────────────────────── */
function PaperCard({ item, index, isExpanded, onToggle, onOpenSchedule, activeTab }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const chevronRotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay: index * 60,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        delay: index * 60,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    Animated.timing(chevronRotate, {
      toValue: isExpanded ? 1 : 0,
      duration: 250,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [isExpanded]);

  const rotateDeg = chevronRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  // Color scheme per tab
  const accentColor = activeTab === 'paper' ? COLORS.brand : COLORS.purple;
  const accentLight = activeTab === 'paper' ? COLORS.brandLight : COLORS.purpleLight;
  const gradientColors = activeTab === 'paper'
    ? ['#0333b6', '#4361ee']
    : ['#8b5cf6', '#a78bfa'];

  return (
    <Animated.View
      style={[
        $.card,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
        isExpanded && $.cardExpanded,
      ]}
    >
      {/* Colored side accent bar */}
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={$.sideAccent}
      />

      <TouchableOpacity
        activeOpacity={0.7}
        style={$.cardHeader}
        onPress={onToggle}
      >
        {/* ID + Track badges */}
        <View style={$.badgeRow}>
          {Boolean(item.paper_id) && (
            <LinearGradient
              colors={gradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={$.idBadge}
            >
              <Ionicons
                name={activeTab === 'paper' ? 'document-text' : 'images'}
                size={10}
                color="#fff"
              />
              <Text style={$.idBadgeText}>{item.paper_id}</Text>
            </LinearGradient>
          )}
          {Boolean(item.track) && (
            <View style={[$.trackBadge, { backgroundColor: accentLight }]}>
              <View style={[$.trackDot, { backgroundColor: accentColor }]} />
              <Text style={[$.trackBadgeText, { color: accentColor }]}>{item.track}</Text>
            </View>
          )}
        </View>

        {/* Title */}
        <Text style={$.cardTitle} numberOfLines={isExpanded ? undefined : 2}>
          {item.title}
        </Text>

        {/* Authors row */}
        <View style={$.authorRow}>
          <View style={[$.authorIconWrap, { backgroundColor: accentLight }]}>
            <Ionicons name="people" size={12} color={accentColor} />
          </View>
          <Text style={$.cardAuthors} numberOfLines={isExpanded ? undefined : 1}>
            {item.authors}
          </Text>
        </View>

        {/* Presentation time pill */}
        {Boolean(item.presentation_time || item.session) && (
          <View style={$.timePill}>
            <Ionicons name="time" size={12} color={accentColor} />
            <Text style={[$.timePillText, { color: accentColor }]}>
              {item.presentation_time || `${item.session?.title} · ${item.session?.room || ''}`}
            </Text>
          </View>
        )}

        {/* Bottom expand indicator */}
        <View style={$.expandRow}>
          <Text style={[$.expandText, { color: accentColor }]}>
            {isExpanded ? 'Hide details' : 'Read abstract'}
          </Text>
          <Animated.View style={{ transform: [{ rotate: rotateDeg }] }}>
            <Ionicons name="chevron-down" size={16} color={accentColor} />
          </Animated.View>
        </View>
      </TouchableOpacity>

      {/* Expanded body */}
      {isExpanded && (
        <View style={$.expandedBody}>
          {Boolean(item.abstract) ? (
            <View style={$.abstractBox}>
              <View style={$.abstractHeader}>
                <View style={[$.abstractIconWrap, { backgroundColor: accentLight }]}>
                  <Ionicons name="reader" size={13} color={accentColor} />
                </View>
                <Text style={$.abstractHeading}>ABSTRACT</Text>
              </View>
              <Text style={$.abstractText}>{item.abstract}</Text>
            </View>
          ) : (
            <View style={$.noAbstractBox}>
              <Ionicons name="information-circle-outline" size={16} color={COLORS.textTer} />
              <Text style={$.noAbstractText}>No abstract provided.</Text>
            </View>
          )}

          {Boolean(item.pdf_url) && (
            <TouchableOpacity
              activeOpacity={0.85}
              style={[$.schedBtnWrap, { marginTop: 12 }]}
              onPress={() => {
                const url = fixMediaUrl ? fixMediaUrl(item.pdf_url) : item.pdf_url;
                if (url) Linking.openURL(url).catch(() => {});
              }}
            >
              <View style={[$.schedBtn, { backgroundColor: accentLight, borderWidth: 1, borderColor: accentColor }]}>
                <Ionicons name="document-text" size={16} color={accentColor} />
                <Text style={[$.schedBtnText, { color: accentColor }]}>View / Download Paper (PDF)</Text>
                <Ionicons name="download-outline" size={15} color={accentColor} />
              </View>
            </TouchableOpacity>
          )}

          {(item.presentation_time || item.presentation_date || item.session) && onOpenSchedule ? (
            <TouchableOpacity
              activeOpacity={0.85}
              style={$.schedBtnWrap}
              onPress={onOpenSchedule}
            >
              <LinearGradient
                colors={gradientColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={$.schedBtn}
              >
                <Ionicons name="calendar" size={15} color="#fff" />
                <Text style={$.schedBtnText}>Open Full Schedule</Text>
                <Ionicons name="arrow-forward" size={15} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          ) : null}
        </View>
      )}
    </Animated.View>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main Screen
   ───────────────────────────────────────────────────────────── */
export default function AcceptedPapersScreen({ onBack, onOpenSchedule, initialSearch }) {
  const [activeTab, setActiveTab] = useState('paper');
  const [search, setSearch] = useState(initialSearch || '');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState([]);
  const [expandedId, setExpandedId] = useState(null);

  // Tab slide animation
  const tabSlide = useRef(new Animated.Value(0)).current;
  // Header fade
  const headerFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerFade, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (initialSearch) setSearch(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    Animated.spring(tabSlide, {
      toValue: activeTab === 'paper' ? 0 : 1,
      useNativeDriver: true,
      tension: 60,
      friction: 8,
    }).start();
  }, [activeTab]);

  const fetchItems = useCallback(async () => {
    try {
      const res = await apiFetch(
        `/schedule/accepted-papers/?type=${activeTab}&search=${encodeURIComponent(search)}`
      );
      if (res.ok) {
        const data = await res.json();
        setItems(data.results || []);
      }
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, search]);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(fetchItems, 300);
    return () => clearTimeout(timer);
  }, [fetchItems]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchItems();
  };

  const toggleExpand = (id) => {
    LayoutAnimation.configureNext({
      duration: 300,
      create: { type: 'easeInEaseOut', property: 'opacity' },
      update: { type: 'easeInEaseOut', springDamping: 0.7 },
    });
    setExpandedId(expandedId === id ? null : id);
  };

  const handleOpenSchedule = () => {
    if (onOpenSchedule) {
      // Defer navigation to next tick to ensure state batching works correctly
      setTimeout(() => onOpenSchedule(), 50);
    }
  };

  const accentColor = activeTab === 'paper' ? COLORS.brand : COLORS.purple;
  const tabIndicatorTranslate = tabSlide.interpolate({
    inputRange: [0, 1],
    outputRange: [0, (W - 44) / 2],
  });

  // Stats row
  const totalCount = items.length;

  return (
    <View style={$.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* GRADIENT HEADER */}
      <LinearGradient
        colors={activeTab === 'paper'
          ? ['#0333b6', '#4361ee', '#6a8dff']
          : ['#7c3aed', '#8b5cf6', '#a78bfa']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={$.gradientHeader}
      >
        {/* Decorative circles */}
        <View style={$.decorCircle1} />
        <View style={$.decorCircle2} />

        <Animated.View style={[$.headerContent, { opacity: headerFade }]}>
          <View style={$.topHeader}>
            <TouchableOpacity style={$.backBtn} onPress={onBack} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={$.headerEyebrow}>ETD 2026</Text>
              <Text style={$.headerTitle}>Accepted Submissions</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          {/* Stats pill */}
          <View style={$.statsRow}>
            <View style={$.statPill}>
              <Ionicons name="checkmark-circle" size={14} color="#fff" />
              <Text style={$.statPillText}>
                {loading ? '—' : totalCount} {activeTab === 'paper' ? 'Papers' : 'Posters'} Accepted
              </Text>
            </View>
          </View>
        </Animated.View>
      </LinearGradient>

      {/* TABS with sliding indicator */}
      <View style={$.tabsWrapper}>
        <View style={$.tabsRow}>
          <Animated.View
            style={[
              $.tabIndicator,
              {
                backgroundColor: activeTab === 'paper' ? COLORS.brandLight : COLORS.purpleLight,
                borderColor: accentColor,
                transform: [{ translateX: tabIndicatorTranslate }],
              },
            ]}
          />
          <TouchableOpacity
            style={$.tabBtn}
            onPress={() => { setActiveTab('paper'); setExpandedId(null); }}
            activeOpacity={0.7}
          >
            <Ionicons
              name="document-text"
              size={16}
              color={activeTab === 'paper' ? COLORS.brand : COLORS.textTer}
            />
            <Text style={[$.tabText, activeTab === 'paper' && { color: COLORS.brand, fontWeight: FONT.w8 }]}>
              Papers
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={$.tabBtn}
            onPress={() => { setActiveTab('poster'); setExpandedId(null); }}
            activeOpacity={0.7}
          >
            <Ionicons
              name="images"
              size={16}
              color={activeTab === 'poster' ? COLORS.purple : COLORS.textTer}
            />
            <Text style={[$.tabText, activeTab === 'poster' && { color: COLORS.purple, fontWeight: FONT.w8 }]}>
              Posters
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* SEARCH BAR */}
      <View style={$.searchWrap}>
        <View style={[$.searchBox, { borderColor: search ? accentColor : COLORS.border }]}>
          <Ionicons name="search" size={18} color={search ? accentColor : COLORS.textTer} style={{ marginRight: 8 }} />
          <TextInput
            style={$.searchInput}
            placeholder={`Search ${activeTab === 'paper' ? 'papers' : 'posters'}...`}
            placeholderTextColor={COLORS.textTer}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close-circle" size={18} color={COLORS.textTer} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* LIST */}
      {loading ? (
        <View style={$.loadingWrap}>
          <ActivityIndicator color={accentColor} size="large" />
          <Text style={$.loadingText}>Loading {activeTab === 'paper' ? 'papers' : 'posters'}...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={$.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={accentColor}
              colors={[accentColor]}
            />
          }
        >
          {items.length === 0 ? (
            <View style={$.emptyWrap}>
              <View style={[$.emptyIconCircle, { backgroundColor: activeTab === 'paper' ? COLORS.brandLight : COLORS.purpleLight }]}>
                <Ionicons
                  name={activeTab === 'paper' ? 'document-text-outline' : 'images-outline'}
                  size={48}
                  color={accentColor}
                />
              </View>
              <Text style={$.emptyTitle}>No results found</Text>
              <Text style={$.emptyText}>
                {search
                  ? `No ${activeTab}s match "${search}"`
                  : `No ${activeTab}s have been published yet.`}
              </Text>
              {search ? (
                <TouchableOpacity style={$.clearSearchBtn} onPress={() => setSearch('')}>
                  <Text style={[$.clearSearchText, { color: accentColor }]}>Clear search</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : (
            items.map((item, index) => (
              <PaperCard
                key={item.id}
                item={item}
                index={index}
                isExpanded={expandedId === item.id}
                onToggle={() => toggleExpand(item.id)}
                onOpenSchedule={handleOpenSchedule}
                activeTab={activeTab}
              />
            ))
          )}

          {items.length > 0 && (
            <View style={$.footerNote}>
              <Ionicons name="checkmark-done" size={14} color={COLORS.textTer} />
              <Text style={$.footerNoteText}>Showing {items.length} {activeTab === 'paper' ? 'papers' : 'posters'}</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════ */
const $ = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },

  /* ── Gradient Header ── */
  gradientHeader: {
    paddingTop: TOP_INSET,
    paddingBottom: 20,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  decorCircle1: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  decorCircle2: {
    position: 'absolute',
    bottom: -30,
    left: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  headerContent: {},
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  headerEyebrow: {
    fontSize: FONT.micro,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: FONT.w7,
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: FONT.lg,
    fontWeight: FONT.w9,
    color: '#fff',
    letterSpacing: 0.3,
  },
  statsRow: { marginTop: 16, alignItems: 'center' },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.20)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
  },
  statPillText: {
    fontSize: FONT.xs,
    fontWeight: FONT.w8,
    color: '#fff',
    letterSpacing: 0.3,
  },

  /* ── Tabs ── */
  tabsWrapper: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: RADIUS.md,
    padding: 4,
    position: 'relative',
  },
  tabIndicator: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: (W - 40) / 2,
    height: 38,
    borderRadius: RADIUS.sm + 2,
    borderWidth: 1.5,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    zIndex: 1,
  },
  tabText: { fontSize: FONT.sm, fontWeight: FONT.w7, color: COLORS.textTer },

  /* ── Search ── */
  searchWrap: { backgroundColor: '#fff', paddingHorizontal: 16, paddingBottom: 14 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#f8fafc',
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
  },
  searchInput: { flex: 1, fontSize: FONT.sm, color: COLORS.text, padding: 0, fontWeight: FONT.w6 },

  /* ── List ── */
  listContent: { paddingHorizontal: 16, paddingBottom: 60, paddingTop: 14 },

  /* ── Card ── */
  card: {
    backgroundColor: '#fff',
    borderRadius: RADIUS.lg,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eef2f7',
    overflow: 'hidden',
    ...SHADOW.sm,
    position: 'relative',
  },
  cardExpanded: {
    borderColor: '#dbeafe',
    ...SHADOW.md,
  },
  sideAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 4,
  },
  cardHeader: { padding: 16, paddingLeft: 18 },

  badgeRow: { flexDirection: 'row', gap: 6, marginBottom: 10, flexWrap: 'wrap' },
  idBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  idBadgeText: {
    fontSize: FONT.micro,
    fontWeight: FONT.w9,
    color: '#fff',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
  trackBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  trackDot: { width: 5, height: 5, borderRadius: 2.5 },
  trackBadgeText: { fontSize: FONT.micro, fontWeight: FONT.w8, letterSpacing: 0.3 },

  cardTitle: {
    fontSize: FONT.base,
    fontWeight: FONT.w8,
    color: COLORS.text,
    lineHeight: 21,
    marginBottom: 8,
  },

  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  authorIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardAuthors: { flex: 1, fontSize: FONT.xs, color: COLORS.textSec, fontWeight: FONT.w6, lineHeight: 17 },

  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#e0f2fe',
  },
  timePillText: { fontSize: FONT.xs, fontWeight: FONT.w7 },

  expandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  expandText: { fontSize: FONT.micro, fontWeight: FONT.w8, letterSpacing: 0.4, textTransform: 'uppercase' },

  /* ── Expanded body ── */
  expandedBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingLeft: 18,
  },
  abstractBox: {
    backgroundColor: '#f8fafc',
    padding: 14,
    borderRadius: RADIUS.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.brand,
  },
  abstractHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  abstractIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  abstractHeading: {
    fontSize: 10,
    fontWeight: FONT.w9,
    color: COLORS.textSec,
    letterSpacing: 1.2,
  },
  abstractText: { fontSize: FONT.xs, color: COLORS.textSec, lineHeight: 20 },

  noAbstractBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#fafafa',
    borderRadius: RADIUS.sm,
  },
  noAbstractText: { fontSize: FONT.xs, color: COLORS.textTer, fontStyle: 'italic' },

  schedBtnWrap: { marginTop: 12, borderRadius: RADIUS.md, overflow: 'hidden' },
  schedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  schedBtnText: { fontSize: FONT.sm, fontWeight: FONT.w8, color: '#fff', letterSpacing: 0.3 },

  /* ── Loading / Empty ── */
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  loadingText: { marginTop: 12, fontSize: FONT.sm, color: COLORS.textSec, fontWeight: FONT.w6 },

  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 40 },
  emptyIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: FONT.md, fontWeight: FONT.w8, color: COLORS.text, marginBottom: 6 },
  emptyText: { fontSize: FONT.sm, color: COLORS.textSec, textAlign: 'center', lineHeight: 20 },
  clearSearchBtn: { marginTop: 14, paddingHorizontal: 20, paddingVertical: 8 },
  clearSearchText: { fontSize: FONT.sm, fontWeight: FONT.w8 },

  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 16,
    opacity: 0.6,
  },
  footerNoteText: { fontSize: FONT.xs, color: COLORS.textTer, fontWeight: FONT.w6 },
});
