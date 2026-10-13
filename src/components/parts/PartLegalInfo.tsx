import { IconBuildingStore, IconCertificate, IconRotateClockwise, IconShieldCheck } from "@tabler/icons-react"
import { CONFORMITY_LABEL, RETURN_POLICY_TEXT, countryLabel } from "@/lib/product-legal"

export type PartLegal = {
  brandName: string | null
  manufacturerInfo: string | null
  originCountry: string | null
  warrantyMonths: number | null
  shelfLife: string | null
  safetyInfo: string | null
  gtin: string | null
  conformityType: string | null
  conformityRegulation: string | null
  conformityNumber: string | null
  conformityValidUntil: string | null
  conformityUrl: string | null
  condition: string
}

export type SellerInfo = {
  name: string
  legalName: string | null
  inn: string | null
  ogrn: string | null
  legalAddress: string | null
  contactPhone: string | null
  sellerType: string | null
  verified: boolean
}

const months = (count: number) => {
  const lastTwo = count % 100
  const last = count % 10
  if (lastTwo >= 11 && lastTwo <= 14) return `${count} месяцев`
  if (last === 1) return `${count} месяц`
  if (last >= 2 && last <= 4) return `${count} месяца`
  return `${count} месяцев`
}

/**
 * Документы, гарантия, продавец и возврат — то, что покупатель обязан
 * видеть до покупки при продаже на расстоянии (ЗоЗПП ст. 9, 10, 26.1).
 * Пустые строки не выводятся: «Гарантия: —» читается как отказ в ней.
 */
export default function PartLegalInfo({ legal, seller }: { legal: PartLegal; seller: SellerInfo | null }) {
  const rows: Array<[string, React.ReactNode]> = []
  if (legal.condition === "USED") rows.push(["Состояние", "Бывший в употреблении — недостатки уточняйте у продавца"])
  if (legal.manufacturerInfo || legal.brandName) rows.push(["Изготовитель", legal.manufacturerInfo || legal.brandName])
  if (countryLabel(legal.originCountry)) rows.push(["Страна производства", countryLabel(legal.originCountry)])
  if (legal.warrantyMonths !== null) rows.push(["Гарантия продавца", legal.warrantyMonths > 0 ? months(legal.warrantyMonths) : "Не предоставляется — действует гарантия изготовителя"])
  if (legal.shelfLife) rows.push(["Срок годности", legal.shelfLife])
  if (legal.conformityType) {
    const valid = legal.conformityValidUntil ? ` · до ${new Date(legal.conformityValidUntil).toLocaleDateString("ru-RU")}` : ""
    rows.push([
      legal.conformityRegulation || "Соответствие",
      legal.conformityType === "NOT_REQUIRED"
        ? CONFORMITY_LABEL.NOT_REQUIRED
        : (
          <>
            {CONFORMITY_LABEL[legal.conformityType] ?? "Документ"}{legal.conformityNumber ? ` № ${legal.conformityNumber}` : ""}{valid}
            {legal.conformityUrl && <> · <a href={legal.conformityUrl} target="_blank" rel="noreferrer">в реестре ФСА</a></>}
          </>
        ),
    ])
  }
  if (legal.gtin) rows.push(["Штрихкод", legal.gtin])

  return (
    <div className="part-legal">
      {rows.length > 0 && (
        <section className="part-legal__block">
          <h3><IconCertificate size={18} /> Документы и гарантия</h3>
          <dl className="part-detail__specs">
            {rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl>
          {legal.safetyInfo && <p className="part-legal__note">{legal.safetyInfo}</p>}
        </section>
      )}

      {seller && (
        <section className="part-legal__block">
          <h3><IconBuildingStore size={18} /> Продавец</h3>
          <dl className="part-detail__specs">
            <div><dt>Магазин</dt><dd>{seller.name}</dd></div>
            {seller.legalName && <div><dt>{seller.sellerType === "SELF_EMPLOYED" ? "Самозанятый" : seller.sellerType === "ENTREPRENEUR" ? "ИП" : "Организация"}</dt><dd>{seller.legalName}</dd></div>}
            {seller.ogrn && <div><dt>{seller.ogrn.length === 15 ? "ОГРНИП" : "ОГРН"}</dt><dd>{seller.ogrn}</dd></div>}
            {seller.inn && <div><dt>ИНН</dt><dd>{seller.inn}</dd></div>}
            {seller.legalAddress && <div><dt>Адрес</dt><dd>{seller.legalAddress}</dd></div>}
          </dl>
          {seller.verified && (
            <p className="part-legal__verified"><IconShieldCheck size={16} /> Реквизиты проверены администрацией LeWheel</p>
          )}
        </section>
      )}

      <section className="part-legal__block">
        <h3><IconRotateClockwise size={18} /> Возврат</h3>
        <p className="part-legal__note">{RETURN_POLICY_TEXT}</p>
      </section>
    </div>
  )
}
