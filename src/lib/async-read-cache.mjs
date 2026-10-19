/**
 * Process-local read optimisation, NOT a distributed cache or a rate limiter.
 * Identical pending reads share work; failed reads are never retained.
 * ttlMs=0 shares pending work only and never reuses a completed result.
 * @param {{ttlMs: number, maxEntries?: number, now?: () => number}} options
 */
export function createAsyncReadCache({ ttlMs, maxEntries = 64, now = Date.now }) {
  if (!Number.isFinite(ttlMs) || ttlMs < 0 || !Number.isInteger(maxEntries) || maxEntries < 1) {
    throw new RangeError("Invalid async read cache limits")
  }
  /** @type {Map<string, {value: unknown, expiresAt: number}>} */
  const values = new Map()
  /** @type {Map<string, Promise<unknown>>} */
  const pending = new Map()

  /**
   * Keys within an instance must always represent the same result type.
   * @template T
   * @param {string} key
   * @param {() => Promise<T>} load
   * @returns {Promise<T>}
   */
  function get(key, load) {
    const hit = values.get(key)
    if (hit && now() < hit.expiresAt) {
      values.delete(key)
      values.set(key, hit)
      return Promise.resolve(/** @type {T} */ (hit.value))
    }
    if (hit) values.delete(key)
    const active = pending.get(key)
    if (active) return /** @type {Promise<T>} */ (active)

    // Bound bookkeeping under arbitrary public filter combinations. Do not
    // evict active work: its existing waiters must keep sharing that promise.
    if (pending.size >= maxEntries) return Promise.resolve().then(load)
    const work = Promise.resolve().then(load).then((value) => {
      if (ttlMs > 0) {
        if (values.size >= maxEntries) values.delete(values.keys().next().value)
        values.set(key, { value, expiresAt: now() + ttlMs })
      }
      return value
    }).finally(() => { pending.delete(key) })
    pending.set(key, work)
    return work
  }
  return { get }
}
