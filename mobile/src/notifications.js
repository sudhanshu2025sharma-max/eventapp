import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
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
if (!isExpoGo) {
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

export async function registerForPushNotificationsAsync() {
  if (isExpoGo || !Notifications) {
    console.log('ℹ️ Running in Expo Go: Push Notifications skipped.');
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Push notification permission denied by user.');
      return null;
    }

    if (Platform.OS === 'android') {
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

    const projectId = Constants?.expoConfig?.extra?.eas?.projectId || EAS_PROJECT_ID;
    const expoTokenObj = await Notifications.getExpoPushTokenAsync({ projectId });
    const expoToken = expoTokenObj?.data;

    if (expoToken) {
      console.log('✓ Successfully generated Expo Push Token:', expoToken);
      apiFetch('/notifications/tokens/', {
        method: 'POST',
        body: JSON.stringify({
          token: expoToken,
          platform: Platform.OS,
        }),
      }).catch(err => console.warn('Token sync warning:', err));
    }
    return expoToken;
  } catch (error) {
    console.warn('registerForPushNotifications warning:', error.message || error);
    return null;
  }
}

export const registerForPushNotifications = registerForPushNotificationsAsync;

export function setupNotificationListeners(onNotificationReceived, onNotificationResponse) {
  if (isExpoGo || !Notifications) {
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
