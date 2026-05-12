/**
 * Returns a stable device ID for this browser/tab session.
 * Generated once and stored in localStorage so it survives page refreshes
 * but is unique per browser (phone ≠ laptop ≠ tablet).
 */
export function getDeviceId(): string {
  const KEY = "exhiby_device_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(KEY, id);
  }
  return id;
}
