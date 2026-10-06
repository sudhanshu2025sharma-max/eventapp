import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, RefreshControl,
  StyleSheet, Platform, StatusBar, Animated, Easing, TextInput,
  Modal, Alert, ActivityIndicator, Dimensions, FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { COLORS, FONT, SPACE, RADIUS, SHADOW, fixMediaUrl } from '../theme';
import { apiFetch } from '../api';
import { useKeyboardHeight } from '../useKeyboard';
import { PulsingDot } from '../components';

const { width: W } = Dimensions.get('window');
const PAD = SPACE.xl;
const THUMB = (W - PAD * 2 - SPACE.sm * 2) / 3;

const SUGGESTED_HASHTAGS = [
  '#ETD2026', '#AI', '#IITDelhi', '#Keynote', '#Networking',
  '#Innovation', '#Research', '#CoffeeBreak', '#PosterSession', '#DigitalLibrary'
];

const SESSION_TYPE_COLOR = {
  keynote: COLORS.purple, technical: COLORS.brand, workshop: COLORS.accent,
  break: COLORS.success, meal: COLORS.success, cultural: COLORS.rose,
  panel: COLORS.teal, ceremony: COLORS.purple, special: COLORS.brand,
  other: COLORS.textSec,
};

function timeAgo(iso) {
  if (!iso) return '';
  const d = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (d < 60) return 'just now';
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

function Lightbox({ photo, onClose, onTagPress }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, tension: 55, friction: 8, useNativeDriver: true }).start();
  }, []);
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] });

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={lb.overlay}>
        <TouchableOpacity style={lb.dismiss} onPress={onClose} activeOpacity={1} />
        <Animated.View style={[lb.card, { transform: [{ scale }] }]}>
          <Image
            source={{ uri: fixMediaUrl(photo.image_url) }}
            style={lb.image}
            resizeMode="contain"
          />
          <View style={lb.meta}>
            <View style={lb.metaRow}>
              <Ionicons name="person-circle-outline" size={16} color={COLORS.textSec} />
              <Text style={lb.metaText}>{photo.uploader}</Text>
              <Text style={lb.metaDot}>·</Text>
              <Text style={lb.metaTime}>{timeAgo(photo.created_at)}</Text>
            </View>

            {!!photo.caption && <Text style={lb.caption}>{photo.caption}</Text>}

            {/* Badges / Pills */}
            <View style={lb.pillsRow}>
              {!!photo.selfie_spot_name && (
                <View style={lb.selfiePill}>
                  <Ionicons name="sparkles" size={12} color={COLORS.rose} />
                  <Text style={lb.selfiePillText}>📸 Selfie Spot: {photo.selfie_spot_name}</Text>
                </View>
              )}
              {!!photo.session_title && (
                <View style={lb.sessionPill}>
                  <Ionicons name="calendar-outline" size={12} color={COLORS.brand} />
                  <Text style={lb.sessionPillText}>{photo.session_title}</Text>
                </View>
              )}
            </View>

            {/* Hashtag Badges */}
            {photo.tags && photo.tags.length > 0 && (
              <View style={lb.tagsContainer}>
                {photo.tags.map((t, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={lb.tagChip}
                    onPress={() => {
                      onClose();
                      onTagPress && onTagPress(t);
                    }}
                  >
                    <Text style={lb.tagChipText}>#{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
          <TouchableOpacity style={lb.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

function UploadSheet({ onClose, onUploaded }) {
  const kbHeight = useKeyboardHeight();
  const [image, setImage] = useState(null);
  const [caption, setCaption] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [uploadSessions, setUploadSessions] = useState([]);
  const [liveSession, setLiveSession] = useState(null);
  const [uploading, setUploading] = useState(false);
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 9, useNativeDriver: true }).start();

    apiFetch('/photos/upload-sessions/').then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        const all = data.sessions || [];
        const live = all.find(s => s.is_live) || null;
        setUploadSessions(all);
        setLiveSession(live);
        if (live) setSessionId(live.id);
      }
    }).catch(() => {});
  }, []);

  const pickImage = async () => {
    if (Platform.OS === 'ios') {
      // Using System Photo Picker directly (Android 13+ compliant)
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.75,
      base64: true,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      setImage(result.assets[0]);
    }
  };

  const toggleHashtag = (tag) => {
    if (caption.includes(tag)) {
      setCaption(caption.replace(tag, '').replace(/\s+/g, ' ').trim());
    } else {
      setCaption(prev => (prev ? `${prev.trim()} ${tag}` : tag));
    }
  };

  const submitRef = useRef(false);

  const submit = async () => {
    if (!image) { Alert.alert('Pick a photo first'); return; }
    if (uploading || submitRef.current) return;
    submitRef.current = true;
    setUploading(true);

    try {
      const payload = {
        caption: caption.trim(),
        session_id: sessionId || null,
        image_base64: image.base64 ? `data:image/jpeg;base64,${image.base64}` : null,
      };

      const res = await apiFetch('/photos/upload/', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      let data = {};
      try { data = await res.json(); } catch {}

      if (!res.ok) {
        Alert.alert('Upload Failed', data.error || 'Please check your connection and try again.');
        submitRef.current = false;
        setUploading(false);
        return;
      }

      onClose();
      onUploaded();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setTimeout(() => {
        Alert.alert(
          data.auto_approved ? '✅ Photo Live!' : '📤 Submitted!',
          data.message || 'Your photo has been uploaded.'
        );
      }, 300);
    } catch (e) {
      Alert.alert('Error', 'Upload failed. Please check connection and try again.');
      submitRef.current = false;
      setUploading(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={up.overlay}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
        <Animated.View style={[up.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: kbHeight > 0 ? kbHeight : SPACE.xl }}
          >
            <View style={up.handle} />
            <Text style={up.title}>Share a Photo</Text>

            <TouchableOpacity style={up.picker} onPress={pickImage} activeOpacity={0.85}>
              {image ? (
                <Image source={{ uri: image.uri }} style={up.preview} resizeMode="cover" />
              ) : (
                <View style={up.pickerEmpty}>
                  <Ionicons name="image-outline" size={36} color={COLORS.textTer} />
                  <Text style={up.pickerText}>Tap to pick a photo</Text>
                </View>
              )}
              {image && (
                <View style={up.pickerOverlay}>
                  <Ionicons name="pencil" size={20} color="#fff" />
                </View>
              )}
            </TouchableOpacity>

            <TextInput
              style={up.input}
              placeholder="Add a caption or #hashtags (type custom or pick below)…"
              placeholderTextColor={COLORS.textTer}
              value={caption}
              onChangeText={setCaption}
              maxLength={300}
              multiline
            />

            {/* Creative Hashtags Quick Chips */}
            <Text style={up.label}>Quick Hashtags</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: SPACE.xs, paddingBottom: SPACE.sm, alignItems: 'center' }}>
              {SUGGESTED_HASHTAGS.map(tag => {
                const active = caption.includes(tag);
                return (
                  <TouchableOpacity
                    key={tag}
                    style={[up.tagChip, active && up.tagChipActive]}
                    onPress={() => toggleHashtag(tag)}
                  >
                    <Text style={[up.tagChipText, active && up.tagChipTextActive]}>{tag}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={up.label}>Tag a session (optional)</Text>
            {liveSession && (
              <TouchableOpacity
                style={[up.liveChip, sessionId === liveSession.id && up.liveChipActive]}
                onPress={() => setSessionId(sessionId === liveSession.id ? null : liveSession.id)}
                activeOpacity={0.85}
              >
                <View style={up.liveDot} />
                <Text style={[up.liveChipText, sessionId === liveSession.id && up.liveChipTextActive]}
                  numberOfLines={1}>{liveSession.title}</Text>
                <View style={up.liveBadgeWrap}><Text style={up.liveBadge}>LIVE NOW</Text></View>
              </TouchableOpacity>
            )}

            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: SPACE.sm, paddingBottom: SPACE.xs, alignItems: 'center' }}>
              <TouchableOpacity
                style={[up.sessionChip, !sessionId && up.sessionChipActive]}
                onPress={() => setSessionId(null)}>
                <Text style={[up.sessionChipText, !sessionId && up.sessionChipTextActive]}>General Wall</Text>
              </TouchableOpacity>
              {uploadSessions.filter(s => !s.is_live).map(s => (
                <TouchableOpacity
                  key={s.id}
                  style={[up.sessionChip, sessionId === s.id && up.sessionChipActive]}
                  onPress={() => setSessionId(s.id)}>
                  <Text style={[up.sessionChipText, sessionId === s.id && up.sessionChipTextActive]}
                    numberOfLines={1}>{s.title}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={up.submitBtn} onPress={submit} activeOpacity={0.85} disabled={uploading}>
              <LinearGradient colors={[COLORS.brand, COLORS.brandDark]} style={up.submitGrad}>
                {uploading
                  ? <ActivityIndicator color="#fff" />
                  : <><Ionicons name="cloud-upload-outline" size={20} color="#fff" />
                     <Text style={up.submitText}>Upload Photo</Text></>}
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function PhotoThumb({ item, index, onPress, onDelete, showDelete }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1, duration: 320, delay: (index % 9) * 40,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, []);

  const approved = item.status === 'approved' || !item.status;
  const pending = item.status === 'pending';
  const rejected = item.status === 'rejected';

  return (
    <Animated.View style={{ opacity: anim, transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) }] }}>
      <TouchableOpacity
        style={[ph.thumb, { opacity: (pending || rejected) ? 0.55 : 1 }]}
        onPress={onPress}
        activeOpacity={0.88}
      >
        <Image source={{ uri: fixMediaUrl(item.image_url) }} style={ph.thumbImg} resizeMode="cover" />
        {pending && (
          <View style={ph.thumbOverlay}>
            <Ionicons name="time-outline" size={18} color="#fff" />
            <Text style={ph.thumbOverlayText}>Pending</Text>
          </View>
        )}
        {rejected && (
          <View style={[ph.thumbOverlay, { backgroundColor: 'rgba(239,68,68,0.7)' }]}>
            <Ionicons name="close-circle-outline" size={18} color="#fff" />
            <Text style={ph.thumbOverlayText}>Rejected</Text>
          </View>
        )}

        {/* Selfie Spot Banner on Thumb */}
        {!!item.selfie_spot_name && approved && (
          <View style={ph.selfieBadge}>
            <Ionicons name="sparkles" size={8} color="#fff" />
            <Text style={ph.selfieBadgeText} numberOfLines={1}>{item.selfie_spot_name}</Text>
          </View>
        )}

        {/* Session Badge */}
        {!!item.session_title && approved && !item.selfie_spot_name && (
          <View style={ph.thumbBadge}>
            <Ionicons name="calendar" size={9} color="#fff" />
          </View>
        )}

        {showDelete && (
          <TouchableOpacity
            style={ph.thumbDeleteBtn}
            onPress={(e) => { e.stopPropagation && e.stopPropagation(); onDelete && onDelete(); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash" size={12} color="#fff" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function PhotosScreen({ onBack, onOpenSelfieSpots }) {
  const [tab, setTab] = useState('wall');
  const [photos, setPhotos] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [activeTag, setActiveTag] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState(null);
  const [myPhotos, setMyPhotos] = useState([]);

  const fetchPhotos = useCallback(async (sessionId = null, wall = false, tag = null) => {
    try {
      let url = '/photos/gallery/';
      const params = [];
      if (sessionId) params.push(`session=${sessionId}`);
      else if (wall) params.push('wall=1');
      if (tag) params.push(`tag=${encodeURIComponent(tag)}`);
      if (params.length) url += `?${params.join('&')}`;

      const res = await apiFetch(url);
      if (!res.ok) return;
      const data = await res.json();
      setPhotos(data.photos || []);
      setAvailableTags(data.available_tags || []);
      setUploadOpen(data.upload_open || false);
    } catch (e) {
      console.log('fetchPhotos error', e);
    }
  }, []);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await apiFetch('/photos/sessions/');
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (e) {}
  }, []);

  const fetchMine = useCallback(async () => {
    try {
      const res = await apiFetch('/photos/mine/');
      if (res.ok) {
        const data = await res.json();
        setMyPhotos(data.photos || []);
      }
    } catch (e) {}
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      fetchPhotos(activeSession, tab === 'wall' && !activeSession && !activeTag, activeTag),
      fetchSessions(),
      fetchMine(),
    ]);
    setLoading(false);
    setRefreshing(false);
  }, [fetchPhotos, fetchSessions, fetchMine, activeSession, tab, activeTag]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const onTabChange = (t) => {
    setTab(t);
    setActiveSession(null);
    setActiveTag(null);
  };

  const onSessionSelect = (id) => {
    setActiveSession(id === activeSession ? null : id);
    setActiveTag(null);
    setTab('sessions');
  };

  const onTagSelect = (t) => {
    const nextTag = activeTag === t ? null : t;
    setActiveTag(nextTag);
    setActiveSession(null);
    fetchPhotos(null, false, nextTag);
  };

  const displayPhotos = tab === 'mine' ? myPhotos : photos;

  const deleteMyPhoto = async (id) => {
    Alert.alert('Delete Photo', 'Remove this photo?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          const res = await apiFetch(`/photos/mine/${id}/delete/`, { method: 'DELETE' });
          if (res.ok) fetchAll();
        } catch (e) {}
      }},
    ]);
  };

  const renderPhoto = ({ item, index }) => (
    <PhotoThumb
      item={item}
      index={index}
      showDelete={tab === 'mine'}
      onDelete={() => deleteMyPhoto(item.id)}
      onPress={() => {
        const approved = item.status === 'approved' || !item.status;
        if (approved) setLightboxPhoto(item);
      }}
    />
  );

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />

      <LinearGradient colors={[COLORS.brandDeep, COLORS.brand]} style={s.header}>
        <View style={s.headerBlob1} />
        <View style={s.headerBlob2} />
        <View style={s.topbar}>
          <TouchableOpacity onPress={onBack} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Photo Wall</Text>
          {uploadOpen ? (
            <TouchableOpacity style={s.uploadBtn} onPress={() => setShowUpload(true)}>
              <Ionicons name="camera" size={20} color="#fff" />
            </TouchableOpacity>
          ) : (
            <View style={[s.uploadBtn, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
              <Ionicons name="lock-closed" size={18} color="rgba(255,255,255,0.4)" />
            </View>
          )}
        </View>

        <View style={s.statusRow}>
          <View style={[s.statusDot, { backgroundColor: uploadOpen ? COLORS.success : '#94a3b8' }]} />
          <Text style={s.statusText}>{uploadOpen ? 'Uploads open' : 'Uploads closed'}</Text>
          <Text style={s.statusSep}>·</Text>
          <Text style={s.statusText}>{photos.length} photo{photos.length !== 1 ? 's' : ''}</Text>
        </View>

        {/* Selfie Spots Challenge Pill Banner */}
        {onOpenSelfieSpots && (
          <TouchableOpacity
            style={s.selfieChallengeBanner}
            activeOpacity={0.88}
            onPress={onOpenSelfieSpots}
          >
            <View style={s.selfieBannerLeft}>
              <Ionicons name="sparkles" size={16} color="#fde68a" />
              <Text style={s.selfieBannerTitle}>Campus Selfie Spots Challenge</Text>
            </View>
            <View style={s.selfieBannerRight}>
              <Text style={s.selfieBannerAction}>Explore Spots</Text>
              <Ionicons name="chevron-forward" size={14} color="#fff" />
            </View>
          </TouchableOpacity>
        )}

        <View style={s.tabRow}>
          {[
            { key: 'wall',     label: 'Wall',     icon: 'images-outline' },
            { key: 'sessions', label: 'Sessions', icon: 'calendar-outline' },
            { key: 'mine',     label: 'Mine',     icon: 'person-outline' },
          ].map(t => (
            <TouchableOpacity key={t.key} style={[s.tabBtn, tab === t.key && s.tabBtnOn]}
              onPress={() => onTabChange(t.key)} activeOpacity={0.85}>
              <Ionicons name={t.icon} size={15} color={tab === t.key ? '#fff' : 'rgba(255,255,255,0.55)'} />
              <Text style={[s.tabText, tab === t.key && s.tabTextOn]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      {/* Dynamic Hashtag Filters bar (Wall View) - ONLY displays tags that exist in DB photos */}
      {tab === 'wall' && availableTags.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.tagFilterContainer}
          style={[s.tagFilterBar, { flexGrow: 0 }]}
        >
          <TouchableOpacity
            style={[s.tagFilterChip, !activeTag && s.tagFilterChipActive]}
            onPress={() => onTagSelect(null)}
          >
            <Text style={[s.tagFilterChipText, !activeTag && s.tagFilterChipTextActive]}>All Tags</Text>
          </TouchableOpacity>
          {availableTags.map(t => {
            const isSelected = activeTag === t;
            return (
              <TouchableOpacity
                key={t}
                style={[s.tagFilterChip, isSelected && s.tagFilterChipActive]}
                onPress={() => onTagSelect(t)}
              >
                <Text style={[s.tagFilterChipText, isSelected && s.tagFilterChipTextActive]}>#{t}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Sessions filter row */}
      {tab === 'sessions' && sessions.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: PAD, gap: SPACE.sm, paddingVertical: SPACE.md, alignItems: 'center' }}
          style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: COLORS.border, flexGrow: 0 }}>
          <TouchableOpacity
            style={[sf.chip, !activeSession && sf.chipActive]}
            onPress={() => { setActiveSession(null); fetchPhotos(null, false); }}>
            <Text style={[sf.chipText, !activeSession && sf.chipTextActive]}>All</Text>
          </TouchableOpacity>
          {sessions.map(s2 => (
            <TouchableOpacity key={s2.id}
              style={[sf.chip, activeSession === s2.id && sf.chipActive,
                { borderColor: SESSION_TYPE_COLOR[s2.session_type] || COLORS.border }]}
              onPress={() => { onSessionSelect(s2.id); fetchPhotos(s2.id); }}>
              <Text style={[sf.chipText, activeSession === s2.id && sf.chipTextActive]}
                numberOfLines={1}>{s2.title}</Text>
              <View style={[sf.chipCount, { backgroundColor: SESSION_TYPE_COLOR[s2.session_type] || COLORS.brand }]}>
                <Text style={sf.chipCountText}>{s2.photo_count}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {loading ? (
        <View style={s.loadingWrap}>
          <PulsingDot color={COLORS.brand} size={11} />
          <Text style={s.loadingText}>Loading photos…</Text>
        </View>
      ) : displayPhotos.length === 0 ? (
        <View style={s.emptyWrap}>
          <View style={s.emptyIcon}>
            <Ionicons name="images-outline" size={38} color={COLORS.textTer} />
          </View>
          <Text style={s.emptyTitle}>
            {tab === 'mine' ? 'No uploads yet' : activeTag ? `No photos with #${activeTag}` : 'No photos here yet'}
          </Text>
          <Text style={s.emptyText}>
            {tab === 'mine'
              ? uploadOpen ? 'Be the first to share a photo!' : 'Uploads are currently closed.'
              : 'Photos will appear once approved by the admin.'}
          </Text>
          {tab === 'mine' && uploadOpen && (
            <TouchableOpacity style={s.emptyBtn} onPress={() => setShowUpload(true)}>
              <LinearGradient colors={[COLORS.brand, COLORS.brandDark]} style={s.emptyBtnGrad}>
                <Ionicons name="camera-outline" size={18} color="#fff" />
                <Text style={s.emptyBtnText}>Upload Photo</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={displayPhotos}
          keyExtractor={(item, i) => String(item.id || i)}
          numColumns={3}
          columnWrapperStyle={{ gap: SPACE.sm }}
          contentContainerStyle={{ padding: PAD, gap: SPACE.sm, paddingBottom: 120 }}
          renderItem={renderPhoto}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll();}} tintColor={COLORS.brand} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {uploadOpen && !loading && (
        <View style={s.fabWrap}>
          <TouchableOpacity onPress={() => setShowUpload(true)} activeOpacity={0.88}>
            <LinearGradient colors={[COLORS.brand, COLORS.brandDark]} style={s.fab}>
              <Ionicons name="camera" size={26} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {lightboxPhoto && (
        <Lightbox
          photo={lightboxPhoto}
          onClose={() => setLightboxPhoto(null)}
          onTagPress={(tag) => onTagSelect(tag)}
        />
      )}

      {showUpload && (
        <UploadSheet
          onClose={() => setShowUpload(false)}
          onUploaded={fetchAll}
        />
      )}
    </View>
  );
}

const lb = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  dismiss: { ...StyleSheet.absoluteFillObject },
  card: { width: W - 32, borderRadius: 24, overflow: 'hidden', backgroundColor: '#0f172a' },
  image: { width: '100%', height: W - 32, backgroundColor: '#1e293b' },
  meta: { padding: SPACE.lg },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, marginBottom: SPACE.xs },
  metaText: { fontSize: FONT.sm, fontWeight: FONT.w7, color: '#e2e8f0' },
  metaDot: { color: '#475569', fontSize: FONT.sm },
  metaTime: { fontSize: FONT.sm, color: '#64748b' },
  caption: { fontSize: FONT.md, color: '#cbd5e1', lineHeight: 22, marginTop: SPACE.xs },
  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.xs, marginTop: SPACE.sm },
  selfiePill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(236,72,153,0.18)', alignSelf: 'flex-start', paddingHorizontal: SPACE.sm + 2, paddingVertical: 5, borderRadius: RADIUS.full, borderWidth: 1, borderColor: 'rgba(236,72,153,0.3)' },
  selfiePillText: { fontSize: 11, fontWeight: FONT.w8, color: '#f472b6' },
  sessionPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.brandLight, alignSelf: 'flex-start', paddingHorizontal: SPACE.sm + 2, paddingVertical: 5, borderRadius: RADIUS.full },
  sessionPillText: { fontSize: 11, fontWeight: FONT.w7, color: COLORS.brand },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: SPACE.sm },
  tagChip: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  tagChipText: { fontSize: 11, fontWeight: FONT.w7, color: '#38bdf8' },
  closeBtn: { position: 'absolute', top: 14, right: 14, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
});

const up = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: PAD, paddingBottom: Platform.OS === 'ios' ? 40 : PAD,
    ...SHADOW.lg,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#e2e8f0', alignSelf: 'center', marginBottom: SPACE.lg },
  title: { fontSize: FONT.xl, fontWeight: FONT.w9, color: COLORS.text, marginBottom: SPACE.lg },
  picker: { height: 160, borderRadius: 20, overflow: 'hidden', backgroundColor: '#f8fafc', borderWidth:1.5, borderColor: COLORS.border, borderStyle: 'dashed', marginBottom: SPACE.md },
  pickerEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACE.sm },
  pickerText: { fontSize: FONT.sm, color: COLORS.textTer },
  preview: { width: '100%', height: '100%' },
  pickerOverlay: { position: 'absolute', bottom: 10, right: 10, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: SPACE.md, fontSize: FONT.sm, color: COLORS.text, marginBottom: SPACE.md, minHeight: 60, textAlignVertical: 'top' },
  label: { fontSize: 11, fontWeight: FONT.w8, color: COLORS.textTer, letterSpacing: 0.8, marginBottom: SPACE.xs, textTransform: 'uppercase' },

  tagChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: COLORS.border },
  tagChipActive: { backgroundColor: '#0284c7', borderColor: '#0284c7' },
  tagChipText: { fontSize: 11, fontWeight: FONT.w7, color: COLORS.textSec },
  tagChipTextActive: { color: '#fff', fontWeight: FONT.w8 },

  liveChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm + 2, borderRadius: RADIUS.lg, borderWidth: 1.5, borderColor: COLORS.rose, backgroundColor: 'rgba(236,72,153,0.08)', marginBottom: SPACE.sm },
  liveChipActive: { backgroundColor: COLORS.rose, borderColor: COLORS.rose },
  liveDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#ef4444' },
  liveChipText: { fontSize: FONT.xs, fontWeight: FONT.w8, color: COLORS.rose, flex: 1 },
  liveChipTextActive: { color: '#fff' },
  liveBadgeWrap: { backgroundColor: '#ef4444', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  liveBadge: { fontSize: 8, fontWeight: FONT.w9, color: '#fff' },

  sessionChip: { paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#f8fafc' },
  sessionChipActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  sessionChipText: { fontSize: FONT.xs, fontWeight: FONT.w7, color: COLORS.textSec },
  sessionChipTextActive: { color: '#fff' },
  submitBtn: { marginTop: SPACE.lg, borderRadius: 16, overflow: 'hidden' },
  submitGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.sm, paddingVertical: SPACE.lg + 2 },
  submitText: { fontSize: FONT.md, fontWeight: FONT.w8, color: '#fff' },
});

const ph = StyleSheet.create({
  thumb: { width: THUMB, height: THUMB, borderRadius: 14, overflow: 'hidden', backgroundColor: '#e2e8f0' },
  thumbImg: { width: '100%', height: '100%' },
  thumbOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', gap: 3 },
  thumbOverlayText: { fontSize: 9, fontWeight: FONT.w8, color: '#fff', letterSpacing: 0.5 },
  thumbBadge: { position: 'absolute', bottom: 5, right: 5, width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.brand, alignItems: 'center', justifyContent: 'center' },
  selfieBadge: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 4, paddingVertical: 3, backgroundColor: 'rgba(236,72,153,0.88)', borderBottomLeftRadius: 14, borderBottomRightRadius: 14 },
  selfieBadgeText: { fontSize: 7, fontWeight: FONT.w8, color: '#fff', flex: 1 },
  thumbDeleteBtn: { position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(239,68,68,0.85)', alignItems: 'center', justifyContent: 'center' },
});

const sf = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#f8fafc' },
  chipActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  chipText: { fontSize: FONT.xs, fontWeight: FONT.w7, color: COLORS.textSec, maxWidth: 120 },
  chipTextActive: { color: '#fff' },
  chipCount: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  chipCountText: { fontSize: 9, fontWeight: FONT.w8, color: '#fff' },
});

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f6fb' },
  header: { paddingTop: Platform.OS === 'ios' ? 54 : 44, paddingBottom: SPACE.md, overflow: 'hidden' },
  headerBlob1: { position: 'absolute', top: -40, right: -20, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.07)' },
  headerBlob2: { position: 'absolute', bottom: -30, left: -10, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(245,158,11,0.08)' },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: PAD, marginBottom: SPACE.sm },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FONT.xl, fontWeight: FONT.w8, color: '#fff', letterSpacing: -0.2 },
  uploadBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, paddingHorizontal: PAD, marginBottom: SPACE.sm },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: FONT.xs, color: 'rgba(255,255,255,0.7)', fontWeight: FONT.w6 },
  statusSep: { color: 'rgba(255,255,255,0.3)' },

  selfieChallengeBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(236,72,153,0.25)',
    marginHorizontal: PAD, marginBottom: SPACE.md,
    paddingVertical: 8, paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: 'rgba(236,72,153,0.4)',
  },
  selfieBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  selfieBannerTitle: { fontSize: 11, fontWeight: FONT.w8, color: '#fff' },
  selfieBannerRight: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  selfieBannerAction: { fontSize: 10, fontWeight: FONT.w7, color: '#fde68a' },

  tabRow: { flexDirection: 'row', gap: SPACE.sm, paddingHorizontal: PAD },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: SPACE.md, borderRadius: RADIUS.full, backgroundColor: 'rgba(255,255,255,0.10)' },
  tabBtnOn: { backgroundColor: 'rgba(255,255,255,0.2)' },
  tabText: { fontSize: FONT.xs, fontWeight: FONT.w7, color: 'rgba(255,255,255,0.6)' },
  tabTextOn: { color: '#fff' },

  tagFilterBar: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: COLORS.border, height: 48 },
  tagFilterContainer: { paddingHorizontal: PAD, gap: SPACE.xs, paddingVertical: SPACE.sm, alignItems: 'center'},
  tagFilterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: COLORS.border, alignSelf: 'center' },
  tagFilterChipActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  tagFilterChipText: { fontSize: 11, fontWeight: FONT.w7, color: COLORS.textSec },
  tagFilterChipTextActive: { color: '#fff' },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACE.md },
  loadingText: { fontSize: FONT.sm, color: COLORS.textSec },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: PAD * 2 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.brandLight, alignItems:'center', justifyContent: 'center', marginBottom: SPACE.lg },
  emptyTitle: { fontSize: FONT.xl, fontWeight: FONT.w8, color: COLORS.text, marginBottom: SPACE.sm, textAlign: 'center' },
  emptyText: { fontSize: FONT.sm, color: COLORS.textSec, textAlign: 'center', lineHeight: 21 },
  emptyBtn: { marginTop: SPACE.xl, borderRadius: 16, overflow: 'hidden' },
  emptyBtnGrad: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, paddingHorizontal: SPACE.xxl, paddingVertical: SPACE.lg },
  emptyBtnText: { fontSize: FONT.md, fontWeight: FONT.w8, color: '#fff' },
  fabWrap: { position: 'absolute', bottom: 32, right: PAD },
  fab: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', ...SHADOW.lg },
});
