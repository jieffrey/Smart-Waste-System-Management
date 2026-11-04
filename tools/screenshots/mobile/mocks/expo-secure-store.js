// SCREENSHOT MOCK ONLY (never in the app): SecureStore on web, backed by localStorage.
export async function getItemAsync(key) { return globalThis.localStorage?.getItem(key) ?? null; }
export async function setItemAsync(key, value) { globalThis.localStorage?.setItem(key, value); }
export async function deleteItemAsync(key) { globalThis.localStorage?.removeItem(key); }
