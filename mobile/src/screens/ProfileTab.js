import SupportModal from './SupportModal';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Platform, Image, Modal, Share, Linking, Alert, ActivityIndicator, TextInput, KeyboardAvoidingView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, SPACE, RADIUS, SHADOW, TOP, API_URL, API_HEADERS, fixMediaUrl } from '../theme';
import { GradientAvatar, FadeIn, IconBox, Divider } from '../components';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Interactive Certificate Modal ─────────────────────────────────────────────
function CertificateModal({ visible, user, onDismiss }) {
  if (!user) return null;
  const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
  const regId = user.registration_id || `ETD-2026-${String(user.id || '').substring(0, 6).toUpperCase()}`;
  const roleDisplay = (user.role || 'participant').replace('_', ' ').toUpperCase();

  const handleShareCertificate = async () => {
    try {
      await Share.share({
        message: `🎓 ETD 2026 Certificate of Participation

This certifies that ${fullName} has participated in the 27th International Symposium on Electronic Theses and Dissertations (ETD 2026) at IIT Delhi.

Verification ID: ${regId}
https://etd2026.iitd.ac.in/`,
      });
    } catch { /* silent */ }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" presentationStyle="overFullScreen" onRequestClose={onDismiss}>
      <View style={cert.overlay}>
        <View style={cert.card}>
          {/* Header foil */}
          <LinearGradient colors={['#0F172A', '#0333b6']} style={cert.header}>
            <View style={cert.sealRing}>
              <Ionicons name="ribbon" size={28} color="#fbbf24" />
            </View>
            <Text style={cert.headerOrg}>INDIAN INSTITUTE OF TECHNOLOGY DELHI</Text>
            <Text style={cert.headerConf}>ETD 2026 SYMPOSIUM</Text>
            <Text style={cert.headerTheme}>"ETDs in the Age of AI: Shaping the Future of Open Knowledge"</Text>
          </LinearGradient>

          {/* Certificate Body */}
          <View style={cert.body}>
            <Text style={cert.kicker}>CERTIFICATE OF PARTICIPATION</Text>
            <Text style={cert.presentedText}>This certificate is proudly presented to</Text>
            <Text style={cert.nameText} numberOfLines={2}>{fullName}</Text>
            {!!user.affiliation && (
              <Text style={cert.affText} numberOfLines={2}>{user.affiliation}</Text>
            )}

            <View style={cert.roleBadge}>
              <Text style={cert.roleBadgeText}>{roleDisplay}</Text>
            </View>

            <Text style={cert.descText}>
              for active participation and valuable scholarly contributions in the 27th International Symposium held at IIT Delhi on October 23–25, 2026.
            </Text>

            <View style={cert.dividerLine} />

            {/* Verification & Signatures */}
            <View style={cert.metaRow}>
              <View>
                <Text style={cert.metaLabel}>VERIFICATION ID</Text>
                <Text style={cert.metaVal}>{regId}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={cert.metaLabel}>DATE ISSUED</Text>
                <Text style={cert.metaVal}>Oct 25, 2026</Text>
              </View>
            </View>

            {/* Signature blocks */}
            <View style={cert.sigRow}>
              <View style={cert.sigBlock}>
                <View style={cert.sigLine} />
                <Text style={cert.sigName}>Organizing Chair</Text>
                <Text style={cert.sigTitle}>ETD 2026, IIT Delhi</Text>
              </View>
              <View style={cert.sigBlock}>
                <View style={cert.sigLine} />
                <Text style={cert.sigName}>NDLTD Executive</Text>
                <Text style={cert.sigTitle}>Global Committee</Text>
              </View>
            </View>
          </View>

          {/* Action buttons */}
          <View style={cert.actions}>
            <TouchableOpacity onPress={handleShareCertificate} style={cert.shareBtn} activeOpacity={0.85}>
              <Ionicons name="share-social-outline" size={18} color="#fff" />
              <Text style={cert.shareBtnText}>Share Certificate</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onDismiss} style={cert.closeBtn} activeOpacity={0.75} hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}>
              <Text style={cert.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const cert = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: SPACE.md },
  card: { width: '100%', maxWidth: 360, backgroundColor: '#FFFFFF', borderRadius: 24, overflow: 'hidden', ...SHADOW.xl },
  header: { paddingVertical: SPACE.lg, paddingHorizontal: SPACE.md, alignItems: 'center' },
  sealRing: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(251,191,36,0.18)', borderWidth: 1.5, borderColor: '#fbbf24', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  headerOrg: { fontSize: 9, fontWeight: FONT.w8, color: 'rgba(255,255,255,0.75)', letterSpacing: 1.2, textAlign: 'center' },
  headerConf: { fontSize: FONT.md, fontWeight: FONT.w9, color: '#FFFFFF', letterSpacing: 0.8, marginTop: 2, textAlign: 'center' },
  headerTheme: { fontSize: 9, color: 'rgba(255,255,255,0.65)', textAlign: 'center', fontStyle: 'italic', marginTop: 3 },
  body: { paddingHorizontal: SPACE.lg, paddingTop: SPACE.md, paddingBottom: SPACE.sm, alignItems: 'center' },
  kicker: { fontSize: 11, fontWeight: FONT.w9, color: COLORS.brand, letterSpacing: 1.5, marginBottom: 4 },
  presentedText: { fontSize: 10, color: COLORS.textTer, marginBottom: 4 },
  nameText: { fontSize: FONT.lg, fontWeight: FONT.w9, color: COLORS.text, textAlign: 'center' },
  affText: { fontSize: FONT.xs, color: COLORS.textSec, textAlign: 'center', marginTop: 2 },
  roleBadge: { backgroundColor: COLORS.brandLight, paddingHorizontal: SPACE.md, paddingVertical: 3, borderRadius: RADIUS.full, marginTop: 8, borderWidth: 1, borderColor: 'rgba(3,51,182,0.12)' },
  roleBadgeText: { fontSize: 9, fontWeight: FONT.w8, color: COLORS.brand, letterSpacing: 0.8 },
  descText: { fontSize: 10, color: COLORS.textSec, textAlign: 'center', marginTop: 10, lineHeight: 14 },
  dividerLine: { width: '100%', height: 1, backgroundColor: '#f1f5f9', marginVertical: SPACE.md },
  metaRow: { width: '100%', flexDirection: 'row', justifyContent: 'space-between' },
  metaLabel: { fontSize: 9.5, fontWeight: FONT.w8, color: COLORS.textTer, letterSpacing: 0.8 },
  metaVal: { fontSize: 10, fontWeight: FONT.w7, color: COLORS.text, marginTop: 1 },
  sigRow: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACE.md },
  sigBlock: { width: '44%', alignItems: 'center' },
  sigLine: { width: '100%', height: 1, backgroundColor: COLORS.textTer, marginBottom: 4 },
  sigName: { fontSize: 9.5, fontWeight: FONT.w7, color: COLORS.text },
  sigTitle: { fontSize: 9, color: COLORS.textTer },
  actions: { padding: SPACE.md, backgroundColor: '#f8fafc', borderTopWidth: 1, borderTopColor: '#f1f5f9', gap: SPACE.xs },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: COLORS.brand, height: 44, borderRadius: RADIUS.md },
  shareBtnText: { fontSize: FONT.sm, fontWeight: FONT.w7, color: '#fff' },
  closeBtn: { alignItems: 'center', justifyContent: 'center', height: 44 },
  closeBtnText: { fontSize: FONT.xs, fontWeight: FONT.w6, color: COLORS.textTer },
});

// ── Blocked Accounts Modal ────────────────────────────────────────────────────
function BlockedUsersModal({ visible, tokens, onDismiss }) {
  const [blockedList, setBlockedList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [unblockingId, setUnblockingId] = useState(null);

  const fetchBlocked = useCallback(async () => {
    if (!tokens?.access) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/chat/blocked/`, {
        headers: { ...API_HEADERS, Authorization: `Bearer ${tokens.access}` },
      });
      const data = await res.json();
      setBlockedList(data.blocked || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [tokens]);

  useEffect(() => {
    if (visible) {
      fetchBlocked();
    }
  }, [visible, fetchBlocked]);

  const handleUnblock = (person) => {
    Alert.alert(
      'Unblock Attendee',
      `Are you sure you want to unblock ${person.name || person.email}? They will be visible again in attendee directories and will be able to send you messages and connection requests.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          style: 'default',
          onPress: async () => {
            setUnblockingId(person.id);
            try {
              const res = await fetch(`${API_URL}/chat/unblock/`, {
                method: 'POST',
                headers: { ...API_HEADERS, Authorization: `Bearer ${tokens.access}` },
                body: JSON.stringify({ user_id: person.id }),
              });
              const data = await res.json();
              if (data.success) {
                setBlockedList(prev => prev.filter(b => b.id !== person.id));
                await AsyncStorage.multiRemove(['net_attendees', 'net_speakers', 'net_discover']).catch(() => {});
                Alert.alert('Attendee Unblocked', `${person.name || 'User'} has been unblocked.`);
              } else {
                Alert.alert('Error', data.error || 'Failed to unblock attendee.');
              }
            } catch {
              Alert.alert('Error', 'Network error while attempting to unblock.');
            } finally {
              setUnblockingId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" presentationStyle="overFullScreen" onRequestClose={onDismiss}>
      <View style={blk.overlay}>
        <View style={blk.card}>
          {/* Header */}
          <View style={blk.header}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={blk.iconRing}>
                  <Ionicons name="ban" size={17} color="#dc2626" />
                </View>
                <Text style={blk.title}>Blocked Accounts</Text>
              </View>
              <Text style={blk.subtitle}>
                Blocked accounts cannot send you messages or appear in attendee lists.
              </Text>
            </View>
            <TouchableOpacity onPress={onDismiss} style={blk.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={COLORS.textSec} />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <View style={blk.body}>
            {loading ? (
              <View style={blk.centerBox}>
                <ActivityIndicator size="small" color={COLORS.brand} />
                <Text style={blk.loadingText}>Loading blocked accounts…</Text>
              </View>
            ) : blockedList.length === 0 ? (
              <View style={blk.centerBox}>
                <View style={blk.emptyIconCircle}>
                  <Ionicons name="shield-checkmark" size={32} color="#10b981" />
                </View>
                <Text style={blk.emptyTitle}>No Blocked Accounts</Text>
                <Text style={blk.emptySub}>
                  You haven't blocked any attendees. When you block someone from a conversation, they will appear here so you can unblock them at any time.
                </Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: SPACE.md }}>
                {blockedList.map((person, idx) => (
                  <View key={person.id || idx} style={blk.row}>
                    <View style={blk.avatarWrap}>
                      {person.profile_photo_url ? (
                        <Image source={{ uri: fixMediaUrl(person.profile_photo_url) }} style={blk.avatar} />
                      ) : (
                        <GradientAvatar name={person.name || person.email} size={42} radius={14} />
                      )}
                    </View>
                    <View style={{ flex: 1, marginRight: SPACE.sm }}>
                      <Text style={blk.personName} numberOfLines={1}>{person.name || person.email}</Text>
                      {person.affiliation ? (
                        <Text style={blk.personSub} numberOfLines={1}>{person.affiliation}</Text>
                      ) : (
                        <Text style={blk.personSub} numberOfLines={1}>{person.email}</Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={blk.unblockBtn}
                      onPress={() => handleUnblock(person)}
                      disabled={unblockingId === person.id}
                      activeOpacity={0.75}
                    >
                      <Text style={blk.unblockBtnText}>
                        {unblockingId === person.id ? 'Unblocking…' : 'Unblock'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Footer */}
          <View style={blk.footer}>
            <TouchableOpacity onPress={onDismiss} style={blk.doneBtn} activeOpacity={0.85}>
              <Text style={blk.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const blk = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '82%',
    minHeight: '42%',
    paddingTop: SPACE.md,
    ...SHADOW.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: SPACE.xl,
    paddingBottom: SPACE.md,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  iconRing: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: FONT.md,
    fontWeight: FONT.w8,
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 11.5,
    color: COLORS.textTer,
    marginTop: 4,
    lineHeight: 16,
  },
  closeBtn: {
    padding: 4,
    marginLeft: SPACE.sm,
  },
  body: {
    paddingHorizontal: SPACE.xl,
    paddingTop: SPACE.md,
    maxHeight: 380,
  },
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACE.xxl,
  },
  loadingText: {
    fontSize: FONT.xs,
    color: COLORS.textTer,
    marginTop: SPACE.sm,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACE.md,
  },
  emptyTitle: {
    fontSize: FONT.md,
    fontWeight: FONT.w8,
    color: COLORS.text,
  },
  emptySub: {
    fontSize: 12,
    color: COLORS.textTer,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    paddingHorizontal: SPACE.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACE.md,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  avatarWrap: {
    marginRight: SPACE.md,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
  },
  personName: {
    fontSize: FONT.sm,
    fontWeight: FONT.w7,
    color: COLORS.text,
  },
  personSub: {
    fontSize: 11,
    color: COLORS.textTer,
    marginTop: 2,
  },
  unblockBtn: {
    paddingHorizontal: SPACE.md,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  unblockBtnText: {
    fontSize: 11.5,
    fontWeight: FONT.w7,
    color: COLORS.brand,
  },
  footer: {
    paddingHorizontal: SPACE.xl,
    paddingVertical: SPACE.md,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#f8fafc',
  },
  doneBtn: {
    height: 46,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    fontSize: FONT.sm,
    fontWeight: FONT.w7,
    color: '#FFFFFF',
  },
});

// ── Delete Account Modal (Reason Picker) ──────────────────────────────────────
const DELETE_REASONS = [
  { key: 'not_useful',     icon: 'thumbs-down-outline', label: 'App is not useful for me' },
  { key: 'privacy',        icon: 'lock-closed-outline', label: 'Privacy concerns' },
  { key: 'too_many_notifs',icon: 'notifications-off-outline', label: 'Too many notifications' },
  { key: 'conference_over',icon: 'calendar-outline',    label: 'Conference is over' },
  { key: 'other',          icon: 'ellipsis-horizontal-outline', label: 'Other reason' },
];

function DeleteAccountModal({ visible, tokens, onDismiss, onSubmitted }) {
  const [selectedReason, setSelectedReason] = useState(null);
  const [detail, setDetail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const resetAndClose = () => {
    setSelectedReason(null);
    setDetail('');
    setSubmitting(false);
    onDismiss();
  };

  const submit = async () => {
    if (!selectedReason) {
      Alert.alert('Select a Reason', 'Please tell us why you are leaving.');
      return;
    }
    if (selectedReason.key === 'other' && detail.trim().length < 5) {
      Alert.alert('Please Elaborate', 'Kindly write at least a few words about your reason.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/auth/delete-account/`, {
        method: 'POST',
        headers: {
          ...API_HEADERS,
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens?.access}`,
        },
        body: JSON.stringify({
          reason: selectedReason.label,
          reason_detail: detail.trim(),
        }),
      });
      const data = await res.json();

      if (data.success) {
        setSubmitting(false);
        Alert.alert(
          'Request Submitted',
          'Your deletion request has been sent to the administrator. You will be logged out now. Admin review typically takes up to 48 hours.',
          [{ text: 'OK', onPress: () => { resetAndClose(); onSubmitted && onSubmitted(); } }]
        );
      } else {
        setSubmitting(false);
        Alert.alert('Error', data.error || 'Failed to submit deletion request.');
      }
    } catch (e) {
      setSubmitting(false);
      Alert.alert('Error', 'Network error while submitting deletion request.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" presentationStyle="overFullScreen" onRequestClose={resetAndClose}>
      <KeyboardAvoidingView
        style={del.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : -80}
      >
        <View style={del.card}>
          <View style={del.header}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={del.iconRing}>
                  <Ionicons name="trash-outline" size={17} color="#dc2626" />
                </View>
                <Text style={del.title}>Request Account Deletion</Text>
              </View>
              <Text style={del.subtitle}>
                Your request will be sent to the administrator for review. Once approved, your account will be permanently deleted within 48 hours.
              </Text>
            </View>
            <TouchableOpacity onPress={resetAndClose} style={del.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={COLORS.textSec} />
            </TouchableOpacity>
          </View>

          <ScrollView style={del.body} showsVerticalScrollIndicator={false}>
            <Text style={del.sectionLabel}>Why are you leaving? (Required)</Text>

            {DELETE_REASONS.map((r) => {
              const active = selectedReason?.key === r.key;
              return (
                <TouchableOpacity
                  key={r.key}
                  onPress={() => setSelectedReason(r)}
                  activeOpacity={0.75}
                  style={[del.reasonRow, active && del.reasonRowActive]}
                >
                  <View style={[del.reasonIcon, active && del.reasonIconActive]}>
                    <Ionicons name={r.icon} size={16} color={active ? '#fff' : COLORS.brand} />
                  </View>
                  <Text style={[del.reasonLabel, active && { color: COLORS.brand, fontWeight: FONT.w7 }]}>{r.label}</Text>
                  {active && <Ionicons name="checkmark-circle" size={18} color={COLORS.brand} />}
                </TouchableOpacity>
              );
            })}

            {selectedReason?.key === 'other' && (
              <View style={del.textAreaWrap}>
                <Text style={del.sectionLabel}>Please elaborate</Text>
                <View style={del.textAreaBox}>
                  <Text style={{ color: COLORS.textTer, fontSize: FONT.xs, marginBottom: 4 }}>Tell us more (minimum 5 characters)</Text>
                  <TextInput
                    value={detail}
                    onChangeText={setDetail}
                    multiline
                    numberOfLines={4}
                    placeholder="Your feedback helps us improve..."
                    placeholderTextColor={COLORS.textTer}
                    style={del.textArea}
                  />
                </View>
              </View>
            )}

            {selectedReason && selectedReason.key !== 'other' && (
              <View style={del.textAreaWrap}>
                <Text style={del.sectionLabel}>Additional comments (Optional)</Text>
                <View style={del.textAreaBox}>
                  <TextInput
                    value={detail}
                    onChangeText={setDetail}
                    multiline
                    numberOfLines={3}
                    placeholder="Any extra context? (optional)"
                    placeholderTextColor={COLORS.textTer}
                    style={del.textArea}
                  />
                </View>
              </View>
            )}
          </ScrollView>

          <View style={del.footer}>
            <TouchableOpacity onPress={resetAndClose} style={del.cancelBtn} activeOpacity={0.75} disabled={submitting}>
              <Text style={del.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={submit} style={[del.submitBtn, submitting && { opacity: 0.6 }]} activeOpacity={0.85} disabled={submitting}>
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="send-outline" size={15} color="#fff" />
                  <Text style={del.submitBtnText}>Submit Request</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const del = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  card: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '88%', minHeight: '55%', paddingTop: SPACE.md, ...SHADOW.xl },
  header: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: SPACE.xl, paddingBottom: SPACE.md, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  iconRing: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: FONT.md, fontWeight: FONT.w8, color: COLORS.text },
  subtitle: { fontSize: 11.5, color: COLORS.textTer, marginTop: 4, lineHeight: 16 },
  closeBtn: { padding: 4, marginLeft: SPACE.sm },
  body: { paddingHorizontal: SPACE.xl, paddingTop: SPACE.md },
  sectionLabel: { fontSize: 11, fontWeight: FONT.w8, color: COLORS.textSec, letterSpacing: 0.6, marginBottom: SPACE.sm, marginTop: SPACE.xs },
  reasonRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACE.md, paddingHorizontal: SPACE.md, borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 14, marginBottom: SPACE.xs + 2, gap: SPACE.md, backgroundColor: '#fff' },
  reasonRowActive: { borderColor: COLORS.brand, backgroundColor: COLORS.brandLight },
  reasonIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: COLORS.brandLight, alignItems: 'center', justifyContent: 'center' },
  reasonIconActive: { backgroundColor: COLORS.brand },
  reasonLabel: { flex: 1, fontSize: FONT.sm, color: COLORS.text, fontWeight: FONT.w5 },
  textAreaWrap: { marginTop: SPACE.md },
  textAreaBox: { backgroundColor: '#f8fafc', borderRadius: 14, padding: SPACE.md, borderWidth: 1, borderColor: '#e2e8f0' },
  textArea: { fontSize: FONT.sm, color: COLORS.text, minHeight: 70, textAlignVertical: 'top', fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' },
  footer: { flexDirection: 'row', paddingHorizontal: SPACE.xl, paddingVertical: SPACE.md, borderTopWidth: 1, borderTopColor: '#f1f5f9', backgroundColor: '#f8fafc', gap: SPACE.md },
  cancelBtn: { flex: 1, height: 46, borderRadius: RADIUS.md, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { fontSize: FONT.sm, fontWeight: FONT.w7, color: COLORS.textSec },
  submitBtn: { flex: 1.4, flexDirection: 'row', gap: 6, height: 46, borderRadius: RADIUS.md, backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { fontSize: FONT.sm, fontWeight: FONT.w7, color: '#fff' },
});

// ── Main Profile Tab Component ────────────────────────────────────────────────
export default function ProfileTab({
  user,
  tokens,
  onLogout,
  onEditProfile,
  onChangePassword,
  onForgotPassword,
  onOpenNotifications,
  onOpenChats,
  onOpenRecap,
  onOpenLeaderboard,
  onOpenSchedule,
  onOpenStaffTeam,
  onOpenReportError,
  onOpenChatRoom,
  onOpenCertificates,
}) {
  const [stats, setStats] = useState({ points: 0, rank: 0 });
  const [connections, setConnections] = useState(0);
  const [showCert, setShowCert] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showMissingModal, setShowMissingModal] = useState(false);
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const fetchStats = useCallback(async () => {
    if (!tokens?.access) return;
    const auth = { ...API_HEADERS, Authorization: `Bearer ${tokens.access}` };
    try {
      const [lb, conn] = await Promise.all([
        fetch(`${API_URL}/leaderboard/my/`, { headers: auth }),
        fetch(`${API_URL}/chat/connections/count/`, { headers: auth }),
      ]);
      const lbData = await lb.json();
      const connData = await conn.json();
      setStats({ points: lbData.total_points || 0, rank: lbData.rank || 0 });
      setConnections(connData.count || 0);
    } catch { /* silent */ }
  }, [tokens]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const interests = useMemo(
    () => (user.research_interests || '').split(',').map(t => t.trim()).filter(Boolean),
    [user.research_interests]
  );

  // Exact profile score math
  const { scorePct, missingFields } = useMemo(() => {
    let score = 0;
    const missing = [];

    if (user.first_name && user.last_name) score += 15;
    else if (user.first_name) { score += 8; missing.push('Last Name (+7%)'); }
    else missing.push('Full Name (+15%)');

    if (user.profile_photo_url) score += 15;
    else missing.push('Profile Photo (+15%)');

    if ((user.affiliation || '').trim().length >= 2) score += 15;
    else missing.push('Affiliation (+15%)');

    if ((user.designation || '').trim().length >= 2) score += 10;
    else missing.push('Designation (+10%)');

    const bioLen = (user.bio || '').trim().length;
    if (bioLen >= 20) score += 15;
    else if (bioLen > 0) { score += 5; missing.push('Bio >= 20 characters (+10%)'); }
    else missing.push('Short Bio (+15%)');

    if (interests.length >= 3 && interests.length <= 5) score += 20;
    else if (interests.length === 2) { score += 12; missing.push('1 More Research Interest (+8%)'); }
    else if (interests.length === 1) { score += 6; missing.push('2 More Research Interests (+14%)'); }
    else missing.push('3 to 5 Research Interests (+20%)');

    if ((user.linkedin_url || '').trim().length >= 8 || (user.phone || '').trim().length >= 6) score += 10;
    else missing.push('LinkedIn or Phone (+10%)');

    return { scorePct: Math.min(100, score), missingFields: missing };
  }, [user, interests]);

  const hasInterestsIncomplete = interests.length < 3;

  const handleDeleteAccount = () => {
    setShowDeleteModal(true);
  };

  const MENU = [
    {
      section: 'Account & Security',
      items: [
        { icon: 'person-outline',        label: 'Edit Profile',    sub: 'Update personal & academic info', onPress: onEditProfile },
        { icon: 'notifications-outline', label: 'Notifications',   sub: 'Updates & announcements',         onPress: onOpenNotifications },
        // { icon: 'lock-closed-outline',   label: 'Change Password', sub: 'Update your login password',       onPress: onChangePassword },
        { icon: 'lock-closed-outline',      label: 'Change Password', sub: 'Reset via OTP sent to your email', onPress: onForgotPassword },
        {
          icon: 'ban-outline',
          label: 'Blocked Accounts',
          sub: 'Manage blocked users & unblock',
          onPress: () => setShowBlockedModal(true),
        },
        
        // Guideline 5.1.1(v): Account deletion only required when user self-registration is enabled in app.
        // For admin-provisioned symposium accounts, this is commented out so it won't appear on screen.
        {
          icon: 'trash-outline',
          label: 'Request Account Deletion',
          sub: 'Submit deletion request to admin',
          color: COLORS.error,
          bg: '#fee2e2',
          onPress: handleDeleteAccount
        },
        
      ]
    },
    {
      section: 'Conference Activity',
      items: [
        { icon: 'sparkles-outline',      label: 'My Conference Memory', sub: 'Your personalized recap & highlights', onPress: onOpenRecap },
        { icon: 'bar-chart-outline',     label: 'Leaderboard & Points', sub: `${stats.points} pts earned (Rank #${stats.rank || '—'})`, onPress: onOpenLeaderboard },
        { icon: 'chatbubbles-outline',   label: 'Networking & Chats',   sub: `${connections} direct connections`,    onPress: onOpenChats },
        { icon: 'calendar-outline',      label: 'Conference Schedule',  sub: 'Explore sessions & bookmark talks',    onPress: onOpenSchedule },
      ]
    },
    {
      section: 'Support & Info',
      items: [
        { icon: 'bug-outline',           label: 'Report an Error', sub: 'Submit bug details & screenshots to admin', onPress: onOpenReportError },
        { icon: 'people-outline',        label: 'Support & Help', sub: 'Central Library & Committee Leaders', onPress: () => setShowSupportModal(true) },
        { icon: 'shield-checkmark-outline', label: 'Privacy Policy', sub: 'https://etd2026.iitd.ac.in/app-privacy-policy/', onPress: () => Linking.openURL('https://etd2026.iitd.ac.in/app-privacy-policy/').catch(() => {}) },
        { icon: 'document-text-outline', label: 'Account Deletion Policy', sub: 'https://etd2026.iitd.ac.in/app-account-deletion/', onPress: () => Linking.openURL('https://etd2026.iitd.ac.in/app-account-deletion/').catch(() => {}) },
        { icon: 'globe-outline',         label: 'Official Conference Website', sub: 'https://etd2026.iitd.ac.in',     onPress: () => Linking.openURL('https://etd2026.iitd.ac.in/') },
      ]
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: '#f0f4f9' }}>
      <CertificateModal visible={showCert} user={user} onDismiss={() => setShowCert(false)} />
      <SupportModal visible={showSupportModal} onDismiss={() => setShowSupportModal(false)} onOpenChatRoom={onOpenChatRoom} />
      <BlockedUsersModal visible={showBlockedModal} tokens={tokens} onDismiss={() => setShowBlockedModal(false)} />
      <DeleteAccountModal
        visible={showDeleteModal}
        tokens={tokens}
        onDismiss={() => setShowDeleteModal(false)}
        onSubmitted={onLogout}
      />

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={p.hero}>
          <LinearGradient colors={['#0333b6', '#022a8f']} style={StyleSheet.absoluteFillObject} />
          <View style={p.blob} />
          <FadeIn>
            <View style={{ position: 'relative', alignSelf: 'center', marginBottom: SPACE.md }}>
              {user.profile_photo_url
                ? <Image source={{ uri: fixMediaUrl(user.profile_photo_url) }} style={p.photo} />
                : <GradientAvatar name={user.first_name || user.email} size={92} radius={30}
                    style={{ borderWidth: 3, borderColor: 'rgba(255,255,255,0.35)' }} />}
              <TouchableOpacity onPress={onEditProfile} style={p.photoBadge} activeOpacity={0.8}>
                <Ionicons name="pencil" size={13} color="#fff" />
              </TouchableOpacity>
            </View>

            <Text style={p.name}>{user.first_name} {user.last_name}</Text>
            {user.designation ? <Text style={p.designation}>{user.designation}</Text> : null}
            <Text style={p.email}>{user.email}</Text>

            <View style={p.rolePill}>
              <Text style={p.rolePillText}>{(user.role || 'participant').replace('_', ' ').toUpperCase()}</Text>
              {user.affiliation ? (
                <>
                  <View style={p.pillSep} />
                  <Text style={p.pillAff} numberOfLines={1}>{user.affiliation}</Text>
                </>
              ) : null}
            </View>
          </FadeIn>
        </View>

        <View style={p.body}>

          {/* Mandatory Research Interests Warning Banner */}
          {hasInterestsIncomplete && (
            <FadeIn>
              <TouchableOpacity onPress={onEditProfile} style={p.warnBanner} activeOpacity={0.88}>
                <View style={p.warnIconWrap}>
                  <Ionicons name="alert-circle" size={24} color={COLORS.warning} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={p.warnTitle}>Research Interests Incomplete</Text>
                  <Text style={p.warnSub}>
                    You have {interests.length} of 3–5 required research areas. Add them to enable attendee matching & unlock full profile points!
                  </Text>
                  <View style={p.warnActionRow}>
                    <Text style={p.warnActionText}>Add Research Interests Now →</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </FadeIn>
          )}

          {/* Stats Bar */}
          <FadeIn delay={60}>
            <View style={p.statsRow}>
              {[
                { label: 'POINTS',  value: String(stats.points), icon: 'flash', color: COLORS.brand },
                { label: 'RANK',    value: stats.rank > 0 ? `#${stats.rank}` : '—', icon: 'trophy', color: '#d97706' },
                { label: 'CONNECTS',value: String(connections), icon: 'people', color: COLORS.teal },
                { label: 'SCORE',   value: `${scorePct}%`, icon: 'shield-checkmark', color: scorePct >= 85 ? COLORS.success : COLORS.accent },
              ].map(st => (
                <View key={st.label} style={p.statPill}>
                  <Ionicons name={st.icon} size={14} color={st.color} style={{ marginBottom: 2 }} />
                  <Text style={p.statPillValue}>{st.value}</Text>
                  <Text style={p.statPillLabel}>{st.label}</Text>
                </View>
              ))}
            </View>
          </FadeIn>

          {/* Profile Strength Widget */}
          <FadeIn delay={100}>
            <View style={p.strengthCard}>
              <View style={p.strengthTop}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="pie-chart-outline" size={16} color={COLORS.brand} />
                  <Text style={p.strengthTitle}>Profile Completeness Score</Text>
                </View>
                <Text style={[p.strengthPct, scorePct >= 85 && { color: COLORS.success }]}>{scorePct}%</Text>
              </View>

              <View style={p.strengthBarBg}>
                <View style={[
                  p.strengthBarFill,
                  { width: `${scorePct}%`, backgroundColor: scorePct >= 85 ? COLORS.success : COLORS.accent }
                ]} />
              </View>

              {missingFields.length > 0 ? (
                <View style={p.missingBox}>
                  <Text style={p.missingHead}>Remaining items for +50 pts:</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                    {missingFields.map(mf => (
                      <TouchableOpacity key={mf} onPress={onEditProfile} style={p.missingChip} activeOpacity={0.7}>
                        <Ionicons name="add-circle" size={12} color={COLORS.brand} />
                        <Text style={p.missingChipText}>{mf}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : (
                <View style={p.completeBadge}>
                  <Ionicons name="checkmark-done-circle" size={18} color={COLORS.success} />
                  <Text style={p.completeText}>100% Complete! Full profile points awarded.</Text>
                </View>
              )}
            </View>
          </FadeIn>

          {/* Research Interests Display */}
          {interests.length > 0 && (
            <FadeIn delay={140}>
              <View style={p.card}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACE.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm }}>
                    <Ionicons name="flask-outline" size={16} color={COLORS.brand} />
                    <Text style={p.cardTitle}>Research Interests ({interests.length}/5)</Text>
                  </View>
                  <TouchableOpacity onPress={onEditProfile} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={p.cardAction}>Edit</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.xs }}>
                  {interests.map(tag => (
                    <View key={tag} style={p.tag}>
                      <Ionicons name="pricetag" size={11} color={COLORS.brand} style={{ marginRight: 4 }} />
                      <Text style={p.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </FadeIn>
          )}


          {/* Quick Shortcuts */}
          <FadeIn delay={180}>
            <View style={p.quickGrid}>
              <TouchableOpacity onPress={onOpenCertificates} style={p.quickCard} activeOpacity={0.8}>
                <LinearGradient colors={['#fef3c7', '#fde68a']} style={p.quickIconBg}>
                  <Ionicons name="ribbon" size={20} color="#b45309" />
                </LinearGradient>
                <Text style={p.quickTitle}>My Certificate</Text>
                <Text style={p.quickSub}>Verified PDF</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={onOpenRecap} style={p.quickCard} activeOpacity={0.8}>
                <LinearGradient colors={[COLORS.brandLight, '#dbeafe']} style={p.quickIconBg}>
                  <Ionicons name="sparkles" size={20} color={COLORS.brand} />
                </LinearGradient>
                <Text style={p.quickTitle}>My Recap</Text>
                <Text style={p.quickSub}>Conference memory</Text>
              </TouchableOpacity>
            </View>
          </FadeIn>

          {/* Menu sections */}
          {MENU.map((sec, si) => (
            <FadeIn key={sec.section} delay={220 + si * 60}>
              <Text style={p.secLabel}>{sec.section.toUpperCase()}</Text>
              <View style={p.card}>
                {sec.items.map((item, ii) => (
                  <React.Fragment key={item.label}>
                    <TouchableOpacity
                      style={p.menuRow}
                      activeOpacity={0.7}
                      onPress={item.onPress || (() => Alert.alert(item.label, 'This section is active.'))}
                    >
                      <IconBox
                        name={item.icon}
                        size={17}
                        color={item.color || COLORS.brand}
                        bg={item.bg || COLORS.brandLight}
                        boxSize={38}
                        radius={RADIUS.md}
                        style={{ marginRight: SPACE.md }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={[p.menuLabel, item.color && { color: item.color }]}>{item.label}</Text>
                        <Text style={p.menuSub}>{item.sub}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={15} color={COLORS.border} />
                    </TouchableOpacity>
                    {ii < sec.items.length - 1 && <Divider style={{ marginLeft: SPACE.md + 38 + SPACE.md }} />}
                  </React.Fragment>
                ))}
              </View>
            </FadeIn>
          ))}

          {/* Sign out */}
          <FadeIn delay={400}>
            <TouchableOpacity style={p.logout} onPress={onLogout} activeOpacity={0.75}>
              <Ionicons name="log-out-outline" size={18} color={COLORS.error} />
              <Text style={p.logoutText}>Sign Out</Text>
            </TouchableOpacity>
            <Text style={p.ver}>ETD 2026  ·  IIT Delhi  ·  v1.0</Text>
          </FadeIn>
          <View style={{ height: 120 }} />
        </View>
      </ScrollView>
    </View>
  );
}

const p = StyleSheet.create({
  hero: {
    paddingTop: TOP + 8,
    paddingBottom: SPACE.xxl, paddingHorizontal: SPACE.xl,
    backgroundColor: COLORS.brand, alignItems: 'center', overflow: 'hidden',
  },
  blob: {
    position: 'absolute', width: 220, height: 220, borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.06)', top: -80, right: -60,
  },
  photo: { width: 92, height: 92, borderRadius: 30, borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)' },
  photoBadge: { position: 'absolute', bottom: -2, right: -2, width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.brand, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: FONT.xl, fontWeight: FONT.w9, color: '#fff', textAlign: 'center', letterSpacing: -0.3 },
  designation: { fontSize: FONT.sm, color: 'rgba(255,255,255,0.85)', marginTop: 2, textAlign: 'center' },
  email: { fontSize: FONT.xs, color: 'rgba(255,255,255,0.6)', marginTop: 4, textAlign: 'center' },
  rolePill: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: SPACE.md, backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: SPACE.md, paddingVertical: 5, borderRadius: RADIUS.full,
  },
  rolePillText: { fontSize: 10, fontWeight: FONT.w8, color: '#fff', letterSpacing: 0.5 },
  pillSep: { width: 1, height: 12, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: SPACE.sm },
  pillAff: { fontSize: FONT.xs, color: 'rgba(255,255,255,0.85)', maxWidth: 180 },

  body: { paddingHorizontal: SPACE.xl, paddingTop: SPACE.lg },

  warnBanner: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#fffbeb', borderWidth: 1.5, borderColor: '#fde68a',
    borderRadius: 20, padding: SPACE.md, marginBottom: SPACE.lg, ...SHADOW.sm,
  },
  warnIconWrap: { marginRight: SPACE.sm, marginTop: 2 },
  warnTitle: { fontSize: FONT.sm, fontWeight: FONT.w8, color: '#92400e' },
  warnSub: { fontSize: 11, color: '#78350f', marginTop: 2, lineHeight: 16 },
  warnActionRow: { marginTop: 6 },
  warnActionText: { fontSize: 11, fontWeight: FONT.w8, color: COLORS.brand },

  statsRow: { flexDirection: 'row', gap: SPACE.xs + 2, marginBottom: SPACE.lg },
  statPill: {
    flex: 1, alignItems: 'center', paddingVertical: SPACE.md,
    backgroundColor: '#FFFFFF', borderRadius: 18,
    borderWidth: 1, borderColor: '#e2e8f0', ...SHADOW.sm,
  },
  statPillValue: { fontSize: FONT.md, fontWeight: FONT.w9, color: COLORS.text, marginTop: 2 },
  statPillLabel: { fontSize: 9.5, fontWeight: FONT.w8, color: COLORS.textTer, letterSpacing: 0.8, marginTop: 2 },

  strengthCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: SPACE.lg,
    borderWidth: 1, borderColor: '#e2e8f0', marginBottom: SPACE.lg, ...SHADOW.sm,
  },
  strengthTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  strengthTitle: { fontSize: FONT.xs, fontWeight: FONT.w7, color: COLORS.text },
  strengthPct: { fontSize: FONT.sm, fontWeight: FONT.w9, color: COLORS.accent },
  strengthBarBg: { height: 8, backgroundColor: '#f1f5f9', borderRadius: 4, overflow: 'hidden' },
  strengthBarFill: { height: '100%', borderRadius: 4 },
  missingBox: { marginTop: SPACE.sm },
  missingHead: { fontSize: 10, fontWeight: FONT.w7, color: COLORS.textTer },
  missingChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.brandLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.full },
  missingChipText: { fontSize: 10, fontWeight: FONT.w7, color: COLORS.brand },
  completeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  completeText: { fontSize: 11, fontWeight: FONT.w7, color: COLORS.success },

  quickGrid: { flexDirection: 'row', gap: SPACE.md, marginBottom: SPACE.lg },
  quickCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 20, padding: SPACE.md, borderWidth: 1, borderColor: '#e2e8f0', ...SHADOW.sm },
  quickIconBg: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: SPACE.sm },
  quickTitle: { fontSize: FONT.sm, fontWeight: FONT.w8, color: COLORS.text },
  quickSub: { fontSize: 10, color: COLORS.textTer, marginTop: 2 },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 22, overflow: 'hidden',
    marginBottom: SPACE.lg, padding: SPACE.lg,
    borderWidth: 1, borderColor: '#e2e8f0', ...SHADOW.sm,
  },
  cardTitle: { fontSize: FONT.sm, fontWeight: FONT.w7, color: COLORS.text },
  cardAction: { fontSize: FONT.xs, fontWeight: FONT.w7, color: COLORS.brand },
  tag: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.brandLight, paddingHorizontal: SPACE.md, paddingVertical: 6, borderRadius: RADIUS.full },
  tagText: { fontSize: FONT.xs, fontWeight: FONT.w7, color: COLORS.brand },

  secLabel: { fontSize: 10, fontWeight: FONT.w8, color: COLORS.textTer, letterSpacing: 1.2, marginBottom: SPACE.xs, marginLeft: 4 },
  menuRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACE.md },
  menuLabel: { fontSize: FONT.sm, fontWeight: FONT.w6, color: COLORS.text },
  menuSub: { fontSize: FONT.xs, color: COLORS.textTer, marginTop: 2 },

  logout: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACE.sm, height: 50, borderRadius: 18,
    borderWidth: 1.5, borderColor: COLORS.error,
    backgroundColor: '#FFFFFF', marginBottom: SPACE.lg, ...SHADOW.sm,
  },
  logoutText: { fontSize: FONT.sm, fontWeight: FONT.w7, color: COLORS.error },
  ver: { textAlign: 'center', fontSize: FONT.xs, color: COLORS.textTer, opacity: 0.6 },
});
