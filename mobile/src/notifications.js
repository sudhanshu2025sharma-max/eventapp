import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Linking, Platform } from 'react-native';
import { apiFetch, getTokens } from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const EAS_PROJECT_ID = 'afa28d7e-10d5-4e85-bed4-783b7371a56b';

// Detect if running inside Expo Go
const isExpoGo =
  Boolean(Constants.expoGoConfig) ||
  Constants.executionEnvironment === ExecutionEnvironment?.StoreClient ||
  Constants.executionEnvironment === 'storeClient' ||
  Constants.appOwnership === 'expo' ||
  Boolean(global.ExpoGo);

let Notifications = null;
let moduleLoadError = null;

// ONLY load and initialize expo-notifications when NOT running in Expo Go
if (Platform.OS !== 'web' && !isExpoGo) {
  try {
    Notifications = require('expo-notifications');
    if (Notifications && typeof Notifications.setNotificationHandler === 'function') {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowAlert: true,
        }),
      });
    }
  } catch (e) {
    moduleLoadError = e;
    console.warn('Failed to load expo-notifications:', e);
    Notifications = null;
  }
}

let activeExpoToken = null;
let registrationError = '';
let registrationPromise = null;
const TOKEN_STORAGE_KEY = 'etd_native_push_token';

async function withRegistrationTimeout(promise, message) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), 20000);
    })]);
  } finally { clearTimeout(timer); }
}

function hasPushPermission(permission) {
  return permission.granted || permission.status === 'granted' ||
    (Platform.OS === 'ios' && [
      Notifications?.IosAuthorizationStatus?.AUTHORIZED,
      Notifications?.IosAuthorizationStatus?.PROVISIONAL,
      Notifications?.IosAuthorizationStatus?.EPHEMERAL,
    ].some(status => status !== undefined && permission.ios?.status === status));
}

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

export async function getPushPermissionState() {
  if (Platform.OS === 'web' || isExpoGo) return 'unsupported';
  if (!Notifications) throw new Error(moduleLoadError?.message || 'Notifications are unavailable in this build. Install the latest version and retry.');
  await prepareAndroidChannels();
  const permission = await Notifications.getPermissionsAsync();
  if (hasPushPermission(permission)) return 'subscribed';
  return permission.canAskAgain === false ? 'denied' : 'unsubscribed';
}

export function getPushRegistrationError() { return registrationError; }
export function openNotificationSettings() { return Linking.openSettings(); }

export async function registerForPushNotificationsAsync(options = {}) {
  if (Platform.OS === 'web' || isExpoGo) return null;
  if (registrationPromise) return registrationPromise;
  registrationPromise = registerNativePush(options);
  try { return await registrationPromise; }
  finally { registrationPromise = null; }
}

async function registerNativePush(options) {
  try {
    registrationError = '';
    if (!Notifications) throw new Error(moduleLoadError?.message || 'Notifications are unavailable in this build.');
    const session = getTokens()?.refresh;
    if (!getTokens()?.access) throw new Error('Sign in before setting up notifications.');
    await prepareAndroidChannels();
    let permission = await Notifications.getPermissionsAsync();
    if (!hasPushPermission(permission) && options.requestPermission !== false) {
      permission = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      });
    }
    if (!hasPushPermission(permission)) {
      registrationError = 'Notifications are blocked. Allow them in your device settings to receive alerts.';
      return null;
    }
    const projectId = Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId || EAS_PROJECT_ID;
    const expoTokenObj = await withRegistrationTimeout(
      Notifications.getExpoPushTokenAsync({ projectId }),
      'Could not obtain a push token. Check your connection and device push services, then retry.',
    );
    const expoToken = expoTokenObj?.data;
    if (!expoToken) throw new Error('The push service returned no device token. Please retry.');
    if (!getTokens()?.access || getTokens()?.refresh !== session) return null;
    const response = await apiFetch('/notifications/tokens/', {
      method: 'POST', timeoutMs: 15000,
      body: JSON.stringify({ token: expoToken, platform: Platform.OS }),
    });
    if (!response.ok) throw new Error(`Notification registration failed (HTTP ${response.status}). Please retry.`);
    const result = await response.json();
    if (result.success !== true) throw new Error('The server did not confirm notification registration. Please retry.');
    activeExpoToken = expoToken;
    await AsyncStorage.setItem(TOKEN_STORAGE_KEY, expoToken).catch(() => {});
    console.log('Push registration confirmed by the server.');
    return expoToken;
  } catch (error) {
    registrationError = error.message || 'Notification registration failed. Please retry.';
    console.warn('Push registration failed:', registrationError);
    return null;
  }
}

export const registerForPushNotifications = registerForPushNotificationsAsync;

export function setupNotificationListeners(onNotificationReceived, onNotificationResponse) {
  if (Platform.OS === 'web' || isExpoGo || !Notifications) {
    return () => {};
  }

  try {
    // Check for cold-start notification response (app opened via notification tap when terminated)
    if (typeof Notifications.getLastNotificationResponseAsync === 'function') {
      Notifications.getLastNotificationResponseAsync().then(response => {
        if (response && typeof onNotificationResponse === 'function') {
          onNotificationResponse(response);
        }
      }).catch(() => {});
    }

    const receivedSub = typeof Notifications.addNotificationReceivedListener === 'function'
      ? Notifications.addNotificationReceivedListener(notification => {
          if (typeof onNotificationReceived === 'function') {
            onNotificationReceived(notification);
          }
        })
      : null;

    const responseSub = typeof Notifications.addNotificationResponseReceivedListener === 'function'
      ? Notifications.addNotificationResponseReceivedListener(response => {
          if (typeof onNotificationResponse === 'function') {
            onNotificationResponse(response);
          }
        })
      : null;

    const tokenSub = Notifications.addPushTokenListener?.(() => {
      registerForPushNotificationsAsync({ requestPermission: false });
    });

    return () => {
      try {
        tokenSub?.remove();
        if (receivedSub && typeof receivedSub.remove === 'function') receivedSub.remove();
        if (responseSub && typeof responseSub.remove === 'function') responseSub.remove();
      } catch (e) {}
    };
  } catch (e) {
    console.warn('setupNotificationListeners error:', e);
    return () => {};
  }
}

export async function sendLocalNotification(title, body, data = {}) {
  if (isExpoGo || !Notifications || typeof Notifications.scheduleNotificationAsync !== 'function') return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: 'default',
      },
      trigger: null,
    });
  } catch (e) {
    console.warn('sendLocalNotification error:', e);
  }
}

export async function unregisterPushForCurrentDevice(token) {
  try {
    if (Platform.OS === 'web') return;
    const registeredToken = token || activeExpoToken || await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
    if (registeredToken) {
      const response = await apiFetch('/notifications/unregister-token/', {
        method: 'POST', timeoutMs: 10000, body: JSON.stringify({ token: registeredToken }),
      });
      if (!response.ok) throw new Error(`Notification unregistration failed (HTTP ${response.status}).`);
      activeExpoToken = null;
      await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch (error) {
    console.warn('Push unregistration warning:', error.message || error);
  }
}
