const buckets = new Map<string, number[]>();

export function takeSlot(key: string, limit = 20, windowMs = 60_000, now = Date.now()) {
  const fresh = (buckets.get(key) ?? []).filter((at) => at > now - windowMs);
  if (fresh.length >= limit) {
    buckets.set(key, fresh);
    return false;
  }
  fresh.push(now);
  buckets.set(key, fresh);
  return true;
}

/** Missing credentials do not consume a slot. The buckets themselves are process memory. */
export function reserveModelSlot(
  apiKey: string | undefined,
  key: string,
  limit = 20,
  windowMs = 60_000,
  now = Date.now(),
): apiKey is string {
  if (!apiKey) return false;
  return takeSlot(key, limit, windowMs, now);
}

export function resetSlots() {
  buckets.clear();
}
