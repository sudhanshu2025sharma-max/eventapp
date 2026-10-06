import React, { useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet, Image,
  Platform, TextInput, ScrollView, KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, SPACE, RADIUS, SHADOW, API_URL, API_HEADERS, fixMediaUrl } from '../theme';
import { GradientAvatar } from '../components';
import TopicPickerModal from './TopicPickerModal';

export default function SpeakerRequestModal({ visible, onClose, speaker, tokens, onSent }) {
  const [step, setStep]         = useState('form');  // form | topic | sending | sent
  const [message, setMessage]   = useState('');
  const [topicModal, setTopic]  = useState(false);
  const [topicData, setTopicData] = useState(null);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const reset = () => {
    setStep('form');
    setMessage('');
    setTopicData(null);
    setError('');
    setLoading(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleTopicConfirmed = (td) => {
    setTopicData(td);
    setTopic(false);
  };

  const handleSend = async () => {
    if (!topicData) { setError('Please select a topic first.'); return; }
    if (!message.trim()) { setError('Please add a short message to the speaker.'); return; }
    setError('');
    setLoading(true);
    setStep('sending');

    try {
      const res = await fetch(`${API_URL}/chat/requests/send/`, {
        method: 'POST',
        headers: { ...API_HEADERS, Authorization: `Bearer ${tokens?.access}` },
        body: JSON.stringify({
          receiver_id:  speaker.id,
          request_type: 'speaker',
          topic:        topicData.topic,
          custom_topic: topicData.custom_topic,
          message:      message.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok || data.already_connected) {
        setStep('sent');
        if (onSent) onSent(data);
      } else {
        setError(data.error || 'Failed to send request.');
        setStep('form');
      }
    } catch {
      setError('Network error. Please try again.');
      setStep('form');
    } finally {
      setLoading(false);
    }
  };

  if (!speaker) return null;

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
        <KeyboardAvoidingView
          style={s.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={handleClose} />
          <View style={s.sheet}>
            <View style={s.handle} />

            {/* Header */}
            <View style={s.header}>
              <View>
                <Text style={s.title}>Speaker Discussion</Text>
                <Text style={s.subtitle}>Request a conversation</Text>
              </View>
              <TouchableOpacity style={s.closeBtn} onPress={handleClose}>
                <Ionicons name="close" size={18} color={COLORS.textSec} />
              </TouchableOpacity>
            </View>

            {step === 'sent' ? (
              /* Sent state */
              <View style={s.sentWrap}>
                <View style={s.sentIconWrap}>
                  <Ionicons name="paper-plane" size={32} color={COLORS.brand} />
                </View>
                <Text style={s.sentTitle}>Request Sent!</Text>
                <Text style={s.sentSub}>
                  Your discussion request has been sent to{' '}
                  <Text style={{ fontWeight: FONT.w7 }}>
                    {speaker.name || `${speaker.first_name || ''} ${speaker.last_name || ''}`.trim()}
                  </Text>
                  . You'll be notified when they respond.
                </Text>
                <TouchableOpacity style={s.doneBtn} onPress={handleClose} activeOpacity={0.8}>
                  <Text style={s.doneBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>

                {/* Speaker mini card */}
                <View style={s.speakerCard}>
                  {(speaker.profile_photo_url || speaker.photo_url || speaker.photo) ? (
                    <Image
                      source={{ uri: fixMediaUrl(speaker.profile_photo_url || speaker.photo_url || speaker.photo) }}
                      style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: COLORS.borderLight }}
                    />
                  ) : (
                    <GradientAvatar
                      name={`${speaker.first_name || ''} ${speaker.last_name || ''}`.trim() || speaker.name || 'S'}
                      size={48} radius={16}
                    />
                  )}
                  <View style={{ flex: 1, marginLeft: SPACE.md }}>
                    <Text style={s.speakerName}>
                      {speaker.name || `${speaker.first_name || ''} ${speaker.last_name || ''}`.trim()}
                    </Text>
                    {speaker.designation ? (
                      <Text style={s.speakerDesig}>{speaker.designation}</Text>
                    ) : null}
                    {speaker.affiliation ? (
                      <Text style={s.speakerAff} numberOfLines={1}>{speaker.affiliation}</Text>
                    ) : null}
                  </View>
                  <View style={s.speakerBadge}>
                    <Ionicons name="mic" size={12} color={COLORS.purple} />
                    <Text style={s.speakerBadgeText}>Speaker</Text>
                  </View>
                </View>

                <Text style={s.infoNote}>
                  <Ionicons name="information-circle-outline" size={13} color={COLORS.textTer} />
                  {'  '}Speakers receive your request and may accept, decline, or respond later.
                </Text>

                {/* Topic selector */}
                <Text style={s.label}>Discussion Topic *</Text>
                <TouchableOpacity
                  style={[s.topicBtn, topicData && s.topicBtnActive]}
                  onPress={() => setTopic(true)}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={16}
                    color={topicData ? COLORS.brand : COLORS.textTer}
                  />
                  <Text style={[s.topicBtnText, topicData && s.topicBtnTextActive]}>
                    {topicData
                      ? (topicData.topic === 'other' ? topicData.custom_topic : topicData.topic.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase()))
                      : 'Select a topic...'}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color={COLORS.textTer} />
                </TouchableOpacity>

                {/* Message */}
                <Text style={[s.label, { marginTop: SPACE.lg }]}>Your Message *</Text>
                <TextInput
                  style={s.messageInput}
                  placeholder="Introduce yourself and explain what you'd like to discuss..."
                  placeholderTextColor={COLORS.textTer}
                  value={message}
                  onChangeText={setMessage}
                  multiline
                  numberOfLines={4}
                  maxLength={400}
                  textAlignVertical="top"
                />
                <Text style={s.charCount}>{message.length}/400</Text>

                {!!error && (
                  <View style={s.errorRow}>
                    <Ionicons name="alert-circle-outline" size={14} color={COLORS.error} />
                    <Text style={s.errorText}>{error}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[s.sendBtn, (loading || step === 'sending') && { opacity: 0.6 }]}
                  onPress={handleSend}
                  disabled={loading || step === 'sending'}
                  activeOpacity={0.82}
                >
                  <Ionicons name="paper-plane" size={18} color="#fff" />
                  <Text style={s.sendBtnText}>
                    {loading ? 'Sending...' : 'Send Discussion Request'}
                  </Text>
                </TouchableOpacity>

                <View style={{ height: 16 }} />
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <TopicPickerModal
        visible={topicModal}
        onClose={() => setTopic(false)}
        onConfirm={handleTopicConfirmed}
        title="Discussion Topic"
      />
    </>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    paddingHorizontal: SPACE.xl,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingTop: SPACE.md,
    maxHeight: '92%',
    ...SHADOW.xl,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: COLORS.border, alignSelf: 'center',
    marginBottom: SPACE.lg,
  },
  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', marginBottom: SPACE.lg,
  },
  title:    { fontSize: FONT.lg, fontWeight: FONT.w8, color: COLORS.text },
  subtitle: { fontSize: FONT.xs, color: COLORS.textTer, marginTop: 2 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.borderLight,
    alignItems: 'center', justifyContent: 'center',
  },

  speakerCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.borderLight, borderRadius: RADIUS.xl,
    padding: SPACE.lg, marginBottom: SPACE.md,
  },
  speakerName:  { fontSize: FONT.sm, fontWeight: FONT.w7, color: COLORS.text },
  speakerDesig: { fontSize: FONT.xs, color: COLORS.textSec, marginTop: 2 },
  speakerAff:   { fontSize: FONT.xs, color: COLORS.textTer, marginTop: 1 },
  speakerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.purpleLight,
    paddingHorizontal: SPACE.sm, paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  speakerBadgeText: { fontSize: 10, fontWeight: FONT.w7, color: COLORS.purple },

  infoNote: {
    fontSize: FONT.xs, color: COLORS.textTer,
    lineHeight: 18, marginBottom: SPACE.xl,
  },

  label: { fontSize: FONT.xs, fontWeight: FONT.w7, color: COLORS.textSec, marginBottom: SPACE.sm },

  topicBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.sm,
    borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.lg, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md,
    backgroundColor: COLORS.borderLight,
  },
  topicBtnActive:    { borderColor: COLORS.brand, backgroundColor: COLORS.brandLight },
  topicBtnText:      { flex: 1, fontSize: FONT.sm, color: COLORS.textTer },
  topicBtnTextActive:{ color: COLORS.brand, fontWeight: FONT.w6 },

  messageInput: {
    borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.lg, paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md, fontSize: FONT.sm,
    color: COLORS.text, minHeight: 100,
    backgroundColor: '#fafafa',
  },
  charCount: {
    fontSize: FONT.xs, color: COLORS.textTer,
    textAlign: 'right', marginTop: 4, marginBottom: SPACE.lg,
  },

  errorRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.sm,
    backgroundColor: COLORS.errorLight, borderRadius: RADIUS.md,
    padding: SPACE.md, marginBottom: SPACE.md,
  },
  errorText: { fontSize: FONT.xs, color: COLORS.error, flex: 1 },

  sendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACE.sm, backgroundColor: COLORS.brand,
    borderRadius: RADIUS.xl, paddingVertical: SPACE.lg,
    ...SHADOW.brand,
  },
  sendBtnText: { fontSize: FONT.md, fontWeight: FONT.w7, color: '#fff' },

  sentWrap: { alignItems: 'center', paddingVertical: SPACE.xxxl },
  sentIconWrap: {
    width: 80, height: 80, borderRadius: 28,
    backgroundColor: COLORS.brandLight,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACE.xl,
  },
  sentTitle: { fontSize: FONT.xl, fontWeight: FONT.w9, color: COLORS.text, marginBottom: SPACE.md },
  sentSub: {
    fontSize: FONT.sm, color: COLORS.textSec,
    textAlign: 'center', lineHeight: 20, marginBottom: SPACE.xl,
  },
  doneBtn: {
    backgroundColor: COLORS.brand, borderRadius: RADIUS.xl,
    paddingVertical: SPACE.lg, paddingHorizontal: SPACE.xxxl,
    ...SHADOW.brand,
  },
  doneBtnText: { fontSize: FONT.md, fontWeight: FONT.w7, color: '#fff' },
});
