import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Linking, Platform } from 'react-native';
import { apiFetch, getTokens } from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const EAS_PROJECT_ID = 'afa28d7e-10d5-4e85-bed4-783b7371a56b';

const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment?.StoreClient ||
  Constants.executionEnvironment === 'storeClient' ||
  Constants.appOwnership === 'expo';

console.log('[PUSH] env:', Constants.executionEnvironment,
  '| ownership:', Constants.appOwnership,
  '| isExpoGo:', isExpoGo,
  '| platform:', Platform.OS);

let Notifications = null;
if (Platform.OS !== 'web' && !isExpoGo) {
  try {
    Notifications = require('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
    console.log('[PUSH] expo-notifications initialized OK');
  } catch (e) {
    console.warn('[PUSH] Failed to load expo-notifications:', e);
    Notifications = null;
  }
}

let activeExpoToken = null;
let lastPushRegistrationError = '';
let registerInFlightPromise = null;
const TOKEN_STORAGE_KEY = 'etd_native_push_token';

export function getPushRegistrationError() {
  return lastPushRegistrationError;
}

async function prepareAndroidChannels() {
  if (Platform.OS !== 'android' || !Notifications) return;
  try {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'General Notifications',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0333b6',
    });
    await Notifications.setNotificationChannelAsync('chat', {
      name: 'Chat & Messages',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 100, 100, 100],
      lightColor: '#7C3AED',
    });
  } catch (e) {
    console.warn('[PUSH] Channel setup warning:', e);
  }
}

function hasPushPermission(permission) {
  if (!permission) return false;
  return permission.granted || permission.status === 'granted' ||
    (Platform.OS === 'ios' && [
      Notifications?.IosAuthorizationStatus?.AUTHORIZED,
      Notifications?.IosAuthorizationStatus?.PROVISIONAL,
      Notifications?.IosAuthorizationStatus?.EPHEMERAL,
    ].some(s => s !== undefined && permission.ios?.status === s));
}

export async function registerForPushNotifications() {
  if (registerInFlightPromise) {
    return registerInFlightPromise;
  }

  registerInFlightPromise = (async () => {
    lastPushRegistrationError = '';

    if (Platform.OS === 'web' || isExpoGo) {
      console.log('[PUSH] Skipped: web or Expo Go environment');
      lastPushRegistrationError = 'Push notifications require a native standalone build (Expo Go / Web not supported)';
      return null;
    }
    if (!Notifications) {
      console.warn('[PUSH] Skipped: Notifications module unavailable');
      lastPushRegistrationError = 'Notifications module unavailable';
      return null;
    }

    const tokens = getTokens();
    if (!tokens?.access) {
      console.warn('[PUSH] Skipped: User not authenticated');
      lastPushRegistrationError = 'User not authenticated';
      return null;
    }

    try {
      await prepareAndroidChannels();

      let permission = await Notifications.getPermissionsAsync();
      if (!hasPushPermission(permission)) {
        console.log('[PUSH] Requesting native permissions...');
        permission = await Notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowBadge: true, allowSound: true },
        });
      }

      if (!hasPushPermission(permission)) {
        console.warn('[PUSH] Permission denied by user');
        lastPushRegistrationError = 'Permission denied by user';
        return null;
      }

      const projectId = Constants?.expoConfig?.extra?.eas?.projectId
        || Constants?.easConfig?.projectId
        || EAS_PROJECT_ID;

      console.log('[PUSH] Requesting Expo push token for project:', projectId);

      const tokenPromise = Notifications.getExpoPushTokenAsync({ projectId });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Push token acquisition timed out after 15s')), 15000)
      );

      const expoTokenObj = await Promise.race([tokenPromise, timeoutPromise]);
      const expoToken = expoTokenObj?.data;

      if (!expoToken) {
        console.warn('[PUSH] Push service returned empty token');
        lastPushRegistrationError = 'Push service returned empty token';
        return null;
      }

      console.log('[PUSH] Push token obtained:', expoToken.substring(0, 35) + '...');

      const response = await apiFetch('/notifications/tokens/', {
        method: 'POST',
        body: JSON.stringify({ token: expoToken, platform: Platform.OS }),
        timeoutMs: 15000,
      });

      if (!response.ok) {
        const msg = `Backend token registration failed HTTP ${response.status}`;
        console.warn('[PUSH]', msg);
        lastPushRegistrationError = msg;
        return null;
      }

      const result = await response.json();
      if (result.success !== true) {
        const msg = `Backend rejected push token: ${result.error || 'Unknown error'}`;
        console.warn('[PUSH]', msg);
        lastPushRegistrationError = msg;
        return null;
      }

      activeExpoToken = expoToken;
      await AsyncStorage.setItem(TOKEN_STORAGE_KEY, expoToken).catch(() => {});
      console.log('[PUSH] ✅ TOKEN SUCCESSFULLY REGISTERED WITH BACKEND!');
      return expoToken;
    } catch (error) {
      const msg = error.message || String(error);
      console.warn('[PUSH] Registration error:', msg);
      lastPushRegistrationError = msg;
      return null;
    }
  })();

  try {
    return await registerInFlightPromise;
  } finally {
    registerInFlightPromise = null;
  }
}

export const registerForPushNotificationsAsync = registerForPushNotifications;

export function setupNotificationListeners(onNotificationReceived, onNotificationResponse) {
  if (Platform.OS === 'web' || isExpoGo || !Notifications) return () => {};
  try {
    if (typeof Notifications.getLastNotificationResponseAsync === 'function') {
      Notifications.getLastNotificationResponseAsync().then(response => {
        if (response && typeof onNotificationResponse === 'function') {
          onNotificationResponse(response);
        }
      }).catch(() => {});
    }

    const receivedSub = Notifications.addNotificationReceivedListener?.(n => {
      onNotificationReceived?.(n);
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener?.(r => {
      onNotificationResponse?.(r);
    });

    const tokenSub = Notifications.addPushTokenListener?.(() => {
      registerForPushNotifications();
    });

    return () => {
      try {
        tokenSub?.remove();
        receivedSub?.remove();
        responseSub?.remove();
      } catch (e) {}
    };
  } catch (e) {
    return () => {};
  }
}

export async function getPushPermissionState() {
  if (Platform.OS === 'web' || isExpoGo) return 'unsupported';
  if (!Notifications) return 'unsupported';
  await prepareAndroidChannels();
  const p = await Notifications.getPermissionsAsync();
  if (hasPushPermission(p)) return 'subscribed';
  return p.canAskAgain === false ? 'denied' : 'unsubscribed';
}

export function openNotificationSettings() { return Linking.openSettings(); }

export async function sendLocalNotification(title, body, data = {}) {
  if (isExpoGo || !Notifications) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data, sound: 'default' },
      trigger: null,
    });
  } catch (e) {}
}

export async function unregisterPushForCurrentDevice(token) {
  try {
    if (Platform.OS === 'web') return;
    const t = token || activeExpoToken || await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
    if (t) {
      await apiFetch('/notifications/unregister-token/', {
        method: 'POST',
        body: JSON.stringify({ token: t }),
        timeoutMs: 10000,
      });
      activeExpoToken = null;
      await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch (e) {}
}
