/** Shared cover for either winner of the daily fuel campaign gate. */
export function fuelCampaignImage(): string | null {
  const configured = process.env.FUEL_INVITE_IMAGE?.trim()
  if (!configured) return null
  if (configured.startsWith("http")) return configured
  if (!configured.startsWith("/uploads/")) {
    console.warn("FUEL_INVITE_IMAGE должен указывать в /uploads — пост уйдёт текстом")
    return null
  }
  return configured
}
