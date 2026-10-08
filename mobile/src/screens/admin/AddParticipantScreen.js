import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Platform, ActivityIndicator, Alert, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, SPACE, RADIUS, API_URL, API_HEADERS, TOP, BOTTOM } from '../../theme';

function authHeaders(tokens) {
  return { ...API_HEADERS, Authorization: `Bearer ${tokens.access}` };
}

function Field({ label, required, children }) {
  return (
    <View style={f.group}>
      <Text style={f.label}>
        {label}{required ? <Text style={{ color: COLORS.error }}> *</Text> : null}
      </Text>
      {children}
    </View>
  );
}

const INPUT = {
  backgroundColor: COLORS.surface,
  borderRadius: RADIUS.md,
  borderWidth: 1,
  borderColor: COLORS.border,
  paddingHorizontal: SPACE.md,
  paddingVertical: SPACE.sm + 2,
  fontSize: FONT.sm,
  color: COLORS.text,
};

const GENDER_OPTIONS = ['', 'Male', 'Female', 'Other'];

export default function AddParticipantScreen({ tokens, onBack, onCreated }) {
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '',
    phone: '', affiliation: '', designation: '',
    gender: '', registration_id: '',
  });
  const [sendEmail, setSendEmail] = useState(false);
  const [loading,   setLoading]   = useState(false);

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const submit = async () => {
    if (!form.first_name.trim()) { Alert.alert('Required', 'First name is required.'); return; }
    if (!form.email.trim() || !form.email.includes('@')) {
      Alert.alert('Required', 'Valid email is required.'); return;
    }

    setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/auth/participants/create/`, {
        method:  'POST',
        headers: authHeaders(tokens),
        body:    JSON.stringify({ ...form, send_email: sendEmail }),
      });
      const data = await res.json();

      if (res.status === 201 && data.success) {
        Alert.alert(
          '✅ Created',
          `${form.first_name} ${form.last_name} added.\nReg ID: ${data.registration_id}`,
          [{ text: 'OK', onPress: () => { if (onCreated) onCreated(); onBack(); } }],
        );
      } else {
        Alert.alert('Error', data.error || 'Failed to create participant.');
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    }
    setLoading(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Add Participant</Text>
          <Text style={s.sub}>Reg ID auto-assigned (ETD-2026-S-XXX)</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: SPACE.xl, paddingBottom: 120 + BOTTOM }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* required */}
        <Text style={s.sectionLabel}>REQUIRED</Text>
        <View style={s.card}>
          <Field label="First Name" required>
            <TextInput style={INPUT} value={form.first_name} onChangeText={v => set('first_name', v)}
              placeholder="First name" placeholderTextColor={COLORS.textTer} autoCapitalize="words" />
          </Field>
          <Field label="Last Name">
            <TextInput style={INPUT} value={form.last_name} onChangeText={v => set('last_name', v)}
              placeholder="Last name" placeholderTextColor={COLORS.textTer} autoCapitalize="words" />
          </Field>
          <Field label="Email" required>
            <TextInput style={INPUT} value={form.email} onChangeText={v => set('email', v)}
              placeholder="email@example.com" placeholderTextColor={COLORS.textTer}
              keyboardType="email-address" autoCapitalize="none" />
          </Field>
        </View>

        {/* optional */}
        <Text style={s.sectionLabel}>OPTIONAL</Text>
        <View style={s.card}>
          <Field label="Designation">
            <TextInput style={INPUT} value={form.designation} onChangeText={v => set('designation', v)}
              placeholder="e.g. PhD Scholar" placeholderTextColor={COLORS.textTer} />
          </Field>
          <Field label="Organisation / Institute">
            <TextInput style={INPUT} value={form.affiliation} onChangeText={v => set('affiliation', v)}
              placeholder="e.g. IIT Delhi" placeholderTextColor={COLORS.textTer} />
          </Field>
          <Field label="Phone">
            <TextInput style={INPUT} value={form.phone} onChangeText={v => set('phone', v)}
              placeholder="Mobile number" placeholderTextColor={COLORS.textTer} keyboardType="phone-pad" />
          </Field>

          {/* gender picker — simple button row */}
          <Field label="Gender">
            <View style={{ flexDirection: 'row', gap: SPACE.sm, flexWrap: 'wrap' }}>
              {['Male', 'Female', 'Other'].map(g => (
                <TouchableOpacity
                  key={g}
                  style={[s.genderChip, form.gender === g && s.genderChipOn]}
                  onPress={() => set('gender', form.gender === g ? '' : g)}
                >
                  <Text style={[s.genderTxt, form.gender === g && s.genderTxtOn]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Field>

          <Field label="Registration ID">
            <TextInput style={INPUT} value={form.registration_id}
              onChangeText={v => set('registration_id', v)}
              placeholder="Leave blank to auto-assign ETD-2026-S-XXX"
              placeholderTextColor={COLORS.textTer} autoCapitalize="characters" />
          </Field>
        </View>

        {/* email toggle */}
        <Text style={s.sectionLabel}>EMAIL</Text>
        <View style={[s.card, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
          <View style={{ flex: 1, marginRight: SPACE.md }}>
            <Text style={s.toggleLabel}>Send credentials email</Text>
            <Text style={s.toggleSub}>Email login details to the participant</Text>
          </View>
          <Switch
            value={sendEmail}
            onValueChange={setSendEmail}
            trackColor={{ false: COLORS.border, true: COLORS.brand }}
            thumbColor={COLORS.surface}
          />
        </View>

        {/* submit */}
        <TouchableOpacity
          style={[s.submitBtn, loading && { opacity: 0.7 }]}
          onPress={submit}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <>
                <Ionicons name="person-add" size={18} color="#fff" />
                <Text style={s.submitTxt}>Create Participant</Text>
              </>
          }
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: TOP + 8,
    paddingBottom: SPACE.md, paddingHorizontal: SPACE.xl,
    backgroundColor: COLORS.bg, gap: SPACE.md,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  title: { fontSize: FONT.lg, fontWeight: FONT.w8, color: COLORS.text },
  sub:   { fontSize: FONT.xs, color: COLORS.textTer, marginTop: 2 },

  sectionLabel: {
    fontSize: 10, fontWeight: FONT.w8, color: COLORS.textTer,
    letterSpacing: 1.5, marginBottom: SPACE.sm, marginLeft: 4,
  },
  card: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.xl,
    padding: SPACE.lg, borderWidth: 1, borderColor: COLORS.border,
    marginBottom: SPACE.xl, gap: SPACE.md,
  },

  genderChip: {
    paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm,
    borderRadius: RADIUS.full, borderWidth: 1.5, borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  genderChipOn:  { borderColor: COLORS.brand, backgroundColor: COLORS.brandLight },
  genderTxt:     { fontSize: FONT.xs, fontWeight: FONT.w6, color: COLORS.textSec },
  genderTxtOn:   { color: COLORS.brand },

  toggleLabel: { fontSize: FONT.sm, fontWeight: FONT.w6, color: COLORS.text },
  toggleSub:   { fontSize: FONT.xs, color: COLORS.textTer, marginTop: 2 },

  submitBtn: {
    backgroundColor: COLORS.brand, borderRadius: RADIUS.lg,
    paddingVertical: SPACE.md + 2, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: SPACE.sm,
  },
  submitTxt: { color: '#fff', fontSize: FONT.md, fontWeight: FONT.w7 },
});

const f = StyleSheet.create({
  group: { gap: SPACE.xs },
  label: { fontSize: FONT.xs, fontWeight: FONT.w6, color: COLORS.textSec },
});
