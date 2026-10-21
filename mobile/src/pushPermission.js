import {
  registerForPushNotifications,
  getPushPermissionState,
  getPushRegistrationError,
  openNotificationSettings
} from './notifications';

export async function preparePushPermission() {
  try {
    const state = await getPushPermissionState();
    if (state === 'subscribed') {
      const token = await registerForPushNotifications();
      if (!token) {
        const err = getPushRegistrationError();
        return { state: 'registration_failed', error: err || 'Push token registration failed' };
      }
      return { state: 'subscribed', token };
    }
    return { state };
  } catch (error) {
    return { state: 'registration_failed', error: error.message };
  }
}

export async function enablePushPermission() {
  try {
    const token = await registerForPushNotifications();
    if (token) return { state: 'subscribed', token };
    const err = getPushRegistrationError();
    return { state: 'registration_failed', error: err || 'Failed to register for notifications' };
  } catch (error) {
    return { state: 'registration_failed', error: error.message };
  }
}

export async function openPushSettings() {
  await openNotificationSettings();
  return { state: 'unsubscribed' };
}
