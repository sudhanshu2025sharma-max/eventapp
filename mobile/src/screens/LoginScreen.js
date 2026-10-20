import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StatusBar,
  KeyboardAvoidingView, Platform, Animated, StyleSheet, Image, Linking, Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, SPACE, RADIUS, SHADOW, API_URL, API_HEADERS } from '../theme';
import { PrimaryButton, FadeIn } from '../components';
import ForgotPasswordScreen from './ForgotPasswordScreen';

function Field({ icon, placeholder, value, onChange, secure, right, error, keyboardType }) {
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
          secureTextEntry={secure}
          keyboardType={keyboardType}
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

export default function LoginScreen({ onLogin }) {
  const [showForgot, setShowForgot] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailErr, setEmailErr] = useState('');
  const [pwdErr, setPwdErr] = useState('');
  const [apiErr, setApiErr] = useState('');

  // ── Enterprise motion: entrance + imperceptible breath + error shake ──
  const logoOp = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.92)).current;
  const logoBreath = useRef(new Animated.Value(1)).current;
  const titleOp = useRef(new Animated.Value(0)).current;
  const titleY = useRef(new Animated.Value(8)).current;
  const cardOp = useRef(new Animated.Value(0)).current;
  const cardY = useRef(new Animated.Value(24)).current;
  const errShake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance sequence: logo → title → card (staggered, purposeful)
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOp, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(logoScale, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(titleOp, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(titleY, { toValue: 0, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(cardOp, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(cardY, { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start(() => {
      // After entrance settles, start the barely-perceptible breath (Revolut/N26 pattern)
      Animated.loop(
        Animated.sequence([
          Animated.timing(logoBreath, { toValue: 1.015, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(logoBreath, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ).start();
    });
  }, []);

  const shakeError = () => {
    Animated.sequence([
      Animated.timing(errShake, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(errShake, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(errShake, { toValue: 5, duration: 50, useNativeDriver: true }),
      Animated.timing(errShake, { toValue: -5, duration: 50, useNativeDriver: true }),
      Animated.timing(errShake, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  if (showForgot) {
    return <ForgotPasswordScreen onBack={() => setShowForgot(false)} initialEmail={email} />;
  }

  const validate = () => {
    let ok = true;
    if (!email.trim()) { setEmailErr('Email is required'); ok = false; } else setEmailErr('');
    if (!password) { setPwdErr('Password is required'); ok = false; }
    else if (password.length < 6) { setPwdErr('Minimum 6 characters'); ok = false; }
    else setPwdErr('');
    return ok;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true); setApiErr('');
    try {
      const res = await fetch(`${API_URL}/auth/login/`, {
        method: 'POST', headers: API_HEADERS,
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { setApiErr('Invalid server response'); shakeError(); setLoading(false); return; }
      if (res.ok && data.success) onLogin(data.user, data.tokens);
      else { setApiErr(data.non_field_errors?.[0] || data.detail || data.message || 'Invalid credentials'); shakeError(); }
    } catch { setApiErr('Connection failed. Check your network.'); shakeError(); }
    setLoading(false);
  };

  const openPrivacy = () => Linking.openURL('https://etd2026.iitd.ac.in/app-privacy-policy/');

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: COLORS.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="light-content" />
      <ScrollView style={{ flex: 1, backgroundColor: COLORS.bg }} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false}>

        {/* ── HERO HEADER — Logo + Title only. Tight. Purposeful. ── */}
        <LinearGradient colors={['#0333b6', '#0245c7']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={st.header}>
          <Animated.View style={{
            opacity: logoOp,
            transform: [{ scale: Animated.multiply(logoScale, logoBreath) }],
          }}>
            <Image
              source={require('../../assets/etd_Logo-white.png')}
              style={st.logoImg}
              resizeMode="contain"
            />
          </Animated.View>

          <Animated.View style={{ opacity: titleOp, transform: [{ translateY: titleY }], alignItems: 'center' }}>
            <Text style={st.appName}>ETD 2026</Text>
            <Text style={st.tagline}>ETDs in the age of AI</Text>
          </Animated.View>
        </LinearGradient>

        <View style={{ backgroundColor: '#0245c7', height: 20 }}><View style={st.curve} /></View>

        <Animated.View style={[st.formWrap, { opacity: cardOp, transform: [{ translateY: cardY }] }]}>
          <View style={st.card}>
            <Text style={st.title}>Welcome to ETD 2026</Text>
            <Text style={st.subtitle}>Sign in to continue your conference journey</Text>

            {!!apiErr && (
              <Animated.View style={{ transform: [{ translateX: errShake }] }}>
                <View style={st.errBox}>
                  <Ionicons name="warning" size={16} color={COLORS.error} style={{ marginRight: SPACE.sm }} />
                  <Text style={st.errText} numberOfLines={2}>{apiErr}</Text>
                </View>
              </Animated.View>
            )}

            <Text style={st.label}>Email Address</Text>
            <Field
              icon="mail-outline"
              placeholder="sudhanshu@library.iitd.ac.in"
              value={email}
              onChange={t => { setEmail(t); setEmailErr(''); setApiErr(''); }}
              keyboardType="email-address"
              error={emailErr}
            />

            <Text style={st.label}>Password</Text>
            <Field
              icon="lock-closed-outline"
              placeholder="Enter your password"
              value={password}
              onChange={t => { setPassword(t); setPwdErr(''); setApiErr(''); }}
              secure={!showPwd}
              error={pwdErr}
              right={
                <TouchableOpacity onPress={() => setShowPwd(!showPwd)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.textTer} />
                </TouchableOpacity>
              }
            />

            <TouchableOpacity style={st.forgot} onPress={() => setShowForgot(true)} activeOpacity={0.7}>
              <Text style={{ fontSize: FONT.sm, fontWeight: FONT.w6, color: COLORS.brand }}>Forgot Password?</Text>
            </TouchableOpacity>

            <PrimaryButton label="Sign In" onPress={handleLogin} loading={loading} />

            <View style={[st.infoRow, { marginTop: SPACE.xl }]}>
              <Ionicons name="globe-outline" size={14} color={COLORS.brand} style={{ marginRight: SPACE.xs }} />
              <Text style={st.infoText}>etd2026.iitd.ac.in</Text>
              <View style={st.infoDot} />
              <Text style={st.infoText}>IIT Delhi</Text>
            </View>
          </View>

          <FadeIn delay={600}>
            <Text style={st.footer}>Need help? Contact the conference organizer</Text>
            <TouchableOpacity onPress={openPrivacy} activeOpacity={0.7} style={{ marginTop: SPACE.sm }}>
              <Text style={st.privacyLink}>Privacy Policy</Text>
            </TouchableOpacity>
            <Text style={st.version}>ETD 2026  ·  IIT Delhi  ·  v1.0</Text>
          </FadeIn>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  // ── HEADER: tight, logo-dominant, no decoration ──
  header: {
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
    paddingBottom: 20,
    alignItems: 'center',
    overflow: 'hidden',
  },

  // ── LOGO: 220px hero. Commanding presence. ──
  logoImg: {
    width: 250,
    height: 220,
     marginTop: -40,
  },

  // ── TITLE: single confident line ──
  appName: {
    fontSize: FONT.xxxl,
    fontWeight: FONT.w9,
    color: COLORS.textInverse,
    letterSpacing: 0.5,
    marginTop: -35,
  },
  tagline: {
    fontSize: FONT.sm,
    fontWeight: FONT.w5,
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 0.4,
    marginTop: 10,
    
  },

  curve: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: RADIUS.xxxl,
    borderTopRightRadius: RADIUS.xxxl,
  },

  formWrap: {
    flexGrow: 1,
    backgroundColor: COLORS.bg,
    paddingHorizontal: SPACE.xl,
    paddingBottom: SPACE.xxl,
    marginTop: -6,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xxl,
    padding: SPACE.xxl,
    ...SHADOW.lg,
    borderWidth: 0,
  },
  title: { fontSize: FONT.xxl, fontWeight: FONT.w8, color: COLORS.text, letterSpacing: -0.3 },
  subtitle: { fontSize: FONT.sm, color: COLORS.textTer, marginTop: 4, marginBottom: SPACE.xxl },

  errBox: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: COLORS.errorLight,
    padding: SPACE.md, borderRadius: RADIUS.md,
    marginBottom: SPACE.lg,
    borderWidth: 1, borderColor: '#fecaca',
  },
  errText: { flex: 1, fontSize: FONT.sm, color: COLORS.error, fontWeight: FONT.w5 },

  label: { fontSize: FONT.sm, fontWeight: FONT.w6, color: COLORS.textSec, marginBottom: SPACE.sm },
  fieldRow: {
    flexDirection: 'row', alignItems: 'center',
    height: 52,
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.lg,
    backgroundColor: COLORS.bg,
    paddingHorizontal: SPACE.md,
  },
  fieldInput: { flex: 1, fontSize: FONT.base, color: COLORS.text },
  fieldErr: { flexDirection: 'row', alignItems: 'center', marginTop: SPACE.xs, marginLeft: 2 },

  forgot: { alignSelf: 'flex-end', marginBottom: SPACE.xl, marginTop: SPACE.xs },

  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  infoText: { fontSize: FONT.xs, color: COLORS.textTer, fontWeight: FONT.w5 },
  infoDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: COLORS.textMuted, marginHorizontal: SPACE.sm },

  footer: { textAlign: 'center', fontSize: FONT.xs, color: COLORS.textTer, marginTop: SPACE.lg },
  privacyLink: { textAlign: 'center', fontSize: FONT.xs, color: COLORS.brand, fontWeight: FONT.w6, textDecorationLine: 'underline' },
  version: { textAlign: 'center', fontSize: FONT.xs, color: COLORS.textTer, marginTop: SPACE.sm, opacity: 0.5 },
});
