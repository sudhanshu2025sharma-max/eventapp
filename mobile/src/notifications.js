import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { apiFetch } from './api';

// Configures Expo SDK 54 notification handler with modern flags
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotificationsAsync() {
  let token;
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return null;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'General Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#1856FF',
      });
      await Notifications.setNotificationChannelAsync('chat', {
        name: 'Chat & Messages',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 100, 100, 100],
        lightColor: '#7C3AED',
      });
    }

    const expoTokenObj = await Notifications.getExpoPushTokenAsync();
    const expoToken = expoTokenObj.data;

    if (expoToken) {
      await apiFetch('/notifications/tokens/', {
        method: 'POST',
        body: JSON.stringify({
          token: expoToken,
          platform: Platform.OS,
        }),
      });
    }
    return expoToken;
  } catch (error) {
    console.log('Error registering for push notifications:', error);
    return null;
  }
}

// Alias to prevent "registerForPushNotifications is not a function" error
export const registerForPushNotifications = registerForPushNotificationsAsync;

export function setupNotificationListeners(onNotificationReceived, onNotificationResponse) {
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
}

export async function sendLocalNotification(title, body, data = {}) {
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
    console.log('Error sending local notification:', e);
  }
}
