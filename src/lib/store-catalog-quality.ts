import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { PRODUCT_GROUPS } from "@/lib/product-groups"
import { legalRules } from "@/lib/product-legal"

/**
 * Качество каталога магазина: чего не хватает позициям.
 *
 * Без фото карточка выглядит заглушкой, без группы товар не попадает в
 * фильтры, без документа о соответствии или штрихкода маркируемый товар
 * нельзя продавать по закону. Продавец видит счётчики и одним нажатием
 * открывает позиции с недостатком; администратор — ту же сводку при
 * проверке магазина.
 */

const CONFORMITY_GROUPS = PRODUCT_GROUPS.filter((group) => legalRules(group.key).conformity).map((group) => group.key)
const MARKING_GROUPS = PRODUCT_GROUPS.filter((group) => legalRules(group.key).marking === "required").map((group) => group.key)

export const CATALOG_ISSUES = {
  noPhoto: { label: "Без фото", where: { OR: [{ images: null }, { images: "" }, { images: "[]" }] } },
  noGroup: { label: "Без группы", where: { productGroup: null } },
  noBrand: { label: "Без производителя", where: { brandName: null } },
  missingDocs: {
    label: "Без сертификата или декларации",
    where: {
      productGroup: { in: CONFORMITY_GROUPS },
      condition: "NEW",
      OR: [{ conformityType: null }, { conformityType: "NOT_REQUIRED" }, { conformityNumber: null }],
    },
  },
  missingGtin: {
    label: "Маркируемые без штрихкода",
    where: { productGroup: { in: MARKING_GROUPS }, condition: "NEW", gtin: null },
  },
} satisfies Record<string, { label: string; where: Prisma.PartWhereInput }>

export type CatalogIssue = keyof typeof CATALOG_ISSUES

export function isCatalogIssue(value: string | null | undefined): value is CatalogIssue {
  return Boolean(value && value in CATALOG_ISSUES)
}

/** Счётчики недостатков; блокирующие продажу — отдельной пометкой. */
export async function storeCatalogQuality(storeId: string) {
  const entries = Object.entries(CATALOG_ISSUES) as Array<[CatalogIssue, (typeof CATALOG_ISSUES)[CatalogIssue]]>
  const [total, ...counts] = await Promise.all([
    prisma.part.count({ where: { storeId } }),
    ...entries.map(([, issue]) => prisma.part.count({ where: { AND: [{ storeId }, issue.where] } })),
  ])
  return {
    total,
    issues: entries.map(([key, issue], index) => ({
      key,
      label: issue.label,
      count: counts[index],
      /* Документы и штрихкод — требование закона; фото и группа — витрина. */
      blocking: key === "missingDocs" || key === "missingGtin",
    })),
  }
}
