import React, { useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, ScrollView,
  TextInput, StyleSheet, Platform, KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, SPACE, RADIUS, SHADOW, BOTTOM } from '../theme';

const TOPICS = [
  { key: 'research_collab',   label: 'Research Collaboration', icon: 'flask-outline' },
  { key: 'session_discuss',   label: 'Session Discussion',     icon: 'calendar-outline' },
  { key: 'digital_libraries', label: 'Digital Libraries',      icon: 'library-outline' },
  { key: 'metadata',          label: 'Metadata',               icon: 'code-slash-outline' },
  { key: 'ai',                label: 'AI',                     icon: 'hardware-chip-outline' },
  { key: 'open_access',       label: 'Open Access',            icon: 'globe-outline' },
  { key: 'networking',        label: 'Networking',             icon: 'people-outline' },
  { key: 'career',            label: 'Career',                 icon: 'briefcase-outline' },
  { key: 'other',             label: 'Other',                  icon: 'ellipsis-horizontal-outline' },
];

export default function TopicPickerModal({ visible, onClose, onConfirm, title = 'Select Topic' }) {
  const [selected, setSelected] = useState('networking');
  const [custom, setCustom]     = useState('');

  const handleConfirm = () => {
    if (selected === 'other' && !custom.trim()) return;
    onConfirm({ topic: selected, custom_topic: selected === 'other' ? custom.trim() : '' });
    setSelected('networking');
    setCustom('');
  };

  const handleClose = () => {
    setSelected('networking');
    setCustom('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" presentationStyle="overFullScreen" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={s.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={handleClose} />
        <View style={s.sheet}>
          {/* Handle */}
          <View style={s.handle} />

          {/* Header */}
          <View style={s.header}>
            <Text style={s.title}>{title}</Text>
            <TouchableOpacity onPress={handleClose} style={s.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={20} color={COLORS.textSec} />
            </TouchableOpacity>
          </View>

          <Text style={s.subtitle}>
            Every conversation starts with a topic so both parties are aligned.
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
            {TOPICS.map(t => {
              const active = selected === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  style={[s.option, active && s.optionActive]}
                  onPress={() => setSelected(t.key)}
                  activeOpacity={0.7}
                >
                  <View style={[s.optionIcon, active && s.optionIconActive]}>
                    <Ionicons name={t.icon} size={17} color={active ? '#fff' : COLORS.brand} />
                  </View>
                  <Text style={[s.optionLabel, active && s.optionLabelActive]}>{t.label}</Text>
                  <View style={[s.radio, active && s.radioActive]}>
                    {active && <View style={s.radioDot} />}
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Custom topic input */}
            {selected === 'other' && (
              <View style={s.customWrap}>
                <TextInput
                  style={s.customInput}
                  placeholder="Type your topic..."
                  placeholderTextColor={COLORS.textTer}
                  value={custom}
                  onChangeText={setCustom}
                  maxLength={80}
                  autoFocus
                />
              </View>
            )}
            <View style={{ height: 12 }} />
          </ScrollView>

          {/* Confirm */}
          <TouchableOpacity
            style={[
              s.confirmBtn,
              (selected === 'other' && !custom.trim()) && s.confirmBtnDisabled,
            ]}
            onPress={handleConfirm}
            activeOpacity={0.82}
            disabled={selected === 'other' && !custom.trim()}
          >
            <Text style={s.confirmBtnText}>Confirm Topic</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1, justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: SPACE.xl,
    paddingBottom: BOTTOM + 8,
    paddingTop: SPACE.md,
    ...SHADOW.xl,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center', marginBottom: SPACE.lg,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: SPACE.sm,
  },
  title:    { fontSize: FONT.lg, fontWeight: FONT.w8, color: COLORS.text },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.borderLight,
    alignItems: 'center', justifyContent: 'center',
  },
  subtitle: {
    fontSize: FONT.xs, color: COLORS.textTer,
    marginBottom: SPACE.lg, lineHeight: 18,
  },
  option: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: SPACE.md, paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.lg, marginBottom: SPACE.xs,
    backgroundColor: COLORS.borderLight,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  optionActive: {
    backgroundColor: COLORS.brandLight,
    borderColor: COLORS.brand,
  },
  optionIcon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: COLORS.brandLight,
    alignItems: 'center', justifyContent: 'center',
    marginRight: SPACE.md,
  },
  optionIconActive: { backgroundColor: COLORS.brand },
  optionLabel: {
    flex: 1, fontSize: FONT.sm, fontWeight: FONT.w5, color: COLORS.text,
  },
  optionLabelActive: { fontWeight: FONT.w7, color: COLORS.brand },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { borderColor: COLORS.brand },
  radioDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: COLORS.brand,
  },
  customWrap: {
    marginTop: SPACE.sm, marginBottom: SPACE.xs,
  },
  customInput: {
    borderWidth: 1.5, borderColor: COLORS.brand,
    borderRadius: RADIUS.lg, paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md, fontSize: FONT.sm,
    color: COLORS.text, backgroundColor: COLORS.brandLight,
  },
  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACE.sm, backgroundColor: COLORS.brand,
    borderRadius: RADIUS.xl, paddingVertical: SPACE.lg,
    marginTop: SPACE.lg,
    ...SHADOW.brand,
  },
  confirmBtnDisabled: { opacity: 0.45 },
  confirmBtnText: {
    fontSize: FONT.md, fontWeight: FONT.w7, color: '#fff',
  },
});
