import { NextRequest, NextResponse } from "next/server"
import { PRODUCT_GROUP_BY_KEY } from "@/lib/product-groups"
import { legalRules } from "@/lib/product-legal"

export const dynamic = "force-dynamic"

/* Примеры строк: продавец видит, как записывать значения, — особенно
   полярность, вязкость и размер шин, где форма записи важна. */
const EXAMPLES: Readonly<Record<string, string>> = {
  battery: "Аккумулятор Varta Blue Dynamic 60 Ач обратная 540A;7200;560408054;Varta;;;Электрика;5;;4016987119495;Германия;24;;60;540;обратная;242;175;175",
  engine_oil: "Масло моторное ZIC X9 5W-40 4 л синтетическое;4100;162611;ZIC;;;Расходники;12;;8801234567893;Корея;0;ЕАЭС N RU Д-KR.АБ12.В.00001/26;5W-40;4;синтетическое",
  tires: "Шина Nokian Hakkapeliitta 10 205/55 R16 94T XL шип;9800;TS32856;Nokian;;;Колёса и диски;8;;6419440325681;Россия;12;ЕАЭС RU С-FI.АЯ46.В.00001/26;205;55;16;зимние;шипованные",
  brake_pads: "Колодки тормозные передние TRW GDB3425;2400;GDB3425;TRW;Toyota;Camry;Тормоза;4;3-5;;Германия;12;ЕАЭС RU С-DE.АБ12.В.00002/26;передняя",
}

const csvCell = (value: string) => (/[;"\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)

/**
 * Шаблон прайс-листа под товарную группу.
 *
 * Колонки — те, что понимает импорт: обязательные «Название» и «Цена»,
 * поля закона (штрихкод, страна, гарантия, сертификат) и характеристики
 * группы. CSV с разделителем «;» и BOM: Excel на русской Windows открывает
 * его без мастера импорта.
 */
export async function GET(request: NextRequest) {
  const groupKey = request.nextUrl.searchParams.get("group") || ""
  const group = PRODUCT_GROUP_BY_KEY.get(groupKey) ?? null
  const rules = legalRules(group?.key)

  const base = ["Название", "Цена", "Артикул", "Производитель", "Марка", "Модель", "Категория", "Кол-во", "Срок", "Штрих-код", "Страна", "Гарантия, мес", "Сертификат"]
  const attributeHeaders = (group?.attributes ?? []).map((def) => (def.unit && def.kind === "number" ? `${def.label}, ${def.unit}` : def.label))
  const header = [...base, ...attributeHeaders]
  const example = EXAMPLES[group?.key ?? ""] ?? "Фильтр масляный MANN W 712/75;650;W71275;MANN-FILTER;;;Расходники;10;2-4;4011558738204;Германия;12;"

  const note = [
    `# Шаблон прайса LeWheel${group ? ` — ${group.label}` : ""}. Строки с # при загрузке пропускаются — пример ниже можно не удалять.`,
    rules.marking === "required" ? "# Маркируемый товар: без штрих-кода строка не загрузится («Честный знак»)." : null,
    rules.conformity ? `# ${rules.conformity.regulation}: укажите номер сертификата или декларации в колонке «Сертификат».` : null,
  ].filter(Boolean) as string[]

  const body = "﻿" + [...note, header.map(csvCell).join(";"), `#пример: ${example}`].join("\r\n") + "\r\n"
  const fileName = `lewheel-price-${group?.key ?? "general"}.csv`
  return new NextResponse(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${fileName}"`,
      "cache-control": "public, max-age=3600",
    },
  })
}
