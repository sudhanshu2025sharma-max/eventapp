import React, { useState, useRef, useEffect, createRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StatusBar, KeyboardAvoidingView, Platform, Animated, StyleSheet, Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, SPACE, RADIUS, SHADOW, API_URL, API_HEADERS } from '../theme';
import { PrimaryButton, FadeIn } from '../components';

// ── 6-Box OTP Input with auto-advance + backspace handling ──
function OtpBoxes({ value, onChange, error }) {
  const inputs = useRef([...Array(6)].map(() => createRef())).current;
  const digits = value.padEnd(6, ' ').split('').slice(0, 6);

  const handleChange = (text, idx) => {
    const char = text.replace(/[^0-9]/g, '').slice(-1);
    const chars = value.split('');
    chars[idx] = char;
    const next = chars.join('').replace(/\s/g, '').slice(0, 6);
    onChange(next);
    if (char && idx < 5) inputs[idx + 1].current?.focus();
  };

  const handleKeyPress = (e, idx) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[idx].trim() && idx > 0) {
      inputs[idx - 1].current?.focus();
    }
  };

  return (
    <View>
      <View style={st.otpRow}>
        {digits.map((d, i) => (
          <TextInput
            key={i}
            ref={inputs[i]}
            style={[
              st.otpBox,
              d.trim() && st.otpBoxFilled,
              error && st.otpBoxError,
            ]}
            value={d.trim()}
            onChangeText={(t) => handleChange(t, i)}
            onKeyPress={(e) => handleKeyPress(e, i)}
            keyboardType="number-pad"
            maxLength={1}
            textAlign="center"
            selectTextOnFocus
          />
        ))}
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

function Field({ icon, placeholder, value, onChange, error, keyboardType, secure, right }) {
  return (
    <View style={{ marginBottom: SPACE.md }}>
      <View style={[st.fieldRow, error && { borderColor: COLORS.error, backgroundColor: COLORS.errorLight }]}>
        <Ionicons name={icon} size={18} color={error ? COLORS.error : COLORS.textTer} style={{ marginRight: SPACE.sm }} />
        <TextInput
          style={st.fieldInput}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textTer}
          value={value}
          onChangeText={onChange}
          keyboardType={keyboardType}
          secureTextEntry={secure}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {right}
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

export default function ForgotPasswordScreen({ onBack, initialEmail = '' }) {
  const [phase, setPhase] = useState('email'); // email → otp → done
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confPwd, setConfPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [errors, setErrors] = useState({});
  const [apiErr, setApiErr] = useState('');
  const [apiMsg, setApiMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // ── Animations ──
  const iconScale = useRef(new Animated.Value(0.7)).current;
  const iconFloat = useRef(new Animated.Value(0)).current;
  const auraOp = useRef(new Animated.Value(0.4)).current;
  const auraScale = useRef(new Animated.Value(1)).current;
  const phaseAnim = useRef(new Animated.Value(1)).current;
  const cardSlide = useRef(new Animated.Value(50)).current;
  const cardOp = useRef(new Animated.Value(0)).current;
  const doneScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance
    Animated.parallel([
      Animated.spring(iconScale, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
      Animated.spring(cardSlide, { toValue: 0, tension: 50, friction: 9, useNativeDriver: true }),
      Animated.timing(cardOp, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();

    // Float loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(iconFloat, { toValue: -4, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(iconFloat, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();

    // Aura pulse loop
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(auraScale, { toValue: 1.4, duration: 2600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(auraScale, { toValue: 1, duration: 0, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(auraOp, { toValue: 0, duration: 2600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(auraOp, { toValue: 0.4, duration: 0, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);

  // ── Phase transition animation ──
  const transitionToPhase = (next) => {
    Animated.timing(phaseAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
      setPhase(next);
      if (next === 'done') {
        Animated.spring(doneScale, { toValue: 1, tension: 80, friction: 6, useNativeDriver: true }).start();
      }
      Animated.timing(phaseAnim, { toValue: 1, duration: 240, useNativeDriver: true }).start();
    });
  };

  // ── Phase 1: Send OTP ──
  const handleSendOtp = async () => {
    const e = {};
    if (!email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'Enter a valid email';
    setErrors(e);
    if (Object.keys(e).length) return;

    setLoading(true); setApiErr(''); setApiMsg('');
    try {
      const res = await fetch(`${API_URL}/auth/forgot-password/`, {
        method: 'POST', headers: API_HEADERS,
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (data.success) {
        setApiMsg('Reset code sent! Check your inbox.');
        transitionToPhase('otp');
      } else {
        setApiErr(data.message || 'Something went wrong');
      }
    } catch {
      setApiErr('Connection failed. Check your network.');
    }
    setLoading(false);
  };

  // ── Phase 2: Verify OTP + Reset ──
  const handleReset = async () => {
    const e = {};
    if (!otp.trim() || otp.trim().length !== 6) e.otp = 'Enter the complete 6-digit code';
    if (!newPwd) e.newPwd = 'New password is required';
    else if (newPwd.length < 8) e.newPwd = 'Minimum 8 characters';
    if (!confPwd) e.confPwd = 'Please confirm your password';
    else if (newPwd && confPwd && newPwd !== confPwd) e.confPwd = 'Passwords do not match';
    setErrors(e);
    if (Object.keys(e).length) return;

    setLoading(true); setApiErr('');
    try {
      const res = await fetch(`${API_URL}/auth/reset-password/`, {
        method: 'POST', headers: API_HEADERS,
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp: otp.trim(),
          new_password: newPwd,
        }),
      });
      const data = await res.json();
      if (data.success) {
        transitionToPhase('done');
      } else {
        setApiErr(data.message || 'Reset failed');
      }
    } catch {
      setApiErr('Connection failed. Check your network.');
    }
    setLoading(false);
  };

  const headerIcon = phase === 'done' ? 'checkmark-circle-outline' : phase === 'otp' ? 'keypad-outline' : 'shield-checkmark-outline';
  const headerTitle = phase === 'email' ? 'Forgot Password?' : phase === 'otp' ? 'Enter Reset Code' : 'All Done!';
  const headerSub = phase === 'email'
    ? 'Enter your registered email and we\'ll send a reset code.'
    : phase === 'otp'
    ? `We sent a 6-digit code to ${email}`
    : 'Your password has been changed successfully.';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="light-content" />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#0333b6', '#0245c7']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={st.header}>
          <TouchableOpacity onPress={onBack} style={st.backBtn} activeOpacity={0.8} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={20} color={COLORS.textInverse} />
          </TouchableOpacity>
          <View style={st.deco1} />
          <View style={st.deco2} />

          <Animated.View style={{ alignItems: 'center' }}>
            {/* Aura pulse ring */}
            <View style={st.iconWrapper}>
              <Animated.View style={[st.aura, { opacity: auraOp, transform: [{ scale: auraScale }] }]} />
              <Animated.View style={{ transform: [{ scale: iconScale }, { translateY: iconFloat }] }}>
                <View style={st.iconBox}>
                  <Ionicons name={headerIcon} size={40} color={COLORS.textInverse} />
                </View>
              </Animated.View>
            </View>
            <Text style={st.headerTitle}>{headerTitle}</Text>
            <Text style={st.headerSub}>{headerSub}</Text>
          </Animated.View>
        </LinearGradient>

        <View style={{ backgroundColor: '#0245c7', height: 30 }}><View style={st.curve} /></View>

        <Animated.View style={[st.body, { opacity: cardOp, transform: [{ translateY: cardSlide }] }]}>
          <Animated.View style={{ opacity: phaseAnim }}>
            <View style={st.card}>
              {!!apiErr && (
                <FadeIn>
                  <View style={st.errBox}>
                    <Ionicons name="warning" size={16} color={COLORS.error} style={{ marginRight: SPACE.sm }} />
                    <Text style={st.errText}>{apiErr}</Text>
                  </View>
                </FadeIn>
              )}
              {!!apiMsg && phase === 'otp' && (
                <View style={st.successBox}>
                  <Ionicons name="mail-outline" size={16} color={COLORS.success} style={{ marginRight: SPACE.sm }} />
                  <Text style={st.successText}>{apiMsg}</Text>
                </View>
              )}

              {phase === 'email' && (
                <>
                  <Text style={st.label}>Email Address</Text>
                  <Field
                    icon="mail-outline"
                    placeholder="you@example.com"
                    value={email}
                    onChange={t => { setEmail(t); setErrors(e => ({ ...e, email: '' })); setApiErr(''); }}
                    keyboardType="email-address"
                    error={errors.email}
                  />
                  <PrimaryButton label="Send Reset Code" onPress={handleSendOtp} loading={loading} style={{ marginTop: SPACE.md }} />
                </>
              )}

              {phase === 'otp' && (
                <>
                  <Text style={st.label}>Enter 6-Digit Code</Text>
                  <OtpBoxes
                    value={otp}
                    onChange={(v) => { setOtp(v); setErrors(e => ({ ...e, otp: '' })); setApiErr(''); }}
                    error={errors.otp}
                  />

                  <Text style={[st.label, { marginTop: SPACE.lg }]}>New Password</Text>
                  <Field
                    icon="lock-closed-outline"
                    placeholder="At least 8 characters"
                    value={newPwd}
                    onChange={t => { setNewPwd(t); setErrors(e => ({ ...e, newPwd: '' })); setApiErr(''); }}
                    secure={!showPwd}
                    error={errors.newPwd}
                    right={
                      <TouchableOpacity onPress={() => setShowPwd(!showPwd)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.textTer} />
                      </TouchableOpacity>
                    }
                  />

                  <Text style={st.label}>Confirm New Password</Text>
                  <Field
                    icon="checkmark-circle-outline"
                    placeholder="Repeat new password"
                    value={confPwd}
                    onChange={t => { setConfPwd(t); setErrors(e => ({ ...e, confPwd: '' })); setApiErr(''); }}
                    secure={!showPwd}
                    error={errors.confPwd}
                  />

                  <View style={st.rulesBox}>
                    <Ionicons name="information-circle-outline" size={14} color={COLORS.textTer} style={{ marginRight: SPACE.xs }} />
                    <Text style={st.rulesText}>Minimum 8 characters. Mix letters and numbers for a strong password.</Text>
                  </View>

                  <PrimaryButton label="Reset Password" onPress={handleReset} loading={loading} style={{ marginTop: SPACE.lg }} />

                  <TouchableOpacity style={st.resendRow} onPress={handleSendOtp} disabled={loading} activeOpacity={0.7}>
                    <Ionicons name="refresh-outline" size={14} color={COLORS.brand} style={{ marginRight: 4 }} />
                    <Text style={st.resendText}>Didn't receive it? Resend code</Text>
                  </TouchableOpacity>
                </>
              )}

              {phase === 'done' && (
                <View style={{ alignItems: 'center', paddingVertical: SPACE.lg }}>
                  <Animated.View style={[st.doneIcon, { transform: [{ scale: doneScale }] }]}>
                    <Ionicons name="checkmark" size={44} color="#fff" />
                  </Animated.View>
                  <Text style={st.doneTitle}>Password Changed!</Text>
                  <Text style={st.doneSub}>You can now sign in with your{'\n'}new password.</Text>
                  <PrimaryButton label="Back to Sign In" onPress={onBack} style={{ marginTop: SPACE.xxl, width: '100%' }} />
                </View>
              )}
            </View>
          </Animated.View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  header: { paddingTop: Platform.OS === 'ios' ? 64 : 50, paddingBottom: 48, alignItems: 'center', paddingHorizontal: SPACE.xxl, overflow: 'hidden' },
  backBtn: { position: 'absolute', top: Platform.OS === 'ios' ? 54 : 42, left: SPACE.lg, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(15,23,42,0.35)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  deco1: { position: 'absolute', width: 200, height: 200, borderRadius: 100, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', top: -50, right: -50 },
  deco2: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(245,158,11,0.06)', bottom: 20, left: -30 },
  iconWrapper: { width: 100, height: 100, alignItems: 'center', justifyContent: 'center', marginBottom: SPACE.lg },
  aura: { position: 'absolute', width: 100, height: 100, borderRadius: 50, borderWidth: 2, borderColor: 'rgba(245,158,11,0.6)' },
  iconBox: { width: 80, height: 80, borderRadius: RADIUS.xl, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  headerTitle: { fontSize: FONT.xxl, fontWeight: FONT.w9, color: COLORS.textInverse, letterSpacing: 0.3, textAlign: 'center', marginBottom: SPACE.sm },
  headerSub: { fontSize: FONT.sm, color: 'rgba(255,255,255,0.65)', textAlign: 'center', lineHeight: 20 },
  curve: { flex: 1, backgroundColor: COLORS.bg, borderTopLeftRadius: RADIUS.xxxl, borderTopRightRadius: RADIUS.xxxl },
  body: { backgroundColor: COLORS.bg, paddingHorizontal: SPACE.xl, paddingBottom: SPACE.xxxl, marginTop: -6 },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl, padding: SPACE.xxl, ...SHADOW.lg, borderWidth: Platform.OS === 'android' ? 1 : 0, borderColor: COLORS.borderLight },
  label: { fontSize: FONT.sm, fontWeight: FONT.w6, color: COLORS.textSec, marginBottom: SPACE.sm },
  fieldRow: { flexDirection: 'row', alignItems: 'center', height: 52, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.lg, backgroundColor: COLORS.bg, paddingHorizontal: SPACE.md },
  fieldInput: { flex: 1, fontSize: FONT.base, color: COLORS.text },
  fieldErr: { flexDirection: 'row', alignItems: 'center', marginTop: SPACE.xs, marginLeft: 2 },
  errBox: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: COLORS.errorLight, padding: SPACE.md, borderRadius: RADIUS.md, marginBottom: SPACE.lg, borderWidth: 1, borderColor: '#fecaca' },
  errText: { flex: 1, fontSize: FONT.sm, color: COLORS.error, fontWeight: FONT.w5 },
  successBox: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: COLORS.successLight, padding: SPACE.md, borderRadius: RADIUS.md, marginBottom: SPACE.lg, borderWidth: 1, borderColor: '#a7f3d0' },
  successText: { flex: 1, fontSize: FONT.sm, color: COLORS.success, fontWeight: FONT.w5 },
  rulesBox: { flexDirection: 'row', alignItems: 'flex-start', marginTop: SPACE.sm },
  rulesText: { fontSize: FONT.xs, color: COLORS.textTer, flex: 1, lineHeight: 18 },
  resendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: SPACE.lg, paddingVertical: SPACE.sm },
  resendText: { fontSize: FONT.sm, color: COLORS.brand, fontWeight: FONT.w6 },
  doneIcon: { width: 84, height: 84, borderRadius: 42, backgroundColor: COLORS.success, alignItems: 'center', justifyContent: 'center', marginBottom: SPACE.lg, ...SHADOW.md },
  doneTitle: { fontSize: FONT.xxl, fontWeight: FONT.w8, color: COLORS.text, marginBottom: SPACE.sm },
  doneSub: { fontSize: FONT.sm, color: COLORS.textTer, textAlign: 'center', lineHeight: 20 },

  // OTP Boxes
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  otpBox: {
    flex: 1, height: 56, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md,
    backgroundColor: COLORS.bg, fontSize: FONT.xl, fontWeight: FONT.w8, color: COLORS.text,
  },
  otpBoxFilled: { borderColor: COLORS.brand, backgroundColor: COLORS.brandLight },
  otpBoxError: { borderColor: COLORS.error, backgroundColor: COLORS.errorLight },
});
