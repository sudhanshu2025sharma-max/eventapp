import React, { useState, useRef, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Image,
  StatusBar, Platform, StyleSheet, Alert, Modal, Keyboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, SPACE, RADIUS, SHADOW, API_URL } from '../theme';
import { Card, FadeIn, GradientAvatar, PrimaryButton, Divider } from '../components';
import { useKeyboardHeight } from '../useKeyboard';

const PRESET_INTERESTS = [
  'AI & ML in Libraries',
  'ETD Repositories',
  'Open Access',
  'Scholarly Publishing',
  'Metadata & Ontologies',
  'Digital Preservation',
  'Information Retrieval',
  'Research Data Management',
  'Copyright & IP',
  'Generative AI & LLMs',
  'Bibliometrics',
  'Knowledge Graphs',
];

// ── Field ─────────────────────────────────────────────────────────────────────
function Field({ label, icon, value, onChange, placeholder, multiline, keyboardType, fieldRef, hint }) {
  return (
    <View style={st.fieldGroup} ref={fieldRef} collapsable={false}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: SPACE.sm }}>
        <Text style={st.label}>{label}</Text>
        {hint ? <Text style={st.fieldHint}>{hint}</Text> : null}
      </View>
      <View style={[st.fieldRow, multiline && { height: 95, alignItems: 'flex-start', paddingTop: SPACE.md }]}>
        <Ionicons name={icon} size={17} color={COLORS.textTer} style={{ marginRight: SPACE.sm, marginTop: multiline ? 2 : 0 }} />
        <TextInput
          style={[st.fieldInput, multiline && { textAlignVertical: 'top', height: 75 }]}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textTer}
          multiline={multiline}
          keyboardType={keyboardType || 'default'}
          autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
        />
      </View>
    </View>
  );
}

// ── TagInput with min 3, max 5 enforcement + 1-tap presets ───────────────────
function TagInput({ label, value, onChange }) {
  const [text, setText] = useState('');
  const tags = useMemo(() => (value || '').split(',').map(t => t.trim()).filter(Boolean), [value]);

  const addTag = (val) => {
    const candidate = (val || text).trim();
    if (!candidate) return;
    if (tags.length >= 5) {
      Alert.alert('Maximum Reached', 'You can select up to 5 research interests.');
      return;
    }
    const exists = tags.some(t => t.toLowerCase() === candidate.toLowerCase());
    if (!exists) {
      onChange([...tags, candidate].join(', '));
    }
    setText('');
  };

  const removeTag = (tag) => {
    onChange(tags.filter(t => t !== tag).join(', '));
  };

  const togglePreset = (preset) => {
    if (tags.some(t => t.toLowerCase() === preset.toLowerCase())) {
      removeTag(preset);
    } else {
      addTag(preset);
    }
  };

  const countColor = tags.length < 3 ? COLORS.warning : tags.length <= 5 ? COLORS.success : COLORS.error;

  return (
    <View style={st.fieldGroup}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: SPACE.sm }}>
        <Text style={st.label}>{label} *</Text>
        <Text style={[st.tagCounter, { color: countColor }]}>
          {tags.length}/5 (Min 3 required)
        </Text>
      </View>

      {/* Selected tags */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.xs, marginBottom: tags.length ? SPACE.sm : 0 }}>
        {tags.map(tag => (
          <TouchableOpacity key={tag} onPress={() => removeTag(tag)} style={st.tagActive} activeOpacity={0.75}>
            <Text style={st.tagTextActive}>{tag}</Text>
            <Ionicons name="close-circle" size={15} color={COLORS.brand} style={{ marginLeft: 4 }} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Custom input */}
      <View style={st.fieldRow}>
        <Ionicons name="pricetag-outline" size={17} color={COLORS.textTer} style={{ marginRight: SPACE.sm }} />
        <TextInput
          style={st.fieldInput}
          value={text}
          onChangeText={setText}
          placeholder="Type custom topic & tap Add..."
          placeholderTextColor={COLORS.textTer}
          onSubmitEditing={() => addTag(text)}
          returnKeyType="done"
          editable={tags.length < 5}
        />
        <TouchableOpacity
          onPress={() => addTag(text)}
          style={[st.addBtn, tags.length >= 5 && { opacity: 0.5 }]}
          disabled={tags.length >= 5 || !text.trim()}
        >
          <Text style={st.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* Preset Suggestions */}
      <Text style={st.presetLabel}>Suggested ETD & AI Topics (tap to add):</Text>
      <View style={st.presetWrap}>
        {PRESET_INTERESTS.map(preset => {
          const isSelected = tags.some(t => t.toLowerCase() === preset.toLowerCase());
          return (
            <TouchableOpacity
              key={preset}
              onPress={() => togglePreset(preset)}
              style={[st.presetChip, isSelected && st.presetChipActive]}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isSelected ? "checkmark-circle" : "add-circle-outline"}
                size={13}
                color={isSelected ? COLORS.brand : COLORS.textSec}
              />
              <Text style={[st.presetText, isSelected && st.presetTextActive]}>{preset}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ── Points modal ──────────────────────────────────────────────────────────────
function PointsModal({ visible, points, message, onDismiss }) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onDismiss}>
      <TouchableOpacity style={st.modalOverlay} activeOpacity={1} onPress={onDismiss}>
        <View style={st.modalCard}>
          <LinearGradient colors={[COLORS.brand, '#0448c8']} style={st.modalGlow} />
          <View style={st.modalTrophy}>
            <Ionicons name="trophy" size={40} color={COLORS.accent} />
          </View>
          <Text style={st.modalTitle}>Achievement Unlocked</Text>
          <Text style={st.modalPoints}>+{points} pts</Text>
          <Text style={st.modalMsg}>{message}</Text>
          <TouchableOpacity onPress={onDismiss} style={st.modalBtn} activeOpacity={0.8}>
            <Text style={st.modalBtnText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function EditProfileScreen({ user, tokens, onBack, onProfileUpdated }) {
  const [form, setForm] = useState({
    first_name:         user?.first_name || '',
    last_name:          user?.last_name  || '',
    phone:              user?.phone      || '',
    affiliation:        user?.affiliation || '',
    designation:        user?.designation || '',
    gender:             user?.gender     || '',
    bio:                user?.bio        || '',
    research_interests: user?.research_interests || '',
    linkedin_url:       user?.linkedin_url || '',
    show_phone:         user?.show_phone   ?? false,
    show_linkedin:      user?.show_linkedin ?? true,
  });
  const [photoUri, setPhotoUri]   = useState(user?.profile_photo_url || null);
  const [newPhoto, setNewPhoto]   = useState(null);
  const [saving, setSaving]       = useState(false);
  const [success, setSuccess]     = useState(false);
  const [pointsModal, setPointsModal] = useState({ visible: false, points: 0, message: '' });

  // Keyboard + scroll
  const kbHeight  = useKeyboardHeight();
  const scrollRef = useRef(null);

  const bioRef      = useRef(null);
  const phoneRef    = useRef(null);
  const linkedinRef = useRef(null);
  const affRef      = useRef(null);

  const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];
  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  // Mathematical profile completeness score (0 - 100%)
  const { scorePct, breakdown } = useMemo(() => {
    let score = 0;
    const items = [];

    // 1. Name (15%)
    if (form.first_name.trim() && form.last_name.trim()) {
      score += 15;
      items.push({ name: 'Full Name', done: true, pts: 15 });
    } else if (form.first_name.trim()) {
      score += 8;
      items.push({ name: 'Last Name', done: false, pts: 7 });
    } else {
      items.push({ name: 'Name', done: false, pts: 15 });
    }

    // 2. Photo (15%)
    if (photoUri || user?.profile_photo_url) {
      score += 15;
      items.push({ name: 'Profile Photo', done: true, pts: 15 });
    } else {
      items.push({ name: 'Profile Photo', done: false, pts: 15 });
    }

    // 3. Affiliation (15%)
    if (form.affiliation.trim().length >= 2) {
      score += 15;
      items.push({ name: 'Affiliation', done: true, pts: 15 });
    } else {
      items.push({ name: 'Affiliation', done: false, pts: 15 });
    }

    // 4. Designation (10%)
    if (form.designation.trim().length >= 2) {
      score += 10;
      items.push({ name: 'Designation', done: true, pts: 10 });
    } else {
      items.push({ name: 'Designation', done: false, pts: 10 });
    }

    // 5. Bio (15%) >= 20 characters
    const bioLen = form.bio.trim().length;
    if (bioLen >= 20) {
      score += 15;
      items.push({ name: 'Bio (20+ chars)', done: true, pts: 15 });
    } else if (bioLen > 0) {
      score += 5;
      items.push({ name: 'Bio too short (<20 chars)', done: false, pts: 10 });
    } else {
      items.push({ name: 'Bio', done: false, pts: 15 });
    }

    // 6. Research Interests (20%) - 3 to 5 tags
    const tags = form.research_interests.split(',').map(t => t.trim()).filter(Boolean);
    if (tags.length >= 3 && tags.length <= 5) {
      score += 20;
      items.push({ name: '3–5 Research Interests', done: true, pts: 20 });
    } else if (tags.length === 2) {
      score += 12;
      items.push({ name: 'Add 1 more interest', done: false, pts: 8 });
    } else if (tags.length === 1) {
      score += 6;
      items.push({ name: 'Add 2 more interests', done: false, pts: 14 });
    } else {
      items.push({ name: 'Research Interests (Min 3)', done: false, pts: 20 });
    }

    // 7. Contact/LinkedIn (10%)
    if (form.linkedin_url.trim().length >= 8 || form.phone.trim().length >= 6) {
      score += 10;
      items.push({ name: 'Contact / LinkedIn', done: true, pts: 10 });
    } else {
      items.push({ name: 'LinkedIn or Phone', done: false, pts: 10 });
    }

    return { scorePct: Math.min(100, score), breakdown: items };
  }, [form, photoUri, user]);

  const pickImage = async () => {
    try {
      const ImagePicker = require('expo-image-picker');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Grant photo library access to upload a profile picture.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (!result.canceled && result.assets?.[0]) {
        setPhotoUri(result.assets[0].uri);
        setNewPhoto(result.assets[0]);
      }
    } catch {
      Alert.alert('Photo Upload', 'Photo picker unavailable. Update from web.');
    }
  };

  const handleSave = async () => {
    if (!form.first_name.trim()) {
      Alert.alert('Required Field', 'First name is required.');
      return;
    }

    const tags = form.research_interests.split(',').map(t => t.trim()).filter(Boolean);
    if (tags.length < 3) {
      Alert.alert(
        'Research Interests Required',
        `Please select at least 3 research interests (currently selected: ${tags.length}). You can choose from the suggestions below.`
      );
      return;
    }
    if (tags.length > 5) {
      Alert.alert('Too Many Interests', 'Please select a maximum of 5 research interests.');
      return;
    }

    Keyboard.dismiss();
    setSaving(true);
    setSuccess(false);

    try {
      const formData = new FormData();
      Object.entries(form).forEach(([key, val]) => {
        formData.append(key, typeof val === 'boolean' ? (val ? 'true' : 'false') : (val || ''));
      });
      if (newPhoto) {
        const uri = newPhoto.uri;
        const ext = (uri.split('.').pop() || 'jpg').toLowerCase();
        formData.append('profile_photo', {
          uri,
          name: `profile.${ext}`,
          type: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
        });
      }

      const res = await fetch(`${API_URL}/auth/update-profile/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokens.access}`,
          Accept: 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(true);
        if (onProfileUpdated) onProfileUpdated(data.user);
        if (data.points_awarded) {
          setPointsModal({
            visible: true,
            points: data.points_awarded,
            message: data.points_message || 'Profile complete! Points added to leaderboard.',
          });
        }
        if (data.user?.profile_photo_url) setPhotoUri(data.user.profile_photo_url);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        Alert.alert('Error', data.message || 'Failed to update profile.');
      }
    } catch {
      Alert.alert('Error', 'Connection failed. Please try again.');
    }
    setSaving(false);
  };

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" />
      <PointsModal
        visible={pointsModal.visible}
        points={pointsModal.points}
        message={pointsModal.message}
        onDismiss={() => setPointsModal(p => ({ ...p, visible: false }))}
      />
      <View style={{ flex: 1, backgroundColor: COLORS.bg }}>

        {/* ── Header ── */}
        <LinearGradient colors={['#0333b6', '#0448c8']} style={st.header}>
          <View style={st.headerRow}>
            <TouchableOpacity onPress={onBack} style={st.backBtn} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={22} color={COLORS.textInverse} />
            </TouchableOpacity>
            <Text style={st.headerTitle}>Edit Profile</Text>
            <View style={{ width: 40 }} />
          </View>

          <TouchableOpacity onPress={pickImage} activeOpacity={0.8} style={st.photoWrap}>
            {photoUri
              ? <Image source={{ uri: photoUri }} style={st.photo} />
              : <GradientAvatar name={form.first_name || user?.email || '?'} size={96} radius={30} />
            }
            <View style={st.cameraIcon}>
              <Ionicons name="camera" size={16} color={COLORS.textInverse} />
            </View>
          </TouchableOpacity>
          <Text style={st.photoHint}>Tap to change photo (+15%)</Text>

          {/* Progress Bar with mathematical breakdown */}
          <View style={st.progressWrap}>
            <View style={st.progressRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons
                  name={scorePct >= 85 ? "shield-checkmark" : "analytics-outline"}
                  size={14}
                  color={scorePct >= 85 ? COLORS.success : COLORS.accent}
                />
                <Text style={st.progressLabel}>Profile Strength</Text>
              </View>
              <Text style={[st.progressPct, scorePct >= 85 && { color: '#86efac' }]}>{scorePct}%</Text>
            </View>
            <View style={st.progressBar}>
              <View style={[
                st.progressFill,
                { width: `${scorePct}%`, backgroundColor: scorePct >= 85 ? '#86efac' : COLORS.accent }
              ]} />
            </View>
            <Text style={st.progressSub}>
              {scorePct >= 85 ? '🌟 Profile is complete! 50 leaderboard points unlocked.' : 'Complete key fields to reach 100% and earn +50 points!'}
            </Text>
          </View>
        </LinearGradient>

        <View style={{ backgroundColor: '#0448c8', height: 22 }}>
          <View style={st.curve} />
        </View>

        {/* ── Scrollable form ── */}
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={[
            st.scrollContent,
            kbHeight > 0 && { paddingBottom: kbHeight + 120 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {success && (
            <FadeIn>
              <View style={st.successBanner}>
                <Ionicons name="checkmark-circle" size={18} color={COLORS.success} style={{ marginRight: SPACE.sm }} />
                <Text style={st.successText}>Profile updated successfully!</Text>
              </View>
            </FadeIn>
          )}

          {/* Basic Info */}
          <Card style={st.section} shadow="sm">
            <View style={st.sectionHeader}>
              <Ionicons name="person-outline" size={18} color={COLORS.brand} />
              <Text style={st.sectionTitle}>Basic Information</Text>
            </View>
            <Divider style={{ marginBottom: SPACE.lg }} />

            <View style={{ flexDirection: 'row', gap: SPACE.md }}>
              <View style={{ flex: 1 }}>
                <Field label="First Name *" icon="text-outline" value={form.first_name} onChange={v => set('first_name', v)} placeholder="First name" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Last Name" icon="text-outline" value={form.last_name} onChange={v => set('last_name', v)} placeholder="Last name" />
              </View>
            </View>

            <Text style={st.label}>Gender</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, marginBottom: SPACE.lg }}>
              {GENDERS.map(g => (
                <TouchableOpacity key={g} onPress={() => set('gender', g)}
                  style={[st.genderChip, form.gender === g && st.genderChipActive]} activeOpacity={0.7}>
                  <Text style={[st.genderText, form.gender === g && st.genderTextActive]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Field label="Designation / Title" icon="briefcase-outline"
              value={form.designation} onChange={v => set('designation', v)}
              placeholder="e.g. Associate Professor / Research Scholar" hint="+10%" />
            <Field fieldRef={phoneRef} label="Phone Number" icon="call-outline"
              value={form.phone} onChange={v => set('phone', v)}
              placeholder="Mobile number with country code" keyboardType="phone-pad" />
          </Card>

          {/* Academic & Research */}
          <Card style={st.section} shadow="sm">
            <View style={st.sectionHeader}>
              <Ionicons name="school-outline" size={18} color={COLORS.brand} />
              <Text style={st.sectionTitle}>Academic &amp; Research</Text>
            </View>
            <Divider style={{ marginBottom: SPACE.lg }} />

            <Field fieldRef={affRef} label="Affiliation / Organisation *" icon="business-outline"
              value={form.affiliation} onChange={v => set('affiliation', v)}
              placeholder="e.g. IIT Delhi / Library of Congress" hint="+15%" />

            <Field fieldRef={bioRef} label="Bio (min 20 characters)" icon="document-text-outline"
              value={form.bio} onChange={v => set('bio', v)}
              placeholder="Write a concise overview of your research, institutional role, and interests..."
              multiline hint={form.bio.trim().length >= 20 ? 'Verified (+15%)' : `${form.bio.trim().length}/20 chars`} />

            <TagInput
              label="Research Interests (3 to 5 Mandatory)"
              value={form.research_interests}
              onChange={v => set('research_interests', v)}
            />
          </Card>

          {/* Social & Privacy */}
          <Card style={st.section} shadow="sm">
            <View style={st.sectionHeader}>
              <Ionicons name="link-outline" size={18} color={COLORS.brand} />
              <Text style={st.sectionTitle}>Social &amp; Privacy</Text>
            </View>
            <Divider style={{ marginBottom: SPACE.lg }} />

            <Field fieldRef={linkedinRef} label="LinkedIn Profile" icon="logo-linkedin"
              value={form.linkedin_url} onChange={v => set('linkedin_url', v)}
              placeholder="https://linkedin.com/in/yourprofile" hint="+10%" />

            <View style={st.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={st.toggleLabel}>Show phone in directory</Text>
                <Text style={st.toggleSub}>Visible only to checked-in attendees</Text>
              </View>
              <TouchableOpacity onPress={() => set('show_phone', !form.show_phone)}
                style={[st.toggle, form.show_phone && st.toggleOn]}>
                <View style={[st.toggleDot, form.show_phone && st.toggleDotOn]} />
              </TouchableOpacity>
            </View>

            <View style={[st.toggleRow, { borderBottomWidth: 0 }]}>
              <View style={{ flex: 1 }}>
                <Text style={st.toggleLabel}>Show LinkedIn on profile</Text>
                <Text style={st.toggleSub}>Allows attendees to connect on LinkedIn</Text>
              </View>
              <TouchableOpacity onPress={() => set('show_linkedin', !form.show_linkedin)}
                style={[st.toggle, form.show_linkedin && st.toggleOn]}>
                <View style={[st.toggleDot, form.show_linkedin && st.toggleDotOn]} />
              </TouchableOpacity>
            </View>
          </Card>

          <PrimaryButton label={saving ? 'Saving Changes…' : 'Save Changes'} onPress={handleSave} loading={saving} style={{ marginBottom: SPACE.sm }} />
          <TouchableOpacity onPress={onBack} style={st.cancelBtn} activeOpacity={0.7}>
            <Text style={st.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  header:       { paddingTop: Platform.OS === 'ios' ? 58 : 46, paddingBottom: SPACE.xl, paddingHorizontal: SPACE.xl, alignItems: 'center' },
  headerRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: SPACE.lg },
  backBtn:      { width: 40, height: 40, borderRadius: RADIUS.md, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { fontSize: FONT.lg, fontWeight: FONT.w7, color: COLORS.textInverse },
  photoWrap:    { position: 'relative', marginBottom: SPACE.xs },
  photo:        { width: 96, height: 96, borderRadius: 30, borderWidth: 3, borderColor: 'rgba(255,255,255,0.25)' },
  cameraIcon:   { position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.brand, borderWidth: 3, borderColor: COLORS.textInverse, alignItems: 'center', justifyContent: 'center' },
  photoHint:    { fontSize: FONT.xs, color: 'rgba(255,255,255,0.70)', marginTop: 4 },
  progressWrap: { width: '100%', marginTop: SPACE.md, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: RADIUS.lg, padding: SPACE.md },
  progressRow:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel:{ fontSize: FONT.xs, color: 'rgba(255,255,255,0.85)', fontWeight: FONT.w7 },
  progressPct:  { fontSize: FONT.xs, color: COLORS.accent, fontWeight: FONT.w9 },
  progressBar:  { height: 6, backgroundColor: 'rgba(255,255,255,0.20)', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: COLORS.accent, borderRadius: 3 },
  progressSub:  { fontSize: 10, color: 'rgba(255,255,255,0.70)', marginTop: 6 },
  curve:        { flex: 1, backgroundColor: COLORS.bg, borderTopLeftRadius: RADIUS.xxxl, borderTopRightRadius: RADIUS.xxxl },
  scrollContent:{ paddingHorizontal: SPACE.xl, paddingTop: SPACE.lg, paddingBottom: 160 },
  successBanner:{ flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.successLight, padding: SPACE.md, borderRadius: RADIUS.md, marginBottom: SPACE.lg },
  successText:  { fontSize: FONT.sm, color: COLORS.success, fontWeight: FONT.w6 },
  section:      { padding: SPACE.lg, marginBottom: SPACE.lg },
  sectionHeader:{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.sm },
  sectionTitle: { fontSize: FONT.md, fontWeight: FONT.w7, color: COLORS.text },
  fieldGroup:   { marginBottom: SPACE.lg },
  label:        { fontSize: FONT.sm, fontWeight: FONT.w6, color: COLORS.textSec },
  fieldHint:    { fontSize: 10, fontWeight: FONT.w7, color: COLORS.brand },
  fieldRow:     { flexDirection: 'row', alignItems: 'center', height: 50, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.lg, backgroundColor: COLORS.bg, paddingHorizontal: SPACE.md },
  fieldInput:   { flex: 1, fontSize: FONT.base, color: COLORS.text },
  genderChip:   { paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, borderRadius: RADIUS.full, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.bg },
  genderChipActive: { borderColor: COLORS.brand, backgroundColor: COLORS.brandLight },
  genderText:   { fontSize: FONT.sm, fontWeight: FONT.w5, color: COLORS.textSec },
  genderTextActive: { color: COLORS.brand, fontWeight: FONT.w7 },
  tagCounter:   { fontSize: 11, fontWeight: FONT.w7 },
  tagActive:    { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.brandLight, paddingHorizontal: SPACE.md, paddingVertical: 6, borderRadius: RADIUS.full, borderWidth: 1, borderColor: 'rgba(3,51,182,0.15)' },
  tagTextActive:{ fontSize: FONT.xs, fontWeight: FONT.w7, color: COLORS.brand },
  addBtn:       { paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, backgroundColor: COLORS.brandLight, borderRadius: RADIUS.md },
  addBtnText:   { fontSize: FONT.sm, fontWeight: FONT.w7, color: COLORS.brand },
  presetLabel:  { fontSize: 11, fontWeight: FONT.w7, color: COLORS.textTer, marginTop: SPACE.md, marginBottom: SPACE.xs },
  presetWrap:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  presetChip:   { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  presetChipActive: { backgroundColor: COLORS.brandLight, borderColor: COLORS.brand },
  presetText:   { fontSize: 11, color: COLORS.textSec, fontWeight: FONT.w5 },
  presetTextActive: { color: COLORS.brand, fontWeight: FONT.w7 },
  toggleRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACE.md, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  toggleLabel:  { fontSize: FONT.sm, fontWeight: FONT.w6, color: COLORS.text },
  toggleSub:    { fontSize: FONT.xs, color: COLORS.textTer, marginTop: 2 },
  toggle:       { width: 48, height: 28, borderRadius: 14, backgroundColor: COLORS.border, justifyContent: 'center', padding: 3 },
  toggleOn:     { backgroundColor: COLORS.brand },
  toggleDot:    { width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.textInverse, ...SHADOW.sm },
  toggleDotOn:  { alignSelf: 'flex-end' },
  cancelBtn:    { alignItems: 'center', paddingVertical: SPACE.md },
  cancelText:   { fontSize: FONT.sm, fontWeight: FONT.w6, color: COLORS.textTer },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: SPACE.xl },
  modalCard:    { backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl, padding: SPACE.xxl, alignItems: 'center', width: '100%', maxWidth: 320, overflow: 'hidden' },
  modalGlow:    { position: 'absolute', top: -60, left: -30, right: -30, height: 120, borderRadius: 60, opacity: 0.15 },
  modalTrophy:  { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.accentLight, alignItems: 'center', justifyContent: 'center', marginBottom: SPACE.lg },
  modalTitle:   { fontSize: FONT.xl, fontWeight: FONT.w8, color: COLORS.text, marginBottom: SPACE.sm },
  modalPoints:  { fontSize: FONT.hero, fontWeight: FONT.w9, color: COLORS.brand, marginBottom: SPACE.sm },
  modalMsg:     { fontSize: FONT.sm, color: COLORS.textSec, textAlign: 'center', marginBottom: SPACE.xl, lineHeight: 20 },
  modalBtn:     { backgroundColor: COLORS.brand, paddingHorizontal: SPACE.xxl, paddingVertical: SPACE.md, borderRadius: RADIUS.lg },
  modalBtnText: { fontSize: FONT.md, fontWeight: FONT.w7, color: COLORS.textInverse },
});
