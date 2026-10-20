export { prepareWebPush as preparePushPermission, enableWebPush as enablePushPermission } from './webPush';
export async function openPushSettings() {
  throw new Error('Open this app in your device notification settings, or use your browser site settings, and allow notifications.');
}
