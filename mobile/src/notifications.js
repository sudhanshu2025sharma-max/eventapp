import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Linking, Platform } from 'react-native';
import { apiFetch } from './api';

const EAS_PROJECT_ID = 'afa28d7e-10d5-4e85-bed4-783b7371a56b';

// Detect if running inside Expo Go
const isExpoGo =
  Boolean(Constants.expoGoConfig) ||
  Constants.executionEnvironment === ExecutionEnvironment?.StoreClient ||
  Constants.executionEnvironment === 'storeClient' ||
  Constants.appOwnership === 'expo' ||
  Boolean(global.ExpoGo);

let Notifications = null;

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
    console.warn('Failed to load expo-notifications:', e);
    Notifications = null;
  }
}

let activeExpoToken = null;
let registrationError = '';

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
  if (Platform.OS === 'web' || isExpoGo || !Notifications) return 'unsupported';
  await prepareAndroidChannels();
  const permission = await Notifications.getPermissionsAsync();
  if (permission.granted || permission.status === 'granted') return 'subscribed';
  return permission.canAskAgain === false ? 'denied' : 'unsubscribed';
}

export function getPushRegistrationError() { return registrationError; }
export function openNotificationSettings() { return Linking.openSettings(); }

export async function registerForPushNotificationsAsync(options = {}) {
  if (Platform.OS === 'web' || isExpoGo || !Notifications) {
    console.log('ℹ️ Running in Expo Go: Push Notifications skipped.');
    return null;
  }

  try {
    registrationError = '';
    // Android 13 needs a notification channel before requesting permission.
    await prepareAndroidChannels();
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted' && options.requestPermission !== false) {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Push notification permission denied by user.');
      return null;
    }

    const projectId = Constants?.expoConfig?.extra?.eas?.projectId || EAS_PROJECT_ID;
    const expoTokenObj = await Notifications.getExpoPushTokenAsync({ projectId });
    const expoToken = expoTokenObj?.data;

    if (expoToken) {
      const response = await apiFetch('/notifications/tokens/', {
        method: 'POST',
        body: JSON.stringify({
          token: expoToken,
          platform: Platform.OS,
        }),
      });
      if (!response.ok) throw new Error(`Notification registration failed (HTTP ${response.status}).`);
      activeExpoToken = expoToken;
      console.log('Push registration confirmed by the server.');
    }
    return expoToken;
  } catch (error) {
    registrationError = error.message || 'Notification registration failed. Please retry.';
    console.warn('registerForPushNotifications warning:', error.message || error);
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

    return () => {
      try {
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
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const readySubscription = navigator.serviceWorker.ready.then((registration) => registration.pushManager.getSubscription());
      const subscription = await Promise.race([
        readySubscription,
        new Promise((resolve) => setTimeout(() => resolve(null), 1500)),
      ]);
      if (subscription) {
        await apiFetch('/notifications/web-push/unsubscribe/', {
          method: 'POST', body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      return;
    }
    const registeredToken = token || activeExpoToken;
    if (registeredToken) {
      await apiFetch('/notifications/unregister-token/', {
        method: 'POST', body: JSON.stringify({ token: registeredToken }),
      });
      activeExpoToken = null;
    }
  } catch (error) {
    console.warn('Push unregistration warning:', error.message || error);
  }
}
