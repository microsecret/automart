import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { normalizeOemNumber, parsePartImportFile } from "@/lib/part-import"

export const dynamic = "force-dynamic"

const MAX_FILE_BYTES = 4 * 1024 * 1024
const MAX_PREVIEW_ROWS = 25

async function requireStore(storeId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: NextResponse.json({ error: "Требуется вход" }, { status: 401 }) }

  const store = await prisma.partStore.findFirst({
    where: { id: storeId, ownerId: session.user.id },
    select: { id: true, name: true, defaultLeadTimeDaysMin: true, defaultLeadTimeDaysMax: true, defaultOriginCountry: true, city: true },
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

  const content = await file.text()
  const parsed = parsePartImportFile(content)
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
    select: { id: true, status: true },
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

  if (batch.status !== "PREVIEW") {
    return NextResponse.json({ error: "Эта загрузка уже обработана" }, { status: 409 })
  }

  const rows = Array.isArray(body?.rows) ? body.rows : null
  if (!rows?.length) return NextResponse.json({ error: "Нет позиций для публикации" }, { status: 400 })

  const now = new Date()
  const data = rows.slice(0, 5_000).flatMap((row: Record<string, unknown>) => {
    const name = typeof row.name === "string" ? row.name.trim().slice(0, 200) : ""
    const price = Number(row.price)
    if (!name || !Number.isFinite(price) || price <= 0) return []

    return [{
      userId,
      storeId: store.id,
      batchId: batch.id,
      name,
      price: Math.round(price),
      description: typeof row.description === "string" ? row.description.slice(0, 1_000) : null,
      condition: row.condition === "USED" ? "USED" : "NEW",
      partType: typeof row.partType === "string" ? row.partType : "OTHER",
      oemNumber: typeof row.oemNumber === "string" ? row.oemNumber.slice(0, 64) : null,
      brandName: typeof row.brandName === "string" ? row.brandName.slice(0, 80) : null,
      make: typeof row.make === "string" && row.make ? row.make.slice(0, 60) : "Универсальная",
      model: typeof row.model === "string" && row.model ? row.model.slice(0, 60) : "—",
      supplyMode: row.supplyMode === "STOCK" ? "STOCK" : "ORDER",
      // Срок магазина подставляется, когда в строке его не было: покупатель
      // должен видеть срок у каждой позиции под заказ.
      leadTimeDaysMin: Number.isFinite(Number(row.leadTimeDaysMin)) ? Number(row.leadTimeDaysMin) : store.defaultLeadTimeDaysMin,
      leadTimeDaysMax: Number.isFinite(Number(row.leadTimeDaysMax)) ? Number(row.leadTimeDaysMax) : store.defaultLeadTimeDaysMax,
      originCountry: store.defaultOriginCountry,
      location: store.city || "Уточняется",
      vehicleType: "CAR",
      createdAt: now,
      updatedAt: now,
    }]
  })

  if (!data.length) return NextResponse.json({ error: "Все позиции отклонены проверкой" }, { status: 422 })

  const created = await prisma.part.createMany({ data })

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
    data: { status: "APPLIED", createdRows: created.count, appliedAt: now },
  })

  return NextResponse.json({ created: created.count })
}
