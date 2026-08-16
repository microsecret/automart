const HOUR_MS = 60 * 60 * 1_000

const DISCOVERY_COOLDOWN_HOURS: Readonly<Record<string, number>> = {
  ENCAR: 12,
  KCAR: 12,
  YOUXINPAI: 12,
  IAUTOS: 18,
  BOBAEDREAM: 12,
  GOONET: 24,
  BEFORWARD: 24,
  CARSENSOR: 24,
  CARVAGO: 24,
  AUTOSALE: 24,
}

const REFRESH_INTERVAL_HOURS: Readonly<Record<string, number>> = {
  ENCAR: 4,
  KCAR: 4,
  YOUXINPAI: 3,
  BOBAEDREAM: 4,
  IAUTOS: 6,
  GOONET: 12,
  BEFORWARD: 12,
  CARSENSOR: 12,
  CARVAGO: 12,
  AUTOSALE: 12,
}

function cutoffDate(hours: number, now = new Date()) {
  return new Date(now.getTime() - hours * HOUR_MS)
}

export function recentDiscoveryCutoff(source: string, now = new Date()) {
  return cutoffDate(DISCOVERY_COOLDOWN_HOURS[source] ?? 24, now)
}

export function refreshDueCutoff(source: string, now = new Date()) {
  return cutoffDate(REFRESH_INTERVAL_HOURS[source] ?? 12, now)
}

export function refreshIntervalHours(source: string) {
  return REFRESH_INTERVAL_HOURS[source] ?? 12
}
