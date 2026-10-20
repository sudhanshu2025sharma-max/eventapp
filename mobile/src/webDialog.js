import React, { useSyncExternalStore } from 'react';
import { Alert, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

let currentDialog = null;
const pendingDialogs = [];
const listeners = new Set();

function publish(next) {
  currentDialog = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function showWebAlert(title, message, buttons, options = {}) {
  const choices = Array.isArray(buttons) && buttons.length
    ? buttons
    : [{ text: 'OK', style: 'default' }];
  const dialog = { title: String(title || ''), message: String(message || ''), buttons: choices, options };
  if (currentDialog) pendingDialogs.push(dialog);
  else publish(dialog);
}

export function installWebAlert() {
  if (Platform.OS === 'web') Alert.alert = showWebAlert;
}

export function WebDialogHost() {
  const dialog = useSyncExternalStore(subscribe, () => currentDialog, () => null);
  const close = (button) => {
    if (currentDialog !== dialog || !dialog) return;
    if (!button && dialog.options.cancelable === false) return;
    publish(pendingDialogs.shift() || null);
    button?.onPress?.();
    if (!button) dialog.options.onDismiss?.();
  };

  return (
    <Modal transparent visible={!!dialog} animationType="fade" onRequestClose={() => close()}>
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityRole="alert">
          <Text style={styles.title}>{dialog?.title}</Text>
          {!!dialog?.message && <Text style={styles.message}>{dialog.message}</Text>}
          <View style={styles.actions}>
            {dialog?.buttons.map((button, index) => (
              <Pressable
                key={`${button.text || 'button'}-${index}`}
                accessibilityRole="button"
                onPress={() => close(button)}
                style={[styles.button, button.style === 'destructive' && styles.destructive]}
              >
                <Text style={[styles.buttonText, button.style === 'destructive' && styles.destructiveText]}>
                  {button.text || 'OK'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: 'rgba(15,23,42,0.48)' },
  card: { width: '100%', maxWidth: 380, borderRadius: 22, padding: 22, backgroundColor: '#fff', shadowColor: '#0f172a', shadowOpacity: 0.2, shadowRadius: 24, elevation: 12 },
  title: { color: '#0f172a', fontSize: 18, fontWeight: '800' },
  message: { color: '#475569', fontSize: 14, lineHeight: 21, marginTop: 10 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8, marginTop: 22 },
  button: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#eff6ff' },
  destructive: { backgroundColor: '#fee2e2' },
  buttonText: { color: '#1d4ed8', fontSize: 14, fontWeight: '700' },
  destructiveText: { color: '#b91c1c' },
});
