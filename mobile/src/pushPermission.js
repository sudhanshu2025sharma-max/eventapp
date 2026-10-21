import { registerForPushNotifications, getPushPermissionState, openNotificationSettings } from './notifications';

export async function preparePushPermission() {
  try {
    const state = await getPushPermissionState();
    if (state === 'subscribed') {
      const token = await registerForPushNotifications();
      return { state: 'subscribed', token };
    }
    return { state };
  } catch (error) {
    return { state: 'registration_failed', error: error.message };
  }
}

export async function enablePushPermission() {
  const token = await registerForPushNotifications();
  if (token) return { state: 'subscribed', token };
  return { state: 'unsubscribed' };
}

export async function openPushSettings() {
  await openNotificationSettings();
  return { state: 'unsubscribed' };
}
