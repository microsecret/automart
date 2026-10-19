/** The same manufacturer may arrive from different sources in different case. */
export function auctionMakeKey(make) {
  return make.trim().toLocaleLowerCase("en-US")
}

/**
 * Merge before limiting: otherwise a repeated spelling can displace a real brand
 * from the top eight. Retain the most common source spelling as the filter value.
 * @param {ReadonlyArray<{make: string, count: number}>} rows
 * @param {number} limit
 * @returns {Array<{make: string, count: number}>}
 */
export function groupAuctionMakes(rows, limit = 8) {
  const groups = new Map()
  for (const row of rows) {
    const key = auctionMakeKey(row.make)
    if (!key) continue
    const previous = groups.get(key)
    if (!previous) {
      groups.set(key, { make: row.make.trim(), count: row.count, largest: row.count })
    } else {
      previous.count += row.count
      if (row.count > previous.largest || (row.count === previous.largest && row.make < previous.make)) {
        previous.make = row.make.trim()
        previous.largest = row.count
      }
    }
  }
  return [...groups.values()]
    .sort((a, b) => b.count - a.count || a.make.localeCompare(b.make, "en"))
    .slice(0, limit)
    .map(({ make, count }) => ({ make, count }))
}
