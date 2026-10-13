import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { randomUUID } from "node:crypto"
import { normalizeOemNumber, parsePartImportFile } from "@/lib/part-import"
import { normalizeAttributeValue, PRODUCT_GROUP_BY_KEY } from "@/lib/product-groups"
import { PART_SUBCATEGORIES } from "@/lib/constants"
import { checkLegal, legalRules } from "@/lib/product-legal"

export const dynamic = "force-dynamic"

const MAX_FILE_BYTES = 4 * 1024 * 1024
const MAX_PREVIEW_ROWS = 25
/** Потолок позиций одной загрузки. */
const MAX_APPLY_ROWS = 5_000
const intInRange = (value: unknown, min: number, max: number) => {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : null
}

async function requireStore(storeId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: NextResponse.json({ error: "Требуется вход" }, { status: 401 }) }

  const store = await prisma.partStore.findFirst({
    where: { id: storeId, ownerId: session.user.id },
    select: { id: true, name: true, defaultLeadTimeDaysMin: true, defaultLeadTimeDaysMax: true, defaultOriginCountry: true, city: true, sellerType: true },
  })
  if (!store) return { error: NextResponse.json({ error: "Магазин не найден" }, { status: 404 }) }
  return { store, userId: session.user.id }
}

/**
 * Разбирает прайс-лист и показывает результат до записи в каталог.
 *
 * Публикация — отдельный шаг: продавец сначала видит, что именно попадёт в
 * витрину и какие строки отклонены, и только потом подтверждает загрузку.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const guard = await requireStore(id)
  if (guard.error) return guard.error
  const { store } = guard

  const form = await request.formData().catch(() => null)
  const file = form?.get("file")
  if (!(file instanceof File)) return NextResponse.json({ error: "Прикрепите файл прайс-листа" }, { status: 400 })
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "Файл больше 4 МБ. Разделите прайс на части." }, { status: 413 })
  }

  /* Кодировка — по содержимому. Excel на русской Windows и 1С сохраняют
     CSV в Windows-1251; file.text() всегда читал UTF-8, заголовки
     превращались в «кракозябры», и сервер отвечал «не найдены колонки». */
  const buffer = await file.arrayBuffer()
  const utf8 = new TextDecoder("utf-8").decode(buffer)
  const content = utf8.includes("\uFFFD") ? new TextDecoder("windows-1251").decode(buffer) : utf8
  const parsed = parsePartImportFile(content)
  /* Закон — построчно. Маркируемый новый товар без штрихкода и группы,
     закрытые самозанятому, не публикуются: продавать их так нельзя.
     Отсутствие документа о соответствии строку не отсекает — сертификаты
     редко лежат в прайсе, — но продавец видит, сколько их не хватает. */
  let missingConformity = 0
  parsed.rows = parsed.rows.filter((row) => {
    const check = checkLegal(row.productGroup, {
      gtin: row.gtin, brandName: row.brandName, condition: row.condition,
      conformityType: row.conformityNumber ? "CERTIFICATE" : null, conformityNumber: row.conformityNumber,
    }, store.sellerType)
    const blocking = check.errors.productGroup || check.errors.gtin
    if (blocking) {
      parsed.errors.push({ line: row.line, reason: blocking, raw: row.name.slice(0, 160) })
      return false
    }
    if (row.condition !== "USED" && legalRules(row.productGroup).conformity && !row.conformityNumber) missingConformity += 1
    return true
  })
  if (!parsed.rows.length) {
    return NextResponse.json({
      error: "Не удалось прочитать ни одной позиции",
      errors: parsed.errors.slice(0, 20),
    }, { status: 422 })
  }

  const batch = await prisma.partImportBatch.create({
    data: {
      storeId: store.id,
      fileName: file.name.slice(0, 200),
      status: "PREVIEW",
      totalRows: parsed.totalRows,
      createdRows: 0,
      skippedRows: parsed.errors.length,
      errorReport: parsed.errors.length ? JSON.stringify(parsed.errors.slice(0, 200)) : null,
      rowsJson: JSON.stringify(parsed.rows.slice(0, MAX_APPLY_ROWS)),
    },
    select: { id: true },
  })

  return NextResponse.json({
    batchId: batch.id,
    totalRows: parsed.totalRows,
    readyRows: parsed.rows.length,
    skippedRows: parsed.errors.length,
    preview: parsed.rows.slice(0, MAX_PREVIEW_ROWS),
    errors: parsed.errors.slice(0, 20),
    missingConformity,
  })
}

/** Публикует разобранный прайс или откатывает уже применённую партию. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const guard = await requireStore(id)
  if (guard.error) return guard.error
  const { store, userId } = guard

  const body = await request.json().catch(() => null)
  const batchId = typeof body?.batchId === "string" ? body.batchId : ""
  const action = body?.action === "REVERT" ? "REVERT" : body?.action === "APPLY" ? "APPLY" : null
  if (!batchId || !action) return NextResponse.json({ error: "Некорректное действие" }, { status: 400 })

  const batch = await prisma.partImportBatch.findFirst({
    where: { id: batchId, storeId: store.id },
    select: { id: true, status: true, rowsJson: true },
  })
  if (!batch) return NextResponse.json({ error: "Загрузка не найдена" }, { status: 404 })

  if (action === "REVERT") {
    if (batch.status !== "APPLIED") {
      return NextResponse.json({ error: "Откатить можно только опубликованную загрузку" }, { status: 409 })
    }
    // Позиции партии удаляются целиком: именно ради этого партия хранится
    // отдельной сущностью, иначе продавцу пришлось бы чистить витрину вручную.
    const removed = await prisma.part.deleteMany({ where: { batchId: batch.id, storeId: store.id } })
    await prisma.partImportBatch.update({
      where: { id: batch.id },
      data: { status: "REVERTED", revertedAt: new Date() },
    })
    return NextResponse.json({ reverted: removed.count })
  }

  // Уже опубликованная партия — 409 до разбора строк: после публикации
  // они стёрты, и иначе ответом было бы «нет позиций».
  if (batch.status !== "PREVIEW") {
    return NextResponse.json({ error: "Эта загрузка уже обработана" }, { status: 409 })
  }

  /* Строки — из самой партии. Раньше публиковалось то, что прислал
     браузер, а он присылал 25 строк предпросмотра: из прайса на 800
     позиций в каталог попадало 25, остальные терялись молча. Старые
     партии без сохранённых строк публикуются по-прежнему из запроса. */
  let stored: unknown = null
  try { stored = batch.rowsJson ? JSON.parse(batch.rowsJson) : null } catch { stored = null }
  const rows = Array.isArray(stored) ? stored : Array.isArray(body?.rows) ? body.rows : null
  if (!rows?.length) return NextResponse.json({ error: "Нет позиций для публикации" }, { status: 400 })

  /* Захват партии одной записью: двойной клик или два запроса разом
     опубликовали бы прайс дважды. Второй запрос получит 409. */
  const claimed = await prisma.partImportBatch.updateMany({ where: { id: batch.id, status: "PREVIEW" }, data: { status: "APPLYING" } })
  if (claimed.count === 0) {
    return NextResponse.json({ error: "Эта загрузка уже обработана" }, { status: 409 })
  }

  const now = new Date()
  /* Характеристики пишутся отдельной таблицей, а createMany не создаёт
     связанные записи и не возвращает id — поэтому id позиций задаём сами. */
  const attributeRows: Array<{ partId: string; key: string; num: number | null; text: string | null }> = []
  const data = rows.slice(0, MAX_APPLY_ROWS).flatMap((row: Record<string, unknown>) => {
    const name = typeof row.name === "string" ? row.name.trim().slice(0, 200) : ""
    const price = Number(row.price)
    if (!name || !Number.isFinite(price) || price <= 0 || price > 100_000_000) return []
    const leadMin = intInRange(row.leadTimeDaysMin, 0, 365)
    const leadMax = intInRange(row.leadTimeDaysMax, 0, 365)
    const partType = typeof row.partType === "string" && row.partType ? row.partType.slice(0, 32) : "OTHER"
    const group = typeof row.productGroup === "string" ? PRODUCT_GROUP_BY_KEY.get(row.productGroup) ?? null : null
    const subcategory = typeof row.subcategory === "string" && (PART_SUBCATEGORIES[partType] || []).includes(row.subcategory) ? row.subcategory : null
    const id = randomUUID()
    /* Значения перепроверяются по справочнику: строки лежали в базе между
       предпросмотром и публикацией, доверять им как есть нельзя. */
    if (group && Array.isArray(row.attributes)) {
      for (const item of row.attributes as Array<Record<string, unknown>>) {
        const def = group.attributes.find((attribute) => attribute.key === item?.key)
        const raw = typeof item?.num === "number" ? item.num : typeof item?.text === "string" ? item.text : null
        const value = def && raw !== null ? normalizeAttributeValue(def, raw) : null
        if (value) attributeRows.push({ partId: id, ...value })
      }
    }

    return [{
      id,
      userId,
      storeId: store.id,
      batchId: batch.id,
      name,
      price: Math.round(price),
      description: typeof row.description === "string" ? row.description.slice(0, 1_000) : null,
      condition: row.condition === "USED" ? "USED" : "NEW",
      partType,
      subcategory,
      productGroup: group?.key ?? null,
      oemNumber: typeof row.oemNumber === "string" ? row.oemNumber.slice(0, 64) : null,
      brandName: typeof row.brandName === "string" ? row.brandName.slice(0, 80) : null,
      make: typeof row.make === "string" && row.make ? row.make.slice(0, 60) : "Универсальная",
      model: typeof row.model === "string" && row.model ? row.model.slice(0, 60) : "—",
      supplyMode: row.supplyMode === "STOCK" ? "STOCK" : "ORDER",
      // Срок магазина подставляется, когда в строке его не было: покупатель
      // должен видеть срок у каждой позиции под заказ.
      // Дробный срок ронял весь createMany (Int-поле): срок округляется и
      // ограничивается годом.
      leadTimeDaysMin: leadMin ?? store.defaultLeadTimeDaysMin,
      leadTimeDaysMax: leadMax ?? store.defaultLeadTimeDaysMax,
      originCountry: typeof row.originCountry === "string" && row.originCountry ? row.originCountry.slice(0, 40) : store.defaultOriginCountry,
      gtin: typeof row.gtin === "string" && /^\d{8,14}$/.test(row.gtin) ? row.gtin : null,
      warrantyMonths: intInRange(row.warrantyMonths, 0, 120),
      conformityNumber: typeof row.conformityNumber === "string" && row.conformityNumber ? row.conformityNumber.slice(0, 80) : null,
      conformityType: typeof row.conformityNumber === "string" && row.conformityNumber ? (/д/i.test(row.conformityNumber.slice(0, 12)) ? "DECLARATION" : "CERTIFICATE") : null,
      location: store.city || "Уточняется",
      vehicleType: "CAR",
      createdAt: now,
      updatedAt: now,
    }]
  })

  if (!data.length) {
    await prisma.partImportBatch.update({ where: { id: batch.id }, data: { status: "PREVIEW" } })
    return NextResponse.json({ error: "Все позиции отклонены проверкой" }, { status: 422 })
  }

  let created: { count: number }
  try {
    created = await prisma.part.createMany({ data })
  } catch (error) {
    /* Сбой записи — партия возвращается в предпросмотр, её можно
       опубликовать снова, а не «застрять» с частью позиций. */
    await prisma.part.deleteMany({ where: { batchId: batch.id, storeId: store.id } }).catch(() => undefined)
    await prisma.partImportBatch.update({ where: { id: batch.id }, data: { status: "PREVIEW" } }).catch(() => undefined)
    console.error("Part import apply failed", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "Не удалось опубликовать позиции. Попробуйте ещё раз." }, { status: 500 })
  }

  if (attributeRows.length) {
    await prisma.partAttribute.createMany({ data: attributeRows }).catch((error) => {
      console.warn("Part attributes were not saved", error instanceof Error ? error.message : error)
    })
  }

  // Аналоги пишутся отдельным проходом: createMany не создаёт связанные
  // записи, а без них номер-заменитель не находится поиском.
  const crossByOem = new Map<string, string[]>()
  for (const row of rows as Array<Record<string, unknown>>) {
    const oem = typeof row.oemNumber === "string" ? row.oemNumber : null
    const numbers = Array.isArray(row.crossNumbers) ? row.crossNumbers.filter((value): value is string => typeof value === "string") : []
    if (!oem || !numbers.length) continue
    crossByOem.set(oem, numbers)
  }

  if (crossByOem.size) {
    const savedParts = await prisma.part.findMany({
      where: { batchId: batch.id, oemNumber: { in: [...crossByOem.keys()] } },
      select: { id: true, oemNumber: true },
    })
    const crossRows = savedParts.flatMap((part) => {
      const numbers = part.oemNumber ? crossByOem.get(part.oemNumber) || [] : []
      return numbers.map((number) => ({
        partId: part.id,
        number: number.slice(0, 64),
        normalizedNumber: normalizeOemNumber(number).slice(0, 64),
      }))
    })
    if (crossRows.length) {
      // Дубли внутри партии игнорируются: уникальность пары уже задана схемой.
      await prisma.partCrossReference.createMany({ data: crossRows }).catch((error) => {
        console.warn("Part cross references were not saved", error instanceof Error ? error.message : error)
      })
    }
  }

  await prisma.partImportBatch.update({
    where: { id: batch.id },
    data: { status: "APPLIED", createdRows: created.count, appliedAt: now, rowsJson: null },
  })

  return NextResponse.json({ created: created.count })
}
