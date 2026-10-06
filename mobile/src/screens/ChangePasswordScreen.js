import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StatusBar, KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, SPACE, RADIUS, SHADOW, API_URL, API_HEADERS } from '../theme';
import { PrimaryButton, FadeIn, GlassCard } from '../components';

function Field({ icon, placeholder, value, onChange, error }) {
  const [show, setShow] = useState(false);
  return (
    <View style={{ marginBottom: SPACE.md }}>
      <View style={[st.fieldRow, error && { borderColor: COLORS.error, backgroundColor: COLORS.errorLight }]}>
        <Ionicons
          name={icon}
          size={18}
          color={error ? COLORS.error : COLORS.textTer}
          style={{ marginRight: SPACE.sm }}
        />
        <TextInput
          style={st.fieldInput}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textTer}
          value={value}
          onChangeText={onChange}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          onPress={() => setShow((s) => !s)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.textTer} />
        </TouchableOpacity>
      </View>
      {!!error && (
        <View style={st.fieldErr}>
          <Ionicons name="alert-circle" size={12} color={COLORS.error} style={{ marginRight: 4 }} />
          <Text style={{ fontSize: FONT.xs, color: COLORS.error }}>{error}</Text>
        </View>
      )}
    </View>
  );
}

export default function ChangePasswordScreen({ navigation, user, tokens, onDone, onGoHome, onBack, onLogout }) {
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confPwd, setConfPwd] = useState('');
  const [errors, setErrors] = useState({});
  const [apiErr, setApiErr] = useState('');
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const e = {};
    if (!oldPwd) e.old = 'Current password is required';
    if (!newPwd) e.new = 'New password is required';
    else if (newPwd.length < 8) e.new = 'Minimum 8 characters';
    if (!confPwd) e.conf = 'Please confirm your new password';
    else if (newPwd && confPwd && newPwd !== confPwd) e.conf = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    setApiErr('');
    try {
      const res = await fetch(`${API_URL}/auth/change-password/`, {
        method: 'POST',
        headers: { ...API_HEADERS, Authorization: `Bearer ${tokens.access}` },
        body: JSON.stringify({ old_password: oldPwd, new_password: newPwd }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onDone?.(user, data.tokens || tokens);
      } else {
        setApiErr(data.message || data.detail || 'Failed to change password.');
      }
    } catch {
      setApiErr('Connection failed. Please try again.');
    }
    setLoading(false);
  };

  const handleReturnHome = () => {
    if (typeof onGoHome === 'function') {
      onGoHome();
    } else if (typeof onBack === 'function') {
      onBack();
    } else if (navigation && typeof navigation.navigate === 'function') {
      navigation.navigate('HomeTab');
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={['#0333b6', '#0245c7']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={st.header}
        >
          {/* Back Button in Header */}
          <TouchableOpacity onPress={handleReturnHome} style={st.headerBackBtn} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={20} color={COLORS.textInverse} />
          </TouchableOpacity>

          <View style={st.deco1} />
          <View style={st.deco2} />

          <GlassCard style={st.iconBox}>
            <Ionicons name="lock-open-outline" size={34} color={COLORS.textInverse} />
          </GlassCard>

          <Text style={st.title}>Set Your Password</Text>
          <Text style={st.subtitle}>
            Hi {user?.first_name || 'there'} — your account was created with a temporary password.{'\n'}
            Please set a permanent one to continue.
          </Text>
        </LinearGradient>

        <View style={{ backgroundColor: '#0245c7', height: 30 }}>
          <View style={st.curve} />
        </View>

        <View style={st.body}>
          <FadeIn delay={150}>
            <View style={st.card}>
              {!!apiErr && (
                <View style={st.errBox}>
                  <Ionicons name="warning" size={16} color={COLORS.error} style={{ marginRight: SPACE.sm }} />
                  <Text style={st.errText}>{apiErr}</Text>
                </View>
              )}

              <Text style={st.label}>Current (Temporary) Password</Text>
              <Field
                icon="lock-closed-outline"
                placeholder="Temporary password from email"
                value={oldPwd}
                onChange={(t) => {
                  setOldPwd(t);
                  setErrors((e) => ({ ...e, old: '' }));
                  setApiErr('');
                }}
                error={errors.old}
              />

              <Text style={st.label}>New Password</Text>
              <Field
                icon="lock-open-outline"
                placeholder="At least 8 characters"
                value={newPwd}
                onChange={(t) => {
                  setNewPwd(t);
                  setErrors((e) => ({ ...e, new: '' }));
                }}
                error={errors.new}
              />

              <Text style={st.label}>Confirm New Password</Text>
              <Field
                icon="checkmark-circle-outline"
                placeholder="Repeat new password"
                value={confPwd}
                onChange={(t) => {
                  setConfPwd(t);
                  setErrors((e) => ({ ...e, conf: '' }));
                }}
                error={errors.conf}
              />

              <View style={st.rulesBox}>
                <Ionicons
                  name="information-circle-outline"
                  size={14}
                  color={COLORS.textTer}
                  style={{ marginRight: SPACE.xs }}
                />
                <Text style={st.rulesText}>
                  Minimum 8 characters. Mix letters and numbers for a strong password.
                </Text>
              </View>

              <PrimaryButton
                label="Set Password & Continue"
                onPress={handleSubmit}
                loading={loading}
                style={{ marginTop: SPACE.lg }}
              />
            </View>
          </FadeIn>

          <View style={st.footerRow}>
            {/* Back to Home Button */}
            <TouchableOpacity style={st.footerLink} onPress={handleReturnHome} activeOpacity={0.7}>
              <Ionicons name="home-outline" size={14} color={COLORS.textTer} style={{ marginRight: 4 }} />
              <Text style={st.footerText}>Back to Home</Text>
            </TouchableOpacity>

            <View style={st.footerDot} />

            {/* Logout Button */}
            <TouchableOpacity
              style={st.footerLink}
              onPress={() => typeof onLogout === 'function' && onLogout()}
              activeOpacity={0.7}
            >
              <Ionicons name="log-out-outline" size={14} color={COLORS.textTer} style={{ marginRight: 4 }} />
              <Text style={st.footerText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  header: {
    paddingTop: Platform.OS === 'ios' ? 72 : 60,
    paddingBottom: 52,
    alignItems: 'center',
    paddingHorizontal: SPACE.xxl,
    overflow: 'hidden',
  },
  headerBackBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 42,
    left: SPACE.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(15,23,42,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  deco1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    top: -50,
    right: -50,
  },
  deco2: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(245,158,11,0.06)',
    bottom: 20,
    left: -30,
  },
  iconBox: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACE.lg,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderColor: 'rgba(255,255,255,0.20)',
  },
  title: {
    fontSize: FONT.xxl,
    fontWeight: FONT.w9,
    color: COLORS.textInverse,
    letterSpacing: 0.3,
    textAlign: 'center',
    marginBottom: SPACE.sm,
  },
  subtitle: {
    fontSize: FONT.sm,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    lineHeight: 20,
  },
  curve: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: RADIUS.xxxl,
    borderTopRightRadius: RADIUS.xxxl,
  },
  body: {
    backgroundColor: COLORS.bg,
    paddingHorizontal: SPACE.xl,
    paddingBottom: SPACE.xxxl,
    marginTop: -6,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xxl,
    padding: SPACE.xxl,
    ...SHADOW.lg,
    borderWidth: Platform.OS === 'android' ? 1 : 0,
    borderColor: COLORS.borderLight,
  },
  label: {
    fontSize: FONT.sm,
    fontWeight: FONT.w6,
    color: COLORS.textSec,
    marginBottom: SPACE.sm,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.bg,
    paddingHorizontal: SPACE.md,
  },
  fieldInput: {
    flex: 1,
    fontSize: FONT.base,
    color: COLORS.text,
  },
  fieldErr: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACE.xs,
    marginLeft: 2,
  },
  errBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.errorLight,
    padding: SPACE.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACE.lg,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errText: {
    flex: 1,
    fontSize: FONT.sm,
    color: COLORS.error,
    fontWeight: FONT.w5,
  },
  rulesBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: SPACE.sm,
  },
  rulesText: {
    fontSize: FONT.xs,
    color: COLORS.textTer,
    flex: 1,
    lineHeight: 18,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACE.xxl,
    gap: 12,
  },
  footerLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  footerText: {
    fontSize: FONT.sm,
    color: COLORS.textTer,
  },
  footerDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: COLORS.textTer,
    opacity: 0.5,
  },
});