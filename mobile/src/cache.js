import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

// A short, account-scoped snapshot avoids a blank screen on quick revisits.
// Screens still request fresh data every time; nothing is persisted to disk here.
const screenSnapshots = new Map();
export function getScreenSnapshot(screen, userId) {
  if (!userId) return null;
  const key = `${userId}:${screen}`;
  const entry = screenSnapshots.get(key);
  if (!entry || Date.now() - entry.ts > 30000) {
    screenSnapshots.delete(key);
    return null;
  }
  return entry.data;
}
export function setScreenSnapshot(screen, userId, data) {
  if (userId) screenSnapshots.set(`${userId}:${screen}`, { data, ts: Date.now() });
}
export function clearScreenSnapshots() { screenSnapshots.clear(); }

export async function getCached(key) {
  try {
    const raw = await AsyncStorage.getItem(`cache_${key}`);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > DEFAULT_TTL) return null; // expired
    return data;
  } catch { return null; }
}

export async function setCache(key, data) {
  try {
    await AsyncStorage.setItem(`cache_${key}`, JSON.stringify({ data, ts: Date.now() }));
  } catch { /* silent */ }
}

export async function clearCache(key) {
  try {
    await AsyncStorage.removeItem(`cache_${key}`);
  } catch { /* silent */ }
}
