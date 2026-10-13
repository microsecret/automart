import { prisma } from "@/lib/prisma"
import { slugify } from "@/lib/news"

/**
 * Адрес витрины: уникальный и читаемый. Суффикс добавляется, только если
 * имя уже занято. Общий для создания магазина из кабинета и из анкеты /sell.
 */
export async function uniqueStoreSlug(name: string) {
  const baseSlug = slugify(name) || "store"
  let slug = baseSlug
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const taken = await prisma.partStore.findUnique({ where: { slug }, select: { id: true } })
    if (!taken) return slug
    slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`
  }
  return `${baseSlug}-${Date.now().toString(36)}`
}
