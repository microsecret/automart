/**
 * Reads only an explicit drivetrain badge from source-confirmed model text.
 * `2WD` is deliberately ignored: on different platforms it may mean either
 * front- or rear-wheel drive, so guessing would corrupt the vehicle card.
 *
 * @param {unknown} value
 * @returns {"AWD" | "RWD" | "FWD" | null}
 */
export function deriveAuctionDriveTypeFromText(value) {
  if (typeof value !== "string") return null
  const normalized = value.toLocaleUpperCase().replace(/[‐‑–—]/g, "-")
  if (/(?:^|[^A-Z0-9])(?:AWD|4WD|4X4|4MATIC\+?|QUATTRO)(?=$|[^A-Z0-9])/.test(normalized)
    || /(?:^|[^A-Z0-9])XDRIVE(?=$|[^A-Z])/.test(normalized)) return "AWD"
  if (/(?:^|[^A-Z0-9])RWD(?=$|[^A-Z0-9])/.test(normalized)) return "RWD"
  if (/(?:^|[^A-Z0-9])FWD(?=$|[^A-Z0-9])/.test(normalized)) return "FWD"
  return null
}
