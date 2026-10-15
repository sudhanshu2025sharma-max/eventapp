import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet,
  Image, ActivityIndicator, Linking, Alert, Dimensions, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, SPACE, RADIUS, SHADOW, fixMediaUrl, BOTTOM } from '../theme';
import { apiFetch } from '../api';
import { GradientAvatar } from '../components';
import TopicPickerModal from './TopicPickerModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - SPACE.lg * 2 - 12) / 2;

export default function SupportModal({ visible, onDismiss, onOpenChatRoom }) {
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connectingId, setConnectingId] = useState(null);

  // Topic Picker State
  const [targetMember, setTargetMember] = useState(null);
  const [showTopicPicker, setShowTopicPicker] = useState(false);

  useEffect(() => {
    if (visible) {
      fetchSupportTeam();
    }
  }, [visible]);

  const fetchSupportTeam = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/auth/support-team/');
      const data = await res.json();
      if (data.success) {
        setTeam(data.support_team || []);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  // 1. User taps Chat -> Open Topic Picker Modal
  const handleInitiateChat = (member) => {
    setTargetMember(member);
    setShowTopicPicker(true);
  };

  // 2. Topic Confirmed -> Send Request & Open Chat Room
  const handleTopicConfirmed = async ({ topic, custom_topic, message }) => {
    if (!targetMember) return;
    const memberId = targetMember.id;
    setShowTopicPicker(false);
    setConnectingId(memberId);

    try {
      const res = await apiFetch(`/chat/support/start/${memberId}/`, {
        method: 'POST',
        body: JSON.stringify({
          topic,
          custom_topic,
          message,
        }),
      });

      const data = await res.json();
      if (data.success && data.conversation_id) {
        onDismiss();
        if (onOpenChatRoom) {
          onOpenChatRoom(data.conversation_id);
        }
      } else {
        Alert.alert('Chat Error', data.error || 'Could not start chat session.');
      }
    } catch {
      Alert.alert('Network Error', 'Could not reach chat server.');
    } finally {
      setConnectingId(null);
      setTargetMember(null);
    }
  };

  const handleEmail = (email) => {
    if (email) Linking.openURL(`mailto:${email}`);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" presentationStyle="overFullScreen" onRequestClose={onDismiss}>
      <View style={s.overlay}>
        {/* Topic Picker Modal */}
        <TopicPickerModal
          visible={showTopicPicker}
          useModal={false}
          onClose={() => {
            setShowTopicPicker(false);
            setTargetMember(null);
          }}
          onConfirm={handleTopicConfirmed}
          title={targetMember ? `Connect with ${targetMember.first_name}` : 'Select Topic'}
        />

        <View style={s.cardContainer}>
          {/* Header */}
          <View style={s.header}>
            <View>
              <Text style={s.headerTitle}>Support &amp; Committee Leaders</Text>
              <Text style={s.headerSub}>Central Library &amp; Organizing Heads</Text>
            </View>
            <TouchableOpacity onPress={onDismiss} style={s.closeBtn}>
              <Ionicons name="close" size={20} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          {/* Member 2-Column Grid */}
          {loading ? (
            <View style={{ paddingVertical: 60, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={COLORS.brand} />
            </View>
          ) : (
            <ScrollView contentContainerStyle={s.gridContainer} showsVerticalScrollIndicator={false}>
              {team.map((m) => (
                <View key={m.id} style={s.gridCard}>
                  {/* 1. Big Clear Photo */}
                  <View style={s.photoContainer}>
                    {m.photo_url ? (
                      <Image
                        source={{ uri: fixMediaUrl(m.photo_url) }}
                        style={s.bigAvatar}
                        resizeMode="contain"
                      />
                    ) : (
                      <GradientAvatar name={m.full_name} size={82} radius={20} />
                    )}
                  </View>

                  {/* 2. Full Name */}
                  <Text style={s.memberName} numberOfLines={2}>{m.full_name}</Text>

                  {/* 3. Designation */}
                  <View style={s.designationBadge}>
                    <Text style={s.designationText} numberOfLines={1}>{m.designation}</Text>
                  </View>

                  {/* 4. Footer Icons Bar: Email | Chat */}
                  <View style={s.iconFooterBar}>
                    <TouchableOpacity
                      onPress={() => handleEmail(m.email)}
                      style={s.iconBtn}
                      activeOpacity={0.75}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons name="mail-outline" size={18} color={COLORS.brand} />
                    </TouchableOpacity>

                    <View style={s.iconDivider} />

                    <TouchableOpacity
                      onPress={() => handleInitiateChat(m)}
                      disabled={connectingId === m.id}
                      style={s.iconBtnPrimary}
                      activeOpacity={0.75}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      {connectingId === m.id ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Ionicons name="chatbubbles-outline" size={18} color="#fff" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  cardContainer: { backgroundColor: '#f0f4f9', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '90%' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACE.lg, paddingTop: SPACE.lg, paddingBottom: SPACE.md,
    backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: FONT.md, fontWeight: FONT.w8, color: COLORS.text },
  headerSub: { fontSize: 11, color: COLORS.textTer, marginTop: 2 },
  closeBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },

  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: SPACE.lg, paddingBottom: 50 + BOTTOM },

  gridCard: {
    width: CARD_WIDTH, backgroundColor: '#fff', borderRadius: 22,
    padding: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, ...SHADOW.sm,
  },

  /* 1. Photo Container with Full Head preservation */
  photoContainer: { marginBottom: 10, alignItems: 'center', width: '100%' },
  bigAvatar: {
    width: 82,
    height: 94,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: '#f8fafc',
  },

  /* 2. Name */
  memberName: { fontSize: 13, fontWeight: FONT.w8, color: COLORS.text, textAlign: 'center', minHeight: 25 },

  /* 3. Designation */
  designationBadge: {
    backgroundColor: COLORS.brandLight, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: RADIUS.full, marginTop: 4, marginBottom: 5, borderWidth: 1, borderColor: 'rgba(3,51,182,0.12)'
  },
  designationText: { fontSize: 9, fontWeight: FONT.w8, color: COLORS.brand, textAlign: 'center' },

  /* 4. Footer Icons Bar */
  iconFooterBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly',
    width: '100%', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9',
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.brandLight,
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtnPrimary: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.brand,
    alignItems: 'center', justifyContent: 'center', ...SHADOW.brand,
  },
  iconDivider: { width: 1, height: 20, backgroundColor: '#e2e8f0' },
});
