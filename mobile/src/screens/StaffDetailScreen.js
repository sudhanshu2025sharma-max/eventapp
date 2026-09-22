import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Linking,
  Alert,
  StatusBar,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { COLORS, FONT, RADIUS, SHADOW, SPACE, fixMediaUrl } from '../theme';
import { apiFetch } from '../api';

const TIER_META = {
  librarian: { label: 'Organising Chair & Head', color: '#D97706', bg: '#FEF3C7' },
  deputy: { label: 'Deputy Librarian', color: '#2563EB', bg: '#DBEAFE' },
  assistant: { label: 'Assistant Librarian', color: '#7C3AED', bg: '#EDE9FE' },
  staff: { label: 'Events Staff', color: '#059669', bg: '#D1FAE5' },
};

const STAFF_ROLES = ['super_admin', 'mgmt_admin', 'team_head', 'staff'];

export default function StaffDetailScreen({
  staff,
  currentUser,
  onBack,
  onOpenChat,
  onInitiateVoiceCall,
}) {
  const [connecting, setConnecting] = useState(false);

  if (!staff) return null;

  const profile = staff.staff_profile || {};
  const tier = profile.tier || staff.tier || 'staff';
  const meta = TIER_META[tier] || TIER_META.staff;
  const photoUri = fixMediaUrl(profile.photo || staff.photo || staff.photo_url);
  const targetUserId = staff.user_id || staff.user?.id || staff.id;
  const isStaff = STAFF_ROLES.includes(currentUser?.role);

  const handlePhone = () => {
    const ph = profile.phone || staff.phone;
    if (ph) {
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_) {}
      Linking.openURL(`tel:${ph}`);
    } else {
      Alert.alert('Phone', 'Phone number not available');
    }
  };

  const handleEmail = () => {
    const em = staff.email || profile.email;
    if (em) {
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_) {}
      Linking.openURL(`mailto:${em}`);
    }
  };

  const handleVoiceCall = () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (_) {}
    if (onInitiateVoiceCall && targetUserId) {
      onInitiateVoiceCall({
        id: targetUserId,
        full_name: staff.full_name || staff.name || `${staff.first_name || ''} ${staff.last_name || ''}`.trim(),
        role: staff.role || 'staff',
        designation: profile.designation || staff.designation || 'Conference Team',
        photo_url: photoUri,
      });
    }
  };

  const handleStartChat = async () => {
    try {
      setConnecting(true);
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_) {}
      const res = await apiFetch('/chat/requests/send/', {
        method: 'POST',
        body: JSON.stringify({ receiver_id: targetUserId }),
      });
      const data = await res.json();
      if (data.success || data.detail?.includes('already')) {
        Alert.alert('Chat Connected', `You can now chat with ${staff.full_name || 'staff'}`, [
          { text: 'Open Chat', onPress: () => onOpenChat?.(staff) },
          { text: 'OK' },
        ]);
      } else {
        Alert.alert('Note', data.detail || 'Request sent');
      }
    } catch (e) {
      Alert.alert('Chat', 'Could not open chat. Please try again.');
    } finally {
      setConnecting(false);
    }
  };

  const openUrl = (url, label) => {
    if (!url) return;
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_) {}
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', `Could not open ${label}`);
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      {/* Hero Header with Tier Gradient */}
      <LinearGradient
        colors={['#0F172A', '#1E293B']}
        style={styles.hero}
      >
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.heroTitle}>Staff Profile</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Avatar + Tier Badge */}
        <View style={styles.avatarCard}>
          <View style={[styles.avatarWrap, { borderColor: meta.color }]}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarLetter}>
                  {(staff.full_name || staff.first_name || 'S').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.name}>{staff.full_name || `${staff.first_name || ''} ${staff.last_name || ''}`.trim()}</Text>
          <Text style={styles.designation}>{profile.designation || staff.designation || 'Conference Organizing Team'}</Text>
          <View style={[styles.tierPill, { backgroundColor: meta.bg }]}>
            <Text style={[styles.tierText, { color: meta.color }]}>{meta.label}</Text>
          </View>
          {(profile.department || staff.department) ? (
            <Text style={styles.deptText}>{profile.department || staff.department}</Text>
          ) : null}
        </View>

        {/* Action Row — Voice Call restricted to staff roles */}
        <View style={styles.actionRow}>
          {isStaff && (
            <TouchableOpacity style={styles.actionItem} onPress={handleVoiceCall} activeOpacity={0.7}>
              <LinearGradient colors={['#10B981', '#059669']} style={styles.actionIcon}>
                <Ionicons name="call" size={20} color="#FFF" />
              </LinearGradient>
              <Text style={styles.actionLabel}>Voice Call</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.actionItem} onPress={handleEmail} activeOpacity={0.7}>
            <LinearGradient colors={['#2563EB', '#1D4ED8']} style={styles.actionIcon}>
              <Ionicons name="mail" size={20} color="#FFF" />
            </LinearGradient>
            <Text style={styles.actionLabel}>Email</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionItem} onPress={handleStartChat} disabled={connecting} activeOpacity={0.7}>
            <LinearGradient colors={['#7C3AED', '#6D28D9']} style={styles.actionIcon}>
              <Ionicons name="chatbubble-ellipses" size={20} color="#FFF" />
            </LinearGradient>
            <Text style={styles.actionLabel}>{connecting ? 'Opening...' : 'Message'}</Text>
          </TouchableOpacity>

          {(profile.phone || staff.phone) ? (
            <TouchableOpacity style={styles.actionItem} onPress={handlePhone} activeOpacity={0.7}>
              <LinearGradient colors={['#F59E0B', '#D97706']} style={styles.actionIcon}>
                <Ionicons name="phone-portrait-outline" size={20} color="#FFF" />
              </LinearGradient>
              <Text style={styles.actionLabel}>Cell</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Contact Info Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Contact Details</Text>
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={18} color={COLORS.textSec} />
            <Text style={styles.infoText}>{staff.email || 'N/A'}</Text>
          </View>
          {(profile.phone || staff.phone) ? (
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={18} color={COLORS.textSec} />
              <Text style={styles.infoText}>{profile.phone || staff.phone}</Text>
            </View>
          ) : null}
          {(profile.department || staff.department) ? (
            <View style={styles.infoRow}>
              <Ionicons name="business-outline" size={18} color={COLORS.textSec} />
              <Text style={styles.infoText}>{profile.department || staff.department}</Text>
            </View>
          ) : null}
        </View>

        {/* Academic & Social Profiles Card */}
        {(profile.profile_url || staff.profile_url || profile.scholar_url || staff.scholar_url || profile.linkedin_url || staff.linkedin_url) ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Academic & Social Profiles</Text>
            {(profile.profile_url || staff.profile_url) ? (
              <TouchableOpacity
                style={styles.linkRow}
                onPress={() => openUrl(profile.profile_url || staff.profile_url, 'Academic Profile')}
                activeOpacity={0.7}
              >
                <View style={[styles.linkIcon, { backgroundColor: '#EDE9FE' }]}>
                  <Ionicons name="school" size={18} color="#7C3AED" />
                </View>
                <Text style={styles.linkText} numberOfLines={1}>IITD Institute Profile</Text>
                <Ionicons name="open-outline" size={16} color={COLORS.textSec} />
              </TouchableOpacity>
            ) : null}

            {(profile.scholar_url || staff.scholar_url) ? (
              <TouchableOpacity
                style={styles.linkRow}
                onPress={() => openUrl(profile.scholar_url || staff.scholar_url, 'Google Scholar')}
                activeOpacity={0.7}
              >
                <View style={[styles.linkIcon, { backgroundColor: '#DBEAFE' }]}>
                  <Ionicons name="book" size={18} color="#2563EB" />
                </View>
                <Text style={styles.linkText} numberOfLines={1}>Google Scholar</Text>
                <Ionicons name="open-outline" size={16} color={COLORS.textSec} />
              </TouchableOpacity>
            ) : null}

            {(profile.linkedin_url || staff.linkedin_url) ? (
              <TouchableOpacity
                style={styles.linkRow}
                onPress={() => openUrl(profile.linkedin_url || staff.linkedin_url, 'LinkedIn')}
                activeOpacity={0.7}
              >
                <View style={[styles.linkIcon, { backgroundColor: '#E0F2FE' }]}>
                  <Ionicons name="logo-linkedin" size={18} color="#0284C7" />
                </View>
                <Text style={styles.linkText} numberOfLines={1}>LinkedIn</Text>
                <Ionicons name="open-outline" size={16} color={COLORS.textSec} />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
    paddingBottom: SPACE.lg,
    paddingHorizontal: SPACE.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTitle: {
    color: '#FFF',
    fontSize: FONT.lg,
    fontWeight: '700',
  },
  scrollContent: {
    padding: SPACE.md,
  },
  avatarCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    padding: SPACE.xl,
    marginTop: -20,
    ...SHADOW.md,
  },
  avatarWrap: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    padding: 3,
    marginBottom: SPACE.md,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
  },
  avatarPlaceholder: {
    backgroundColor: COLORS.brandLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    color: '#FFF',
    fontSize: 40,
    fontWeight: '700',
  },
  name: {
    fontSize: FONT.xl,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  designation: {
    fontSize: FONT.sm,
    color: COLORS.textSec,
    textAlign: 'center',
    marginBottom: SPACE.sm,
  },
  tierPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    marginBottom: 6,
  },
  tierText: {
    fontSize: FONT.xs,
    fontWeight: '700',
  },
  deptText: {
    fontSize: FONT.xs,
    color: COLORS.textSec,
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACE.lg,
    marginVertical: SPACE.lg,
  },
  actionItem: {
    alignItems: 'center',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    ...SHADOW.sm,
  },
  actionLabel: {
    fontSize: FONT.xs,
    color: COLORS.text,
    fontWeight: '600',
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACE.lg,
    marginBottom: SPACE.md,
    ...SHADOW.sm,
  },
  cardTitle: {
    fontSize: FONT.base,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACE.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  infoText: {
    fontSize: FONT.sm,
    color: COLORS.text,
    flex: 1,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  linkIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  linkText: {
    fontSize: FONT.sm,
    color: COLORS.text,
    fontWeight: '600',
    flex: 1,
  },
});
