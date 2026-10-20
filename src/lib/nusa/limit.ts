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

export function resetSlots() {
  buckets.clear();
}
