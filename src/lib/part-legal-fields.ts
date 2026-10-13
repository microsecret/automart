import { checkLegal } from "@/lib/product-legal"

const text = (value: unknown, limit: number) => (typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, limit) || null : null)

/**
 * Сведения о товаре из формы продавца — только присланные поля, чтобы
 * правка цены не стирала документы.
 */
export function readLegalFields(body: Record<string, unknown> | null) {
  if (!body) return {}
  const data: Record<string, unknown> = {}
  if (body.gtin !== undefined) data.gtin = text(body.gtin, 20)?.replace(/\D/g, "") || null
  if (body.manufacturerInfo !== undefined) data.manufacturerInfo = text(body.manufacturerInfo, 300)
  if (body.warrantyMonths !== undefined) {
    const months = Number(body.warrantyMonths)
    data.warrantyMonths = body.warrantyMonths === "" || body.warrantyMonths === null || !Number.isFinite(months) ? null : Math.max(0, Math.min(120, Math.round(months)))
  }
  if (body.shelfLife !== undefined) data.shelfLife = text(body.shelfLife, 80)
  if (body.safetyInfo !== undefined) data.safetyInfo = text(body.safetyInfo, 1_000)
  if (body.originCountry !== undefined) data.originCountry = text(body.originCountry, 40)
  if (body.conformityType !== undefined) {
    data.conformityType = ["CERTIFICATE", "DECLARATION", "NOT_REQUIRED"].includes(String(body.conformityType)) ? String(body.conformityType) : null
  }
  if (body.conformityRegulation !== undefined) data.conformityRegulation = text(body.conformityRegulation, 60)
  if (body.conformityNumber !== undefined) data.conformityNumber = text(body.conformityNumber, 80)
  if (body.conformityValidUntil !== undefined) {
    const date = typeof body.conformityValidUntil === "string" && body.conformityValidUntil ? new Date(body.conformityValidUntil) : null
    data.conformityValidUntil = date && !Number.isNaN(date.getTime()) ? date : null
  }
  if (body.conformityUrl !== undefined) {
    /* Ссылка только на реестр ФСА: под видом «сертификата» в карточку не
       должна попасть произвольная страница. */
    const url = text(body.conformityUrl, 300)
    data.conformityUrl = url && /^https:\/\/pub\.fsa\.gov\.ru\//.test(url) ? url : null
  }
  return data
}

/** Проверка с учётом уже сохранённых значений позиции. */
export function validateLegal(
  group: string | null | undefined,
  merged: { gtin?: unknown; brandName?: unknown; originCountry?: unknown; conformityType?: unknown; conformityNumber?: unknown; condition?: unknown },
  sellerType: string | null | undefined,
) {
  const str = (value: unknown) => (typeof value === "string" ? value : null)
  return checkLegal(group, {
    gtin: str(merged.gtin),
    brandName: str(merged.brandName),
    originCountry: str(merged.originCountry),
    conformityType: str(merged.conformityType),
    conformityNumber: str(merged.conformityNumber),
    condition: str(merged.condition),
  }, sellerType)
}
