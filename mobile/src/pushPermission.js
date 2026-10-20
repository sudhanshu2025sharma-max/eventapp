import { getPushPermissionState, registerForPushNotifications, getPushRegistrationError, openNotificationSettings } from './notifications';

export async function preparePushPermission() {
  const state = await getPushPermissionState();
  if (state !== 'subscribed') return { state };
  const token = await registerForPushNotifications({ requestPermission: false });
  if (!token) return { state: 'registration_failed', error: getPushRegistrationError() || 'Could not register notifications. Check your connection and retry.' };
  return { state, token };
}

export async function enablePushPermission() {
  const token = await registerForPushNotifications();
  if (!token) throw new Error(getPushRegistrationError() || 'Without permission you will not receive notification alerts. You can allow them in device settings.');
  return { state: 'subscribed', token };
}

export const openPushSettings = openNotificationSettings;
