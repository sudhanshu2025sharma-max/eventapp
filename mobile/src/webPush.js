import { apiFetch } from './api';

let registration = null;
let publicKey = null;
let subscription = null;

export async function prepareWebPush() {
  if (!window.isSecureContext || !('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined') {
    return { state: 'unsupported' };
  }
  let timer;
  try {
    registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Notification setup timed out. Reload and try again.')), 10000); }),
    ]);
    const response = await apiFetch('/notifications/web-push/config/');
    if (!response.ok) return { state: 'unconfigured' };
    const config = await response.json();
    if (!config.public_key) return { state: 'unconfigured' };
    const encoded = config.public_key.replace(/-/g, '+').replace(/_/g, '/');
    publicKey = Uint8Array.from(atob(encoded + '='.repeat((4 - encoded.length % 4) % 4)), c => c.charCodeAt(0));
    subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const saved = await apiFetch('/notifications/web-push/subscribe/', {
        method: 'POST', body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
      if (!saved.ok) return { state: 'unconfigured' };
    }
    return { state: subscription ? 'subscribed' : Notification.permission === 'denied' ? 'denied' : 'unsubscribed' };
  } finally {
    clearTimeout(timer);
  }
}

export async function enableWebPush() {
  if (!registration || !publicKey) throw new Error('Notification setup is not ready. Please retry shortly.');
  // Keep the browser permission request in the original tap, before any network await.
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Without permission you will not receive notification alerts. Allow notifications in your browser or device settings.');
  const next = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: publicKey });
  try {
    const response = await apiFetch('/notifications/web-push/subscribe/', {
      method: 'POST', body: JSON.stringify({ subscription: next.toJSON() }),
    });
    if (!response.ok) throw new Error('Could not register this browser with the server. Please retry.');
    subscription = next;
    return { state: 'subscribed' };
  } catch (error) {
    await next.unsubscribe().catch(() => {});
    subscription = null;
    throw error;
  }
}

export async function disableWebPush() {
  const current = await registration?.pushManager.getSubscription();
  if (current) {
    const response = await apiFetch('/notifications/web-push/unsubscribe/', {
      method: 'POST', body: JSON.stringify({ endpoint: current.endpoint }),
    });
    if (!response.ok) throw new Error('Could not update notification settings.');
    await current.unsubscribe();
  }
  subscription = null;
  return { state: 'unsubscribed' };
}
