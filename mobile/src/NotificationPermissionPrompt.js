import React, { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { preparePushPermission, enablePushPermission, openPushSettings } from './pushPermission';

const promptKey = state => `etd_notification_prompt_v1:${state}`;

export default function NotificationPermissionPrompt({ active, userId, onRegistered }) {
  const [state, setState] = useState('checking');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const [setupError, setSetupError] = useState('');
  const onRegisteredRef = useRef(onRegistered);
  onRegisteredRef.current = onRegistered;

  useEffect(() => {
    if (!active) { setVisible(false); return; }
    let canceled = false;
    const check = async () => {
      try {
        const result = await preparePushPermission();
        if (canceled) return;
        setState(result.state);
        setSetupError(result.error || '');
        if (result.token) onRegisteredRef.current?.(result.token);
        const shouldPrompt = ['unsubscribed', 'denied', 'registration_failed'].includes(result.state) || (Platform.OS === 'web' && result.state === 'unsupported');
        const dismissed = shouldPrompt && await AsyncStorage.getItem(promptKey(result.state));
        if (!canceled) setVisible(shouldPrompt && !dismissed);
      } catch (error) {
        console.warn('Notification setup:', error.message);
      }
    };
    check();
    const listener = AppState.addEventListener('change', next => { if (next === 'active') check(); });
    return () => { canceled = true; listener.remove(); };
  }, [active, userId, retry]);

  const dismiss = () => {
    setVisible(false);
    AsyncStorage.setItem(promptKey(state), 'dismissed').catch(() => {});
  };

  const enable = async () => {
    setBusy(true);
    try {
      const result = await (state === 'denied' ? openPushSettings() : enablePushPermission());
      if (result?.token) onRegisteredRef.current?.(result.token);
      setVisible(false);
    } catch (error) {
      setVisible(false);
      Alert.alert('Notification alerts', error.message, [{ text: 'OK', onPress: () => setRetry(value => value + 1) }]);
    } finally {
      setBusy(false);
    }
  };

  if (!visible || !active) return null;
  const unsupported = state === 'unsupported';
  return (
    <Modal transparent visible animationType="fade" onRequestClose={dismiss}>
      <View style={s.backdrop}>
        <View style={s.card} accessibilityRole="alert">
          <Text style={s.title}>{unsupported ? 'Install for notification alerts' : state === 'registration_failed' ? 'Finish notification setup' : 'Allow conference notifications'}</Text>
          <Text style={s.message}>Without permission, you won’t receive notification alerts for conference updates. You can still read notices in the app.</Text>
          {unsupported && <Text style={s.message}>On iPhone or iPad with iOS 16.4 or later, open this site in Safari, use Share → Add to Home Screen, then open the installed app and allow notifications.</Text>}
          {state === 'denied' && <Text style={s.message}>Notifications are currently blocked. You can allow them in your device or browser settings.</Text>}
          {!!setupError && <Text style={s.message}>{setupError}</Text>}
          <View style={s.actions}>
            <Pressable onPress={dismiss} disabled={busy} style={s.secondary}><Text style={s.secondaryText}>{unsupported ? 'Got it' : 'Not now'}</Text></Pressable>
            {!unsupported && <Pressable onPress={enable} disabled={busy} style={s.primary}><Text style={s.primaryText}>{busy ? 'Please wait…' : state === 'denied' ? 'Open settings' : state === 'registration_failed' ? 'Retry' : 'Allow notifications'}</Text></Pressable>}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(15,23,42,0.48)' },
  card: { width: '100%', maxWidth: 400, padding: 24, borderRadius: 22, backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  message: { marginTop: 12, fontSize: 15, lineHeight: 22, color: '#475569' },
  actions: { marginTop: 22, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 },
  secondary: { paddingHorizontal: 14, paddingVertical: 12 },
  secondaryText: { color: '#475569', fontWeight: '700' },
  primary: { backgroundColor: '#0333b6', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 },
  primaryText: { color: '#fff', fontWeight: '700' },
});
