import { slugify } from "@/lib/news"
import { PRODUCT_GROUPS, type ProductGroup } from "@/lib/product-groups"
import { legalRules } from "@/lib/product-legal"

/**
 * Адреса и тексты страниц товарных групп /avtotovary/<группа>.
 *
 * Поиск запчастей рисуется в браузере, и поисковик видит его пустым:
 * запрос «купить аккумулятор» вести было некуда. Эти страницы отвечают
 * сами — текстом о выборе, требованиями закона и товарами магазинов.
 */

export function groupSlug(group: ProductGroup) {
  return slugify(group.label) || group.key
}

export function groupBySlug(slug: string): ProductGroup | null {
  return PRODUCT_GROUPS.find((group) => groupSlug(group) === slug.toLowerCase()) ?? null
}

export function groupHref(group: ProductGroup) {
  return `/avtotovary/${groupSlug(group)}`
}

/** «Как выбрать»: какие характеристики сравнивать — из справочника группы. */
export function buyingGuide(group: ProductGroup): string | null {
  const keys = group.attributes.filter((def) => def.filter)
  if (!keys.length) return null
  const main = keys.filter((def) => def.summary).map((def) => def.label.toLocaleLowerCase("ru-RU"))
  const rest = keys.filter((def) => !def.summary).map((def) => def.label.toLocaleLowerCase("ru-RU"))
  return [
    main.length ? `Главное при выборе — ${main.join(", ")}.` : null,
    rest.length ? `Дальше сравнивают ${rest.join(", ")}.` : null,
    "Все эти параметры есть в фильтрах — выберите нужные значения, и в выдаче останутся только подходящие товары.",
  ].filter(Boolean).join(" ")
}

/** Что требует закон — коротко, для покупателя. */
export function legalNotes(group: ProductGroup): string[] {
  const rules = legalRules(group.key)
  const notes: string[] = []
  if (rules.marking === "required") notes.push("Товар подлежит обязательной маркировке «Честный знак»: у каждой единицы есть код, который можно проверить в приложении «Честный знак».")
  if (rules.conformity) {
    const required = rules.conformity.form === "certificate" ? "должен быть сертификат"
      : rules.conformity.form === "declaration" ? "должна быть декларация"
      : "должен быть сертификат или декларация"
    notes.push(`По техрегламенту ${rules.conformity.regulation} у нового товара ${required} о соответствии — магазин указывает номер в карточке, его можно проверить в реестре ФСА.`)
  }
  if (rules.note) notes.push(rules.note)
  return notes
}
