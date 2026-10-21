import React, { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { preparePushPermission, enablePushPermission, openPushSettings } from './pushPermission';

const promptKey = (userId, state) => `etd_notification_prompt_v2:${userId}:${state}`;

export default function NotificationPermissionPrompt({ active, userId, onRegistered }) {
  const [state, setState] = useState('checking');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const [setupError, setSetupError] = useState('');
  const dismissedThisSession = useRef(new Set());
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
        const shouldPrompt = ['unsubscribed', 'denied', 'registration_failed'].includes(result.state);
        const key = promptKey(userId, result.state);
        const dismissed = dismissedThisSession.current.has(key) || (shouldPrompt && result.state !== 'registration_failed' && await AsyncStorage.getItem(key));
        if (!canceled) setVisible(shouldPrompt && !dismissed);
      } catch (error) {
        console.warn('Notification setup:', error.message);
        if (!canceled) {
          setState('registration_failed');
          setSetupError(error.message || 'Notification setup failed. Please retry.');
          setVisible(!dismissedThisSession.current.has(promptKey(userId, 'registration_failed')));
        }
      }
    };
    check();
    const listener = AppState.addEventListener('change', next => { if (next === 'active') check(); });
    return () => { canceled = true; listener.remove(); };
  }, [active, userId, retry]);

  const dismiss = () => {
    setVisible(false);
    const key = promptKey(userId, state);
    dismissedThisSession.current.add(key);
    if (state !== 'registration_failed') AsyncStorage.setItem(key, 'dismissed').catch(() => {});
  };

  const enable = async () => {
    setBusy(true);
    try {
      const result = await (state === 'denied' ? openPushSettings() : enablePushPermission());
      if (result?.token) {
        onRegisteredRef.current?.(result.token);
        setVisible(false);
      } else if (result?.state === 'registration_failed' || result?.error) {
        setState('registration_failed');
        setSetupError(result.error || 'Failed to register notifications.');
      } else {
        setVisible(false);
      }
    } catch (error) {
      setState('registration_failed');
      setSetupError(error.message || 'Notification setup failed.');
    } finally {
      setBusy(false);
    }
  };

  if (!visible || !active) return null;
  return (
    <Modal transparent visible animationType="fade" onRequestClose={dismiss}>
      <View style={s.backdrop}>
        <View style={s.card} accessibilityRole="alert">
          <Text style={s.title}>{state === 'registration_failed' ? 'Finish notification setup' : 'Allow conference notifications'}</Text>
          <Text style={s.message}>Without permission, you won’t receive notification alerts for conference updates. You can still read notices in the app.</Text>
          {state === 'denied' && <Text style={s.message}>Notifications are currently blocked. You can allow them in your device settings.</Text>}
          {!!setupError && <Text style={s.message}>{setupError}</Text>}
          <View style={s.actions}>
            <Pressable onPress={dismiss} disabled={busy} style={s.secondary}><Text style={s.secondaryText}>Not now</Text></Pressable>
            <Pressable onPress={enable} disabled={busy} style={s.primary}><Text style={s.primaryText}>{busy ? 'Please wait…' : state === 'denied' ? 'Open settings' : state === 'registration_failed' ? 'Retry' : 'Allow notifications'}</Text></Pressable>
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
