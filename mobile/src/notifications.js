import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { apiFetch } from './api';

const EAS_PROJECT_ID = 'afa28d7e-10d5-4e85-bed4-783b7371a56b';

// Detect if running inside Expo Go
const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment?.StoreClient ||
  Constants.executionEnvironment === 'storeClient' ||
  Constants.appOwnership === 'expo';

let Notifications = null;

// ONLY load and initialize expo-notifications when NOT running in Expo Go
if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  } catch (e) {
    console.warn('Failed to load expo-notifications:', e);
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
    const receivedSub = Notifications.addNotificationReceivedListener(notification => {
      if (typeof onNotificationReceived === 'function') {
        onNotificationReceived(notification);
      }
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener(response => {
      if (typeof onNotificationResponse === 'function') {
        onNotificationResponse(response);
      }
    });

    return () => {
      try {
        receivedSub.remove();
        responseSub.remove();
      } catch (e) {}
    };
  } catch (e) {
    console.warn('setupNotificationListeners error:', e);
    return () => {};
  }
}

export async function sendLocalNotification(title, body, data = {}) {
  if (isExpoGo || !Notifications) return;
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
