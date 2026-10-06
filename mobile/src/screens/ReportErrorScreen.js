import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, FlatList,
  StyleSheet, Platform, Image, Alert, ActivityIndicator, Dimensions, Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, FONT, SPACE, RADIUS, SHADOW } from '../theme';
import { apiFetch } from '../api';
import { FadeIn } from '../components';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const CATEGORIES = [
  { key: 'ui_ux',         label: 'Screen / UI Glitch',        icon: 'phone-portrait-outline' },
  { key: 'backend_api',   label: 'Backend & Data Loading',   icon: 'server-outline' },
  { key: 'notification',  label: 'Push Notifications Issue',  icon: 'notifications-outline' },
  { key: 'network',       label: 'Network / Connectivity',    icon: 'wifi-outline' },
  { key: 'auth',          label: 'Login & Password Issue',    icon: 'lock-closed-outline' },
  { key: 'schedule_meal', label: 'Schedule / Meal Pass',      icon: 'restaurant-outline' },
  { key: 'other',         label: 'Other Technical Problem',   icon: 'help-circle-outline' },
];

export default function ReportErrorScreen({ tokens, user, onBack }) {
  const [activeTab, setActiveTab] = useState('submit'); // 'submit' | 'my_tickets'

  // Submission State
  const [category, setCategory] = useState('ui_ux');
  const [description, setDescription] = useState('');
  const [title, setTitle] = useState('');
  const [userPhoneInput, setUserPhoneInput] = useState(user?.phone || '');
  const [screenshots, setScreenshots] = useState([]); // [{ uri, base64 }]
  const [submitting, setSubmitting] = useState(false);

  // My Tickets State
  const [myTickets, setMyTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  // Fetch User's Submitted Tickets
  const fetchMyTickets = useCallback(async () => {
    setLoadingTickets(true);
    try {
      const res = await apiFetch('/error-reports/my/');
      const data = await res.json();
      if (data.success) {
        setMyTickets(data.reports || []);
      }
    } catch {
      /* silent */
    } finally {
      setLoadingTickets(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'my_tickets') {
      fetchMyTickets();
    }
  }, [activeTab, fetchMyTickets]);

  const pickImage = async () => {
    if (screenshots.length >= 4) {
      Alert.alert('Limit Reached', 'You can attach up to 4 screenshots per report.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.6,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const mimeType = asset.mimeType || asset.type || 'image/jpeg';
        const b64Data = asset.base64 ? `data:${mimeType};base64,${asset.base64}` : null;

        setScreenshots(prev => [...prev, {
          uri: asset.uri,
          base64: b64Data,
        }]);
      }
    } catch {
      Alert.alert('Image Picker Error', 'Could not open image gallery.');
    }
  };

  const removeImage = (index) => {
    setScreenshots(screenshots.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      Alert.alert('Missing Details', 'Please write a description of the error you encountered.');
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        title: title.trim() || description.trim().substring(0, 50),
        description: description.trim(),
        category: category,
        user_phone: userPhoneInput.trim() || user?.phone || '',
        device_info: {
          os: String(Platform.OS),
          os_version: String(Platform.Version),
          platform: 'React Native Expo SDK 57',
          screen_width: Math.round(SCREEN_WIDTH),
          screen_height: Math.round(SCREEN_HEIGHT),
          app_version: '1.0.0',
          user_email: user?.email || '',
          user_name: `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.email || '',
        },
        screenshots_base64: screenshots.map(s => s.base64).filter(Boolean),
      };

      const res = await apiFetch('/error-reports/submit/', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        Alert.alert(
          'Report Submitted 🚀',
          'Thank you! Your ticket has been logged. You can track its status and admin responses in the "My Bug Tickets" tab.',
          [
            {
              text: 'View My Tickets',
              onPress: () => {
                setDescription('');
                setTitle('');
                setScreenshots([]);
                setActiveTab('my_tickets');
              },
            },
          ]
        );
      } else {
        Alert.alert('Submission Failed', data.error || 'Could not submit your error report.');
      }
    } catch (e) {
      Alert.alert('Network Error', `Could not submit report. ${e?.message || ''}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Render Single Ticket Card
  const renderTicketCard = ({ item }) => {
    const isResolved = item.status === 'resolved';
    const isInProgress = item.status === 'in_progress';
    const isNew = item.status === 'new';

    return (
      <View style={s.ticketCard}>
        {/* Top Header */}
        <View style={s.ticketHeader}>
          <View style={{ flex: 1 }}>
            <Text style={s.ticketTitle}>{item.title}</Text>
            <Text style={s.ticketCat}>{item.category_display}</Text>
          </View>

          {/* Status Badge */}
          <View style={[
            s.statusBadge,
            isNew && { backgroundColor: '#fee2e2' },
            isInProgress && { backgroundColor: '#fef3c7' },
            isResolved && { backgroundColor: '#d1fae5' },
          ]}>
            <Text style={[
              s.statusBadgeText,
              isNew && { color: COLORS.error },
              isInProgress && { color: '#d97706' },
              isResolved && { color: COLORS.success },
            ]}>
              {item.status.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
        </View>

        {/* User Description */}
        <Text style={s.ticketDesc}>{item.description}</Text>

        {/* Screenshots */}
        {item.screenshots && item.screenshots.length > 0 && (
          <View style={s.shotsRow}>
            {item.screenshots.map((url) => (
              <TouchableOpacity key={url} onPress={() => setSelectedImage(url)} activeOpacity={0.8}>
                <Image source={{ uri: url }} style={s.shotThumb} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Admin Remarks Box */}
        {!!item.admin_notes ? (
          <View style={s.adminRemarksBox}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Ionicons name="chatbubble-ellipses" size={14} color={COLORS.brand} style={{ marginRight: 6 }} />
              <Text style={s.adminRemarksHeader}>ADMIN REMARKS &amp; RESOLUTION</Text>
            </View>
            <Text style={s.adminRemarksText}>{item.admin_notes}</Text>
          </View>
        ) : (
          <View style={s.pendingBox}>
            <Ionicons name="time-outline" size={13} color={COLORS.textTer} style={{ marginRight: 4 }} />
            <Text style={s.pendingText}>
              {isResolved
                ? 'Resolved by admin team.'
                : 'Pending admin review & resolution.'}
            </Text>
          </View>
        )}

        {/* Submitted Date Footer */}
        <Text style={s.ticketDate}>
          Submitted on {new Date(item.created_at).toLocaleDateString()} at {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  return (
    <View style={s.container}>
      {/* Image Zoom Modal */}
      <Modal visible={!!selectedImage} transparent animationType="fade" onRequestClose={() => setSelectedImage(null)}>
        <View style={s.imageModalBg}>
          <TouchableOpacity onPress={() => setSelectedImage(null)} style={s.closeModalBtn}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          {selectedImage && <Image source={{ uri: selectedImage }} style={s.fullModalImage} resizeMode="contain" />}
        </View>
      </Modal>

      {/* Screen Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Help &amp; Error Support</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Top Segmented Tabs */}
      <View style={s.tabBar}>
        <TouchableOpacity
          onPress={() => setActiveTab('submit')}
          style={[s.tabItem, activeTab === 'submit' && s.tabItemActive]}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle-outline" size={15} color={activeTab === 'submit' ? COLORS.brand : COLORS.textSec} style={{ marginRight: 6 }} />
          <Text style={[s.tabText, activeTab === 'submit' && s.tabTextActive]}>Report New Error</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('my_tickets')}
          style={[s.tabItem, activeTab === 'my_tickets' && s.tabItemActive]}
          activeOpacity={0.8}
        >
          <Ionicons name="list-circle-outline" size={15} color={activeTab === 'my_tickets' ? COLORS.brand : COLORS.textSec} style={{ marginRight: 6 }} />
          <Text style={[s.tabText, activeTab === 'my_tickets' && s.tabTextActive]}>
            My Bug Tickets {myTickets.length > 0 ? `(${myTickets.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'submit' ? (
        /* TAB 1: Submission Form */
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <FadeIn>
            <View style={s.infoBanner}>
              <Ionicons name="shield-checkmark" size={22} color={COLORS.brand} style={{ marginRight: 10 }} />
              <Text style={s.infoBannerText}>
                Encountering an issue? Mention details below. Your device specs &amp; phone contact will be attached for fast support response.
              </Text>
            </View>
          </FadeIn>

          {/* Category Picker */}
          <Text style={s.sectionLabel}>ISSUE CATEGORY</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.catScroll}>
            {CATEGORIES.map(c => {
              const active = category === c.key;
              return (
                <TouchableOpacity
                  key={c.key}
                  onPress={() => setCategory(c.key)}
                  style={[s.catPill, active && s.catPillActive]}
                  activeOpacity={0.8}
                >
                  <Ionicons name={c.icon} size={15} color={active ? '#fff' : COLORS.textSec} style={{ marginRight: 6 }} />
                  <Text style={[s.catPillText, active && s.catPillTextActive]}>{c.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Contact Phone Number */}
          <Text style={s.sectionLabel}>CONTACT PHONE NUMBER (FOR SUPPORT FOLLOW-UP)</Text>
          <TextInput
            style={s.input}
            placeholder="+91 XXXXX XXXXX"
            placeholderTextColor={COLORS.textTer}
            keyboardType="phone-pad"
            value={userPhoneInput}
            onChangeText={setUserPhoneInput}
          />

          {/* Summary Title */}
          <Text style={s.sectionLabel}>SUMMARY / TITLE (OPTIONAL)</Text>
          <TextInput
            style={s.input}
            placeholder="e.g. Schedule tab glitch on Day 2"
            placeholderTextColor={COLORS.textTer}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />

          {/* Description */}
          <Text style={s.sectionLabel}>DETAILED DESCRIPTION *</Text>
          <TextInput
            style={[s.input, s.textArea]}
            placeholder="Please describe what happened, what screen you were on, or any error message you noticed..."
            placeholderTextColor={COLORS.textTer}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            value={description}
            onChangeText={setDescription}
          />

          {/* Screenshots */}
          <Text style={s.sectionLabel}>ATTACH SCREENSHOTS (UP TO 4)</Text>
          <View style={s.imageGrid}>
            {screenshots.map((item, idx) => (
              <View key={item.uri || idx} style={s.imageThumbWrap}>
                <Image source={{ uri: item.uri }} style={s.imageThumb} />
                <TouchableOpacity onPress={() => removeImage(idx)} style={s.imageRemoveBtn}>
                  <Ionicons name="close" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
            {screenshots.length < 4 && (
              <TouchableOpacity onPress={pickImage} style={s.addImageBtn} activeOpacity={0.75}>
                <Ionicons name="camera-outline" size={26} color={COLORS.brand} />
                <Text style={s.addImageText}>Add Screenshot</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Submit */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting}
            style={[s.submitBtn, submitting && { opacity: 0.7 }]}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="paper-plane-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={s.submitBtnText}>Submit Error Report</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      ) : (
        /* TAB 2: My Reported Errors List */
        <View style={{ flex: 1 }}>
          {loadingTickets ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color={COLORS.brand} />
            </View>
          ) : (
            <FlatList
              data={myTickets}
              keyExtractor={item => item.id}
              renderItem={renderTicketCard}
              contentContainerStyle={{ padding: SPACE.lg, paddingBottom: 60 }}
              onRefresh={fetchMyTickets}
              refreshing={loadingTickets}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', paddingVertical: 50 }}>
                  <Ionicons name="document-text-outline" size={48} color={COLORS.textTer} style={{ opacity: 0.5, marginBottom: 10 }} />
                  <Text style={{ fontSize: FONT.sm, fontWeight: FONT.w7, color: COLORS.textSec }}>No Error Tickets Submitted Yet</Text>
                  <Text style={{ fontSize: FONT.xs, color: COLORS.textTer, textAlign: 'center', marginTop: 4, paddingHorizontal: 20 }}>
                    When you report a bug or glitch, your ticket and admin remarks will appear here.
                  </Text>
                  <TouchableOpacity onPress={() => setActiveTab('submit')} style={s.emptyBtn} activeOpacity={0.8}>
                    <Text style={s.emptyBtnText}>+ Submit an Error Report</Text>
                  </TouchableOpacity>
                </View>
              }
            />
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f9' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 54 : 24, paddingBottom: 14,
    paddingHorizontal: SPACE.lg, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' },
  headerTitle: { fontSize: FONT.md, fontWeight: FONT.w8, color: COLORS.text },

  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabItemActive: { borderBottomColor: COLORS.brand },
  tabText: { fontSize: 12, fontWeight: FONT.w6, color: COLORS.textSec },
  tabTextActive: { color: COLORS.brand, fontWeight: FONT.w8 },

  content: { padding: SPACE.lg, paddingBottom: 60 },

  infoBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.brandLight,
    padding: SPACE.md, borderRadius: 16, marginBottom: SPACE.lg,
    borderWidth: 1, borderColor: 'rgba(3,51,182,0.12)',
  },
  infoBannerText: { flex: 1, fontSize: 12, color: COLORS.brandDark, lineHeight: 17 },

  sectionLabel: { fontSize: 10, fontWeight: FONT.w8, color: COLORS.textTer, letterSpacing: 1.1, marginBottom: 8, marginTop: 12 },
  catScroll: { flexDirection: 'row', marginBottom: 16 },
  catPill: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.full,
    marginRight: 8, borderWidth: 1, borderColor: COLORS.border, ...SHADOW.sm,
  },
  catPillActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  catPillText: { fontSize: 12, fontWeight: FONT.w6, color: COLORS.textSec },
  catPillTextActive: { color: '#fff' },

  input: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: COLORS.border, fontSize: 14,
    color: COLORS.text, marginBottom: 8, ...SHADOW.sm,
  },
  textArea: { minHeight: 120 },

  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24, marginTop: 4 },
  imageThumbWrap: { width: 80, height: 80, borderRadius: 12, position: 'relative' },
  imageThumb: { width: 80, height: 80, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  imageRemoveBtn: {
    position: 'absolute', top: -5, right: -5, width: 22, height: 22,
    borderRadius: 11, backgroundColor: COLORS.error, alignItems: 'center',
    justifyContent: 'center', borderWidth: 1.5, borderColor: '#fff',
  },
  addImageBtn: {
    width: 80, height: 80, borderRadius: 12, borderStyle: 'dashed',
    borderWidth: 1.5, borderColor: COLORS.brand, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  addImageText: { fontSize: 9, fontWeight: FONT.w7, color: COLORS.brand, marginTop: 4, textAlign: 'center' },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.brand, height: 50, borderRadius: 16,
    marginTop: 10, ...SHADOW.brand,
  },
  submitBtnText: { fontSize: 15, fontWeight: FONT.w8, color: '#fff' },

  /* Ticket Cards in My Tickets Tab */
  ticketCard: { backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: COLORS.border, ...SHADOW.sm },
  ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  ticketTitle: { fontSize: FONT.base, fontWeight: FONT.w8, color: COLORS.text },
  ticketCat: { fontSize: 11, fontWeight: FONT.w6, color: COLORS.brand, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: '#f1f5f9' },
  statusBadgeText: { fontSize: 10, fontWeight: FONT.w8 },

  ticketDesc: { fontSize: 13, color: COLORS.textSec, lineHeight: 18, marginTop: 6, marginBottom: 10 },

  shotsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  shotThumb: { width: 64, height: 64, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border },

  adminRemarksBox: {
    backgroundColor: COLORS.brandLight, padding: 12, borderRadius: 12,
    borderLeftWidth: 3, borderLeftColor: COLORS.brand, marginTop: 4, marginBottom: 8,
  },
  adminRemarksHeader: { fontSize: 10, fontWeight: FONT.w8, color: COLORS.brand, letterSpacing: 0.8 },
  adminRemarksText: { fontSize: 12, color: COLORS.brandDark, fontWeight: FONT.w5, marginTop: 2, lineHeight: 17 },

  pendingBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', padding: 8, borderRadius: 8, marginTop: 4, marginBottom: 8 },
  pendingText: { fontSize: 11, color: COLORS.textTer },

  ticketDate: { fontSize: 10, color: COLORS.textTer, textAlign: 'right', marginTop: 4 },

  emptyBtn: { marginTop: 16, backgroundColor: COLORS.brandLight, paddingHorizontal: 18, paddingVertical: 10, borderRadius: RADIUS.full },
  emptyBtnText: { fontSize: 13, fontWeight: FONT.w7, color: COLORS.brand },

  imageModalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  closeModalBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  fullModalImage: { width: '90%', height: '80%' },
});
