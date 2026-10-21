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
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
    console.log('[PUSH] expo-notifications loaded OK');
  } catch (e) {
    console.warn('[PUSH] Failed to load expo-notifications:', e);
    Notifications = null;
  }
}

let activeExpoToken = null;
const TOKEN_STORAGE_KEY = 'etd_native_push_token';

async function prepareAndroidChannels() {
  if (Platform.OS !== 'android' || !Notifications) return;
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
}

function hasPushPermission(permission) {
  return permission.granted || permission.status === 'granted' ||
    (Platform.OS === 'ios' && [
      Notifications?.IosAuthorizationStatus?.AUTHORIZED,
      Notifications?.IosAuthorizationStatus?.PROVISIONAL,
      Notifications?.IosAuthorizationStatus?.EPHEMERAL,
    ].some(s => s !== undefined && permission.ios?.status === s));
}

export async function registerForPushNotifications() {
  if (Platform.OS === 'web' || isExpoGo) return null;
  if (!Notifications) {
    console.warn('[PUSH] Notifications module not available');
    return null;
  }
  if (!getTokens()?.access) {
    console.warn('[PUSH] No auth token');
    return null;
  }
  try {
    await prepareAndroidChannels();
    let permission = await Notifications.getPermissionsAsync();
    if (!hasPushPermission(permission)) {
      permission = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      });
    }
    if (!hasPushPermission(permission)) {
      console.warn('[PUSH] Permission denied');
      return null;
    }
    const projectId = Constants?.expoConfig?.extra?.eas?.projectId
      || Constants?.easConfig?.projectId
      || EAS_PROJECT_ID;
    console.log('[PUSH] Getting device token...');
    const deviceToken = await Notifications.getDevicePushTokenAsync();
    console.log('[PUSH] Exchanging with Expo...');
    const expoTokenObj = await Notifications.getExpoPushTokenAsync({
      projectId,
      devicePushToken: deviceToken,
    });
    const expoToken = expoTokenObj?.data;
    if (!expoToken) {
      console.warn('[PUSH] No token from Expo');
      return null;
    }
    console.log('[PUSH] Token:', expoToken.substring(0, 30) + '...');
    const response = await apiFetch('/notifications/tokens/', {
      method: 'POST',
      body: JSON.stringify({ token: expoToken, platform: Platform.OS }),
    });
    if (!response.ok) {
      console.warn('[PUSH] Server rejected:', response.status);
      return null;
    }
    const result = await response.json();
    if (result.success !== true) {
      console.warn('[PUSH] Server did not confirm');
      return null;
    }
    activeExpoToken = expoToken;
    await AsyncStorage.setItem(TOKEN_STORAGE_KEY, expoToken).catch(() => {});
    console.log('[PUSH] ✅ Registered with server');
    return expoToken;
  } catch (error) {
    console.warn('[PUSH] Failed:', error.message || error);
    return null;
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
      try { tokenSub?.remove(); receivedSub?.remove(); responseSub?.remove(); } catch (e) {}
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

export function getPushRegistrationError() { return ''; }
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
      });
      activeExpoToken = null;
      await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch (e) {}
}
