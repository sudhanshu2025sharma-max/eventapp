import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StatusBar, KeyboardAvoidingView, Platform, Animated, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, SPACE, RADIUS, SHADOW, API_URL, API_HEADERS } from '../theme';
import { PrimaryButton, FadeIn, GlassCard, Divider } from '../components';

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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailErr, setEmailErr] = useState('');
  const [pwdErr, setPwdErr] = useState('');
  const [apiErr, setApiErr] = useState('');

  const logoScale = useRef(new Animated.Value(0.7)).current;
  const logoOp = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(logoScale, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
      Animated.timing(logoOp, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

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
    setLoading(true); 
    setApiErr('');
    
    const targetUrl = `${API_URL}/auth/login/`;
    let responseData = null;

    // 1. Network Request Phase
    try {
      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });

      const text = await res.text();

      try {
        responseData = JSON.parse(text);
      } catch (jsonErr) {
        setApiErr(`Server error (${res.status}): ${text.slice(0, 100)}`);
        setLoading(false);
        return;
      }

      if (!res.ok || !responseData.success) {
        const msg = responseData.non_field_errors?.[0] || responseData.detail || responseData.message || `Login failed (${res.status})`;
        setApiErr(msg);
        setLoading(false);
        return;
      }
    } catch (netErr) {
      setApiErr(`Network error: ${netErr.message || String(netErr)}\nURL: ${targetUrl}`);
      setLoading(false);
      return;
    }

    // 2. State & Session Phase (isolated from network catch)
    try {
      if (responseData && responseData.user && responseData.tokens) {
        await onLogin(responseData.user, responseData.tokens);
      }
    } catch (appErr) {
      setApiErr(`App session error: ${appErr.message || String(appErr)}`);
    }

    setLoading(false);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="light-content" />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#0333b6', '#0245c7']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={st.header}>
          <View style={st.deco1} />
          <View style={st.deco2} />
          <Animated.View style={{ alignItems: 'center', transform: [{ scale: logoScale }], opacity: logoOp }}>
            <GlassCard style={st.logoBox}><Text style={st.logoText}>ETD</Text></GlassCard>
            <Text style={st.appName}>ETD 2026</Text>
            <Text style={st.tagline}>ETDs in the age of AI</Text>
            <View style={st.accentRow}>
              <View style={st.accentDash} /><View style={st.accentDot} /><View style={st.accentDash} />
            </View>
          </Animated.View>
        </LinearGradient>

        <View style={{ backgroundColor: '#0245c7', height: 30 }}><View style={st.curve} /></View>

        <View style={st.formWrap}>
          <FadeIn delay={200}>
            <View style={st.card}>
              <Text style={st.title}>Welcome back</Text>
              <Text style={st.subtitle}>Sign in with your conference credentials</Text>

              {!!apiErr && (
                <FadeIn>
                  <View style={st.errBox}>
                    <Ionicons name="warning" size={16} color={COLORS.error} style={{ marginRight: SPACE.sm, marginTop: 2 }} />
                    <Text style={st.errText}>{apiErr}</Text>
                  </View>
                </FadeIn>
              )}

              <Text style={st.label}>Email Address</Text>
              <Field 
                icon="mail-outline" 
                placeholder="you@example.com" 
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

              <PrimaryButton label="Sign In" onPress={handleLogin} loading={loading} />
              <Divider style={{ marginVertical: SPACE.xl }} />
              <View style={st.infoRow}>
                <Ionicons name="globe-outline" size={14} color={COLORS.brand} style={{ marginRight: SPACE.xs }} />
                <Text style={st.infoText}>etd2026.iitd.ac.in</Text>
                <View style={st.infoDot} />
                <Text style={st.infoText}>IIT Delhi</Text>
              </View>
            </View>
          </FadeIn>
          <FadeIn delay={400}>
            <Text style={st.footer}>Need help? Contact the conference organizer</Text>
            <Text style={st.version}>ETD 2026  ·  IIT Delhi  ·  v1.0</Text>
          </FadeIn>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  header: { paddingTop: Platform.OS === 'ios' ? 72 : 60, paddingBottom: 52, alignItems: 'center', overflow: 'hidden' },
  deco1: { position: 'absolute', width: 200, height: 200, borderRadius: 100, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', top: -50, right: -50 },
  deco2: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(245,158,11,0.06)', bottom: 20, left: -30 },
  logoBox: { width: 80, height: 80, borderRadius: RADIUS.xl, alignItems: 'center', justifyContent: 'center', marginBottom: SPACE.lg, backgroundColor: 'rgba(255,255,255,0.10)', borderColor: 'rgba(255,255,255,0.20)' },
  logoText: { fontSize: FONT.xl, fontWeight: FONT.w9, color: COLORS.textInverse, letterSpacing: 2 },
  appName: { fontSize: FONT.xxxl, fontWeight: FONT.w9, color: COLORS.textInverse, letterSpacing: 0.5 },
  tagline: { fontSize: FONT.sm, color: 'rgba(255,255,255,0.58)', marginTop: SPACE.xs, letterSpacing: 0.3 },
  accentRow: { flexDirection: 'row', alignItems: 'center', marginTop: SPACE.lg },
  accentDash: { width: 28, height: 2, backgroundColor: COLORS.accent, borderRadius: 2 },
  accentDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.accent, marginHorizontal: SPACE.xs },
  curve: { flex: 1, backgroundColor: COLORS.bg, borderTopLeftRadius: RADIUS.xxxl, borderTopRightRadius: RADIUS.xxxl },
  formWrap: { backgroundColor: COLORS.bg, paddingHorizontal: SPACE.xl, paddingBottom: SPACE.xxxl, marginTop: -6 },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl, padding: SPACE.xxl, ...SHADOW.lg, borderWidth: Platform.OS === 'android' ? 1 : 0, borderColor: COLORS.borderLight },
  title: { fontSize: FONT.xxl, fontWeight: FONT.w8, color: COLORS.text, letterSpacing: -0.3 },
  subtitle: { fontSize: FONT.sm, color: COLORS.textTer, marginTop: 4, marginBottom: SPACE.xxl },
  errBox: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: COLORS.errorLight, padding: SPACE.md, borderRadius: RADIUS.md, marginBottom: SPACE.lg, borderWidth: 1, borderColor: '#fecaca' },
  errText: { flex: 1, fontSize: FONT.xs, color: COLORS.error, fontWeight: FONT.w5, lineHeight: 18 },
  label: { fontSize: FONT.sm, fontWeight: FONT.w6, color: COLORS.textSec, marginBottom: SPACE.sm },
  fieldRow: { flexDirection: 'row', alignItems: 'center', height: 52, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.lg, backgroundColor: COLORS.bg, paddingHorizontal: SPACE.md },
  fieldInput: { flex: 1, fontSize: FONT.base, color: COLORS.text },
  fieldErr: { flexDirection: 'row', alignItems: 'center', marginTop: SPACE.xs, marginLeft: 2 },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  infoText: { fontSize: FONT.xs, color: COLORS.textTer, fontWeight: FONT.w5 },
  infoDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: COLORS.textMuted, marginHorizontal: SPACE.sm },
  footer: { textAlign: 'center', fontSize: FONT.xs, color: COLORS.textTer, marginTop: SPACE.xxl },
  version: { textAlign: 'center', fontSize: FONT.xs, color: COLORS.textTer, marginTop: 4, opacity: 0.5 },
});
